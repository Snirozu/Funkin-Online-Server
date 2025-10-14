import { Express } from 'express';
import { getScore, getReplayFile, checkAccess, getIDToken, submitReport, submitScore } from '../database';

export class ScoreRoute {
    static init(app: Express) {
        app.get("/api/score/replay", async (req, res) => {
            try {
                if (!req.query.id)
                    return res.sendStatus(400);

                res.setHeader('content-type', 'application/json');

                const score = await getScore(req.query.id as string);
                if (!score)
                    return res.sendStatus(404);

                const file = await getReplayFile(score.replayFileId);
                if (!file)
                    return res.sendStatus(404);

                res.send(file.data);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        // requires `content` json body field
        app.post("/api/score/report", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);

                res.json(await submitReport(id, req.body));
            }
            catch (exc: any) {
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't report..."
                });
            }
        });

        // submits user replay to the leaderboard system
        // requires replay data json data
        app.post("/api/score/submit", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);

                res.json(await submitScore(id, req.body));
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