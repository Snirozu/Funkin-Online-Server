import { Room, Client } from "@colyseus/core";
import { IncomingMessage } from "http";
import { ServerError } from "colyseus";
import { Data } from "../Data";
import { authPlayer, getPlayerByID } from "../network";
import { NetworkSchema } from "./schema/NetworkSchema";
import { formatLog } from "../util";

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

export function logToAll(content: string) {
  try {
    if (!networkRoom) {
      return;
    }

    networkRoom.broadcast('log', content);
  }
  catch (exc) { }
}

export class NetworkRoom extends Room<NetworkSchema> {
  //at least it's fast /shrug
  SSIDtoID: Map<String, String> = new Map<String, String>();
  IDToName: Map<String, String> = new Map<String, String>();
  IDtoClient: Map<String, Client> = new Map<String, Client>();
  nameToClient: Map<String, Client> = new Map<String, Client>();
  nameToHue: Map<String, number> = new Map<String, number>();

  notifyClients: Array<Client> = [];

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
          this.nameToClient.get(player.toLowerCase()).send("log", formatLog("[" + sender + "->YOU]: " + msg, 40));
          this.nameToClient.get(player.toLowerCase()).send('notification', 'New PM from ' + sender + '!');
          client.send("log", formatLog("[YOU->" + sender + "]: " + msg, 40));
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
        else if (message.startsWith('/notify')) {
          this.setNotifs(client, !this.notifyClients.includes(client));
          if (this.notifyClients.includes(client)) {
            client.send("log", formatLog('Enabled Notifications!'));
          }
          else {
            client.send("log", formatLog('Disabled Notifications!'));
          }
        }
        else if (message.startsWith('/help')) {
          client.send("log", formatLog('DM players with the following format >{user} {message}\nSee the online player list with /list!\nIf you want to receive notifications for all messages then type /notify! (lasts until the end of a session)'));
        }
        else if (message.startsWith('/announce')) {
          const playAdm = await getPlayerByID(this.SSIDtoID.get(client.sessionId) + '');
          
          if (playAdm && playAdm.isMod) {
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

      this.broadcast("log", formatLog(sender + ": " + message, this.nameToHue.get(sender.toLowerCase())));
      this.notifyClients.forEach(client => {
        try {
          client.send("notification", 'New Chat Message from ' + sender);
        }
        catch (exc) {}
      });
    });
  }
  
  async onAuth(client: Client, options: any, request: IncomingMessage) {
    const latestVersion = Data.PROTOCOL_VERSION;
    if (latestVersion != options.protocol) {
      throw new ServerError(5003, "This client version is not supported on this server, please update!\n\nYour protocol version: '" + options.protocol + "' latest: '" + latestVersion + "'");
    }

    const player = await authPlayer(options);
    if (!player) {
      throw new ServerError(5001, "Prohibited!"); 
    }
    if (this.IDToName.has(player.id)) {
      throw new ServerError(5002, "Prohibited"); 
    }

    this.SSIDtoID.set(client.sessionId, player.id);
    this.IDToName.set(player.id, player.name);
    this.IDtoClient.set(player.id, client);
    this.nameToClient.set(player.name.toLowerCase(), client);
    this.nameToHue.set(player.name.toLowerCase(), player.profileHue);

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
    const clID = this.SSIDtoID.get(client.sessionId);
    this.IDtoClient.delete(clID);
    this.nameToClient.delete(this.IDToName.get(clID).toLowerCase());
    this.nameToHue.delete(this.IDToName.get(clID).toLowerCase());
    this.IDToName.delete(clID);
    this.SSIDtoID.delete(client.sessionId);

    this.setNotifs(client, false);
  }

  setNotifs(client: Client, enable:boolean) {
    if (enable) {
      if (!this.notifyClients.includes(client)) {
        this.notifyClients.push(client);
      }
      return;
    }
    const index = this.notifyClients.indexOf(client, 0);
    if (index > -1) {
      this.notifyClients.splice(index, 1);
    }
  }
}