import { GameRoom } from "./rooms/GameRoom";

export class Data {
    public static PROTOCOL_VERSION = 9;
    public static NETWORK_PROTOCOL_VERSION = 8;
    public static DAY_PLAYERS: any[] = [];
    public static COUNTRY_PLAYERS: any = {};
    public static ONLINE_PLAYERS: string[] = [];
    public static MAP_USERNAME_PLAYINGROOM: Map<string, GameRoom> = new Map<string, GameRoom>();
    public static EMAIL_BLACKLIST: string[] = [];
    public static PUBLIC: PublicData;
}

export class PublicData {
    public FRONT_MESSAGES: SezData[] = [];
    public LOGGED_MESSAGES: Array<Array<any>> = []; // array<any> is [content, unix_timestamp]
}

class SezData {
    player: string
    message: string
}