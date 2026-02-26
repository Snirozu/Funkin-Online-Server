import { Application, Express } from 'express';
import { authPlayer, checkAccess, getAvatar, getBackground, getPlayerByName, getPlayerClubTag, getPlayerIDByName, getPlayerRank, getUserStats, getScoresPlayer, removeFriendFromUser, requestFriendRequest, getUserWarnings, hasAccess, getIDToken, userIDsToNames } from '../database';
import { HttpStatusCode } from 'axios';

export class UserRoute {
    static init(app: Application) {
        app.get("/api/user/friends/remove", checkAccess, async (req, res) => {
            try {
                if (!req.query.name)
                    return res.sendStatus(400);

                await removeFriendFromUser(req);
                res.sendStatus(200);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/user/friends/request", checkAccess, async (req, res) => {
            try {
                if (!req.query.name)
                    return res.sendStatus(400);

                const [id] = getIDToken(req);

                const targetId = await getPlayerIDByName(req.query.name as string);
                if (!targetId)
                    return res.sendStatus(HttpStatusCode.NotFound);

                await requestFriendRequest(id, targetId);
                res.sendStatus(200);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/user/avatar/:user", async (req, res) => {
            try {
                if (!req.params.user)
                    return res.sendStatus(400);

                const file = await getAvatar(await getPlayerIDByName(req.params.user as string));
                if (!file)
                    return res.sendStatus(404);

                res.send(file.data);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/user/background/:user", async (req, res) => {
            try {
                if (!req.params.user)
                    return res.sendStatus(400);

                const file = await getBackground(await getPlayerIDByName(req.params.user as string));
                if (!file)
                    return res.sendStatus(404);

                res.send(file.data);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/user/info", async (req, res) => {
            try {
                if (!req.query.name)
                    return res.sendStatus(400);

                const user = await getPlayerByName(req.query.name as string);
                const stats = await getUserStats(user.id, req.query.category as string);

                if (!user)
                    return res.sendStatus(404);

                res.send({
                    role: user.role,
                    joined: user.joined,
                    lastActive: user.lastActive,
                    profileHue: user.profileHue ?? 250,
                    profileHue2: user.profileHue2,
                    points: stats["points" + (req.query.keys ?? 4) + "k"],
                    avgAccuracy: stats["avgAcc" + (req.query.keys ?? 4) + "k"],
                    rank: await getPlayerRank(user.name, req.query.category as string, Number.parseInt(req.query.keys as string)),
                    country: user.country,
                    club: await getPlayerClubTag(user.id)
                });
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/user/details", async (req, res) => {
            try {
                if (!req.query.name)
                    return res.sendStatus(400);

                const auth = await authPlayer(req, false);
                const user = await getPlayerByName(req.query.name as string);
                const stats = await getUserStats(user.id, req.query.category as string);

                if (!user)
                    return res.sendStatus(404);

                const pingasFriends = user?.friendRequests ?? [];

                res.send({
                    role: user.role,
                    joined: user.joined,
                    lastActive: user.lastActive,
                    isSelf: auth?.id == user.id,
                    bio: user.bio,
                    friends: await userIDsToNames(user.friends),
                    canFriend: !pingasFriends.includes(auth?.id),
                    profileHue: user.profileHue ?? 250,
                    profileHue2: user.profileHue2,
                    points: stats["points" + (req.query.keys ?? 4) + "k"],
                    avgAccuracy: stats["avgAcc" + (req.query.keys ?? 4) + "k"],
                    rank: await getPlayerRank(user.name, req.query.category as string, Number.parseInt(req.query.keys as string)),
                    country: user.country,
                    club: await getPlayerClubTag(user.id),
                    ng: user.ngUrl,
                    warns: await getUserWarnings(user.id, hasAccess(auth, 'mod.warns'))
                });
            }
            catch (exc) {
                res.sendStatus(500);
            }
        });

        app.get("/api/user/scores", async (req, res) => {
            try {
                if (!req.query.name)
                    return res.sendStatus(400);

                const userID = await getPlayerIDByName(req.query.name as string);

                if (!userID)
                    return res.sendStatus(404);

                const coolScores: any[] = [];

                const scores = await getScoresPlayer(userID, Number.parseInt(req.query.page as string ?? "0"), Number.parseInt(req.query.keys as string), req.query.category as string, req.query.sort as string);
                if (!scores)
                    return res.sendStatus(404);
                scores.forEach(score => {
                    const songId = (score.songId as string).split('-');
                    songId.pop();
                    coolScores.push({
                        name: songId.join(" "),
                        songId: score.songId,
                        strum: score.strum,
                        score: score.score,
                        accuracy: score.accuracy,
                        points: score.points,
                        submitted: score.submitted,
                        id: score.id,
                        modURL: score.modURL,
                        misses: score.misses
                    });
                });

                res.send(coolScores);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });
    }
}