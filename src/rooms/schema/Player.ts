import { Schema, type } from "@colyseus/schema";

export class Player extends Schema {
    @type("number") score:number = 0;
    @type("number") misses: number = 0;
    @type("number") sicks: number = 0;
    @type("number") goods: number = 0;
    @type("number") bads: number = 0;
    @type("number") shits: number = 0;
    @type("number") songPoints: number = 0;
    @type("number") maxCombo: number = 0;
    @type("string") name: string = "";
    @type("boolean") hasSong: boolean = false;
    @type("boolean") hasLoaded: boolean = false;
    @type("boolean") hasEnded: boolean = false;
    @type("number") ping: number = 0;
    @type("boolean") isReady: boolean = false;
    @type("string") skinMod: string = null;
    @type("string") skinName: string = null;
    @type("string") skinURL: string = null;
    @type("number") points: number = 0;
    @type("string") status: string = "";
    @type("boolean") botplay: boolean = false;
    @type("boolean") verified: boolean = false;

    @type({ array: "number" }) arrowColor0: number[] = [];
    @type({ array: "number" }) arrowColor1: number[] = [];
    @type({ array: "number" }) arrowColor2: number[] = [];
    @type({ array: "number" }) arrowColor3: number[] = [];

    @type({ array: "number" }) arrowColorP0: number[] = [];
    @type({ array: "number" }) arrowColorP1: number[] = [];
    @type({ array: "number" }) arrowColorP2: number[] = [];
    @type({ array: "number" }) arrowColorP3: number[] = [];
}
