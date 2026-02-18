import { Application, Express } from 'express';

// forward deprecated urls to new ones

export class RedirectRoutes {
    static init(app: Application) {
        app.get("/network/user*", async (req, res) => {
            res.redirect(req.url.substring("/network".length));
        });

        app.get("/api/avatar*", async (req, res) => {
            // temporary, the client doesn't have http location header support for relative paths in the latest release
            res.redirect('https://funkin.sniro.boo/api/user' + req.url.substring("/api".length));
        });

        app.get("/api/background*", async (req, res) => {
            res.redirect('/api/user' + req.url.substring("/api".length));
        });

        app.get("/api/account/cookie", async (req, res) => {
            res.redirect('/api/auth' + req.url.substring("/api/account".length));
        });

        app.get("/api/account/logout", async (req, res) => {
            res.redirect('/api/auth' + req.url.substring("/api/account".length));
        });
    }
}