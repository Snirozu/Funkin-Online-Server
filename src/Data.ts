export class Data {
    public static PROTOCOL_VERSION = 7;
    public static DAY_PLAYERS: any[] = [];
    public static COUNTRY_PLAYERS: any = {};
    public static ONLINE_PLAYERS: string[] = [];
    public static VERIFIED_PLAYING_PLAYERS: string[] = [];
    public static FRONT_MESSAGES: SezData[] = [];
    public static EMAIL_BLACKLIST: string[] = [];
}

class SezData {
    player: string
    message: string
}