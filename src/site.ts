import * as fs from 'fs';
import { endWeekly, getClub, getPlayerByName, getPlayerClubTag, getPlayerNameByID, getSong, hasAvatar, topPlayers } from "./network/database";
import cookieParser from "cookie-parser";
import express, { Request, Response, Express } from 'express';
import fileUpload from "express-fileupload";
import { logToAll, networkRoom } from "./rooms/NetworkRoom";
import {formatLog, isUserNameInRoom } from "./util";
import cors from 'cors';
import { matchMaker } from "colyseus";
import { RootRoute } from './network/routes/root';
import { UserRoute } from './network/routes/user';
import { RedirectRoutes } from './network/routes/_redirect';
import { AdminRoute } from './network/routes/admin';
import { SongRoute } from './network/routes/song';
import { ScoreRoute } from './network/routes/score';
import { TopRoute } from './network/routes/top';
import { SearchRoute } from './network/routes/search';
import { AccountRoute } from './network/routes/account';
import { ClubRoute } from './network/routes/club';
import { DebugRoutes } from './network/routes/_debug';
import { StatsRoute } from './network/routes/stats';
import { Data } from './data';
import sanitizeHtml from 'sanitize-html';
import { AuthRoute } from './network/routes/auth';
import { cooldownRequest } from './cooldown';

export async function initExpress(app: Express) {
    app.get("/api/front", async (_req, res) => {
        try {
            const [playerCount, roomFreeCount] = await countPlayers();
            const playerName = Data.PERSIST.props.FRONT_MESSAGES[0] ? await getPlayerNameByID(Data.PERSIST.props.FRONT_MESSAGES[0].player) : undefined;

            res.send({
                online: playerCount,
                rooms: roomFreeCount,
                sez: (playerName ? playerName + ' sez: "' + Data.PERSIST.props.FRONT_MESSAGES[0].message + '"' : '')
            });
        }
        catch (exc) {
            console.error(exc);
            res.sendStatus(500);
        }
    });

    app.get("/api/onlinecount", async (_req, res) => {
        try {
            res.send('' + (await countPlayers())[0]);
        }
        catch (exc) {
            console.error(exc);
            res.sendStatus(500);
        }
    });

    if (process.env["NETWORK_ENABLED"] == "true") {
        console.log("Network is enabled")

        sanitizeHtml.defaults.allowedTags.push('img');

        app.use(cors({ origin: true, credentials: true, }));
        app.use(express.json({
            limit: '1mb'
        }));
        app.use(fileUpload({}));
        app.use(cookieParser());
        app.use(cooldownRequest);

        RedirectRoutes.init(app);
        RootRoute.init(app);
        StatsRoute.init(app);
        UserRoute.init(app);
        AdminRoute.init(app);
        SongRoute.init(app);
        ScoreRoute.init(app);
        TopRoute.init(app);
        SearchRoute.init(app);
        AccountRoute.init(app);
        AuthRoute.init(app);
        ClubRoute.init(app);

        if (process.env["DEBUG_ENABLED"] == "true") {
            DebugRoutes.init(app);
        }

        // refresh stats every 10 minutes
        setInterval(async function () {
            Data.INFO.DAY_PLAYERS.push([
                (await countPlayers())[0],
                Date.now()
            ]);

            if (Data.INFO.DAY_PLAYERS.length > 300)
                Data.INFO.DAY_PLAYERS.shift();

            if (!fs.existsSync("database/")) {
                fs.mkdirSync("database/");
            }

            fs.writeFileSync("database/day_players.json", JSON.stringify(Data.INFO.DAY_PLAYERS));
        }, 1000 * 60 * 10);

        // stats every minute
        setInterval(async function () {
            if (!fs.existsSync("database/")) {
                fs.mkdirSync("database/");
            }

            fs.writeFileSync("database/country_players.json", JSON.stringify(Data.INFO.COUNTRY_PLAYERS));
        }, 1000 * 60);

        //stats every 2 minutes
        setInterval(async function () {
            const refreshPlayers: string[] = [];
            for (const pName of Data.INFO.ONLINE_PLAYERS) {
                const player = await getPlayerByName(pName);
                if (player && Date.now() - player.lastActive.getTime() < 1000 * 90) {
                    refreshPlayers.push(pName);
                }
            };
            for (const item of Data.INFO.MAP_USERNAME_PLAYINGROOM) {
                if (!isUserNameInRoom(item[0], item[1])) {
                    Data.INFO.MAP_USERNAME_PLAYINGROOM.delete(item[0]);
                }
            }
            Data.INFO.ONLINE_PLAYERS = refreshPlayers;
        }, 1000 * 60 * 2);

        const WEEK_TIME_MS = 604800000;

        // every second
        if (process.env["PRODUCTION_MODE"] == "true") {
            setInterval(async function () {
                if (Date.now() >= Data.PERSIST.props.NEXT_WEEKLY_DATE) {
                    console.log('NEXT WEEK!');

                    Data.PERSIST.props.NEXT_WEEKLY_DATE += WEEK_TIME_MS;
                    Data.PERSIST.save();

                    async function getPlaceMessage(player: any) {
                        const clubPlate = await getPlayerClubTag(player.id);
                        return player.name + (clubPlate ? ' [' + clubPlate + ']' : '') + ' with ' + player.pointsWeekly + 'FP!';
                    }

                    const _top = await topPlayers(0, undefined, "week");
                    let leadersMessage = '• Weekly Leaderboard Finals! •';
                    leadersMessage = leadersMessage + '\n1st. ' + await getPlaceMessage(_top[0]);
                    leadersMessage = leadersMessage + '\n2nd. ' + await getPlaceMessage(_top[1]);
                    leadersMessage = leadersMessage + '\n3rd. ' + await getPlaceMessage(_top[2]);
                    leadersMessage = leadersMessage + '\n4th. ' + await getPlaceMessage(_top[3]);
                    leadersMessage = leadersMessage + '\n5th. ' + await getPlaceMessage(_top[4]);
                    await logToAll(formatLog(leadersMessage))

                    await endWeekly();

                    await logToAll(formatLog('[!] The weekly leaderboard has been reset!'))
                }
            }, 1000);
        }
    }
    else {
        app.all("/api*", async (_req, res) => {
            res.status(400).json({
                error: "This server doesn't support the Network functionality!"
            });
        });
    }

    if (process.env["DEBUG_ENABLED"] == "true") {
        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        //app.use("/playground", playground);

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        //app.use("/colyseus", monitor());
    }

    app.get('/', showIndex);
    app.use(express.static('client/build/'));
    app.get('/*', showIndex);
}

