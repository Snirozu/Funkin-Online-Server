import { GameRoom } from "./rooms/GameRoom";

export class Data {
    public static PROTOCOL_VERSION = 8;
    public static DAY_PLAYERS: any[] = [];
    public static COUNTRY_PLAYERS: any = {};
    public static ONLINE_PLAYERS: string[] = [];
    public static MAP_USERNAME_PLAYINGROOM: Map<string, GameRoom> = new Map<string, GameRoom>();
    public static FRONT_MESSAGES: SezData[] = [];
    public static EMAIL_BLACKLIST: string[] = [];
}

class SezData {
    player: string
    message: string
}