import { Router } from 'express';
import { Data } from '../data';

const statsRouter = Router();

statsRouter.get("/day_players", (_req, res) => {
    // #swagger.tags = ['Statistics']

    res.send(Data.INFO.DAY_PLAYERS);
});

statsRouter.get("/country_players", (_req, res) => {
    // #swagger.tags = ['Statistics']

    const returnMap: Map<string, number> = new Map<string, number>();
    for (const key in Data.INFO.COUNTRY_PLAYERS) {
        if (Data.INFO.COUNTRY_PLAYERS.hasOwnProperty(key)) {
            returnMap.set(key, Data.INFO.COUNTRY_PLAYERS[key].length);
        }
    }
    res.send(Object.fromEntries(returnMap));
});

export default statsRouter;