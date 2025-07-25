import { Room, Client } from "@colyseus/core";
import { IncomingMessage } from "http";
import { ServerError } from "colyseus";
import { Data } from "../Data";
import { authPlayer, getPlayerByID, getPlayerByName, getPlayerIDByName, hasAccess } from "../network";
import { NetworkSchema } from "./schema/NetworkSchema";
import { formatLog, isUserIDInRoom } from "../util";
import { DiscordBot } from "../discord";

export let networkRoom: NetworkRoom; 

export function notifyPlayer(toId:string, content:string) {
  try {
    if (!networkRoom || !networkRoom.IDtoClient || !networkRoom.IDtoClient.has(toId)) {
      return;
    }
    
    networkRoom.IDtoClient.get(toId).send('notification', content);
  }
  catch (exc) {}
}

export function logToAll(content: string, notDiscord?:boolean) {
  try {
    if (!networkRoom) {
      return;
    }

    Data.PUBLIC.LOGGED_MESSAGES.push([content, Date.now()]);
    if (Data.PUBLIC.LOGGED_MESSAGES.length > 100) {
      Data.PUBLIC.LOGGED_MESSAGES.shift();
    }
    networkRoom.broadcast('log', content);
    if (!notDiscord)
      DiscordBot.networkChannel.send(JSON.parse(content).content);
  }
  catch (exc) { }
}

export class NetworkRoom extends Room<NetworkSchema> {
  //at least it's fast /shrug
  SSIDtoID: Map<string, string> = new Map<string, string>();
  IDToName: Map<string, string> = new Map<string, string>();
  IDtoClient: Map<string, Client> = new Map<string, Client>();
  nameToClient: Map<string, Client> = new Map<string, Client>();
  nameToHue: Map<string, number> = new Map<string, number>();

  async onCreate (options: any) {
    if (networkRoom) {
      throw new ServerError(418);
    }
    this.setState(new NetworkSchema());
    networkRoom = this;
    this.roomId = '0';

    this.autoDispose = false;

    this.onMessage("chat", async (client, message:string) => {
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
        let msgSplit = message.split(' ');
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
          let onlines: String[] = [];
          this.IDToName.forEach((v, k) => {
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

      logToAll(formatLog(sender + ": " + message, this.nameToHue.get(sender.toLowerCase())));
    });

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

      const senderName = this.IDToName.get(this.SSIDtoID.get(client.sessionId));

      this.nameToClient.get(message.toLowerCase()).send('roominvite', JSON.stringify({
        name: senderName,
        roomid: Data.MAP_USERNAME_PLAYINGROOM.get(senderName).roomId
      }));
      client.send("notification", 'Invite sent!');
    });

    this.onMessage("loggedMessagesAfter", async (client, message: number) => {
      if (!message)
        message = 0;

      let loggedAfter = [];
      for (const log of Data.PUBLIC.LOGGED_MESSAGES) {
        if (log[1] > message) {
          loggedAfter.push(log[0]);
        }
      }
      client.send("batchLog", JSON.stringify(loggedAfter));
    });
  }
  
  async onAuth(client: Client, options: any, request: IncomingMessage) {
    const latestVersion = Data.NETWORK_PROTOCOL_VERSION;
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

  async onLeave(client: Client, consented: boolean) {
    try {
      await this.allowReconnection(client, !consented ? 10 : 0);
    }
    catch (err) {
      this.removePlayer(client);
    }
  }

  removePlayer(client: Client) {
    try {
      const clID = this.SSIDtoID.get(client.sessionId);
      this.IDtoClient.delete(clID);
      this.nameToClient.delete(this.IDToName.get(clID).toLowerCase());
      this.nameToHue.delete(this.IDToName.get(clID).toLowerCase());
      this.IDToName.delete(clID);
      this.SSIDtoID.delete(client.sessionId);
    }
    catch (exc) {}
    
    client.leave();
  }
}