export const moneyFormatter = new Intl.NumberFormat();

async function showIndex(req: Request, res: Response) {
    try {
        const indexPath = process.cwd() + '/client/build/index.html';
        if (!fs.existsSync(indexPath)) {
            res.sendStatus(200);
            return;
        }
        let response = fs.readFileSync(indexPath, { encoding: 'utf8', flag: 'r' }).toString();
        let title = "Psych Online";
        let description = "A FNF Multiplayer mod based on Psych Engine!";
        let image = "https://" + req.hostname + "/images/transwag.png";
        const params = req.path.substring(1).split('/');
        switch (params[0]) {
            case "user": {
                const player = await getPlayerByName(params[1]);
                if (!player)
                    break;
                title = player.name + " " + (player.country ? getFlagEmoji(player.country) + ' ' : '') + '· Profile';
                description = (player.role ?? Data.CONFIG.DEFAULT_ROLE) + " | " + moneyFormatter.format(player.points) + " FP" + "\nAvg. Accuracy: " + (player.avgAcc * 100).toFixed(2) + '%';
                if (await hasAvatar(player.id))
                    image = "https://" + req.hostname + "/api/user/avatar/" + encodeURIComponent(player.name);
                else
                    image = "https://" + req.hostname + "/images/bf1.png";
                //image = 'https://kickstarter.funkin.me/static/assets/img/stickers/bf1.png';
                break;
            }
            case "song": {
                const song = params[1].split('-');
                title = song[0] + " [" + song[1] + "]";
                const daSong = await getSong(params[1]);
                if (daSong) {
                    description = 'FP Record: ' + moneyFormatter.format(daSong.maxPoints) + "\n" + daSong._count.scores + ' Score(s) | ' + daSong._count.comments + ' Comment(s)';
                }
                break;
            }
            case "club": {
                const club = await getClub(params[1]);
                if (!club)
                    break;
                title = club.name + ' [' + club.tag + '] · Club';
                description = moneyFormatter.format(club.points) + 'FP\n' + club.members.length + " Member(s)";
                image = "https://" + req.hostname + "/api/club/banner/" + encodeURIComponent(club.tag);
                break;
            }
            case "top":
                switch (params[1]) {
                    case 'players':
                        title = 'FP Leaderboard' + (req.query.country ? ' in ' + getFlagEmoji(req.query.country as string) : '');
                        break;
                    case 'clubs':
                        title = 'Clubs Leaderboard';
                        break;
                }
                break;
            case "friends":
                title = 'Friend List';
                break;
            case "search":
                title = 'Search' + (req.query.q ? ' for "' + req.query.q + '"' : '');
                break;
            case "stats":
                title = 'Statistics';
                break;
            case "network":
                title = 'Psych Online Network';
                break;
        }
        response = response.replaceAll('%___OG_TITLE___%', title);
        response = response.replace('%___OG_DESC___%', description);
        response = response.replace('%___OG_IMAGE___%', image);
        res.send(response);
    }
    catch (exc) {
        console.error(exc);
        res.sendStatus(404);
    }
}

function getFlagEmoji(countryCode: string) {
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

/**
 * @returns [playerCount, roomFreeCount, playingCount]
 */
export async function countPlayers(): Promise<number[]> {
    let playerCount = 0;
    let roomFreeCount = 0;
    let playingCount = 0;
    const rooms = await matchMaker.query();
    if (rooms.length >= 1) {
        rooms.forEach((room) => {
            if (!networkRoom || room.roomId != networkRoom.roomId) {
                playerCount += room.clients;
                playingCount += room.clients;
                if (!room.private && !room.locked)
                    roomFreeCount++;
            }
        });
    }
    for (const player of Data.INFO.ONLINE_PLAYERS) {
        if (isUserNameInRoom(player)) {
            playerCount++;
        }
    }
    return [playerCount, roomFreeCount, playingCount];
}