import { Room, Client, AuthContext, CloseCode } from "@colyseus/core";
import { ServerError } from "colyseus";
import { authPlayer, getNotifications, getPlayerByID, getPlayerByName, getPlayerClubTag, getPlayerIDByName, hasAccess } from "../network/database";
import { NetworkSchema } from "./schema/NetworkSchema";
import { formatLog, isUserIDInRoom } from "../util";
import { DiscordBot } from "../discord";
import { Data } from "../data";
import { cooldown, setCooldown } from "../cooldown";

export class NetworkRoom extends Room {
    public static PROTOCOL_VERSION = 8;

    public static instance: NetworkRoom;
    /**
     * schema of the current room
     */
    state = new NetworkSchema();
    //at least it's fast /shrug
    SSIDtoID: Map<string, string> = new Map<string, string>();
    IDToName: Map<string, string> = new Map<string, string>();
    IDtoClient: Map<string, Client> = new Map<string, Client>();
    nameToClient: Map<string, Client> = new Map<string, Client>();
    nameToHue: Map<string, number> = new Map<string, number>();

    async onCreate(_options: any) {
        if (NetworkRoom.instance) {
            throw new ServerError(418);
        }
        NetworkRoom.instance = this;
        this.roomId = '0';

        this.autoDispose = false;

        this.onMessage("chat", async (client, message: string) => {
            if (message.length > 300) {
                client.send("log", formatLog("Message length reached!"));
                return;
            }

            if (!this.SSIDtoID.has(client.sessionId) || !this.IDToName.has(this.SSIDtoID.get(client.sessionId))) {
                this.removePlayer(client);
                return;
            }

            message = message.trim();

            if (message.length <= 0) {
                return;
            }

            const sender = this.IDToName.get(this.SSIDtoID.get(client.sessionId));

            if (message.startsWith('>')) {
                const msgSplit = message.split(' ');
                const player = msgSplit[0].substring(1);
                msgSplit.shift();
                const msg = msgSplit.join(' ');
                if (msg.length <= 0) {
                    return;
                }

                if (this.nameToClient.has(player.toLowerCase())) {
                    this.nameToClient.get(player.toLowerCase()).send("log", formatLog("[" + sender + "->YOU]: " + msg, 40, true));
                    client.send("log", formatLog("[YOU->" + player + "]: " + msg, 40));
                }
                else {
                    client.send("log", formatLog("Player not found!"));
                }
                return;
            }
            else if (message.startsWith('/')) {
                if (message.startsWith('/list')) {
                    const onlines: string[] = [];
                    this.IDToName.forEach(v => {
                        onlines.push(v);
                    });
                    client.send("log", formatLog('Online: ' + onlines.join(', ')));
                }
                else if (message.startsWith('/help')) {
                    client.send("log", formatLog('DM players with the following format >{user} {message}\nSee the online player list with /list!\nIf you want to receive notifications for all messages then type /notify!\nTo view someone\'s profile use /profile <user>'));
                }
                else if (message.startsWith('/announce')) {
                    const playAdm = await getPlayerByID(this.SSIDtoID.get(client.sessionId) + '');

                    if (playAdm && hasAccess(playAdm, 'command.announce')) {
                        this.clients.forEach(client => {
                            client.send("notification", message.substring('/announce '.length));
                        });
                    }
                }
                else {
                    client.send("log", formatLog("Command not found! (Try /help)"));
                }
                return;
            }

            await NetworkRoom.logToAll(formatLog(sender + ": " + message, this.nameToHue.get(sender.toLowerCase())), true);
            await NetworkRoom.discordChatMessage(sender, message);
        });

        setCooldown('room.invite', 30);
        this.onMessage("inviteplayertoroom", async (client, message: string) => {
            if (!this.SSIDtoID.has(client.sessionId)) {
                client.send("notification", 'Authorization Error');
                this.removePlayer(client);
                return;
            }

            if (!this.nameToClient.has(message.toLowerCase())) {
                client.send("notification", 'Player isn\'t online in-game!');
                return;
            }

            if (!(await isUserIDInRoom(this.SSIDtoID.get(client.sessionId)))) {
                client.send("notification", 'You\'re not in a game room!');
                return;
            }

            if (!((await getPlayerByName(message)).friends.includes(this.SSIDtoID.get(client.sessionId)))) {
                client.send("notification", 'You\'re not friends with ' + message + '!');
                return;
            }

            if (!cooldown(this.SSIDtoID.get(client.sessionId) + '.' + this.SSIDtoID.get(this.nameToClient.get(message.toLowerCase()).sessionId), 'room.invite')) {
                client.send("notification", 'You\'re on cooldown ' + message + '!');
                return;
            }

            const senderName = this.IDToName.get(this.SSIDtoID.get(client.sessionId));

            this.nameToClient.get(message.toLowerCase()).send('roominvite', JSON.stringify({
                name: senderName,
                roomid: Data.INFO.MAP_USERNAME_PLAYINGROOM.get(senderName).roomId
            }));
            client.send("notification", 'Invite sent!');
        });

        this.onMessage("loggedMessagesAfter", async (client, message: number) => {
            if (!message)
                message = 0;

            const loggedAfter = [];
            for (const log of Data.PERSIST.props.LOGGED_MESSAGES) {
                if (Number(log[1]) > message) {
                    loggedAfter.push(log[0]);
                }
            }
            client.send("batchLog", JSON.stringify(loggedAfter));
        });
    }

