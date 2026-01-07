import { Room, Client } from "@colyseus/core";
import { RoomState } from "./schema/RoomState";
import { ColorArray, Person, Player } from "./schema/Player";
import { ServerError } from "colyseus";
import { getPlayerByID, getUserStats, hasAccess, submitReport } from "../network/database";
import jwt from "jsonwebtoken";
import { filterChatMessage, filterUsername, formatLog, getRequestIP } from "../util";
import { Data } from "../data";
import { ServerInstance } from "../server";
import { IncomingMessage } from "http";
import { cooldown, cooldownLeft } from "../cooldown";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

class ClientInfo {
    /**
     * the ip address of the client
     */
    public ip: string = null;
    /**
     * private network id of the client
     */
    public networkId: string = null;
    /**
     * hue of the profile
     */
    public hue: number = 250;
    /**
     * last time the player has pinged the room
     */
    public lastPing: number = 0;
    /**
     * last time the player has done something in a room
     * this seperate from ping so inactive players get kicked
     */
    public aliveTime: number = 0;
}

export class GameRoom extends Room<RoomState> {
    /**
     * the maximum amount of people that can join the room
     * this also counts spectators
     */
    maxClients = 6; // 6 or more is supported but expected graphical errors
    /**
     * a colyseus channel that holds all of the room ids 
     * this is so conflicts don't happen when creating a room with the same id
     */
    LOBBY_CHANNEL = "$lobbiesChannel"
    /**
     * a colyseus channel that holds the ip addresses of players
     * this is to prevent bots from joining and creating lobbies under the same ip
     */
    IPS_CHANNEL = "$IPSChannel"
    /**
     * secret hash of the current chart so the chart validation can't be faked
     */
    chartHash: string = null;
    /**
     * map that holds the private info of clients
     */
    clientsInfo: Map<string, ClientInfo> = new Map<string, ClientInfo>();
    /** 
     * holds all of the kicked or leaving clients
     */
    clientsRemoved: string[] = [];
    /**
     * the last time the room has requested ping from the clients
     */
    lastPingTime: number = null;
    /**
     * (TODO unused but working) if true, only players with a network account can join the room
     */
    networkOnly: boolean = false;

    dummies:Player[] = [];

