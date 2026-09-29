import { Router } from 'express';
import { logActionOnRequest } from '../mods';
import { checkAccess, getIDToken, hasAccess, userIDsToNames } from '../database/db.util';
import { db } from '../database/db';
import { ResponseError } from '../error';

const modRouter = Router();

modRouter.post("/dl/submit", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    await db.mods.submitDownloadForID(req.body.id as string, req.body.urls as string[], req.body.mod_id as string);
    res.sendStatus(200);
});

modRouter.post("/dl/delete", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    await db.mods.removeDownloadForID(req.body.id as string);
    res.sendStatus(200);
});

modRouter.post("/dl/edit", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    await db.mods.editDownload(req.body);
    res.sendStatus(200);
});

modRouter.post("/fav", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userId, _] = getIDToken(req);
    await db.mods.toggleFavorite(userId, req.body.id as string);
    res.sendStatus(200);
});

modRouter.get("/details/:mod_id", async (req, res) => {
    // #swagger.tags = ['Mods']

    const mod = await db.mods.getByID(req.params.mod_id);
    if (!mod)
        return res.sendStatus(404);
    mod.favorited = await userIDsToNames(mod.favorited);
    res.status(200).send(mod);
});

modRouter.post("/submit", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    res.send(await db.mods.submit(req.body));
});

modRouter.post("/edit", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    res.send(await db.mods.edit(req.body));
});

modRouter.post("/delete", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    res.send(await db.mods.delete(req.body));
});

modRouter.post("/comment/react", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userId, _] = getIDToken(req);
    res.status(200).send(await db.mods.reactComment(userId, req.body.name, req.body.id));
});

modRouter.post("/comment/post", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userId, _] = getIDToken(req);
    res.status(200).send(await db.mods.submitComment(db.users.byID(userId), req.body));
});

modRouter.get("/comment/remove", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [id, _] = getIDToken(req);

    const userRef = db.users.byID(id);
    const user = await userRef.getLoginState();

    const comment = await db.mods.getComment(req.query.id as string);
    const canForceIt = hasAccess(user.role, 'admin.mod.comment.remove');

    if (!canForceIt && comment.by != id) {
        throw new ResponseError('No permissions!');
    }

    res.status(200).send(await db.mods.removeComment(req.query.id as string));
});

modRouter.get("/comments/:id", async (req, res) => {
    // #swagger.tags = ['Mods']

    const comments = await db.mods.getCommentsForID(req.params.id, Number.parseInt(req.query.page as string ?? "0"));
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

export default modRouter;