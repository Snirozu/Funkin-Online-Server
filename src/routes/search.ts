import { Router } from 'express';
import { setCooldown } from '../cooldown';
import { db } from '../database/db';

const searchRouter = Router();

setCooldown("/api/search/songs", 1);
searchRouter.get("/songs", async (req, res) => {
    // #swagger.tags = ['Search']

    res.send(await db.songs.search(req.query.q as string, Number.parseInt(req.query.page as string ?? "0")));
});

setCooldown("/api/search/users", 1);
searchRouter.get("/users", async (req, res) => {
    // #swagger.tags = ['Search']

    res.send(await db.users.search(req.query.q as string, Number.parseInt(req.query.page as string ?? "0")));
});

setCooldown("/api/search/mods", 1);
searchRouter.get("/mods", async (req, res) => {
    // #swagger.tags = ['Search']

    res.send(await db.mods.search(req.query.q as string, Number.parseInt(req.query.page as string ?? "0"), req.query.sort as string));
});

export default searchRouter;