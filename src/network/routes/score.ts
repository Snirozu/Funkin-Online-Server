import { Application, Express } from 'express';
import { getScore, getReplayFile, checkAccess, getIDToken, submitReport, submitScore, getPlayerNameByID, removeScore, authPlayer, setScoreModURL } from '../database';
import { setCooldown } from '../../cooldown';

export class ScoreRoute {
    static init(app: Application) {
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

                const replay = JSON.parse(file.data.toString());
                replay.player = await getPlayerNameByID(score.player);
                replay.songId = score.songId;
                res.send(replay);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        setCooldown("/api/score/report", 20);
        app.post("/api/score/report", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);

                res.json(await submitReport(id, req.body.content));
            }
            catch (exc: any) {
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't report..."
                });
            }
        });

        // submits user replay to the leaderboard system
        // requires replay data json data
        setCooldown("/api/score/submit", 30);
        app.post("/api/score/submit", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);

                res.json(await submitScore(id, req.body));
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't submit..."
                });
            }
        });

        app.get("/api/score/delete", checkAccess, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                if (!reqPlayer)
                    return res.sendStatus(403);
                await removeScore(req.query.id as string, false, reqPlayer.id);
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/score/set/modurl", checkAccess, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                if (!reqPlayer)
                    return res.sendStatus(403);

                const score = await getScore(req.query.id as string);
                if (score.player != reqPlayer.id)
                    return res.sendStatus(403);

                await setScoreModURL(req.query.id as string, req.query.url as string);
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });
    }
}