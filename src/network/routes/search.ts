import { Express } from 'express';
import { searchSongs, searchUsers } from '../database';
import { setCooldown } from '../../cooldown';

export class SearchRoute {
    static init(app: Express) {
        setCooldown("/api/search/songs", 1);
        app.get("/api/search/songs", async (req, res) => {
            try {
                res.send(await searchSongs(req.query.q as string));
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });

        setCooldown("/api/search/users", 1);
        app.get("/api/search/users", async (req, res) => {
            try {
                res.send(await searchUsers(req.query.q as string));
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });
    }
}