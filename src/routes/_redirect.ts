import { Router } from 'express';
import { db } from '../database/db';

const redirectRouter = Router();

// forward deprecated urls to new ones

redirectRouter.get("/network/user*x", (req, res) => {
    // #swagger.deprecated = true
    res.redirect(req.url.substring("/network".length));
});

redirectRouter.get("/api/avatar*x", (req, res) => {
    // #swagger.deprecated = true

    // temporary, the client doesn't have http location header support for relative paths in the latest release
    res.redirect('https://funkin.sniro.boo/api/user' + req.url.substring("/api".length));
});

redirectRouter.get("/api/background*x", (req, res) => {
    // #swagger.deprecated = true
    res.redirect('/api/user' + req.url.substring("/api".length));
});

redirectRouter.get("/api/account/cookie", (req, res) => {
    // #swagger.deprecated = true
    res.redirect('/api/auth' + req.url.substring("/api/account".length));
});

redirectRouter.get("/api/account/logout", (req, res) => {
    // #swagger.deprecated = true
    res.redirect('/api/auth' + req.url.substring("/api/account".length));
});

redirectRouter.get("/mod/:mod_id/dl/:dl_id", async (req, res) => {
    const url = await db.mods.giveDownloadURLForID(req.params.mod_id + ':' + req.params.dl_id);
    if (!url)
        return res.sendStatus(404);
    res.redirect(url);
});

export default redirectRouter;