    /**
     * used only for chat reporting
     */
    loggedMessages: ChatMessageDetails[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async onCreate(options: any) {
        this.roomId = await this.generateRoomId();
        await this.setPrivate();
        this.setState(new RoomState());
        this.autoDispose = true;

        if (process.env.DEBUG == "true")
            console.log("new room created: " + this.roomId);

        this.networkOnly = options.networkOnly;

        await this.setMetadata({ name: options.name, networkOnly: this.networkOnly });
        this.updateRoomMetaClients();

        this.onMessage("togglePrivate", async (client) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.isPrivate = !this.state.isPrivate;
                await this.setPrivate(this.state.isPrivate);
            }
            else {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("startGame", async (client) => {
            this.keepAliveClient(client);

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            if (requester.hasSong) {
                requester.isReady = !requester.isReady;
                for (const dummy of this.dummies) {
                    dummy.isReady = requester.isReady;
                    dummy.hasSong = requester.hasSong;
                }
            }

            const sideCount = [0, 0];
            for (const [_, player] of this.state.players) {
                if (!player.isReady || !player.hasSong)
                    return;

                sideCount[player.bfSide ? 1 : 0]++;
            }

            for (const count of sideCount) {
                if (count > this.maxClients / 2)
                    return;
            }

            for (const [_, player] of this.state.players) {
                player.score = 0;
                player.misses = 0;
                player.sicks = 0;
                player.goods = 0;
                player.bads = 0;
                player.shits = 0;
                player.songPoints = 0;
                player.hasLoaded = false;
                player.hasEnded = false;
                player.isReady = false;
            }

            await this.lock();
            this.state.isStarted = true;
            this.state.health = 1;
            this.broadcast("gameStarted", "", { afterNextPatch: true });
        });

        this.onMessage("addScore", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.NUMBER)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            if (this.state.isStarted) {
                requester.score += message;
            }
        });

        this.onMessage("addMiss", (client, _message) => {
            this.keepAliveClient(client);

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            if (this.state.isStarted) {
                requester.misses += 1;
            }
        });

        this.onMessage("addHitJudge", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.STRING)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            if (this.state.isStarted) {
                switch (message) {
                    case "sick":
                        requester.sicks += 1;
                        break; // java flashbacks
                    case "good":
                        requester.goods += 1;
                        break;
                    case "bad":
                        requester.bads += 1;
                        break;
                    case "shit":
                        requester.shits += 1;
                        break;
                }
            }
        });

        this.onMessage("setSong", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 6)) return;

            if (this.hasPerms(client)) {
                this.state.folder = message[0];
                this.state.song = message[1];
                this.state.diff = message[2];
                this.chartHash = message[3];
                this.state.modDir = message[4];
                this.state.modURL = message[5];
                this.state.diffList = message[6];

                for (const [sid, player] of this.state.players) {
                    player.isReady = false;
                    player.hasSong = sid == client.sessionId;
                }

                const requester = this.getStatePlayer(client);
                if (!requester)
                    return;

                this.broadcast("log", formatLog(requester.name + ' has picked song: "' + this.state.song + '"'));
                this.broadcast("checkChart", "", { afterNextPatch: true });
            }
            else {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("setStage", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;

            if (this.hasPerms(client)) {
                this.state.stageName = message[0];
                this.state.stageMod = message[1];
                this.state.stageURL = message[2];

                for (const [_, player] of this.state.players) {
                    player.isReady = false;
                }

                const requester = this.getStatePlayer(client);
                if (!requester)
                    return;

                this.broadcast("log", formatLog(requester.name + ' has picked stage: "' + this.state.stageName + '"'));
                this.broadcast("checkStage", "", { afterNextPatch: true });
            }
            else {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("verifyChart", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.STRING)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            requester.hasSong = this.chartHash == message;
        });

        this.onMessage("strumPlay", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;
            
            if (!this.getStatePlayer(client))
                return;

            this.broadcast("strumPlay", [client.sessionId, message], { except: client });
        });

        this.onMessage("charPlay", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 0)) return;
            
            if (!this.getStatePlayer(client))
                return;

            this.broadcast("charPlay", [client.sessionId, message], { except: client });
        });

        this.onMessage("playerReady", (client, _message) => {
            this.keepAliveClient(client);

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            if (requester.hasLoaded)
                return;

            this.broadcast("log", formatLog(requester.name + ' is ready!'));
            requester.hasLoaded = true;

            for (const dummy of this.dummies) {
                dummy.hasLoaded = true;
            }

            for (const [_, player] of this.state.players) {
                if (!player.hasLoaded)
                    return;
            }

            this.broadcast("startSong", "", { afterNextPatch: true });
        });

        this.onMessage("playerEnded", async (client, _message) => {
            this.keepAliveClient(client);

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            requester.hasEnded = true;

            for (const dummy of this.dummies) {
                dummy.hasEnded = true;
            }

            for (const [_, player] of this.state.players) {
                if (!player.hasEnded)
                    return;
            }

            await this.endSong();
        });

        this.onMessage("noteHit", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;

            if (!this.getStatePlayer(client))
                return;

            this.broadcast("noteHit", [client.sessionId, message], { except: client });

            if (this.playerSide(client)) {
                this.state.health -= 0.023;
            }
            else {
                this.state.health += 0.023;
            }

            if (this.state.health > 2)
                this.state.health = 2;
            else if (this.state.health < 0)
                this.state.health = 0;
        });

        this.onMessage("noteMiss", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;

            if (!this.getStatePlayer(client))
                return;

            this.broadcast("noteMiss", [client.sessionId, message], { except: client });

            if (this.playerSide(client)) {
                this.state.health += 0.0475;
            }
            else {
                this.state.health -= 0.0475;
            }

            if (this.state.health > 2)
                this.state.health = 2;
            else if (this.state.health < 0)
                this.state.health = 0;
        });

        this.onMessage("noteHold", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.BOOL)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            requester.noteHold = message;
        });

        this.onMessage("updateSongFP", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.NUMBER)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            requester.songPoints = message;
        });

        this.onMessage("updateMaxCombo", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.NUMBER)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            requester.maxCombo = message;
        });

        this.onMessage("chat", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.STRING)) return; // Fix crash issue from a null value.

            message = filterChatMessage(message);

            if (message.length >= 300) {
                client.send("log", formatLog("The message is too long!"));
                return;
            }
            if ((message as string).trim() == "") {
                return;
            }
            const requester = this.getStatePerson(client);
            if (!requester)
                return;

            const detals = new ChatMessageDetails();
            detals.content = requester.name + ": " + message;
            detals.client_info = this.clientsInfo.get(client.sessionId);
            this.loggedMessages.push(detals);

            this.broadcast("log", formatLog(detals.content, detals.client_info.hue));
        });

        this.onMessage("notifyInstall", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.STRING)) return; // Fix crash issue from a null value.

            const requester = this.getStatePerson(client);
            if (!requester)
                return;

            if (message.length >= 200) {
                this.broadcast("log", formatLog(requester.name + " has finished installing the mod!"));
                return;
            }
            this.broadcast("log", formatLog(requester.name + " has finished installing: " + message));
        });

        this.onMessage("swapSides", (client, _message) => {
            this.keepAliveClient(client);

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            requester.isReady = false;
            this.setPlayerSide(requester, !requester.bfSide);
        });

        this.onMessage("anarchyMode", (client, _message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.anarchyMode = !this.state.anarchyMode;
            }
            else {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("teamMode", (client, _message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.teamMode = !this.state.teamMode;
            }
            else {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("toggleGF", (client, _message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.hideGF = !this.state.hideGF;
            }
            else {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("toggleSkins", (client, _message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.disableSkins = !this.state.disableSkins;

                if (this.state.disableSkins) {
                    for (const [_, player] of this.state.players) {
                        player.skinMod = null;
                        player.skinName = null;
                        player.skinURL = null;
                    }
                }
                else {
                    this.broadcast("requestSkin", null, { afterNextPatch: true });
                }
            }
            else {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("nextWinCondition", (client, _message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                // 0 - accuracy
                // 1 - score
                // 2 - misses
                // 3 - points
                // 4 - (max) combo
                let newCond = this.state.winCondition + 1;
                if (newCond > 4) {
                    newCond = 0;
                }
                this.state.winCondition = Math.max(0, newCond);
            }
            else {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("pong", (client, _message) => {
            const daPing = Date.now() - this.lastPingTime;

            const requester = this.getStatePerson(client);
            if (!requester)
                return;

            requester.ping = daPing;
            if (this.isOwner(client)) {
                this.metadata.ping = daPing;
            }

            this.clientsInfo.get(client.sessionId).lastPing = Date.now();
        });

        this.onMessage("requestEndSong", async (client, _message) => {
            this.keepAliveClient(client);

            if (!this.getStatePlayer(client))
                return;

            //if (this.hasPerms(client)) {
            await this.endSong();
            // }
            // else {
            //   this.broadcast("log", this.getStatePlayer(client).name + " wants to end the song! (ESC)");
            // }
        });

        this.onMessage("setGameplaySetting", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 1)) return;

            if (!this.updateGameplaySetting(client, message[0], message[1])) {
                client.send('alert', 'You don\'t have a permission to do that.')
            }
        });

        this.onMessage("setSkin", (client, message) => {
            if (this.state.disableSkins || !this.getStatePlayer(client)) {
                return;
            }

            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) {
                this.getStatePlayer(client).skinMod = null;
                this.getStatePlayer(client).skinName = null;
                this.getStatePlayer(client).skinURL = null;
                return;
            }

            this.getStatePlayer(client).skinMod = message[0];
            this.getStatePlayer(client).skinName = message[1];
            this.getStatePlayer(client).skinURL = message[2];
        });

        this.onMessage("updateFP", async (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.NUMBER)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;
            
            const user = requester.verified && process.env["DATABASE_URL"] ? await getPlayerByID(this.clientsInfo.get(client.sessionId).networkId) : null;
            if (user) {
                const stats = await getUserStats(this.clientsInfo.get(client.sessionId).networkId);
                this.setPlayerPoints(requester, stats.points4k);
                requester.name = user.name;
            }
            else {
                this.setPlayerPoints(requester, message);
            }

            if (this.isOwner(client))
                this.metadata.points = requester.points;
        });

        this.onMessage("status", (client, message) => {
            if (this.checkInvalid(message, VerifyTypes.STRING) || message.length >= 30) return;

            const requester = this.getStatePerson(client);
            if (!requester)
                return;

            requester.status = message;
        });

        this.onMessage("botplay", (client, _) => {
            this.keepAliveClient(client);

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            requester.botplay = true;
        });

        this.onMessage("updateArrColors", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 1)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            this.updateArrowColors(requester, message);
        });

        this.onMessage("updateNoteSkinData", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;

            const requester = this.getStatePlayer(client);
            if (!requester)
                return;

            requester.noteSkin = message[0];
            requester.noteSkinMod = message[1];
            requester.noteSkinURL = message[2];
        });

        this.onMessage("command", async (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 0)) return;

            const requester = this.getStatePerson(client);
            if (!requester)
                return;

            switch (message[0]) {
                case "roll":
                    this.broadcast("log", formatLog("> " + requester.name + " has rolled " + Math.floor(Math.random() * 6 + 1)));
                    break;
                case "kick":
                    if (!this.isOwner(client)) {
                        client.send("log", formatLog("> Just leave the game bro"));
                        return;
                    }

                    let kickCount = 0;
                    for (const cl of this.clients) {
                        const clPerson = this.getStatePerson(cl);
                        if (!clPerson)
                            continue;

                        const usrArr = (message as string[]).slice();
                        usrArr.shift();
                        const username = usrArr.join(' ').toLowerCase();
                        
                        if (!this.isOwner(cl) && (username ? clPerson.name.toLowerCase() == username : true)) {
                            await this.removePlayer(cl);
                            kickCount++;
                        }
                    }
                    client.send("log", formatLog("> Kicked " + kickCount + " people"));
                    break;
                case "report":
                    switch (message[1]) {
                        case 'chat': {
                            const clientInfo = this.clientsInfo.get(client.sessionId);
                            if (!cooldown(clientInfo.ip, 'command.report')) {
                                client.send("log", formatLog("> Try again in " + cooldownLeft(['command.report', clientInfo.ip]) + "s!"));
                                return;
                            }

                            await submitReport(clientInfo.networkId ?? clientInfo.ip, JSON.stringify({
                                roomId: this.roomId,
                                messages: this.loggedMessages
                            }));
                            this.loggedMessages = [];
                            client.send("log", formatLog("> Report Submitted!"));
                            break;
                        }
                        default: {
                            client.send("log", formatLog("> Reports X to the moderation team.\nUse '/report chat' to report all messages from this room."));
                        }
                    }
                    break;
                case "help":
                    client.send("log", formatLog("> Global Commands: /roll, /kick <name>, /report"));
                    break;
                default:
                    client.send("log", formatLog("> Unknown command; try /help to see the command list!"));
                    break;
            }
        });

        this.onMessage("custom", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 1)) return;

            if (!this.getStatePlayer(client))
                return;

            this.broadcast("custom", [client.sessionId, message], { except: client });
        });

        this.onMessage("customTo", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;

            if (!this.getStatePlayer(client))
                return;

            const to = (message as Array<any>).shift();
            for (const client of this.clients) {
                if (client.sessionId == to) {
                    client.send('custom', [client.sessionId, message]);
                    break;
                }
            }
        });

        this.clock.setInterval(() => {
            this.lastPingTime = Date.now();
            this.broadcast("ping");
        }, 1000 * 3); //every 3 seconds

        this.clock.setInterval(async () => {
            if (this.clients.length < 1 || !this.metadata.ping) {
                await this.destroy();
            }

            for (const [clientSusID, info] of this.clientsInfo) {
                if (Date.now() - info.lastPing > 1000 * 60) { // if the player wasnt responding for 60 seconds
                    if (process.env.DEBUG == "true")
                        console.log(clientSusID + " wasn't pinging on " + this.roomId + "! kicking... ");

                    const kiclient = this.clients.getById(clientSusID);
                    if (kiclient)
                        await this.removePlayer(kiclient);
                }

                if (Date.now() - info.aliveTime > 1000 * 60 * 20) { // if the player wasnt active for 20 minutes
                    if (process.env.DEBUG == "true")
                        console.log(clientSusID + " wasn't active on " + this.roomId + "! kicking... ");

                    const kiclient = this.clients.getById(clientSusID);
                    if (kiclient)
                        await this.removePlayer(kiclient);
                }
            }
        }, 1000 * 60); //every minute
    }

    async endSong() {
        for (const [_, player] of this.state.players) {
            player.isReady = false;
            player.botplay = false;
        }

        await this.unlock();
        this.state.isStarted = false;

        this.broadcast("endSong", "", { afterNextPatch: true });
    }

    //why does this function exist
    async onAuth(client: Client, options: any, request: IncomingMessage) {
        const latestVersion = ServerInstance.PROTOCOL_VERSION;
        if (options == null || options.name == null || (options.name + "").trim().length < 3) {
            throw new ServerError(5000, "Too short name!"); // too short name error
        }
        else if (filterUsername(options.name) != options.name) {
            throw new ServerError(5004, "Username contains invalid characters!");
        }
        else if (latestVersion != options.protocol) {
            throw new ServerError(5003, "This client version is not supported on this server!\n\nYour protocol version: '" + options.protocol + "' latest: '" + latestVersion + "'");
        }
        else if (options.name.length > 14) {
            throw new ServerError(5001, "Too long name!");
        }

        if (!await this.isClientAllowed(request)) {
            throw new ServerError(5002, "Can't join/create 4 servers on the same IP!");
        }

        const playerIp = getRequestIP(request);
        try {
            const ipInfo = await (await fetch("http://ip-api.com/json/" + encodeURIComponent(playerIp))).json();
            if (process.env["NETWORK_ENABLED"] == "true" && ipInfo.country) {
                if (!Data.INFO.COUNTRY_PLAYERS.hasOwnProperty(ipInfo.country))
                    Data.INFO.COUNTRY_PLAYERS[ipInfo.country] = [];

                if (!Data.INFO.COUNTRY_PLAYERS[ipInfo.country].includes(playerIp))
                    Data.INFO.COUNTRY_PLAYERS[ipInfo.country].push(playerIp);
            }
        }
        catch (exc) {
            console.log(playerIp);
            console.error(exc);
        }

        this.clientsInfo.set(client.sessionId, new ClientInfo());
        this.clientsInfo.get(client.sessionId).ip = playerIp;

        return true;
    }

    async onJoin(client: Client, options: any) {
        if (!this.state.host)
            this.state.host = client.sessionId;

        this.clientsInfo.get(client.sessionId).lastPing = Date.now();
        this.keepAliveClient(client);

        let playerName = options.name;
        let playerPoints = options.points;
        let isVerified = false;
        let player = null;
        let playerStats = null;
        if (process.env["DATABASE_URL"]) {
            player = await getPlayerByID(options.networkId);
            playerStats = await getUserStats(options.networkId);
        }
        if (options.networkId && options.networkToken && player) {
            if (!hasAccess(player, 'room.auth')) {
                client.error(418, "get fucked lmao");
                await this.removePlayer(client);
                return;
            }

            // await does work here, for some reason typescript counts it as "no effect"?
            await jwt.verify(options.networkToken, player.secret as string, async (err: any, _user: any) => {
                if (err) {
                    client.error(401, "Couldn't authorize to the network!");
                    await this.removePlayer(client);
                    return;
                }

                isVerified = true;
                this.clientsInfo.get(client.sessionId).networkId = options.networkId;
                this.clientsInfo.get(client.sessionId).hue = player.profileHue ?? 250;
                Data.INFO.MAP_USERNAME_PLAYINGROOM.set(player.name, this);
                playerName = player.name;
                playerPoints = playerStats.points4k;
            })
        }

        if (!isVerified && this.networkOnly) {
            client.error(400, "Only Registered Network players can join!");
            await this.removePlayer(client);
            return;
        }

        if (this.clients.length == 1) {
            this.metadata.points = playerPoints;
            this.metadata.verified = isVerified;

            // let dummy = new Player();
            // //dummy.i = this.totalClientsJoined++;
            // dummy.name = 'Test 1';
            // this.dummies.push(dummy);
            // this.state.players.set(dummy.name, dummy);
            // this.setPlayerSide(dummy, false);

            // dummy = new Player();
            // //dummy.i = this.totalClientsJoined++;
            // dummy.name = 'Test 2';
            // this.dummies.push(dummy);
            // this.state.players.set(dummy.name, dummy);
            // this.setPlayerSide(dummy, true);

            // this.state.folder = 'dad-battle';
            // this.state.song = 'dad-battle-nightmare';
            // this.state.diff = 4;
            // this.chartHash = 'c6e45da60216fb63e070fdcf1181ab97';
            // this.state.modDir = '';
            // this.state.modURL = null;
            // this.state.diffList = ['Easy', 'Normal', 'Hard', 'Erect', 'Nightmare'];

            // dummy = new Player();
            // dummy.name = 'Test 3';
            // this.setPlayerSide(dummy, true);
            // this.dummies.push(dummy);
            // this.state.players.set(dummy.name, dummy);

            // dummy = new Player();
            // dummy.name = 'Test 4';
            // this.setPlayerSide(dummy, false);
            // this.dummies.push(dummy);
            // this.state.players.set(dummy.name, dummy);

            // dummy = new Player();
            // dummy.name = 'Test 5';
            // this.setPlayerSide(dummy, true);
            // this.dummies.push(dummy);
            // this.state.players.set(dummy.name, dummy);
        }

        if (process.env.DEBUG == "true")
            console.log(client.sessionId + " has joined on " + this.roomId);

        const requester = new Player();
        //requester.i = this.totalClientsJoined++;
        // if (this.state.player1.name == playerName) {
        //     playerName += "(2)";
        // }
        requester.name = playerName;
        if (!this.state.disableSkins) {
            requester.skinMod = options.skinMod;
            requester.skinName = options.skinName;
            requester.skinURL = options.skinURL;
        }
        this.setPlayerPoints(requester, playerPoints);
        requester.verified = isVerified;

        this.updateArrowColors(requester, options.arrowRGB);
        requester.noteSkin = options.noteSkin;
        requester.noteSkinMod = options.noteSkinMod;
        requester.noteSkinURL = options.noteSkinURL;

        const sideCount = [0, 0];
        for (const [_, player] of this.state.players) {
            sideCount[player.bfSide ? 1 : 0]++;
        }
        this.state.players.set(client.sessionId, requester);

        if (options.gameplaySettings) {
            for (const key in options.gameplaySettings) {
                const value = options.gameplaySettings[key];
                this.updateGameplaySetting(client, key, value);
            }
        }

        this.setPlayerSide(requester, sideCount[0] > sideCount[1]);

        this.broadcast("log", formatLog(this.getStatePlayer(client).name + " has joined the room!"), { afterNextPatch: true });

        client.send("checkChart", "", { afterNextPatch: true });

        this.clock.setTimeout(() => {
            if (client != null)
                client.send("checkChart", "", { afterNextPatch: true });
        }, 1000);

        this.updateRoomMetaClients();
    }

    updateRoomMetaClients() {
        this.metadata.clients = this.clients.length;
        this.metadata.maxClients = this.maxClients;
    }

    async onLeave(client: Client, consented: boolean) {
        if (process.env.DEBUG == "true")
            console.log(client.sessionId + " has left " + this.roomId + " " + (consented ? 'with consent' : 'without consent'));

        try {
            if (process.env.DEBUG == "true")
                console.log(client.sessionId + " is " + (!consented && !this.clientsRemoved.includes(client.sessionId) ? 'allowed ' : 'not allowed') + " to reconnect with token " + client._reconnectionToken + " " + this.roomId);

            await this.allowReconnection(client, !consented && !this.clientsRemoved.includes(client.sessionId) ? 20 : 0);
            if (process.env.DEBUG == "true")
                console.log(client.sessionId + " has reconnected on " + this.roomId);
        }
        catch (err) {
            if (process.env.DEBUG == "true") {
                console.log(client.sessionId + " has failed to reconnect on " + this.roomId);
                console.error(err);
            }

            await this.removePlayer(client);
            delete this.clientsRemoved[this.clientsRemoved.indexOf(client.sessionId)];
        }

        this.updateRoomMetaClients();
    }

    async removePlayer(client: Client) {
        // if (this.state.isStarted) {
        //     await this.endSong();
        // }
        if (!this.state.isStarted) {
            for (const [_, player] of this.state.players) {
                player.isReady = false;
            }
        }

        this.broadcast("log", formatLog(this.getStatePlayer(client).name + " has left the room!"));

        Data.INFO.MAP_USERNAME_PLAYINGROOM.delete(this.getStatePlayer(client).name);
        this.presence.hset(this.IPS_CHANNEL, this.clientsInfo.get(client.sessionId).ip, ((Number.parseInt(await this.presence.hget(this.IPS_CHANNEL, this.clientsInfo.get(client.sessionId).ip)) - 1) + ""));
        this.clientsInfo.delete(client.sessionId);
        this.clientsRemoved.push(client.sessionId);
        this.clients.delete(client);
        this.state.players.delete(client.sessionId);
        this.updateSides();
        client.leave();

        if (this.clients.length < 1)
            await this.destroy();
        else if (this.isOwner(client))
            for (const [sid, _] of this.state.players) {
                this.state.host = sid;
                break;
            }

        // if (this.clients.length < this.maxClients) {
        //     this.unlock();
        // }

        this.updateRoomMetaClients();
    }

    async onDispose() {
        if (process.env.DEBUG == "true")
            console.log("room has been disposed: " + this.roomId);

        for (const [username, room] of Data.INFO.MAP_USERNAME_PLAYINGROOM) {
            if (room == this) {
                Data.INFO.MAP_USERNAME_PLAYINGROOM.delete(username);
            }
        }
        await this.destroy(true);
        this.presence.srem(this.LOBBY_CHANNEL, this.roomId);
    }

    async destroy(ing?: boolean) {
        for (const client of this.clients) {
            await this.removePlayer(client);
        }
        if (!ing) {
            await this.disconnect();
        }
    }

    keepAliveClient(client: Client) {
        if (!this.clientsInfo.has(client.sessionId))
            return;
        this.clientsInfo.get(client.sessionId).aliveTime = Date.now();
    }

    hasPerms(client: Client) {
        return this.isOwner(client) || this.state.anarchyMode;
    }

    isOwner(client: Client) {
        return client.sessionId == this.state.host;
    }

    playerSide(client: Client) {
        return !this.getStatePlayer(client).bfSide;
    }

    setPlayerSide(player: Player, v:boolean) {
        player.bfSide = v;
        this.updateSides();
    }

    updateSides() {
        const sideCount = [0, 0];
        for (const [_, player] of this.state.players) {
            player.ox = sideCount[player.bfSide ? 1 : 0]++;
        }
        return sideCount;
    }

    getStatePlayer(client: Client): Player {
        return this.state.players.get(client.sessionId);
    }

    getStatePerson(client: Client): Person {
        return this.state.players.get(client.sessionId) ?? this.state.spectators.get(client.sessionId);
    }

    checkInvalid(v: any, type: VerifyTypes, indexes?: number) {
        if (v == null) return true;
        switch (type) {
            case VerifyTypes.NUMBER:
                return !Number.isFinite(v);
            case VerifyTypes.STRING:
                return typeof v !== 'string';
            case VerifyTypes.ARRAY:
                if (!indexes) indexes = 0;
                return !Array.isArray(v) || v.length < indexes + 1;
            case VerifyTypes.BOOL:
                return typeof v !== "boolean";
        }
        return false;
    }

    // Generate a single 4 capital letter room ID.
    generateRoomIdSingle(): string {
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
        }
        return result;
    }

    setPlayerPoints(player: any, v: number): void {
        if (this.checkInvalid(v, VerifyTypes.NUMBER)) return;
        player.points = v;
    }
    
    updateArrowColors(player: Player, message: Array<any>) {
        for (const [i, _maniaColors] of message.entries()) {
            const maniaColors: Map<string, Array<Array<number>>> = new Map(Object.entries(_maniaColors));

            for (const [mania, colors2D] of maniaColors) {
                const colors1D = new ColorArray();
                for (const colors of colors2D) {
                    colors1D.value.push(...colors);
                }
                (i == 0 ? player.arrowColors : player.arrowColorsPixel)
                    .set(mania, colors1D);
            }
        }
    }

    updateGameplaySetting(client: Client, key: string, value: any) {
        const requester = this.getStatePlayer(client);
        if (!requester)
            return false;

        requester.gameplaySettings.set(key, value.toString());

        if (key == "instakill" || key == "practice" || key == "opponentplay") {
            return false;
        }

        if (this.hasPerms(client)) {
            this.state.gameplaySettings.set(key, value.toString());
            return true;
        }
        return false;
    }

    // 1. Get room IDs already registered with the Presence API.
    // 2. Generate room IDs until you generate one that is not already used.
    // 3. Register the new room ID with the Presence API.
    async generateRoomId(): Promise<string> {
        const currentIds = await this.presence.smembers(this.LOBBY_CHANNEL);
        let id;
        do {
            id = this.generateRoomIdSingle();
        } while (currentIds.includes(id));

        await this.presence.sadd(this.LOBBY_CHANNEL, id);
        return id;
    }

    async isClientAllowed(request: IncomingMessage): Promise<boolean> {
        if (process.env.DISABLE_IP_LOCK == "true") {
            return true;
        }

        const requesterIP = getRequestIP(request);

        const currentIps = await this.presence.hget(this.IPS_CHANNEL, requesterIP);
        const ipOccurs = !currentIps ? 0 : Number.parseInt(currentIps);
        if (ipOccurs < 4) {
            await this.presence.hset(this.IPS_CHANNEL, requesterIP, (ipOccurs + 1) + "");
            return true;
        }
        return false;
    }
}

enum VerifyTypes {
    NUMBER,
    STRING,
    ARRAY,
    BOOL,
}

class ChatMessageDetails {
    public content: string = undefined;
    public client_info: ClientInfo = undefined;
}