import { Schema, type } from "@colyseus/schema";
import { Player } from "./Player";

export class RoomState extends Schema {
  @type("string") song:string = "none";
  @type("string") folder: string = "";
  @type("number") diff: number = 1;
  @type("string") modDir: string = "";
  @type(Player) player1:Player;
  @type(Player) player2:Player;
  //@type(Player) player3:Player;
  @type("boolean") isPrivate: boolean = true;
  @type("boolean") isStarted: boolean = false;
  @type("boolean") swagSides: boolean = false;
  @type("boolean") anarchyMode: boolean = false;
  @type("number") health: number = 0.0;
}
