import * as fs from 'fs';
import cookieParser from "cookie-parser";
import express, { Application } from 'express';
import fileUpload from "express-fileupload";
import { NetworkRoom } from "./rooms/NetworkRoom";
import {formatLog, isUserNameInRoom } from "./util";
import cors from 'cors';
import { matchMaker } from "colyseus";
import adminRouter from './routes/admin';
import songRouter from './routes/song';
import scoreRouter from './routes/score';
import topRouter from './routes/top';
import searchRouter from './routes/search';
import accountRouter from './routes/account';
import clubRouter from './routes/club';
import statsRouter from './routes/stats';
import { Data } from './data';
import sanitizeHtml from 'sanitize-html';
import authRouter from './routes/auth';
import { cooldownRequest } from './cooldown';
import modRouter from './routes/mod';
import { authUser, endWeekly, getIDToken, hasAccess } from './database/db.util';
import { db } from './database/db';
import userRouter from './routes/user';
import { ResponseError } from './error';
import redirectRouter from './routes/_redirect';
import apiRouter from './routes/api';

export function initExpress(app: Application) {
    // set this to true if you use a proxy like nginx
    app.set('trust proxy', process.env['EXPRESS_TRUST_PROXY'] == "true");

    app.get("/rooms/:roomName", async (_req, res) => {
        // #swagger.ignore = true
        
        const rooms = await matchMaker.query({
            name: 'room',
            locked: false,
            private: false,
            unlisted: false
        });
        const showRooms = [];
        for (const room of rooms) {
            if (room.clients >= room.maxClients) {
                continue;
            }

            showRooms.push({
                clients: room.clients,
                maxClients: room.maxClients,
                metadata: room.metadata,
                roomId: room.roomId
            });
        }
        res.json(showRooms);
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

        // app.use('/api/v1', apiRouter);

        app.use('/api', apiRouter);
        app.use('/api/user', userRouter);
        app.use('/api/top', topRouter);
        app.use('/api/stats', statsRouter);
        app.use('/api/song', songRouter);
        app.use('/api/search', searchRouter);
        app.use('/api/score', scoreRouter);
        app.use('/api/mod', modRouter);
        app.use('/api/club', clubRouter);
        app.use('/api/auth', authRouter);
        app.use('/api/admin', adminRouter);
        app.use('/api/account', accountRouter);
        app.use('', redirectRouter);

        app.get("/api.json", (_req, res) => {
            // #swagger.tags = ['Generic']

            if (!Data.INFO.RAW_OPENAPI)
                return res.sendStatus(400);

            res.status(200).send(Data.INFO.RAW_OPENAPI);
        });

        // if (process.env["DEBUG_ENABLED"] == "true") {
        //     DebugRoutes.init(app);
        // }

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
        setInterval(function () {
            if (!fs.existsSync("database/")) {
                fs.mkdirSync("database/");
            }

            fs.writeFileSync("database/country_players.json", JSON.stringify(Data.INFO.COUNTRY_PLAYERS));
        }, 1000 * 60);

        //stats every 2 minutes
        setInterval(async function () {
            const refreshPlayers: string[] = [];
            for (const pName of Data.INFO.ONLINE_PLAYERS) {
                const player = await db.users.byName(pName).get({
                    select: {
                        lastActive: true,
                    }
                });
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
        if (process.env["PRODUCTION_MODE"] == "true" || true) {
            setInterval(async function () {
                if (Date.now() >= Data.PERSIST.props.NEXT_WEEKLY_DATE) {
                    console.log('NEXT WEEK!');

                    Data.PERSIST.props.NEXT_WEEKLY_DATE += WEEK_TIME_MS;
                    while (Date.now() >= Data.PERSIST.props.NEXT_WEEKLY_DATE) {
                        Data.PERSIST.props.NEXT_WEEKLY_DATE += WEEK_TIME_MS;
                        console.log('skipping week ahead!');
                    }
                    Data.PERSIST.save();

                    async function getPlaceMessage(stats: any) {
                        const clubTag = await (await db.users.byID(stats.userRe.id).getClub()).getTag();
                        return stats.userRe.name + (clubTag ? ' [' + clubTag + ']' : '') + ' with ' + stats.points4k + 'FP!';
                    }

                    const _top = await db.users.top(0, undefined, "week");
                    let leadersMessage = '• Weekly 4k Leaderboard Finals! •';
                    leadersMessage = leadersMessage + '\n1st. ' + await getPlaceMessage(_top[0]);
                    leadersMessage = leadersMessage + '\n2nd. ' + await getPlaceMessage(_top[1]);
                    leadersMessage = leadersMessage + '\n3rd. ' + await getPlaceMessage(_top[2]);
                    leadersMessage = leadersMessage + '\n4th. ' + await getPlaceMessage(_top[3]);
                    leadersMessage = leadersMessage + '\n5th. ' + await getPlaceMessage(_top[4]);
                    await NetworkRoom.logToAll(formatLog(leadersMessage))

                    //FIXME
                    await endWeekly();

                    await NetworkRoom.logToAll(formatLog('[!] The weekly leaderboard has been reset!'))
                }
            }, 1000);
        }
    }
    else {
        app.all("/api*x", (_req, res) => {
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

    app.use(express.static('client/build/'));
    app.get('/*x', async (req, res) => {
        // #swagger.ignore = true

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
            for (const [i, param] of params.entries()) {
                params[i] = decodeURIComponent(param);
            }
            switch (params[0]) {
                case "mod": {
                    if (!params[1])
                        break;
                    const mod = await db.mods.getByID(params[1]);
                    if (!mod)
                        break;
                    title = mod.title + ' · Mod';
                    description = mod.favorited.length + ' Likes · ' + mod.downloadsHits + ' Downloads' + '\n\n' + mod.description;
                    image = mod.images[0];
                    break;
                }
                case "user": {
                    if (!params[1])
                        break;
                    const user = db.users.byName(params[1]);
                    if (!user)
                        break;
                    const player = await user.get({
                        select: {
                            country: true,
                            name: true,
                            role: true,
                            id: true,
                        }
                    });
                    if (!player)
                        break;
                    const stats = await user.getStats();
                    title = player.name + " " + (player.country ? getFlagEmoji(player.country) + ' ' : '') + '· Profile';
                    description = (player.role ?? Data.CONFIG.DEFAULT_ROLE) + " | " + moneyFormatter.format(stats.points4k) + " FP" + "\nAvg. Accuracy: " + (stats.avgAcc4k * 100).toFixed(2) + '%';
                    if (await user.hasAvatar())
                        image = "https://" + req.hostname + "/api/user/avatar/" + encodeURIComponent(player.name);
                    else
                        image = "https://" + req.hostname + "/images/bf1.png";
                    //image = 'https://kickstarter.funkin.me/static/assets/img/stickers/bf1.png';
                    break;
                }
                case "song": {
                    if (!params[1])
                        break;
                    const daSong = await db.songs.getByID(params[1]);
                    if (!daSong)
                        break;

                    const song = params[1].split('-');
                    title = song[0] + " [" + song[1] + "]";
                    if (daSong) {
                        description = 'FP Record: ' + moneyFormatter.format(daSong.maxPoints) + "\n" + daSong._count.scores + ' Score(s) | ' + daSong._count.comments + ' Comment(s)';
                    }
                    break;
                }
                case "club": {
                    if (!params[1])
                        break;
                    const club = await db.clubs.byTag(params[1]).get({
                        select: {
                            tag: true,
                            name: true,
                            points: true,
                            members: true,
                        }
                    });
                    if (!club)
                        break;
                    title = club.name + ' [' + club.tag + '] · Club';
                    description = moneyFormatter.format(club.points) + 'FP\n' + club.members.length + " Member(s)";
                    image = "https://" + req.hostname + "/api/club/banner/" + encodeURIComponent(club.tag);
                    break;
                }
                case "top":
                    if (!params[1])
                        break;
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
            if (req.path == "/404") {
                res.status(404);
            }
            res.send(response);
        }
        catch (exc) {
            console.error(exc);
            res.sendStatus(404);
        }
    });

    app.use(async function(err:Error, req, res, _) {
        let showDetailed = false;
        try {
            const [id, __] = getIDToken(req);
            if (!id) throw null;

            const user = await authUser(req);
            if (!user) throw null;

            if (hasAccess((await user.get({ select: { role: true } })).role, '*')) {
                showDetailed = true;
            }
        }
        catch (_) {}

        if (err.name == 'server.ResponseError' || err instanceof ResponseError) {
            return res.status(500).send(err.message + (showDetailed ? '\n' + err.stack : ''));
        }

        console.error(err);
        if (!showDetailed)
            return res.sendStatus(500);
        else
            return res.status(500).send(err.message + (showDetailed ? '\n' + err.stack : ''));
    });
}

export const moneyFormatter = new Intl.NumberFormat();

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
            if (!NetworkRoom.instance || room.roomId != NetworkRoom.instance.roomId) {
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