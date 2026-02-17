import { Schema, MapSchema, type } from "@colyseus/schema";
import { Person, Player } from "./Player";

export class RoomState extends Schema {
  @type("string") song: string = "";
  @type("string") folder: string = "";
  @type("number") diff: number = 1;
  @type({ array: "string" }) diffList: string[] = [];
  @type("string") stageName: string = "";
  @type("string") stageMod: string = "";
  @type("string") stageURL: string = "";
  @type("string") modDir: string = "";
  @type("string") modURL: string = "";
  @type("string") host: string = null;
  @type({ map: Person }) spectators = new MapSchema<Person>();
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("boolean") isPrivate: boolean = true;
  @type("boolean") networkOnly: boolean = false;
  @type("boolean") isStarted: boolean = false;
  @type("boolean") anarchyMode: boolean = false;
  @type("boolean") allPlayersChoose: boolean = false;
  @type("number") health: number = 0.0;
  @type({ map: "string" }) gameplaySettings = new MapSchema<string>();
  @type("boolean") hideGF: boolean = false;
  @type("number") winCondition: number = 0;
  @type("boolean") teamMode: boolean = false;
  @type("boolean") disableSkins: boolean = false;
  @type("boolean") royalMode: boolean = false;
  @type("boolean") royalModeDadSide: boolean = false;
}
