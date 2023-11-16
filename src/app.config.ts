import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
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
            var rooms = matchMaker.query({private: false, clients: 1});
            rooms.then((v) => {
                let page = Assets.HTML_THEME + "<b>Available Public Rooms:</b><br>";
                if (v.length >= 1) {
                    v.forEach((room) => {
                        page += "Code: " + room.roomId + " Player: " + room.metadata.name + "<br>";
                    });
                }
                else {
                    page += 'None public.<br><iframe src="https://www.youtube.com/embed/v4YHIYXao9I?autoplay=1" width="560" height="315" frameborder="0" allowfullscreen></iframe>';
                }
                res.send(page);
            })
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
