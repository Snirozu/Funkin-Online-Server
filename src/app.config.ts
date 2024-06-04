import config from "@colyseus/tools";
//import { monitor } from "@colyseus/monitor";
//import { playground } from "@colyseus/playground";

/**
 * Import your Room files
 */
import { GameRoom } from "./rooms/GameRoom";
import { matchMaker } from "colyseus";
import { Assets } from "./Assets";
import * as fs from 'fs';
import bodyParser from "body-parser";

export default config({

    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('room', GameRoom);

    },

    initializeExpress: (app) => {
        app.use(bodyParser.raw({ limit: '5mb' }));

        /**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
        app.get("/rooms", async (req, res) => {
            var rooms = await matchMaker.query(/*{private: false, clients: 1}*/);
            let page = Assets.HTML_ROOMS + "<div id='filter'><div id='content'><h3><b>Available Public Rooms:</b></h3>";
            let hasPublicRoom = false;
            let playerCount = 0;

            if (rooms.length >= 1) {
                rooms.forEach((room) => {
                    playerCount += room.clients;
                    if (!room.private && room.clients == 1) {
                        page += "<div class='room'> Code: " + room.roomId + "<br>Player: " + room.metadata.name + "<br>Ping: " + room.metadata.ping + "ms" + "</div>";
                        hasPublicRoom = true;
                    }
                });
            }

            if (!hasPublicRoom) {
                page += 'None public.<br><br><iframe src="https://www.youtube.com/embed/v4YHIYXao9I?autoplay=1" width="560" height="315" frameborder="0" allowfullscreen></iframe> <br>';
            }

            page += "<br style='clear: left'>Players Online: " + playerCount;
            page += "</div>";
            res.send(page);
        });

        app.get("/stats", async (req, res) => {
            var rooms = await matchMaker.query();
            let playerCount = 0;
            if (rooms.length >= 1) {
                rooms.forEach((room) => {
                    playerCount += room.clients;
                });
            }
            res.send(Assets.HTML_STATS.replace("$PLAYERS_ONLINE$", playerCount + ""));
        });

        app.get("/api/online", async (req, res) => {
            var rooms = await matchMaker.query();
            let playerCount = 0;
            if (rooms.length >= 1) {
                rooms.forEach((room) => {
                    playerCount += room.clients;
                });
            }
            res.send(playerCount + "");
        });

        app.get("/api/day_players", (req, res) => {
            res.send(Assets.DAY_PLAYERS);
        });

        app.get("/api/country_players", (req, res) => {
            let returnMap: Map<string, number> = new Map<string, number>();
            for (var key in Assets.COUNTRY_PLAYERS) {
                if (Assets.COUNTRY_PLAYERS.hasOwnProperty(key)) {
                    returnMap.set(key, Assets.COUNTRY_PLAYERS[key].length);
                }
            }
            res.send(Object.fromEntries(returnMap));
        });

        // app.get("/rankings*", async (req, res) => {
        //     const params = (req.params as Array<string>)[0].split("/");
        //     switch (params[1]) {
        //         case undefined:
        //         case "":
        //             res.send("home");
        //             break;
        //         case "submit":
        //             res.send("post");
        //             break;
        //         case "song":
        //             res.send("viewing: " + params[2]);
        //             break;
        //         default:
        //             res.send("unknown page");
        //             break;
        //     }
        // });

        app.get("*", async (req, res) => {
            var rooms = await matchMaker.query();
            let playerCount = 0;
            if (rooms.length >= 1) {
                rooms.forEach((room) => {
                    playerCount += room.clients;
                });
            }
            res.send(Assets.HTML_HOME.replace("$PLAYERS_ONLINE$", playerCount + ""));
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

        // every 10 minutes
        setInterval(async function () {
            var rooms = await matchMaker.query();
            let playerCount = 0;
            if (rooms.length >= 1) {
                rooms.forEach((room) => {
                    playerCount += room.clients;
                });
            }

            Assets.DAY_PLAYERS.push([
                playerCount,
                Date.now()
            ]);

            if (Assets.DAY_PLAYERS.length > 300)
                Assets.DAY_PLAYERS.shift();

            if (!fs.existsSync("database/")) {
                fs.mkdirSync("database/");
            }

            fs.writeFileSync("database/day_players.json", JSON.stringify(Assets.DAY_PLAYERS));
        }, 1000 * 60 * 10);

        // every minute
        setInterval(async function () {
            if (!fs.existsSync("database/")) {
                fs.mkdirSync("database/");
            }

            fs.writeFileSync("database/country_players.json", JSON.stringify(Assets.COUNTRY_PLAYERS));
        }, 1000 * 60);
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});
