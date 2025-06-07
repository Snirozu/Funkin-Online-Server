import { Room, Client } from "@colyseus/core";
import { RoomState } from "./schema/RoomState";
import { Player } from "./schema/Player";
import { IncomingMessage } from "http";
import { ServerError } from "colyseus";
import { MapSchema } from "@colyseus/schema";
import { getPlayerByID, hasAccess } from "../network";
import jwt from "jsonwebtoken";
import { filterUsername, formatLog } from "../util";
import { Data } from "../Data";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

class ClientInfo {
    public ip: string = null;
    public networkId: string = null;
    public hue: number = 250;
    public lastPing: number = 0;
    public aliveTime: number = 0;
}

export class GameRoom extends Room<RoomState> {
    maxClients = 2;
    LOBBY_CHANNEL = "$lobbiesChannel"
    IPS_CHANNEL = "$IPSChannel"
    chartHash: string = null;
    clientsInfo: Map<string, ClientInfo> = new Map<string, ClientInfo>();
    clientsRemoved: string[] = [];
    ownerUUID: string = null;
    lastPingTime: number = null;
    networkOnly: boolean = false;

    keepAliveClient(client: Client) {
        this.clientsInfo.get(client.sessionId).aliveTime = Date.now();
    }

    async onCreate(options: any) {
        this.roomId = await this.generateRoomId();
        this.setPrivate();
        this.setState(new RoomState());
        this.autoDispose = true;

        if (process.env.DEBUG == "true")
            console.log("new room created: " + this.roomId);

        var daGameplaySettings = options.gameplaySettings;
        if (daGameplaySettings) {
            for (const key in daGameplaySettings) {
                const value = daGameplaySettings[key].toString();
                if (key == "instakill" || key == "practice" || key == "opponentplay") {
                    continue;
                }
                this.state.gameplaySettings.set(key, value);
            }
        }

        this.networkOnly = options.networkOnly;

        this.setMetadata({ name: options.name, networkOnly: this.networkOnly });

        this.onMessage("togglePrivate", (client, message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.isPrivate = !this.state.isPrivate;
                this.setPrivate(this.state.isPrivate);
            }
        });

        this.onMessage("startGame", (client, message) => {
            this.keepAliveClient(client);

            if (this.isOwner(client) && this.state.player1.hasSong) {
                this.state.player1.isReady = !this.state.player1.isReady;
            }
            else if (!this.isOwner(client) && this.state.player2.hasSong) {
                this.state.player2.isReady = !this.state.player2.isReady;
            }

            //if (this.clients.length >= 2 && this.hasPerms(client) && this.state.player1.hasSong && this.state.player2.hasSong) {
            if (this.state.player1.isReady && this.state.player2.isReady && this.state.player1.hasSong && this.state.player2.hasSong) {
                this.state.isStarted = true;

                this.state.player1.score = 0;
                this.state.player1.misses = 0;
                this.state.player1.sicks = 0;
                this.state.player1.goods = 0;
                this.state.player1.bads = 0;
                this.state.player1.shits = 0;
                this.state.player1.songPoints = 0;
                this.state.player1.hasLoaded = false;
                this.state.player1.hasEnded = false;
                this.state.player1.isReady = false;

                this.state.player2.score = 0;
                this.state.player2.misses = 0;
                this.state.player2.sicks = 0;
                this.state.player2.goods = 0;
                this.state.player2.bads = 0;
                this.state.player2.shits = 0;
                this.state.player2.songPoints = 0;
                this.state.player2.hasLoaded = false;
                this.state.player2.hasEnded = false;
                this.state.player2.isReady = false;

                this.state.health = 1;

                this.broadcast("gameStarted", "", { afterNextPatch: true });
            }
        });

