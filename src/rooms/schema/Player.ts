import { MapSchema, Schema, type } from "@colyseus/schema";

export class Person extends Schema {
    @type("string") name: string = "";
    @type("number") ping: number = 0;
    @type("boolean") hasSong: boolean = false;
    @type("boolean") hasLoaded: boolean = false;
    @type("boolean") verified: boolean = false;
    @type("string") status: string = "";
}

export class ColorArray extends Schema {
    // since colyseus doesn't support 2D arrays we have to use 1D array
    @type({ array: "number" }) value: number[] = [];
}

export class Player extends Person {
    @type("number") ox: number = 0;
    @type("number") score: number = 0;
    @type("number") misses: number = 0;
    @type("number") sicks: number = 0;
    @type("number") goods: number = 0;
    @type("number") bads: number = 0;
    @type("number") shits: number = 0;
    @type("number") songPoints: number = 0;
    @type("number") maxCombo: number = 0;
    @type("boolean") bfSide: boolean = false;
    @type("boolean") hasEnded: boolean = false;
    @type("boolean") isReady: boolean = false;
    @type("string") skinMod: string = null;
    @type("string") skinName: string = null;
    @type("string") skinURL: string = null;
    @type("number") points: number = 0;
    @type("boolean") botplay: boolean = false;
    @type("boolean") noteHold: boolean = false;

    @type("string") noteSkin: string = null;
    @type("string") noteSkinMod: string = null;
	@type("string") noteSkinURL: string = null;

    @type({ map: "string" }) gameplaySettings = new MapSchema<string>();

    // maniaK => colors
    @type({ map: ColorArray }) arrowColors = new MapSchema<ColorArray>();
    // maniaK => colorsPixel
    @type({ map: ColorArray }) arrowColorsPixel = new MapSchema<ColorArray>();
}
