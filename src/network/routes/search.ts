import { Express } from 'express';
import { searchSongs, searchUsers } from '../database';

export class SearchRoute {
    static init(app: Express) {
        app.get("/api/search/songs", async (req, res) => {
            try {
                res.send(await searchSongs(req.query.q as string));
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "None found...");
            }
        });

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