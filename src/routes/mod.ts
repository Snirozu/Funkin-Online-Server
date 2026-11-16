import { Router } from 'express';
import { logActionOnRequest } from '../mods';
import { checkAccess, getIDToken, hasAccess, userIDsToNames } from '../database/db.util';
import { db } from '../database/db';
import { ResponseError } from '../error';
import { UploadedFile } from 'express-fileupload';
import { Image } from 'canvas';

async function canManageMod(userid: string, modid:string) {
    const userRef = db.users.byID(userid);
    const user = await userRef.getLoginState();
    const mod = await db.mods.getByID(modid);
    return hasAccess(user.role, 'admin.mods.manage') || mod.submitterid == user.id;
}

const modRouter = Router();

modRouter.post("/dl/submit", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userid, _] = getIDToken(req);
    if (!(await canManageMod(userid, req.body.mod_id as string)))
        return res.sendStatus(403)

    await db.mods.submitDownloadForID(req.body.id as string, req.body.urls as string[], req.body.mod_id as string);
    res.sendStatus(200);
});

modRouter.post("/dl/delete", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userid, _] = getIDToken(req);

     if (!req.body.id.includes(':'))
        throw new ResponseError("The ID is incomplete!");
    const modId = req.body.id.split(':')[0];

    if (!(await canManageMod(userid, modId)))
        return res.sendStatus(403)

    await db.mods.removeDownloadForID(req.body.id as string);
    res.sendStatus(200);
});

modRouter.post("/dl/edit", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userid, _] = getIDToken(req);

    const modDownload = await db.mods.getModDownload(req.body.id);
    if (!modDownload)
        throw new ResponseError("Non-existent Mod Download!");

    if (!(await canManageMod(userid, modDownload.modID)))
        return res.sendStatus(403)

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

    const mod:any = await db.mods.getByID(req.params.mod_id);
    if (!mod)
        return res.sendStatus(404);
    mod.favorited = await userIDsToNames(mod.favorited);
    if (mod.submitter != null) {
        mod.submitter.clubTag = await db.users.byID(mod.submitterid).getClubTag();
    }
    mod.submitterid = undefined;
    res.status(200).send(mod);
});

modRouter.post("/submit", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userid, _] = getIDToken(req);
    res.send(await db.mods.submit(userid, req.body));
});

modRouter.post("/edit", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userid, _] = getIDToken(req);
    if (!(await canManageMod(userid, req.body.id)))
        return res.sendStatus(403)

    res.send(await db.mods.edit(req.body));
});

modRouter.post("/delete", checkAccess, logActionOnRequest, async (req, res) => {
    // #swagger.tags = ['Mods']

    const [userid, _] = getIDToken(req);
    if (!(await canManageMod(userid, req.body.id)))
        return res.sendStatus(403)

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

modRouter.post("/category/create", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    res.status(200).send(await db.mods.createModCategory(req.body.name, req.body.description));
});

modRouter.post("/category/update", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    res.status(200).send(await db.mods.updateModCategory(req.body.id, req.body));
});

modRouter.get("/categories/:id", async (req, res) => {
    // #swagger.tags = ['Mods']

    res.status(200).send(await db.mods.getModCategoryByID(req.params.id));
});

modRouter.get("/categories", async (_, res) => {
    // #swagger.tags = ['Mods']

    res.status(200).send(await db.mods.getModCategories());
});

modRouter.post("/category/icon", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    const modCategory = await db.mods.getModCategoryByID(req.query.id as string);

    const file = req.files.file as UploadedFile;
    if (file.size > 1024 * 350) {
        return res.sendStatus(413);
    }

    if (file.mimetype != 'image/png' && file.mimetype != 'image/jpeg' && file.mimetype != 'image/gif') {
        return res.sendStatus(415);
    }

    const img = new Image();
    img.onload = async function () {
        if (img.width != 64 && img.height != 64) {
            return res.status(400).json({
                error: 'Image must be in size of 64x64px!'
            });
        }

        if (!await db.mods.uploadCategoryIcon(modCategory.id, file.data)) {
            return res.sendStatus(500);
        }
        res.sendStatus(200);
    }
    img.onerror = function () {
        res.status(500).json({
            error: 'Server failed to read the image.'
        });
    }
    img.src = "data:" + file.mimetype + ";base64," + file.data.toString("base64");
});

modRouter.get("/category/icon/:id", async (req, res) => {
    // #swagger.tags = ['Mods']

    const file = await db.mods.getCategoryIcon(req.params.id);
    if (!file)
        return res.sendStatus(404);

    res.send(file.data);
});

modRouter.post("/verify", checkAccess, async (req, res) => {
    // #swagger.tags = ['Mods']

    await db.mods.verifyForID(req.body.id);

    res.sendStatus(200);
});

export default modRouter;