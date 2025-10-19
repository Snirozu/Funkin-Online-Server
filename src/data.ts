import fs from 'fs';
import { GameRoom } from "./rooms/GameRoom";
import { ConfigData } from "./data.config";
import { PersistentData } from "./data.persistent";
import { loadCooldownData } from './cooldown';

export class Data {
    public static PERSIST: PersistentData;
    public static INFO: InfoData;
    public static CONFIG: ConfigData;

    static async init() {
        if (!fs.existsSync("database/"))
            fs.mkdirSync("database/");
        
        Data.PERSIST = new PersistentData();
        Data.PERSIST.load();

        Data.INFO = new InfoData();
        Data.INFO.load();

        Data.CONFIG = new ConfigData();
        await Data.CONFIG.load();

        await loadCooldownData();
    }
}

export class InfoData {
    public DAY_PLAYERS: any[] = [];
    public COUNTRY_PLAYERS: any = {};
    public ONLINE_PLAYERS: string[] = [];
    public MAP_USERNAME_PLAYINGROOM: Map<string, GameRoom> = new Map<string, GameRoom>();

    load() {
        if (fs.existsSync("database/day_players.json"))
            this.DAY_PLAYERS = JSON.parse(fs.readFileSync("database/day_players.json", 'utf8'));
        if (fs.existsSync("database/country_players.json"))
            this.COUNTRY_PLAYERS = JSON.parse(fs.readFileSync("database/country_players.json", 'utf8'));
    }
}