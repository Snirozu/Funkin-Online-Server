import { Application, Express } from 'express';
import { Data } from '../../data';

export class StatsRoute {
    static init(app: Application) {
        app.get("/api/stats/day_players", (_req, res) => {
            try {
                res.send(Data.INFO.DAY_PLAYERS);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/stats/country_players", (_req, res) => {
            try {
                const returnMap: Map<string, number> = new Map<string, number>();
                for (const key in Data.INFO.COUNTRY_PLAYERS) {
                    if (Data.INFO.COUNTRY_PLAYERS.hasOwnProperty(key)) {
                        returnMap.set(key, Data.INFO.COUNTRY_PLAYERS[key].length);
                    }
                }
                res.send(Object.fromEntries(returnMap));
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });
    }
}