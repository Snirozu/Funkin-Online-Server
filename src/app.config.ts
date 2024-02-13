import config from "@colyseus/tools";
//import { monitor } from "@colyseus/monitor";
//import { playground } from "@colyseus/playground";

/**
 * Import your Room files
 */
import { GameRoom } from "./rooms/GameRoom";
import { matchMaker } from "colyseus";
import { Assets } from "./Assets";

export default config({

    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('room', GameRoom);

    },

    initializeExpress: (app) => {
        /**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
        app.get("/rooms", (req, res) => {
            var rooms = matchMaker.query(/*{private: false, clients: 1}*/);
            rooms.then((v) => {
                let page = Assets.HTML_THEME + "<div id='content'><b>Available Public Rooms:</b><br>";
                let hasPublicRoom = false;
                let playerCount = 0;

                if (v.length >= 1) {
                    v.forEach((room) => {
                        playerCount += room.clients;
                        if (!room.private && room.clients == 1) {
                            page += "Code: " + room.roomId + " Player: " + room.metadata.name + " Ping: " + room.metadata.ping + "ms" + "<br>";
                            hasPublicRoom = true;
                        }
                    });
                }

                if (!hasPublicRoom) {
                    page += 'None public.<br><br><iframe src="https://www.youtube.com/embed/v4YHIYXao9I?autoplay=1" width="560" height="315" frameborder="0" allowfullscreen></iframe>';
                }

                page += "<br><br>Players Online: " + playerCount;
                page += "</div>";
                res.send(page);
            })
        });

        app.get("/api/online", (req, res) => {
            var rooms = matchMaker.query();
            rooms.then((v) => {
                let playerCount = 0;
                if (v.length >= 1) {
                    v.forEach((room) => {
                        playerCount += room.clients;
                    });
                }
                res.send(playerCount + "");
            })
        });

        app.get("/api/google/token/auth", async (req, _res) => {
            if (!process.env.GAPI_CLIENT_ID || !process.env.GAPI_CLIENT_SECRET || !req.query.code)
                return;

            let res = await fetch('https://oauth2.googleapis.com/token?' +
                "client_id=" + process.env.GAPI_CLIENT_ID +
                "&client_secret=" + process.env.GAPI_CLIENT_SECRET +
                "&code=" + req.query.code +
                "&redirect_uri=http://localhost:8080" +
                "&grant_type=authorization_code", {
                method: "POST",
                headers: { 'Accept': 'application/json' }
            });
            _res.send(await res.text());
        });

        app.get("/api/google/token/refresh", async (req, _res) => {
            if (!process.env.GAPI_CLIENT_ID || !process.env.GAPI_CLIENT_SECRET || !req.query.refresh_token)
                return;

            let res = await fetch('https://oauth2.googleapis.com/token?' +
                "client_id=" + process.env.GAPI_CLIENT_ID +
                "&client_secret=" + process.env.GAPI_CLIENT_SECRET +
                "&refresh_token=" + req.query.refresh_token +
                "&grant_type=refresh_token", {
                method: "POST",
                headers: { 'Accept': 'application/json' }
            });
            _res.send(await res.text());
        });

        // oauth verification shit idfk?
        app.get("/googleedc467409fad1d08.html", async (req, res) => {
            res.send("google-site-verification: googleedc467409fad1d08.html");
        });

        app.get("*", (req, res) => {
            res.redirect("https://github.com/Snirozu/Funkin-Online-Server");
        });

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        // if (process.env.NODE_ENV !== "production") {
        //     app.use("/", playground);
        // }

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        //app.use("/colyseus", monitor());
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});