        this.onMessage("addScore", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.NUMBER)) return;
            if (this.state.isStarted) {
                this.getStatePlayer(client).score += message;
            }
        });

        this.onMessage("addMiss", (client, message) => {
            this.keepAliveClient(client);

            if (this.state.isStarted) {
                this.getStatePlayer(client).misses += 1;
            }
        });

        this.onMessage("addHitJudge", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.STRING)) return;
            if (this.state.isStarted) {
                switch (message) {
                    case "sick":
                        this.getStatePlayer(client).sicks += 1;
                        break; // java flashbacks
                    case "good":
                        this.getStatePlayer(client).goods += 1;
                        break;
                    case "bad":
                        this.getStatePlayer(client).bads += 1;
                        break;
                    case "shit":
                        this.getStatePlayer(client).shits += 1;
                        break;
                }
            }
        });

        this.onMessage("setFSD", (client, message) => {
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

                this.state.player1.isReady = false;
                this.state.player2.isReady = false;

                this.state.player1.hasSong = this.isOwner(client);
                this.state.player2.hasSong = !this.isOwner(client);

                this.broadcast("checkChart", "", { afterNextPatch: true });
            }
        });

        this.onMessage("setStage", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;
            if (this.hasPerms(client)) {
                this.state.stageName = message[0];
                this.state.stageMod = message[1];
                this.state.stageURL = message[2];

                this.state.player1.isReady = false;
                this.state.player2.isReady = false;

                this.broadcast("checkStage", "", { afterNextPatch: true });
            }
        });

        this.onMessage("verifyChart", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.STRING)) return;
            if (!this.isOwner(client)) {
                this.state.player2.hasSong = this.chartHash == message;
            }
            else {
                this.state.player1.hasSong = this.chartHash == message;
            }
        });

        this.onMessage("strumPlay", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;
            if (this.clients[0] == null || this.clients[1] == null) {
                return;
            }

            this.broadcast("strumPlay", message, { except: client });
        });

        this.onMessage("charPlay", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 0)) return;
            if (this.clients[0] == null || this.clients[1] == null) {
                return;
            }

            this.broadcast("charPlay", message, { except: client });
        });

        this.onMessage("playerReady", (client, message) => {
            this.keepAliveClient(client);

            if (this.isOwner(client)) {
                this.state.player1.hasLoaded = true;
            }
            else {
                this.state.player2.hasLoaded = true;
            }

            if (this.state.player1.hasLoaded && this.state.player2.hasLoaded) {
                this.state.player1.isReady = false;
                this.state.player2.isReady = false;
                this.broadcast("startSong", "", { afterNextPatch: true });
            }
        });

        this.onMessage("playerEnded", (client, message) => {
            this.keepAliveClient(client);

            if (this.isOwner(client)) {
                this.state.player1.hasEnded = true;
            }
            else {
                this.state.player2.hasEnded = true;
            }

            if (this.state.player1.hasEnded && this.state.player2.hasEnded) {
                this.endSong();
            }
        });

        this.onMessage("noteHit", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;
            if (this.clients[0] == null || this.clients[1] == null) {
                return;
            }

            this.broadcast("noteHit", message, { except: client });

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
            if (this.clients[0] == null || this.clients[1] == null) {
                return;
            }

            this.broadcast("noteMiss", message, { except: client });

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

            if (message != true && message != false) return;
            if (this.clients[0] == null) {
                return;
            }

            this.broadcast("noteHold", message, { except: client });
        });

        this.onMessage("updateSongFP", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.NUMBER)) return;

            if (this.isOwner(client)) {
                this.state.player1.songPoints = message;
            }
            else {
                this.state.player2.songPoints = message;
            }
        });

        this.onMessage("updateMaxCombo", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.NUMBER)) return;

            if (this.isOwner(client)) {
                this.state.player1.maxCombo = message;
            }
            else {
                this.state.player2.maxCombo = message;
            }
        });

        this.onMessage("chat", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.STRING)) return; // Fix crash issue from a null value.
            if (message.length >= 300) {
                client.send("log", formatLog("The message is too long!"));
                return;
            }
            if ((message as String).trim() == "") {
                return;
            }
            this.broadcast("log", formatLog(this.getStatePlayer(client).name + ": " + message, this.clientsInfo.get(client.sessionId).hue));
        });

        this.onMessage("notifyInstall", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.STRING)) return; // Fix crash issue from a null value.
            if (message.length >= 200) {
                this.broadcast("log", formatLog(this.getStatePlayer(client).name + " has finished installing the mod!"));
                return;
            }
            this.broadcast("log", formatLog(this.getStatePlayer(client).name + " has finished installing: " + message));
        });

        this.onMessage("swapSides", (client, message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.swagSides = !this.state.swagSides;
            }
        });

        this.onMessage("anarchyMode", (client, message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.anarchyMode = !this.state.anarchyMode;
            }
        });

        this.onMessage("toggleGF", (client, message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.hideGF = !this.state.hideGF;
            }
        });

        this.onMessage("toggleSkins", (client, message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.disableSkins = !this.state.disableSkins;

                if (this.state.disableSkins) {
                    this.state.player1.skinMod = null;
                    this.state.player1.skinName = null;
                    this.state.player1.skinURL = null;
                    this.state.player2.skinMod = null;
                    this.state.player2.skinName = null;
                    this.state.player2.skinURL = null;
                }
                else {
                    this.broadcast("requestSkin", null, { afterNextPatch: true });
                }
            }
        });

        this.onMessage("nextWinCondition", (client, message) => {
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
        });

        this.onMessage("pong", (client, message: number) => {
            const daPing = Date.now() - this.lastPingTime;

            if (this.isOwner(client)) {
                this.metadata.ping = daPing;
                this.state.player1.ping = daPing;
            }
            else {
                this.state.player2.ping = daPing;
            }

            this.clientsInfo.get(client.sessionId).lastPing = Date.now();
        });

        this.onMessage("requestEndSong", (client, message) => {
            this.keepAliveClient(client);

            //if (this.hasPerms(client)) {
            this.endSong();
            // }
            // else {
            //   this.broadcast("log", this.getStatePlayer(client).name + " wants to end the song! (ESC)");
            // }
        });

        this.onMessage("setGameplaySetting", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 1)) return;
            if (this.hasPerms(client)) {
                if (message[0] == "instakill" || message[0] == "practice" || message[0] == "opponentplay") {
                    return;
                }
                this.state.gameplaySettings.set(message[0], message[1].toString());
            }
        });

        this.onMessage("toggleLocalModifiers", (client, message) => {
            this.keepAliveClient(client);

            if (this.hasPerms(client)) {
                this.state.permitModifiers = !this.state.permitModifiers;
                if (this.state.permitModifiers) {
                    this.state.gameplaySettings = new MapSchema<any, any>();
                }
                else if (!this.checkInvalid(message, VerifyTypes.ARRAY, 0)) {
                    for (const key in message[0]) {
                        const value = message[0][key].toString();
                        if (key == "instakill" || key == "practice" || key == "opponentplay") {
                            continue;
                        }
                        this.state.gameplaySettings.set(key, value);
                    }
                }
            }
        });

        this.onMessage("setSkin", (client, message) => {
            if (this.state.disableSkins) {
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

            const player = await getPlayerByID(this.clientsInfo.get(client.sessionId).networkId);
            if (!player)
                return;

            if (this.isOwner(client)) {
                if (this.state.player1.verified && player) {
                    this.setPlayerPoints(this.state.player1, player.points);
                    this.state.player1.name = player.name;
                }
                else
                    this.setPlayerPoints(this.state.player1, message);

                this.metadata.points = this.state.player1.points;
            }
            else {
                if (this.state.player2.verified) {
                    this.setPlayerPoints(this.state.player2, player.points);
                    this.state.player2.name = player.name;
                }
                else
                    this.setPlayerPoints(this.state.player2, message);
            }
        });

        this.onMessage("status", (client, message) => {
            if (this.checkInvalid(message, VerifyTypes.STRING) || message.length >= 30) return;

            if (this.isOwner(client)) {
                this.state.player1.status = message;
            }
            else {
                this.state.player2.status = message;
            }
        });

        this.onMessage("botplay", (client, _) => {
            this.keepAliveClient(client);

            if (this.isOwner(client)) {
                this.state.player1.botplay = true;
            }
            else {
                this.state.player2.botplay = true;
            }
        });

        this.onMessage("updateArrColors", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 1)) return;

            if (this.isOwner(client)) {
                this.state.player1.arrowColor0 = message[0][0];
                this.state.player1.arrowColor1 = message[0][1];
                this.state.player1.arrowColor2 = message[0][2];
                this.state.player1.arrowColor3 = message[0][3];

                this.state.player1.arrowColorP0 = message[1][0];
                this.state.player1.arrowColorP1 = message[1][1];
                this.state.player1.arrowColorP2 = message[1][2];
                this.state.player1.arrowColorP3 = message[1][3];
            }
            else {
                this.state.player2.arrowColor0 = message[0][0];
                this.state.player2.arrowColor1 = message[0][1];
                this.state.player2.arrowColor2 = message[0][2];
                this.state.player2.arrowColor3 = message[0][3];

                this.state.player2.arrowColorP0 = message[1][0];
                this.state.player2.arrowColorP1 = message[1][1];
                this.state.player2.arrowColorP2 = message[1][2];
                this.state.player2.arrowColorP3 = message[1][3];
            }
        });

        this.onMessage("updateNoteSkinData", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 2)) return;

            if (this.isOwner(client)) {
                this.state.player1.noteSkin = message[0];
                this.state.player1.noteSkinMod = message[1];
                this.state.player1.noteSkinURL = message[2];
            }
            else {
                this.state.player2.noteSkin = message[0];
                this.state.player2.noteSkinMod = message[1];
                this.state.player2.noteSkinURL = message[2];
            }
        });

        this.onMessage("command", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 0)) return;

            switch (message[0]) {
                case "roll":
                    this.broadcast("log", formatLog("> " + this.getStatePlayer(client).name + " has rolled " + Math.floor(Math.random() * (6 - 1 + 1) + 1)));
                    break;
                case "kick":
                    if (!this.isOwner(client)) {
                        client.send("log", formatLog("> Just leave the game bro"));
                        return;
                    }

                    let kickCount = 0;
                    for (const cl of this.clients) {
                        if (!this.isOwner(cl) && (message[1] ? this.getStatePlayer(cl).name == message[1] : true)) {
                            this.removePlayer(cl);
                            kickCount++;
                        }
                    }
                    client.send("log", formatLog("> Kicked " + kickCount + " player(s)"));
                    break;
                case "help":
                    client.send("log", formatLog("> Global Commands: /roll, /kick"));
                    break;
                default:
                    client.send("log", formatLog("> Unknown command; try /help to see the command list!"));
                    break;
            }
        });

        this.onMessage("custom", (client, message) => {
            this.keepAliveClient(client);

            if (this.checkInvalid(message, VerifyTypes.ARRAY, 1)) return;
            this.broadcast("custom", message, { except: client });
        });

        this.clock.setInterval(() => {
            this.lastPingTime = Date.now();
            this.broadcast("ping");
        }, 1000 * 3); //every 3 seconds

        this.clock.setInterval(() => {
            if (this.clients.length < 1 || !this.metadata.ping) {
                this.destroy();
            }

            for (const [clientSusID, info] of this.clientsInfo) {
                if (Date.now() - info.lastPing > 1000 * 60) { // if the player wasnt responding for 60 seconds
                    if (process.env.DEBUG == "true")
                        console.log(clientSusID + " wasn't pinging on " + this.roomId + "! kicking... ");

                    const kiclient = this.clients.getById(clientSusID);
                    if (kiclient)
                        this.removePlayer(kiclient);
                }

                if (Date.now() - info.aliveTime > 1000 * 60 * 20) { // if the player wasnt active for 20 minutes
                    if (process.env.DEBUG == "true")
                        console.log(clientSusID + " wasn't active on " + this.roomId + "! kicking... ");

                    const kiclient = this.clients.getById(clientSusID);
                    if (kiclient)
                        this.removePlayer(kiclient);
                }
            }
        }, 1000 * 60); //every minute
    }

    endSong() {
        this.state.player1.isReady = false;
        this.state.player1.botplay = false;
        this.state.player2.isReady = false;
        this.state.player2.botplay = false;

        this.state.isStarted = false;

        this.broadcast("endSong", "", { afterNextPatch: true });
    }

    //why does this function exist
    async onAuth(client: Client, options: any, request: IncomingMessage) {
        const latestVersion = Data.PROTOCOL_VERSION;
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

        if (!await this.isClientAllowed(client, request)) {
            throw new ServerError(5002, "Can't join/create 4 servers on the same IP!");
        }

        const playerIp = this.getRequestIP(request);
        const ipInfo = await (await fetch("http://ip-api.com/json/" + playerIp)).json();
        if (process.env["STATS_ENABLED"] == "true" && ipInfo.country) {
            if (!Data.COUNTRY_PLAYERS.hasOwnProperty(ipInfo.country))
                Data.COUNTRY_PLAYERS[ipInfo.country] = [];

            if (!Data.COUNTRY_PLAYERS[ipInfo.country].includes(playerIp))
                Data.COUNTRY_PLAYERS[ipInfo.country].push(playerIp);
        }

        this.clientsInfo.set(client.sessionId, new ClientInfo());
        this.clientsInfo.get(client.sessionId).ip = requesterIP;

        return true;
    }

    async onJoin(client: Client, options: any) {
        if (!this.ownerUUID)
            this.ownerUUID = client.sessionId;

        this.clientsInfo.get(client.sessionId).lastPing = Date.now();
        this.keepAliveClient(client);

        let playerName = options.name;
        let playerPoints = options.points;
        let isVerified = false;
        const player = await getPlayerByID(options.networkId);
        if (options.networkId && options.networkToken && player) {
            if (!hasAccess(player, 'room.auth')) {
                client.error(418, "get fucked lmao");
                this.removePlayer(client);
                return;
            }

            jwt.verify(options.networkToken, player.secret as string, (err: any, user: any) => {
                if (err) {
                    client.error(401, "Couldn't authorize to the network!");
                    this.removePlayer(client);
                    return;
                }

                isVerified = true;
                this.clientsInfo.get(client.sessionId).networkId = options.networkId;
                this.clientsInfo.get(client.sessionId).hue = player.profileHue ?? 250;
                Data.MAP_USERNAME_PLAYINGROOM.set(player.name, this);
                playerName = player.name;
                playerPoints = player.points;
            })
        }

        if (!isVerified && this.networkOnly) {
            client.error(400, "Only Registered Network players can join!");
            this.removePlayer(client);
            return;
        }

        if (process.env.DEBUG == "true")
            console.log(client.sessionId + " has joined on " + this.roomId);

        if (this.clients.length == 1) {
            this.metadata.points = playerPoints;
            this.metadata.verified = isVerified;

            this.state.player1 = new Player();
            this.state.player1.name = playerName;
            if (!this.state.disableSkins) {
                this.state.player1.skinMod = options.skinMod;
                this.state.player1.skinName = options.skinName;
                this.state.player1.skinURL = options.skinURL;
            }
            this.setPlayerPoints(this.state.player1, playerPoints);
            this.state.player1.verified = isVerified;

            this.state.player1.arrowColor0 = options.arrowRGBT[0];
            this.state.player1.arrowColor1 = options.arrowRGBT[1];
            this.state.player1.arrowColor2 = options.arrowRGBT[2];
            this.state.player1.arrowColor3 = options.arrowRGBT[3];

            this.state.player1.arrowColorP0 = options.arrowRGBP[0];
            this.state.player1.arrowColorP1 = options.arrowRGBP[1];
            this.state.player1.arrowColorP2 = options.arrowRGBP[2];
            this.state.player1.arrowColorP3 = options.arrowRGBP[3];

            this.state.player1.noteSkin = options.noteSkin;
            this.state.player1.noteSkinMod = options.noteSkinMod;
            this.state.player1.noteSkinURL = options.noteSkinURL;
        }
        else if (this.clients.length == 2) {
            this.state.player2 = new Player();
            if (this.state.player1.name == playerName) {
                playerName += "(2)";
            }
            this.state.player2.name = playerName;
            if (!this.state.disableSkins) {
                this.state.player2.skinMod = options.skinMod;
                this.state.player2.skinName = options.skinName;
                this.state.player2.skinURL = options.skinURL;
            }
            this.setPlayerPoints(this.state.player2, playerPoints);
            this.state.player2.verified = isVerified;

            this.state.player2.arrowColor0 = options.arrowRGBT[0];
            this.state.player2.arrowColor1 = options.arrowRGBT[1];
            this.state.player2.arrowColor2 = options.arrowRGBT[2];
            this.state.player2.arrowColor3 = options.arrowRGBT[3];

            this.state.player2.arrowColorP0 = options.arrowRGBP[0];
            this.state.player2.arrowColorP1 = options.arrowRGBP[1];
            this.state.player2.arrowColorP2 = options.arrowRGBP[2];
            this.state.player2.arrowColorP3 = options.arrowRGBP[3];

            this.state.player2.noteSkin = options.noteSkin;
            this.state.player2.noteSkinMod = options.noteSkinMod;
            this.state.player2.noteSkinURL = options.noteSkinURL;
        }
        // else if (this.clients.length == 3) {
        //   this.state.player3 = new Player();
        //   if (this.state.player2.name == options.name || this.state.player1.name == options.name) {
        //     options.name += "(2)";
        //   }
        //   this.state.player3.name = options.name;
        // }

        this.broadcast("log", formatLog(this.getStatePlayer(client).name + " has joined the room!"), { afterNextPatch: true });

        client.send("checkChart", "", { afterNextPatch: true });

        this.clock.setTimeout(() => {
            if (client != null)
                client.send("checkChart", "", { afterNextPatch: true });
        }, 1000);
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
            if (process.env.DEBUG == "true")
                console.log(client.sessionId + " has failed to reconnect on " + this.roomId);

            this.removePlayer(client);
            delete this.clientsRemoved[this.clientsRemoved.indexOf(client.sessionId)];
        }
    }

    async removePlayer(client: Client) {
        if (this.state.isStarted) {
            this.endSong();
        }
        else {
            this.state.player1.isReady = false;
            this.state.player2.isReady = false;
        }

        this.broadcast("log", formatLog(this.getStatePlayer(client).name + " has left the room!"));

        Data.MAP_USERNAME_PLAYINGROOM.delete(this.getStatePlayer(client).name);
        this.presence.hset(this.IPS_CHANNEL, this.clientsInfo.get(client.sessionId).ip, ((Number.parseInt(await this.presence.hget(this.IPS_CHANNEL, this.clientsInfo.get(client.sessionId).ip)) - 1) + ""));
        this.clientsInfo.delete(client.sessionId);
        this.clientsRemoved.push(client.sessionId);
        this.clients.delete(client);
        client.leave();

        if (this.clients.length < 1 || this.isOwner(client))
            this.destroy();
        else
            this.state.player2 = new Player();

        if (this.clients.length < this.maxClients) {
            this.unlock();
        }
    }

    async onDispose() {
        if (process.env.DEBUG == "true")
            console.log("room has been disposed: " + this.roomId);

        for (const [username, room] of Data.MAP_USERNAME_PLAYINGROOM) {
            if (room == this) {
                Data.MAP_USERNAME_PLAYINGROOM.delete(username);
            }
        }
        this.destroy(true);
        this.presence.srem(this.LOBBY_CHANNEL, this.roomId);
    }

    destroy(ing?: boolean) {
        for (const client of this.clients) {
            this.removePlayer(client);
        }
        if (!ing) {
            this.disconnect();
        }
    }

    hasPerms(client: Client) {
        return this.isOwner(client) || this.state.anarchyMode;
    }

    isOwner(client: Client) {
        return client.sessionId == this.ownerUUID;
    }

    playerSide(client: Client) {
        return this.state.swagSides ? !this.isOwner(client) : this.isOwner(client);
    }

    isGf(client: Client) {
        return this.clients.indexOf(client) == 2;
    }

    getStatePlayer(client: Client): Player {
        if (this.isGf(client)) {
            return null;
            //return this.state.player3;
        }

        return (this.isOwner(client) ? this.state.player1 : this.state.player2);
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
        }
        return false;
    }

    // Generate a single 4 capital letter room ID.
    generateRoomIdSingle(): string {
        let result = '';
        for (var i = 0; i < 4; i++) {
            result += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
        }
        return result;
    }

    setPlayerPoints(player: any, v: number): void {
        if (this.checkInvalid(v, VerifyTypes.NUMBER)) return;
        player.points = v;
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

    async isClientAllowed(client: Client, request: IncomingMessage): Promise<Boolean> {
        if (process.env.DISABLE_IP_LOCK == "true") {
            return true;
        }

        var requesterIP = this.getRequestIP(request);

        const currentIps = await this.presence.hget(this.IPS_CHANNEL, requesterIP);
        var ipOccurs = !currentIps ? 0 : Number.parseInt(currentIps);
        if (ipOccurs < 4) {
            await this.presence.hset(this.IPS_CHANNEL, requesterIP, (ipOccurs + 1) + "");
            return true;
        }
        return false;
    }

    getRequestIP(req: IncomingMessage) {
        if (req.headers['x-forwarded-for']) {
            return (req.headers['x-forwarded-for'] as String).split(",")[0].trim();
        }
        else {
            return req.socket.remoteAddress;
        }
    }
}

enum VerifyTypes {
    NUMBER,
    STRING,
    ARRAY,
}
