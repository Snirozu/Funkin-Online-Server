import { Application, Express } from 'express';
import { checkAccess, deleteMod, editDownloadForMod, editMod, getIDToken, getMod, giveDownloadURL, removeDownloadForMod, searchSongs, searchUsers, submitDownloadForMod, submitMod, toggleFavMod, userIDsToNames } from '../database';
import { setCooldown } from '../../cooldown';
import { logActionOnRequest } from '../mods';

export class ModRoute {
    static init(app: Application) {
        app.get("/mod/:mod_id/dl/:dl_id", async (req, res) => {
            try {
                const url = await giveDownloadURL(req.params.mod_id + ':' + req.params.dl_id);
                if (!url)
                    return res.sendStatus(404);
                res.redirect(url);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });

        app.post("/api/mod/dl/submit", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await submitDownloadForMod(req.body.id as string, req.body.urls as string[], req.body.mod_id as string);
                res.sendStatus(200);
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });

        app.post("/api/mod/dl/delete", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await removeDownloadForMod(req.body.id as string);
                res.sendStatus(200);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });

        app.post("/api/mod/dl/edit", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await editDownloadForMod(req.body);
                res.sendStatus(200);
            }
            catch (exc: any) {
                console.log(exc);
                res.status(400).send(exc?.error_message ?? "Failed to submit...");
            }
        });

        app.post("/api/mod/fav", checkAccess, async (req, res) => {
            try {
                const [userId, _] = getIDToken(req);
                await toggleFavMod(userId, req.body.id as string);
                res.sendStatus(200);
            }
            catch (exc: any) {
                console.log(exc);
                res.status(400).send(exc?.error_message ?? "Failed to submit...");
            }
        });

        app.get("/api/mod/details/:mod_id", async (req, res) => {
            try {
                const mod = await getMod(req.params.mod_id);
                if (!mod)
                    return res.sendStatus(404);
                mod.favorited = await userIDsToNames(mod.favorited);
                res.status(200).send(mod);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });

        app.post("/api/mod/submit", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                res.send(await submitMod(req.body));
            }
            catch (exc: any) {
                console.log(exc);
                res.status(400).send(exc?.error_message ?? "Failed to submit...");
            }
        });

        app.post("/api/mod/edit", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                res.send(await editMod(req.body));
            }
            catch (exc: any) {
                console.log(exc);
                res.status(400).send(exc?.error_message ?? "Failed to submit...");
            }
        });

        app.post("/api/mod/delete", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                res.send(await deleteMod(req.body));
            }
            catch (exc: any) {
                console.log(exc);
                res.status(400).send(exc?.error_message ?? "Failed to submit...");
            }
        });
    }
}