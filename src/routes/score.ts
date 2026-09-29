import { Router } from 'express';
import { setCooldown } from '../cooldown';
import { db } from '../database/db';
import { authUser, checkAccess, getIDToken } from '../database/db.util';

const scoreRouter = Router();

scoreRouter.get("/replay", async (req, res) => {
    // #swagger.tags = ['Scores']

    if (!req.query.id)
        return res.sendStatus(400);

    res.setHeader('content-type', 'application/json');

    const score = await db.scores.getByID(req.query.id as string);
    if (!score)
        return res.sendStatus(404);

    const file = await db.scores.getReplayFileByID(score.replayFileId);
    if (!file)
        return res.sendStatus(404);

    const replay = JSON.parse(file.data.toString());
    replay.player = await db.users.getNameByID(score.player);
    replay.songId = score.songId;
    res.send(replay);
});

setCooldown("/api/score/report", 20);
scoreRouter.post("/report", checkAccess, async (req, res) => {
    // #swagger.tags = ['Scores']

    const [id, _] = getIDToken(req);

    res.json(await db.reports.submit(id, req.body.content));
});

// submits user replay to the leaderboard system
// requires replay data json data
setCooldown("/api/score/submit", 30);
scoreRouter.post("/submit", checkAccess, async (req, res) => {
    // #swagger.tags = ['Scores']

    const [id, _] = getIDToken(req);

    res.json(await db.scores.submit(db.users.byID(id), req.body));
});

scoreRouter.get("/delete", checkAccess, async (req, res) => {
    // #swagger.tags = ['Scores']

    const reqPlayerRef = await authUser(req);
    if (!reqPlayerRef)
        return res.sendStatus(403);
    await db.scores.removeByIDs(req.query.id as string, false, await reqPlayerRef.getID());
    return res.sendStatus(200);
});

scoreRouter.get("/set/modurl", checkAccess, async (req, res) => {
    // #swagger.tags = ['Scores']

    const reqPlayerRef = await authUser(req);
    if (!reqPlayerRef)
        return res.sendStatus(403);

    const score = await db.scores.getByID(req.query.id as string);
    if (score.player != await reqPlayerRef.getID())
        return res.sendStatus(403);

    await db.scores.setModURLForID(req.query.id as string, req.query.url as string);
    return res.sendStatus(200);
});

export default scoreRouter;