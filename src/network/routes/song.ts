import { Express } from 'express';
import { getSongComments, getPlayerNameByID, checkAccess, getIDToken, submitSongComment } from '../database';

// forward deprecated urls to new ones

export class SongRoute {
    static init(app: Express) {
        app.get("/api/song/comments", async (req, res) => {
            try {
                if (!req.query.id)
                    return res.sendStatus(400);

                const comments = await getSongComments(req.query.id as string);
                if (!comments)
                    return res.sendStatus(404);

                const cmts = [];
                for (const comment of comments) {
                    cmts.push({
                        player: await getPlayerNameByID(comment.by),
                        content: comment.content,
                        at: comment.at
                    });
                }
                res.send(cmts);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.post("/api/song/comment", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);

                res.json(await submitSongComment(id, req.body));
            }
            catch (exc: any) {
                console.log(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't submit..."
                });
            }
        });
    }
}