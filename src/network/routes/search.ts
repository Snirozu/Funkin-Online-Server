import { Application, Express } from 'express';
import { searchMods, searchSongs, searchUsers } from '../database';
import { setCooldown } from '../../cooldown';

export class SearchRoute {
    static init(app: Application) {
        setCooldown("/api/search/songs", 1);
        app.get("/api/search/songs", async (req, res) => {
            try {
                res.send(await searchSongs(req.query.q as string, Number.parseInt(req.query.page as string ?? "0")));
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });

        setCooldown("/api/search/users", 1);
        app.get("/api/search/users", async (req, res) => {
            try {
                res.send(await searchUsers(req.query.q as string, Number.parseInt(req.query.page as string ?? "0")));
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });

        setCooldown("/api/search/mods", 1);
        app.get("/api/search/mods", async (req, res) => {
            try {
                res.send(await searchMods(req.query.q as string, Number.parseInt(req.query.page as string ?? "0"), req.query.sort as string));
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });
    }
}