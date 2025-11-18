import { Express } from 'express';
import { topScores, getPlayerNameByID, topPlayers, getPlayerClubTag, topClubs } from '../database';

export class TopRoute {
    static init(app: Express) {
        app.get("/api/top/song", async (req, res) => {
            try {
                if (!req.query.song)
                    return res.sendStatus(400);

                const _top = await topScores(req.query.song as string, Number.parseInt(req.query.strum as string ?? "2"), Number.parseInt(req.query.page as string ?? "0"), Number.parseInt(req.query.keys as string), req.query.category as string, req.query.sort as string);
                const top = [];
                for (const score of _top) {
                    top.push({
                        score: score.score,
                        accuracy: score.accuracy,
                        points: score.points,
                        player: await getPlayerNameByID(score.player),
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
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/top/players", async (req, res) => {
            try {
                const _top = await topPlayers(Number.parseInt(req.query.page as string ?? "0"), req.query.country as string, req.query.category as string, req.query.sort as string);
                const top: any[] = [];
                if (_top) {
                    for (const player of _top) {
                        top.push({
                            player: player.userRe.name,
                            [req.query.sort as string]: player[req.query.sort as string],
                            profileHue: player.userRe.profileHue ?? 250,
                            profileHue2: player.userRe.profileHue2,
                            country: player.userRe.country,
                            club: await getPlayerClubTag(player.userRe.id)
                        });
                    }
                }
                res.send(top);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/top/clubs", async (req, res) => {
            try {
                if (!req.query.page)
                    return res.sendStatus(400);

                const top = await topClubs(parseInt(req.query.page as string));
                if (!top)
                    return res.sendStatus(404);

                res.send(top);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });
    }
}