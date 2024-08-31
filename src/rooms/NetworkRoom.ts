import { Room, Client } from "@colyseus/core";
import { RoomState } from "./schema/RoomState";
import { IncomingMessage } from "http";
import { ServerError } from "colyseus";
import { Data } from "../Data";
import { authPlayer } from "../network";

export let networkRoom: NetworkRoom; 

export function notifyFromPlayer(toId:string, fromName:string, action:string, content?:string) {
  networkRoom.users.get(toId).send('notifFromPlayer', {
    from: fromName,
    action: action,
    content: content
  });
}

export class NetworkRoom extends Room<RoomState> {
  users: Map<String, Client> = new Map<String, Client>();

  async onCreate (options: any) {
    if (networkRoom) {
      throw new ServerError(418);
    }
    networkRoom = this;

    this.autoDispose = false;
  }
  
  async onAuth(client: Client, options: any, request: IncomingMessage) {
    const latestVersion = Data.PROTOCOL_VERSION;
    if (latestVersion != options.protocol) {
      throw new ServerError(5003, "This client version is not supported on this server, please update!\n\nYour protocol version: '" + options.protocol + "' latest: '" + latestVersion + "'");
    }

    const player = await authPlayer(options);
    if (!player) {
      throw new ServerError(5001, "Too long name!"); 
    }

    client.sessionId = player.id;

    this.users.set(player.id, client);

    return true;
  }

  async onLeave(client: Client, consented: boolean) {
    this.users.delete(client.sessionId);
  }
}