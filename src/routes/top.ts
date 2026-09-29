import { Router } from 'express';
import { db } from '../database/db';

const topRouter = Router();

topRouter.get("/song", async (req, res) => {
    // #swagger.tags = ['Leaderboard']

    if (!req.query.song)
        return res.sendStatus(400);

    const _top = await db.scores.top(req.query.song as string, Number.parseInt(req.query.strum as string ?? "2"), Number.parseInt(req.query.page as string ?? "0"), Number.parseInt(req.query.keys as string), req.query.category as string, req.query.sort as string);
    const top = [];
    for (const score of _top) {
        top.push({
            score: score.score,
            accuracy: score.accuracy,
            points: score.points,
            player: await db.users.getNameByID(score.player),
            submitted: score.submitted,
            id: score.id,
            misses: score.misses,
            modURL: score.modURL,
            sicks: score.sicks,
            goods: score.goods,
            bads: score.bads,
            shits: score.shits,
            playbackRate: score.playbackRate,
        });
    }
    res.send(top);
});

topRouter.get("/players", async (req, res) => {
    // #swagger.tags = ['Leaderboard']

    const _top = await db.users.top(Number.parseInt(req.query.page as string ?? "0"), req.query.country as string, req.query.category as string, req.query.sort as string);
    const top: any[] = [];
    if (_top) {
        for (const player of _top) {
            const playerRef = db.users.byID(player.userRe.id);

            top.push({
                player: player.userRe.name,
                [req.query.sort as string]: player[req.query.sort as string],
                profileHue: player.userRe.profileHue ?? 250,
                profileHue2: player.userRe.profileHue2,
                country: player.userRe.country,
                club: await playerRef.getClubTag()
            });
        }
    }
    res.send(top);
});

topRouter.get("/clubs", async (req, res) => {
    // #swagger.tags = ['Leaderboard']

    if (!req.query.page)
        return res.sendStatus(400);

    const top = await db.clubs.top(parseInt(req.query.page as string));
    if (!top)
        return res.sendStatus(404);

    res.send(top);
});

export default topRouter;