    async onAuth(client: Client, options: any, _context: AuthContext) {
        const latestVersion = NetworkRoom.PROTOCOL_VERSION;
        if (latestVersion != options.protocol) {
            throw new ServerError(5003, "This client version is not supported on this server, please update!\n\nYour protocol version: '" + options.protocol + "' latest: '" + latestVersion + "'");
        }

        const player = await authPlayer(options, false);
        if (!player) {
            throw new ServerError(401, "Unauthorized to Network");
        }
        if (this.IDToName.has(player.id)) {
            this.removePlayer(this.IDtoClient.get(player.id));
        }

        this.SSIDtoID.set(client.sessionId, player.id);
        this.IDToName.set(player.id, player.name);
        this.IDtoClient.set(player.id, client);
        this.nameToClient.set(player.name.toLowerCase(), client);
        this.nameToHue.set(player.name.toLowerCase(), player.profileHue ?? 250);

        client.send("log", formatLog("Welcome, " + player.name + '!\nYou should also check /help!'));
        return true;
    }

    async onJoin(client: Client, _: any) {
        const player = await getPlayerByID(this.SSIDtoID.get(client.sessionId));
        if (!player)
            throw new ServerError(401, "Unauthorized to Network");

        if ((Date.now() - player.lastActive.getTime()) > (1000 * 60)) {
            for (const friend of player.friends) {
                if (!this.IDtoClient.has(friend))
                    continue;

                this.IDtoClient.get(friend).send("friendOnlineNotif", player.name);
            }
        }

        const notifs = await getNotifications(player.id);
        if (notifs && notifs.length > 0) {
            NetworkRoom.notifyPlayer(player.id, 'You have ' + notifs.length + ' new notifications!')
        }
    }

    async onLeave(client: Client, code: CloseCode) {
        try {
            await this.allowReconnection(client, code != CloseCode.CONSENTED ? 10 : 0);
        }
        catch (err) {
            if (process.env.DEBUG == "true")
                console.error(err);
            this.removePlayer(client);
        }
    }

    removePlayer(client: Client) {
        try {
            const clID = this.SSIDtoID.get(client.sessionId);
            this.SSIDtoID.delete(client.sessionId);
            this.IDtoClient.delete(clID);
            if (this.IDToName.has(clID)) {
                this.nameToClient.delete(this.IDToName.get(clID).toLowerCase());
                this.nameToHue.delete(this.IDToName.get(clID).toLowerCase());
                this.IDToName.delete(clID);
            }
        }
        catch (exc) {
            console.error(exc);
        }

        client.leave();
    }

    public static notifyPlayer(toId: string, content: string) {
        try {
            if (!NetworkRoom.instance || !NetworkRoom.instance.IDtoClient || !NetworkRoom.instance.IDtoClient.has(toId)) {
                return;
            }

            NetworkRoom.instance.IDtoClient.get(toId).send('notification', content);
        }
        catch (exc) {
            console.error(exc);
        }
    }

    public static async logToAll(content: string, notDiscord?: boolean) {
        try {
            if (!NetworkRoom.instance) {
                return;
            }

            Data.PERSIST.props.LOGGED_MESSAGES.push([content, Date.now()]);
            if (Data.PERSIST.props.LOGGED_MESSAGES.length > 100) {
                Data.PERSIST.props.LOGGED_MESSAGES.shift();
            }
            Data.PERSIST.save();

            NetworkRoom.instance.broadcast('log', content);
            if (!notDiscord)
                await DiscordBot.sendNetworkMessage(JSON.parse(content).content);
        }
        catch (exc) {
            console.error(exc);
        }
    }

    public static async discordChatMessage(user: string, content: string) {
        const tag = await getPlayerClubTag(await getPlayerIDByName(user))
        await DiscordBot.sendWebhookMessage({
            content: content,
            username: user + (tag ? ' [' + tag + ']' : ''),
            avatarURL: "https://funkin.sniro.boo/api/user/avatar/" + user // maybe make a .env value for domain? because i hate this with a burning passion
        });
    }
}