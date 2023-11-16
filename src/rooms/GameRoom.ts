import { Room, Client, ClientArray } from "@colyseus/core";
import { RoomState } from "./schema/RoomState";
import { Player } from "./schema/Player";
import { IncomingMessage } from "http";
import { ServerError } from "colyseus";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class GameRoom extends Room<RoomState> {
  maxClients = 2;
  LOBBY_CHANNEL = "$lobbiesChannel"
  roomOwner:string = null;
  chartHash:string = null;

  async onCreate (options: any) {
    this.roomId = await this.generateRoomId();
    this.setPrivate();
    this.setState(new RoomState());
    this.autoDispose = true;

    this.setMetadata({name: options.name});

    this.onMessage("togglePrivate", (client, message) => {
      if (this.isOwner(client)) {
        this.state.isPrivate = !this.state.isPrivate;
        this.setPrivate(this.state.isPrivate);
      }
    });

    this.onMessage("startGame", (client, message) => {
      if (this.clients.length >= 2 && this.isOwner(client) && this.state.player1.hasSong && this.state.player2.hasSong) {
        this.state.isStarted = true;
        
        this.state.player1.score = 0;
        this.state.player1.misses = 0;
        this.state.player1.sicks = 0;
        this.state.player1.goods = 0;
        this.state.player1.bads = 0;
        this.state.player1.shits = 0;
        this.state.player1.hasLoaded = false;
        this.state.player1.hasEnded = false;

        this.state.player2.score = 0;
        this.state.player2.misses = 0;
        this.state.player2.sicks = 0;
        this.state.player2.goods = 0;
        this.state.player2.bads = 0;
        this.state.player2.shits = 0;
        this.state.player2.hasLoaded = false;
        this.state.player2.hasEnded = false;

        this.broadcast("gameStarted");
      }
    });

    this.onMessage("addScore", (client, message) => {
      if (this.state.isStarted) {
        (this.isOwner(client) ? this.state.player1 : this.state.player2).score += message;
      }
    });

    this.onMessage("addMiss", (client, message) => {
      if (this.state.isStarted) {
        (this.isOwner(client) ? this.state.player1 : this.state.player2).misses += 1;
      }
    });

    this.onMessage("addHitJudge", (client, message) => {
      if (this.state.isStarted) {
        switch (message) {
          case "sick":
            (this.isOwner(client) ? this.state.player1 : this.state.player2).sicks += 1;
            break; // java war flashbacks
          case "good":
            (this.isOwner(client) ? this.state.player1 : this.state.player2).goods += 1;
            break;
          case "bad":
            (this.isOwner(client) ? this.state.player1 : this.state.player2).bads += 1;
            break;
          case "shit":
            (this.isOwner(client) ? this.state.player1 : this.state.player2).shits += 1;
            break;
        }
      }
    });

    this.onMessage("setFSD", (client, message) => {
      if (this.isOwner(client)) {
        this.state.folder = message[0];
        this.state.song = message[1];
        this.state.diff = message[2];
        this.chartHash = message[3];
        this.state.modDir = message[4];

        this.state.player1.hasSong = this.isOwner(client);
        if (this.state.player2 != null) {
          this.state.player2.hasSong = !this.isOwner(client);
        }

        this.broadcast("checkChart", "", {afterNextPatch: true});
      }
    });

    this.onMessage("verifyChart", (client, message) => {
      if (!this.isOwner(client)) {
        this.state.player2.hasSong = this.chartHash == message;
      }
      else {
        this.state.player1.hasSong = this.chartHash == message;
      }
    });

    this.onMessage("strumPlay", (client, message) => {
      if (this.clients[0] == null || this.clients[1] == null) {
        return;
      }

      if (this.isOwner(client)) {
        this.clients[1].send("strumPlay", message);
      }
      else {
        this.clients[0].send("strumPlay", message);
      }
    });

    this.onMessage("charPlay", (client, message) => {
      if (this.clients[0] == null || this.clients[1] == null) {
        return;
      }

      if (this.isOwner(client)) {
        this.clients[1].send("charPlay", message);
      }
      else {
        this.clients[0].send("charPlay", message);
      }
    });

    this.onMessage("playerReady", (client, message) => {
      if (this.isOwner(client)) {
        this.state.player1.hasLoaded = true;
      }
      else {
        this.state.player2.hasLoaded = true;
      }

      if (this.state.player1.hasLoaded && this.state.player2.hasLoaded) {
        this.broadcast("startSong", "", { afterNextPatch: true });
      }
    });

    this.onMessage("playerEnded", (client, message) => {
      if (this.isOwner(client)) {
        this.state.player1.hasEnded = true;
      }
      else {
        this.state.player2.hasEnded = true;
      }

      if (this.state.player1.hasEnded && this.state.player2.hasEnded) {
        this.broadcast("endSong", "", { afterNextPatch: true });
      }
    });

    this.onMessage("noteHit", (client, message) => {
      if (this.clients[0] == null || this.clients[1] == null) {
        return;
      }

      if (this.isOwner(client)) {
        this.clients[1].send("noteHit", message);
      }
      else {
        this.clients[0].send("noteHit", message);
      }
    });

    this.onMessage("noteMiss", (client, message) => {
      if (this.clients[0] == null || this.clients[1] == null) {
        return;
      }

      if (this.isOwner(client)) {
        this.clients[1].send("noteMiss", message);
      }
      else {
        this.clients[0].send("noteMiss", message);
      }
    });

    this.onMessage("chat", (client, message) => {
      this.broadcast("log", "<" + (this.isOwner(client) ? this.state.player1.name : this.state.player2.name) + ">: " + message);
    });
  }

  onAuth(client: Client, options: any, request?: IncomingMessage) {
    if (options == null || options.name == null || (options.name + "").trim().length < 3) {
      throw new ServerError(5000, "Too short name!"); // too short name error
    }
    return true;
  }

  onJoin (client: Client, options: any) {
    if (this.clients.length == 1) {
      this.state.player1 = new Player();
      this.state.player1.name = options.name;
      this.roomOwner = client.sessionId;
    }
    else {
      this.state.player2 = new Player();
      if (this.state.player1.name == options.name) {
        options.name += "(2)";
      }
      this.state.player2.name = options.name;
    }

    this.broadcast("log", (this.isOwner(client) ? this.state.player1.name : this.state.player2.name) + " has joined the room!");

    client.send("checkChart");
  }

  onLeave (client: Client, consented: boolean) {
    this.broadcast("log", (this.isOwner(client) ? this.state.player1.name : this.state.player2.name) + " has left the room!");

    if (this.isOwner(client)) {
      this.disconnect(4000);
    }
    else {
      this.state.player2 = new Player();
    }
  }

  onDispose() {
    this.presence.srem(this.LOBBY_CHANNEL, this.roomId);
  }

  isOwner(client: Client) {
    return client.sessionId == this.roomOwner;
  }

  // Generate a single 4 capital letter room ID.
  generateRoomIdSingle(): string {
    let result = '';
    for (var i = 0; i < 4; i++) {
      result += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
    }
    return result;
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
}
