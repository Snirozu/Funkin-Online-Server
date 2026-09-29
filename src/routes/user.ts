import { Router } from 'express';
import { HttpStatusCode } from 'axios';
import { db } from '../database/db';
import { authUser, checkAccess, getIDToken, hasAccess, userIDsToNames } from '../database/db.util';
import { ResponseError } from '../error';

const userRouter = Router();

userRouter.get("/friends/remove", checkAccess, async (req, res) => {
    // #swagger.tags = ['Users']

    if (!req.query.name)
        return res.sendStatus(400);

    const [id] = getIDToken(req);
    const self = db.users.byID(id);

    const target = db.users.byName(req.query.name as string);
    await self.removeFriend(target);

    res.sendStatus(200);
});

userRouter.get("/friends/request", checkAccess, async (req, res) => {
    // #swagger.tags = ['Users']

    if (!req.query.name)
        return res.sendStatus(400);

    const [id] = getIDToken(req);
    const self = db.users.byID(id);

    const target = db.users.byName(req.query.name as string);
    if (!target)
        return res.sendStatus(HttpStatusCode.NotFound);

    await self.addFriend(target);
    res.sendStatus(200);
});

userRouter.get("/avatar/:user", async (req, res) => {
    // #swagger.tags = ['Users']

    if (!req.params.user)
        return res.sendStatus(400);

    const target = db.users.byName(req.params.user as string);

    const file = await target.getAvatar();
    if (!file)
        return res.sendStatus(404);

    res.send(file.data);
});

userRouter.get("/background/:user", async (req, res) => {
    // #swagger.tags = ['Users']

    if (!req.params.user)
        return res.sendStatus(400);

    const target = db.users.byName(req.params.user as string);
    if (!await target.exists())
        return res.sendStatus(404);

    const file = await target.getBackground();
    if (!file)
        return res.sendStatus(404);

    res.send(file.data);
});

userRouter.get("/info", async (req, res) => {
    // #swagger.tags = ['Users']

    if (!req.query.name)
        return res.sendStatus(400);

    const target = db.users.byName(req.query.name as string);

    const user = await target.get();
    const stats = await target.getStats(req.query.category as string);

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
        rank: await target.getRank(req.query.category as string, Number.parseInt(req.query.keys as string)),
        country: user.country,
        club: await target.getClubTag()
    });
});

userRouter.get("/details", async (req, res) => {
    // #swagger.tags = ['Users']

    if (!req.query.name)
        return res.sendStatus(400);

    const authRef = await authUser(req, false);
    const auth = await authRef.get();

    const userRef = db.users.byName(req.query.name as string);
    const user = await userRef.get(); 
    if (!user)
        return res.sendStatus(404);

    const stats = await userRef.getStats(req.query.category as string);

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
        rank: await userRef.getRank(req.query.category as string, Number.parseInt(req.query.keys as string)),
        country: user.country,
        club: await userRef.getClubTag(),
        ng: user.ngUrl,
        warns: await userRef.getWarnings(hasAccess(auth?.role, 'mod.warns'))
    });
});

userRouter.get("/scores", async (req, res) => {
    // #swagger.tags = ['Users']

    if (!req.query.name)
        return res.sendStatus(400);

    const userID = await db.users.byName(req.query.name as string).getID();
    if (!userID)
        return res.sendStatus(404);

    const coolScores: any[] = [];

    const scores = await db.scores.getListForUserID(userID, Number.parseInt(req.query.page as string ?? "0"), Number.parseInt(req.query.keys as string), req.query.category as string, req.query.sort as string);
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
});

userRouter.post("/comment/react", checkAccess, async (req, res) => {
    // #swagger.tags = ['Users']

    const [userId, _] = getIDToken(req);
    res.status(200).send(await db.users.byID(userId).reactComment(req.body.name, req.body.id));
});

userRouter.post("/comment/post", checkAccess, async (req, res) => {
    // #swagger.tags = ['Users']

    const [userId, _] = getIDToken(req);
    res.status(200).send(await db.users.byID(userId).submitComment(req.body));
});

userRouter.get("/comment/remove", checkAccess, async (req, res) => {
    // #swagger.tags = ['Users']

    const [id, _] = getIDToken(req);

    const userRef = db.users.byID(id);
    const user = await userRef.getLoginState();

    const comment = await db.users.getCommentByID(req.query.id as string);
    const canForceIt = hasAccess(user.role, 'admin.user.comment.remove');

    if (!canForceIt && comment.by != id) {
        throw new ResponseError('No permissions!');
    }

    res.status(200).send(await db.users.removeCommentByID(req.query.id as string));
});

userRouter.get("/comments/:name", async (req, res) => {
    // #swagger.tags = ['Users']

    const comments = await db.users.byName(req.params.name as string).getComments(Number.parseInt(req.query.page as string ?? "0"));
    if (!comments)
        return res.sendStatus(404);
    for (const comment of comments.comments) {
        comment.by = await db.users.getNameByID(comment.by);
        (comment as any).byHue = await db.users.getProfileHueByName(comment.by);
        for (const reaction of comment.reactions) {
            reaction.usersIDs = await userIDsToNames(reaction.usersIDs);
        }
    }
    res.status(200).send(comments);
});

export default userRouter;