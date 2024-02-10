import { Room, Client } from "@colyseus/core";
import { RoomState } from "./schema/RoomState";
import { Player } from "./schema/Player";
import { IncomingMessage } from "http";
import { ServerError } from "colyseus";
import { Assets } from "../Assets";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class GameRoom extends Room<RoomState> {
  maxClients = 2;
  LOBBY_CHANNEL = "$lobbiesChannel"
  IPS_CHANNEL = "$IPSChannel"
  chartHash:string = null;
  clientsIP: Map<Client, string> = new Map<Client, string>();
  ownerUUID:string = null;
  lastPingTime:number = null;

  async onCreate (options: any) {
    this.roomId = await this.generateRoomId();
    this.setPrivate();
    this.setState(new RoomState());
    this.autoDispose = true;

    this.setMetadata({name: options.name});

    this.onMessage("togglePrivate", (client, message) => {
      if (this.hasPerms(client)) {
        this.state.isPrivate = !this.state.isPrivate;
        this.setPrivate(this.state.isPrivate);
      }
    });

    this.onMessage("startGame", (client, message) => {
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
        this.state.player1.hasLoaded = false;
        this.state.player1.hasEnded = false;
        this.state.player1.isReady = false;

        this.state.player2.score = 0;
        this.state.player2.misses = 0;
        this.state.player2.sicks = 0;
        this.state.player2.goods = 0;
        this.state.player2.bads = 0;
        this.state.player2.shits = 0;
        this.state.player2.hasLoaded = false;
        this.state.player2.hasEnded = false;
        this.state.player2.isReady = false;

        this.state.health = 1;

        this.broadcast("gameStarted", "", { afterNextPatch: true });
      }
    });

    this.onMessage("addScore", (client, message) => {
      if (this.state.isStarted) {
        this.getStatePlayer(client).score += message;
      }
    });

    this.onMessage("addMiss", (client, message) => {
      if (this.state.isStarted) {
        this.getStatePlayer(client).misses += 1;
      }
    });

    this.onMessage("addHitJudge", (client, message) => {
      if (this.state.isStarted) {
        switch (message) {
          case "sick":
            this.getStatePlayer(client).sicks += 1;
            break; // java war flashbacks
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
      if (this.hasPerms(client)) {
        this.state.folder = message[0];
        this.state.song = message[1];
        this.state.diff = message[2];
        this.chartHash = message[3];
        this.state.modDir = message[4];
        if (message.length > 5 && (message[5] + "").trim() != "") {
          this.state.modURL = message[5];
        }
        else {
          this.state.modURL = null;
        }

        this.state.player1.isReady = false;
        this.state.player2.isReady = false;

        this.state.player1.hasSong = this.isOwner(client);
        this.state.player2.hasSong = !this.isOwner(client);

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

      this.broadcast("strumPlay", message, { except: client });
    });

    this.onMessage("charPlay", (client, message) => {
      if (this.clients[0] == null || this.clients[1] == null) {
        return;
      }

      this.broadcast("charPlay", message, { except: client });
    });

    this.onMessage("playerReady", (client, message) => {
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
      if (this.isOwner(client)) {
        this.state.player1.hasEnded = true;
      }
      else {
        this.state.player2.hasEnded = true;
      }

      if (this.state.player1.hasEnded && this.state.player2.hasEnded) {
        this.state.player1.isReady = false;
        this.state.player2.isReady = false;
        this.broadcast("endSong", "", { afterNextPatch: true });
      }
    });

    this.onMessage("noteHit", (client, message) => {
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

    this.onMessage("chat", (client, message) => {
      if (message.length >= 300) {
        client.send("log", "The message is too long!");
        return;
      }
      if ((message as String).trim() == "") {
        return;
      }
      this.broadcast("log", "<" + this.getStatePlayer(client).name + ">: " + message);
    });

    this.onMessage("swapSides", (client, message) => {
      if (this.hasPerms(client) || this.state.anarchyMode) {
        this.state.swagSides = !this.state.swagSides;
      }
    });

    this.onMessage("anarchyMode", (client, message) => {
      if (this.hasPerms(client)) {
        this.state.anarchyMode = !this.state.anarchyMode;
      }
    });

    this.onMessage("pong", (client, message:number) => {
      const daPing = Date.now() - this.lastPingTime;

      if (this.isOwner(client)) {
        this.metadata.ping = daPing;
        this.state.player1.ping = daPing;
      }
      else {
        this.state.player2.ping = daPing;
      }
    });

    this.onMessage("requestEndSong", (client, message) => {
      if (this.hasPerms(client)) {
        this.state.player1.isReady = false;
        this.state.player2.isReady = false;
        this.broadcast("endSong", "", { afterNextPatch: true });
      }
      else {
        this.broadcast("log", this.getStatePlayer(client).name + " wants to end the song! (ESC)");
      }
    });

    this.onMessage("setSkin", (client, message) => {
      if (message == null || message.length < 3) {
        this.getStatePlayer(client).skinMod = null;
        this.getStatePlayer(client).skinName = null;
        this.getStatePlayer(client).skinURL = null;
        return;
      }

      this.getStatePlayer(client).skinMod = message[0];
      this.getStatePlayer(client).skinName = message[1];
      this.getStatePlayer(client).skinURL = message[2];
    });

    this.onMessage("command", (client, message) => {
      if (message == null || message.length < 1) {
        return;
      }

      switch (message[0]) {
        case "roll":
          this.broadcast("log", "> " + this.getStatePlayer(client).name + " has rolled " + Math.floor(Math.random() * (6 - 1 + 1) + 1));
          break;
        case "kick":
          if (!this.isOwner(client) || !this.clients.at(1) || this.clients.at(1) == client) {
            return;
          }
          this.clients.at(1).leave(4100);
          break;
      }
    });

    this.onMessage("custom", (client, message) => {
      this.broadcast("custom", message, { except: client });
    });

    //this.state.player1.isReady = false;

    this.clock.setInterval(() => {
      this.lastPingTime = Date.now();
      this.broadcast("ping");
    }, 3000);
  }

  async onAuth(client: Client, options: any, request?: IncomingMessage) {
    if (!await this.isClientAllowed(client, request)) {
      throw new ServerError(5002, "Can't join/create 4 servers on the same IP!"); 
    }
    const latestVersion = await this.latestVersion();
    if (options == null || options.name == null || (options.name + "").trim().length < 3) {
      throw new ServerError(5000, "Too short name!"); // too short name error
    }
    else if (latestVersion != options.version) {
      throw new ServerError(5003, "Outdated client, please update!\nYour version: " + options.version + " latest: " + latestVersion);
    }
    else if (options.name.length >= 20) {
      throw new ServerError(5001, "Too long name!"); 
    }
    return true;
  }

  async latestVersion():Promise<String> {
    // let res = await fetch('https://raw.githubusercontent.com/Snirozu/Funkin-Psych-Online/main/gitVersion.txt');
    // let data = await res.text();
    // return (data + "").split('\n')[0].trim(); 
    return Assets.VERSION;
  }

  onJoin (client: Client, options: any) {
    if (this.clients.length == 1) {
      this.ownerUUID = client.sessionId;
      this.state.player1 = new Player();
      this.state.player1.name = options.name;
      this.state.player1.skinMod = options.skinMod;
      this.state.player1.skinName = options.skinName;
      this.state.player1.skinURL = options.skinURL;
    }
    else if (this.clients.length == 2) {
      this.state.player2 = new Player();
      if (this.state.player1.name == options.name) {
        options.name += "(2)";
      }
      this.state.player2.name = options.name;
      this.state.player2.skinMod = options.skinMod;
      this.state.player2.skinName = options.skinName;
      this.state.player2.skinURL = options.skinURL;
    }
    // else if (this.clients.length == 3) {
    //   this.state.player3 = new Player();
    //   if (this.state.player2.name == options.name || this.state.player1.name == options.name) {
    //     options.name += "(2)";
    //   }
    //   this.state.player3.name = options.name;
    // }

    this.broadcast("log", this.getStatePlayer(client).name + " has joined the room!", { afterNextPatch: true });

    client.send("checkChart", "", { afterNextPatch: true });

    this.clock.setTimeout(() => {
      if (client != null)
        client.send("checkChart", "", { afterNextPatch: true });
    }, 1000);
  }

  async onLeave (client: Client, consented: boolean) {
    if (consented) {
        return this.removePlayer(client);
    }

    try {
        await this.allowReconnection(client, 5);
        this.broadcast("log", (this.isOwner(client) ? this.state.player1.name : this.state.player2.name) + " has reconnected to the room!");
    }
    catch (err) {
        return this.removePlayer(client);
    }
  }

    async removePlayer(client:Client) {
        if (this.state.isStarted) {
            this.broadcast("endSong");
        }
        
        this.broadcast("log", this.getStatePlayer(client).name + " has left the room!");

        this.presence.hset(this.IPS_CHANNEL, this.clientsIP.get(client), ((Number.parseInt(await this.presence.hget(this.IPS_CHANNEL, this.clientsIP.get(client))) - 1) + ""));
        this.clientsIP.delete(client);

        this.state.player1.isReady = false;
        this.state.player2.isReady = false;

        if (this.isOwner(client))
            this.disconnect(4000);
        else
            this.state.player2 = new Player();
    }

  async onDispose() {
    this.presence.srem(this.LOBBY_CHANNEL, this.roomId);
    for (var ip in this.clientsIP) {
      this.presence.hset(this.IPS_CHANNEL, ip, ((Number.parseInt(await this.presence.hget(this.IPS_CHANNEL, ip)) - 1) + ""));
    }
    this.clientsIP = null;
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

  isGf(client:Client) {
    return this.clients.indexOf(client) == 2;
  }

  getStatePlayer(client:Client):Player {
    if (this.isGf(client)) {
      return null;
      //return this.state.player3;
    }

    return (this.isOwner(client) ? this.state.player1 : this.state.player2);
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

  async isClientAllowed(client: Client, request: IncomingMessage): Promise<Boolean> {
    var requesterIP = null;
    if (request.headers['x-forwarded-for']) {
      requesterIP = (request.headers['x-forwarded-for'] as String).split(",")[0].trim();
    }
    else {
      requesterIP = request.socket.remoteAddress;
    }

    const currentIps = await this.presence.hget(this.IPS_CHANNEL, requesterIP);
    var ipOccurs = !currentIps ? 0 : Number.parseInt(currentIps);
    if (ipOccurs < 4) {
      await this.presence.hset(this.IPS_CHANNEL, requesterIP, (ipOccurs + 1) + "");
      this.clientsIP.set(client, requesterIP);
      return true;
    }
    return false;
  }
}
