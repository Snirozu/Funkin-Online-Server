import { Router } from 'express';
import { setCooldown } from '../cooldown';
import { db } from '../database/db';
import { checkAccess, getIDToken } from '../database/db.util';

// forward deprecated urls to new ones

const songRouter = Router();

songRouter.get("/comments", async (req, res) => {
    // #swagger.tags = ['Song']

    if (!req.query.id)
        return res.sendStatus(400);

    const comments = await db.songs.getComments(req.query.id as string);
    if (!comments)
        return res.sendStatus(404);

    const cmts = [];
    for (const comment of comments) {
        cmts.push({
            player: await db.users.getNameByID(comment.by),
            content: comment.content,
            at: comment.at,
            submitted: comment.submitted
        });
    }
    res.send(cmts);
});

setCooldown("/api/song/comment", 20);
songRouter.post("/comment", checkAccess, async (req, res) => {
    // #swagger.tags = ['Song']

    const [id, _] = getIDToken(req);

    res.json(await db.songs.submitComment(db.users.byID(id), req.body));
});

export default songRouter;