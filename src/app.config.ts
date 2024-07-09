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
import { checkSecret, genAccessToken, resetSecret, createUser, submitScore, checkLogin, submitReport, getPlayerByID, getPlayerByName, renamePlayer, pingPlayer, getIDToken, topScores, getScoreReplay, topPlayers } from "./network";
import cookieParser from "cookie-parser";
import TimeAgo from "javascript-time-ago";
import en from 'javascript-time-ago/locale/en'

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US')

export default config({

    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('room', GameRoom);

    },

    initializeExpress: (app) => {
        app.use(bodyParser.json({ limit: '2mb' }));
        app.use(bodyParser.urlencoded({ limit: '2mb' }));
        app.use(cookieParser());

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
            res.send(Assets.HTML_STATS.replaceAll("$PLAYERS_ONLINE$", playerCount + "").replaceAll("$HOST$", "https://" + req.hostname));
        });

        app.get("/api/front", async (req, res) => {
            var rooms = await matchMaker.query();
            let playerCount = 0;
            let roomCount = 0;
            if (rooms.length >= 1) {
                rooms.forEach((room) => {
                    playerCount += room.clients;
                    if (!room.private && room.clients == 1)
                        roomCount += 1;
                });
            }

            const player = await getPlayerByID(Assets.FRONT_MESSAGE_PLAYER);

            res.send({
                online: playerCount,
                rooms: roomCount,
                sez: (player && Assets.FRONT_MESSAGE && Assets.FRONT_MESSAGE_PLAYER ? player.name + ' sez: "' + Assets.FRONT_MESSAGE + '"' : null)
            });
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

        if (process.env["STATS_ENABLED"] == "true") {
            app.get("/api/stats/day_players", (req, res) => {
                res.send(Assets.DAY_PLAYERS);
            });

            app.get("/api/stats/country_players", (req, res) => {
                let returnMap: Map<string, number> = new Map<string, number>();
                for (var key in Assets.COUNTRY_PLAYERS) {
                    if (Assets.COUNTRY_PLAYERS.hasOwnProperty(key)) {
                        returnMap.set(key, Assets.COUNTRY_PLAYERS[key].length);
                    }
                }
                res.send(Object.fromEntries(returnMap));
            });
        }

        //every post request should be in a json format
        if (process.env["NETWORK_ENABLED"] == "true") {
            // will move this to react
            app.get("/network*", async (req, res) => {
                try {
                    const params = (req.params as Array<string>)[0].split("/");
                    switch (params[1]) {
                        case undefined:
                        case "":
                            res.send("home");
                            break;
                        case "user":
                            const player = await getPlayerByName(params[2]);

                            if (!player)
                                throw { error_message: "Player not found!" };

                            res.send("<h2>" + player.name + "</h2><hr>Points: " + player.points + "<br>Online: " + (Date.now() - player.lastActive.getTime() < 1000 * 90 ? "Now" : timeAgo.format(player.lastActive)) + "<br>Joined: " + new Date(player.joined).toDateString());
                            break;
                        default:
                            res.send("unknown page");
                            break;
                    }
                }
                catch (exc:any) {
                    res.status(400).send(exc.error_message ?? "Unknown error...");
                }
            });

            /*
            -
            API STUFF
            -
            */

            //GET

            app.get("/api/network/score/replay", async (req, res) => {
                if (!req.query.id)
                    return res.sendStatus(400);

                res.send(await getScoreReplay(req.query.id as string));
            });

            app.get("/api/network/top/song", async (req, res) => {
                if (!req.query.song)
                    return res.sendStatus(400);

                const _top = await topScores(req.query.song as string, Number.parseInt(req.query.strum as string ?? "0"), Number.parseInt(req.query.page as string ?? "0"));
                const top:any[] = [];
                for (const score of _top) {
                    top.push({
                        score: score.score,
                        accuracy: score.accuracy,
                        points: score.points,
                        player: (await getPlayerByID(score.player)).name,
                        submitted: score.submitted,
                        id: score.id
                    });
                }
                res.send(top);
            });

            app.get("/api/network/top/players", async (req, res) => {
                const _top = await topPlayers(Number.parseInt(req.query.page as string ?? "0"));
                const top: any[] = [];
                for (const score of _top) {
                    top.push({
                        player: score.name,
                        points: score.points
                    });
                }
                res.send(top);
            });

            // ping for successful authorization
            app.get("/api/network/account/ping", checkLogin, async (req, res) => {
                const [id, token] = getIDToken(req);
                
                res.send((await pingPlayer(id)).name);
            });

            // saves the auth cookie in the browser
            app.get("/api/network/account/cookie", async (req, res) => {
                if (!req.query.id || !req.query.token) return;

                res.cookie("authid", req.query.id, {
                    expires: new Date(253402300000000)
                });

                res.cookie("authtoken", req.query.token, {
                    expires: new Date(253402300000000)
                });

                const user = await getPlayerByID(String(req.query.id));

                res.redirect('/network/user/' + user.name);
            });

            // logs out the user of the website
            app.get("/api/network/account/logout", async (req, res) => {
                res.clearCookie('authid');
                res.clearCookie('authtoken');
                res.sendStatus(200);
            });

            //POST

            app.post("/api/network/sez", checkLogin, async (req, res) => {
                if (req.body.message && req.body.message.length < 80 && !(req.body.message as string).includes("\n")) {
                    const [id, _] = getIDToken(req);
                    const player = await getPlayerByID(id);
                    
                    Assets.FRONT_MESSAGE = req.body.message;
                    Assets.FRONT_MESSAGE_PLAYER = player.id;
                    res.sendStatus(200);
                    return;
                }
                if (!req.body.message)
                    res.sendStatus(418);
                else
                    res.sendStatus(413);
            });

            app.post("/api/network/account/rename", checkLogin, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    res.send((await renamePlayer(id, req.body.username)).name);
                }
                catch (exc: any) {
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't report..."
                    });
                }
            });

            // reports a replay to me!!!!
            // requires `content` json body field
            app.post("/api/network/score/report", checkLogin, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    res.json(await submitReport(id, req.body));
                }
                catch (exc: any) {
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't report..."
                    });
                }
            });

            // submits user replay to the leaderboard system
            // requires replay data json data
            app.post("/api/network/score/submit", checkLogin, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    res.json(await submitScore(id, req.body));
                }
                catch (exc: any) {
                    console.log(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't submit..."
                    });
                }
            });
            
            // registers the user to the database
            // requires 'username' json body field
            // todo to add user deletion from the database
            app.post("/api/network/auth/register", async (req, res) => {
                try {
                    const user = await createUser(req.body.username);
                    res.json({
                        id: user.id,
                        token: await genAccessToken(user.id),
                        secret: user.secret
                    });
                }
                catch (exc: any) {
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't register..."
                    });
                }
            });

            // resets the token and secret
            // doesnt require a body but requires to use secret instead of token in the authentication header
            app.post("/api/network/auth/reset", checkSecret, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);
                    
                    const user = await resetSecret(id);
                    res.json({
                        id: id,
                        token: await genAccessToken(user.id),
                        secret: user.secret
                    });
                }
                catch (exc: any) {
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't reset credentials..."
                    });
                }
            });
        }

        app.get("/", async (req, res) => {
            var rooms = await matchMaker.query();
            let playerCount = 0;
            if (rooms.length >= 1) {
                rooms.forEach((room) => {
                    playerCount += room.clients;
                });
            }
            res.send(Assets.HTML_HOME.replaceAll("$PLAYERS_ONLINE$", playerCount + ""));
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

        if (process.env["STATS_ENABLED"] == "true") {
            // refresh stats every 10 minutes
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

            // stats every minute
            setInterval(async function () {
                if (!fs.existsSync("database/")) {
                    fs.mkdirSync("database/");
                }

                fs.writeFileSync("database/country_players.json", JSON.stringify(Assets.COUNTRY_PLAYERS));
            }, 1000 * 60);
        }
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});
