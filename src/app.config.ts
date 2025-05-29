import config from "@colyseus/tools";
//import { monitor } from "@colyseus/monitor";
//import { playground } from "@colyseus/playground";

/**
 * Import your Room files
 */
import { GameRoom } from "./rooms/GameRoom";
import { matchMaker } from "colyseus";
import * as fs from 'fs';
import { genAccessToken, createUser, submitScore, checkAccess, submitReport, getPlayerByID, getPlayerByName, renamePlayer, pingPlayer, getIDToken, topScores, getScore, topPlayers, getScoresPlayer, authPlayer, viewReports, removeReport, removeScore, getSongComments, submitSongComment, removeSongComment, searchSongs, searchUsers, setEmail, getPlayerByEmail, deleteUser, setUserBanStatus, setPlayerBio, requestFriendRequest, removeFriendFromUser, getUserFriends, searchFriendRequests, getPlayerRank, getPlayerIDByName, getPlayerNameByID, getPlayerProfileHue, getReplayFile, uploadAvatar, getAvatar, hasAvatar, uploadBackground, getBackground, removeImages, validateEmail, getPriority, grantPlayerRole, getSong } from "./network";
import cookieParser from "cookie-parser";
import TimeAgo from "javascript-time-ago";
import en from 'javascript-time-ago/locale/en'
import { Data } from "./Data";
import express from 'express';
import fileUpload, { UploadedFile } from "express-fileupload";
import { networkRoom, NetworkRoom } from "./rooms/NetworkRoom";
import nodemailer from 'nodemailer';
import * as crypto from "crypto";
import { getKeyOfValue, isUserIDInRoom, isUserNameInRoom } from "./util";
import { DEFAULT_ROLE, loadConfig, ROLES } from "./Config";

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US')

const transMail = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_ID,
        pass: process.env.GMAIL_PASSWORD
    }
});

const emailCodes: Map<String, String> = new Map<String, String>();
const emailCodeTimers: Map<String, NodeJS.Timeout> = new Map<String, NodeJS.Timeout>();

export default config({

    initializeGameServer: async (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('room', GameRoom);
        gameServer.define('network', NetworkRoom);
        await matchMaker.createRoom("network", {});
    },

    initializeExpress: (app) => {

        app.use(fileUpload({}));
        app.use(cookieParser());

        app.get("/api/front", async (req, res) => {
            try {
                const [playerCount, roomFreeCount] = await countPlayers();
                const playerName = Data.PUBLIC.FRONT_MESSAGES[0] ? await getPlayerNameByID(Data.PUBLIC.FRONT_MESSAGES[0].player) : undefined;

                res.send({
                    online: playerCount,
                    rooms: roomFreeCount,
                    sez: (playerName ? playerName + ' sez: "' + Data.PUBLIC.FRONT_MESSAGES[0].message + '"' : '')
                });
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/onlinecount", async (req, res) => {
            try {
                res.send('' + (await countPlayers())[0]);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        if (process.env["STATS_ENABLED"] == "true") {
            app.get("/api/stats/day_players", (req, res) => {
                try {
                    res.send(Data.DAY_PLAYERS);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/stats/country_players", (req, res) => {
                try {
                    let returnMap: Map<string, number> = new Map<string, number>();
                    for (var key in Data.COUNTRY_PLAYERS) {
                        if (Data.COUNTRY_PLAYERS.hasOwnProperty(key)) {
                            returnMap.set(key, Data.COUNTRY_PLAYERS[key].length);
                        }
                    }
                    res.send(Object.fromEntries(returnMap));
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });
        }

        //every post request should be in a json format
        if (process.env["NETWORK_ENABLED"] == "true") {
            app.get("/network/user*", async (req, res) => {
                res.redirect(req.url.substring("/network".length));
            });

            /*
            -
            API STUFF
            -
            */

            //GET

            app.get("/api/sezdetal", async (req, res) => {
                try {
                    let sezlist = [];
                    for (const msg of Data.PUBLIC.FRONT_MESSAGES) {
                        const playerName = await getPlayerNameByID(msg.player);
                        sezlist.push({
                            player: playerName,
                            message: msg.message
                        });
                    }
                    res.send(sezlist);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/online", async (req, res) => {
                try {
                    let roomArray:any = [];
                    var rooms = await matchMaker.query();
                    if (rooms.length >= 1) {
                        rooms.forEach((room) => {
                            if (!room.private && !room.locked && room.roomId != networkRoom.roomId)
                                roomArray.push({
                                    code: room.roomId,
                                    player: room?.metadata?.name ?? "???",
                                    ping: room?.metadata?.ping ?? NaN
                                });
                        });
                    }

                    res.send({
                        network: Data.ONLINE_PLAYERS,
                        playing: (await countPlayers())[2],
                        rooms: roomArray
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/account/info", checkAccess, async (req, res) => {
                try {
                    const [id, token] = getIDToken(req);
                    const user = await pingPlayer(id);

                    res.send({
                        name: user.name,
                        role: user.role,
                        joined: user.joined,
                        lastActive: user.lastActive,
                        points: user.points,
                        avgAccuracy: user.avgAccSumAmount > 0 ? user.avgAccSum / user.avgAccSumAmount : 0
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/user/friends/remove", checkAccess, async (req, res) => {
                try {
                    if (!req.query.name)
                        return res.sendStatus(400);

                    await removeFriendFromUser(req);
                    res.sendStatus(200);
                }
                catch (exc: any) {
                    res.status(400).send(exc?.error_message ?? "Unknown error...");
                }
            });

            app.get("/api/user/friends/request", checkAccess, async (req, res) => {
                try {
                    if (!req.query.name)
                        return res.sendStatus(400);

                    await requestFriendRequest(req);
                    res.sendStatus(200);
                }
                catch (exc:any) {
                    res.status(400).send(exc?.error_message ?? "Unknown error...");
                }
            });

            app.get("/api/avatar/:user", async (req, res) => {
                try {
                    if (!req.params.user)
                        return res.sendStatus(400);

                    const file = await getAvatar(await getPlayerIDByName(req.params.user as string));
                    if (!file)
                        return res.sendStatus(404);

                    res.send(file.data);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/background/:user", async (req, res) => {
                try {
                    if (!req.params.user)
                        return res.sendStatus(400);

                    const file = await getBackground(await getPlayerIDByName(req.params.user as string));
                    if (!file)
                        return res.sendStatus(404);

                    res.send(file.data);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/user/info", async (req, res) => {
                try {
                    if (!req.query.name)
                        return res.sendStatus(400);

                    const user = await getPlayerByName(req.query.name as string);
                    
                    if (!user)
                        return res.sendStatus(404);

                    res.send({
                        role: user.role,
                        joined: user.joined,
                        lastActive: user.lastActive,
                        points: user.points,
                        profileHue: user.profileHue ?? 250,
                        avgAccuracy: user.avgAccSumAmount > 0 ? user.avgAccSum / user.avgAccSumAmount : 0,
                        rank: await getPlayerRank(user.name),
                        country: user.country
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/user/details", async (req, res) => {
                try {
                    if (!req.query.name)
                        return res.sendStatus(400);

                    const auth = await authPlayer(req, false);
                    const user = await getPlayerByName(req.query.name as string);

                    if (!user)
                        return res.sendStatus(404);

                    const pingasFriends = auth?.pendingFriends ?? [];

                    res.send({
                        role: user.role,
                        joined: user.joined,
                        lastActive: user.lastActive,
                        points: user.points,
                        isSelf: auth?.id == user.id,
                        bio: user.bio,
                        friends: await getUserFriends(user.friends),
                        canFriend: !pingasFriends.includes(user?.id),
                        profileHue: user.profileHue ?? 250,
                        avgAccuracy: user.avgAccSumAmount > 0 ? user.avgAccSum / user.avgAccSumAmount : 0,
                        rank: await getPlayerRank(user.name),
                        country: user.country
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/user/scores", async (req, res) => {
                try {
                    if (!req.query.name)
                        return res.sendStatus(400);

                    const userID = await getPlayerIDByName(req.query.name as string);

                    if (!userID)
                        return res.sendStatus(404);

                    let coolScores: any[] = [];

                    const scores = await getScoresPlayer(userID, Number.parseInt(req.query.page as string ?? "0"));
                    if (!scores)
                        return res.sendStatus(404);
                    scores.forEach(score => {
                        const songId = (score.songId as string).split('-');
                        songId.pop();
                        coolScores.push({
                            name: songId.join(" "),
                            songId: score.songId,
                            strum: score.strum,
                            score: score.score,
                            accuracy: score.accuracy,
                            points: score.points,
                            submitted: score.submitted,
                            id: score.id,
                            modURL: score.modURL
                        });
                    });

                    res.send(coolScores);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/admin*", checkAccess, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer)
                        return res.sendStatus(403);

                    const params = (req.params as Array<string>)[0].split("/");
                    switch (params[1]) {
                        case "remove":
                            const removed = [];
                            if (req.query.report) {
                                await removeReport(req.query.report as string);
                                removed.push("report");
                            }
                            if (req.query.score) {
                                await removeScore(req.query.score as string);
                                removed.push("score");
                            }

                            if (removed.length == 0) {
                                res.send('none removed! <br><a href="javascript:history.back()"> go bakc </a>');
                                return;
                            }

                            res.send('removed ' + removed.join(',') + '! <br><a href="javascript:history.back()"> go bakc </a>');
                            break;
                        default:
                            let response = '';

                            response += '<h1>logged as ' + reqPlayer.name + "</h1>";

                            response += '<h2> Reports: </h2><hr>';
                            const reports = await viewReports();
                            for (const report of reports) {
                                const submitter = await getPlayerByID(report.by);
                                response += "By: <a href='/user/" + submitter.name + "'>" + submitter.name + "</a>";
                                const contentLines = report.content.split('\n');
                                const scoreLine = contentLines.shift();
                                if (scoreLine.startsWith("Score #")) {
                                    const score = await getScore(scoreLine.split("Score #")[1]);
                                    if (!score) {
                                        await removeReport(report.id);
                                        response += "<br>REMOVED<hr>";
                                        continue;
                                    }
                                    const scorePlayer = await getPlayerByID(score.player);
                                    response += "<br> " + "<a href='/user/" + scorePlayer.name + "'>" + scorePlayer.name + "'s</a> <a href='/api/score/replay?id=" + score.id + "'>Score"
                                        + "</a> on <a href='/song/" + score.songId + "?strum=" + score.strum + "'>" + score.songId + "</a>"
                                        + (contentLines.length > 0 ? "<br>" + contentLines.join('<br>') : '')
                                        + "<br><br><a href='/admin/remove?report=" + report.id + "&score=" + score.id + "'>(REMOVE SCORE)</a>&nbsp;&nbsp;&nbsp;";
                                }
                                else {
                                    response += "<br>" + report.content + "<br><br>";
                                }
                                response += "<a href='/admin/remove?report=" + report.id + "'>(REMOVE REPORT)</a>"
                                response += "<hr>";
                            }
                            response += '<style> html { padding: 30px; color: white; background-color: rgb(50, 50, 50); font-family: Verdana, sans-serif; } a { color: #428ee6; } </style>';

                            res.send(response);
                            break;
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).send(exc?.error_message ?? "Unknown error...");
                }
            });

            app.get("/api/admin/user/data", checkAccess , async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer)
                        return res.sendStatus(403);
                    return res.send(await getPlayerByName(req.query.username as string));
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/admin/user/set/email", checkAccess, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer)
                        return res.sendStatus(403);
                    return res.send(await setEmail((await getPlayerByName(req.query.username as string)).id, req.query.email as string));
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/admin/user/delete", checkAccess, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    const target = await getPlayerByName(req.query.username as string);
                    if (!reqPlayer || getPriority(target) >= getPriority(reqPlayer))
                        return res.sendStatus(403);
                    await deleteUser(target.id);
                    return res.sendStatus(200);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/admin/user/ban", checkAccess, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    const target = await getPlayerByName(req.query.username as string);
                    if (!reqPlayer || getPriority(target) >= getPriority(reqPlayer))
                        return res.sendStatus(403);
                    await setUserBanStatus(target.id, (req.query.to as string ?? "false") == "true")
                    return res.sendStatus(200);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/admin/score/delete", checkAccess, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer)
                        return res.sendStatus(403);
                    await removeScore(req.query.id as string)
                    return res.sendStatus(200);
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/admin/players", checkAccess, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer)
                        return res.sendStatus(403);

                    let jsonRooms = {
                        rooms: [] as any[],
                        playing_rooms: Data.MAP_USERNAME_PLAYINGROOM
                    };
                    for (const room of await matchMaker.query()) {
                        if (room.roomId != networkRoom.roomId) {
                            jsonRooms.rooms.push({
                                id: room.roomId,
                                meta: room.metadata,
                                clients: room.clients
                            });
                        }
                    };
                    res.send(jsonRooms);
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/admin/reloadconfig", checkAccess, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer)
                        return res.sendStatus(403);

                    loadConfig();
                    res.sendStatus(200);
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/admin/user/grant", checkAccess, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    const target = await getPlayerByName(req.query.username as string);
                    if (!reqPlayer 
                        || getPriority(target) >= getPriority(reqPlayer)
                        || ROLES.get(req.query.role as string).priority >= getPriority(reqPlayer))
                        return res.sendStatus(403);

                    if (grantPlayerRole(req.query.username as string, req.query.role as string))
                        res.sendStatus(200);
                    else
                        res.sendStatus(400);
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/song/comments", async (req, res) => {
                try {
                    if (!req.query.id)
                        return res.sendStatus(400);

                    const comments = await getSongComments(req.query.id as string);
                    if (!comments)
                        return res.sendStatus(404);

                    let cmts = [];
                    for (const comment of comments) {
                        cmts.push({
                            player: await getPlayerNameByID(comment.by),
                            content: comment.content,
                            at: comment.at
                        });
                    }
                    res.send(cmts);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/score/replay", async (req, res) => {
                try {
                    if (!req.query.id)
                        return res.sendStatus(400);

                    res.setHeader('content-type', 'application/json');

                    const score = await getScore(req.query.id as string);
                    if (!score)
                        return res.sendStatus(404);

                    const file = await getReplayFile(score.replayFileId);
                    if (!file)
                        return res.sendStatus(404);

                    res.send(file.data);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/top/song", async (req, res) => {
                try {
                    if (!req.query.song)
                        return res.sendStatus(400);

                    const _top = await topScores(req.query.song as string, Number.parseInt(req.query.strum as string ?? "2"), Number.parseInt(req.query.page as string ?? "0"));
                    const top = [];
                    for (const score of _top) {
                        top.push({
                            score: score.score,
                            accuracy: score.accuracy,
                            points: score.points,
                            player: await getPlayerNameByID(score.player),
                            submitted: score.submitted,
                            id: score.id,
                            misses: score.misses,
                            modURL: score.modURL,
                            sicks: score.sicks,
                            goods: score.goods,
                            bads: score.bads,
                            shits: score.shits,
                            playbackRate: score.playbackRate,
                        });
                    }
                    res.send(top);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/top/players", async (req, res) => {
                try {
                    const _top = await topPlayers(Number.parseInt(req.query.page as string ?? "0"), req.query.country as string);
                    const top: any[] = [];
                    if (_top) {
                        for (const player of _top) {
                            top.push({
                                player: player.name,
                                points: player.points,
                                profileHue: player.profileHue ?? 250,
                                country: player.country
                            });
                        }
                    }
                    res.send(top);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

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

            /*
            for (const song of (await searchSongs(req.query.q as string))) {
                resp += '<a href="/old_network/song/' + song.id + '"> ' + song.id + '</a><hr>';
            }
            for (const user of (await searchUsers(req.query.q as string))) {
                resp += '<a href="/old_network/user/' + user.name + '"> ' + user.name + '</a><hr>';
            }
            */

            // ping for successful authorization
            app.get("/api/account/me", checkAccess, async (req, res) => {
                try {
                    const [id, token] = getIDToken(req);
                    const player = await pingPlayer(id);

                    if (!Data.ONLINE_PLAYERS.includes(player.name)) {
                        Data.ONLINE_PLAYERS.push(player.name);
                    }

                    res.send({
                        name: player.name,
                        points: player.points,
                        avgAccuracy: player.avgAccSumAmount > 0 ? player.avgAccSum / player.avgAccSumAmount : 0,
                        role: player.role,
                        profileHue: player.profileHue ?? 250,
                        country: player.country,
                        access: ROLES.get(player.role ?? DEFAULT_ROLE).access ?? []
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/account/friends", checkAccess, async (req, res) => {
                try {
                    const [id, token] = getIDToken(req);
                    const player = await getPlayerByID(id);
                    const friendList = await getUserFriends(player.friends);
                    const pending = await getUserFriends(player.pendingFriends);
                    const request = await searchFriendRequests(player.id);

                    let friends: Array<any> = [];
                    for (const friend of friendList) {
                        friends.push({
                            name: friend,
                            status: Data.ONLINE_PLAYERS.includes(friend) ? 'ONLINE' : 'Offline',
                            hue: await getPlayerProfileHue(friend)
                        });
                    }

                    res.send({
                        friends: friends,
                        pending: pending,
                        requests: request,
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });
            
            app.get("/api/account/ping", checkAccess, async (req, res) => {
                try {
                    const [id, token] = getIDToken(req);
                    const player = await pingPlayer(id);

                    if (!Data.ONLINE_PLAYERS.includes(player.name)) {
                        Data.ONLINE_PLAYERS.push(player.name);
                    }
                    
                    res.send(player.name);
                } 
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            // saves the auth cookie in the browser
            app.get("/api/account/cookie", async (req, res) => {
                try {
                    if (!req.query.id || !req.query.token) return;

                    res.cookie("authid", req.query.id, {
                        expires: new Date(253402300000000)
                    });

                    res.cookie("authtoken", req.query.token, {
                        expires: new Date(253402300000000)
                    });

                    const userName = await getPlayerNameByID(req.query.id + "");
                    if (!userName)
                        return res.sendStatus(400);
                    
                    res.redirect('/user/' + userName);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            // logs out the user of the website
            app.get("/api/account/logout", async (req, res) => {
                try {
                    res.clearCookie('authid');
                    res.clearCookie('authtoken');
                    res.sendStatus(200);
                } 
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            //POST

            app.post("/api/account/avatar", checkAccess, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    const file = req.files.file as UploadedFile;
                    if (file.size > 1024 * 100) {
                        return res.sendStatus(413);
                    }
                    if (file.mimetype != 'image/png' && file.mimetype != 'image/jpeg') {
                        return res.sendStatus(415);
                    }
                    if (!await uploadAvatar(id, file.data)) {
                        return res.sendStatus(500);
                    }
                    res.sendStatus(200);
                }
                catch (exc: any) {
                    console.log(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't upload..."
                    });
                }
            });

            app.post("/api/account/background", checkAccess, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);
                    if ((await getPlayerByID(id)).points < 1000) {
                        return res.sendStatus(418);
                    }

                    const file = req.files.file as UploadedFile;
                    if (file.size > 1024 * 100) {
                        return res.sendStatus(413);
                    }
                    if (file.mimetype != 'image/png' && file.mimetype != 'image/jpeg') {
                        return res.sendStatus(415);
                    }
                    if (!await uploadBackground(id, file.data)) {
                        return res.sendStatus(500);
                    }
                    res.sendStatus(200);
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't upload..."
                    });
                }
            });
            
            app.post("/api/account/removeimages", checkAccess, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);
                    if (!await removeImages(id)) {
                        return res.sendStatus(500);
                    }
                    res.sendStatus(200);
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't upload..."
                    });
                }
            });

            app.post("/api/song/comment", checkAccess, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    res.json(await submitSongComment(id, req.body));
                }
                catch (exc: any) {
                    console.log(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't submit..."
                    });
                }
            });

            app.post("/api/sez", checkAccess, async (req, res) => {
                try {
                    if (req.body.message && req.body.message.length < 80 && !(req.body.message as string).includes("\n")) {
                        const [id, _] = getIDToken(req);
                        
                        Data.PUBLIC.FRONT_MESSAGES.unshift({
                            player: id,
                            message: req.body.message
                        });
                        if (Data.PUBLIC.FRONT_MESSAGES.length > 5) {
                            Data.PUBLIC.FRONT_MESSAGES.pop();
                        }
                        res.sendStatus(200);
                        return;
                    }
                    if (!req.body.message)
                        res.sendStatus(418);
                    else
                        res.sendStatus(413);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.post("/api/account/profile/set", checkAccess, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    await setPlayerBio(id, req.body.bio, Number.parseInt(req.body.hue), req.body.country);
                    res.sendStatus(200);
                }
                catch (exc: any) {
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't set bio..."
                    });
                }
            });

            app.post("/api/account/rename", checkAccess, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    if (await isUserIDInRoom(id)) {
                        const room = Data.MAP_USERNAME_PLAYINGROOM.get(await getPlayerNameByID(id));
                        const clientSSID = getKeyOfValue(room.clientsID, id);
                        let client = null;
                        for (const c of room.clients) {
                            if (c.sessionId == clientSSID)
                                client = c;
                        }
                        if (client == null) {
                            res.sendStatus(418);
                            return;
                        }
                        client.leave();
                    }

                    const renameAction = await renamePlayer(id, req.body.username);
                    res.send(renameAction.new);
                }
                catch (exc: any) {
                    if (!exc?.error_message)
                        console.error(exc);

                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't change your handle..."
                    });
                }
            });

            // requires `content` json body field
            app.post("/api/score/report", checkAccess, async (req, res) => {
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
            app.post("/api/score/submit", checkAccess, async (req, res) => {
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
            app.post("/api/auth/register", async (req, res) => {
                try {
                    if (!req.body.email || !(req.body.email as string).includes('@'))
                        throw { error_message: 'Invalid Email Address!' }

                    if (!validateEmail(req.body.email)) {
                        throw { error_message: 'This Email Host is Blocked!' }
                    }

                    const player = await getPlayerByEmail(req.body.email);

                    if (req.body.code) {
                        if (req.body.code != emailCodes.get(req.body.email)) {
                            emailCodes.delete(req.body.email);
                            throw { error_message: 'Invalid Code!' }
                        }

                        emailCodes.delete(req.body.email);
                        const user = await createUser(req.body.username, req.body.email);
                        res.json({
                            id: user.id,
                            token: await genAccessToken(user.id),
                            secret: user.secret
                        });
                    }
                    else {
                        res.sendStatus(200);
                        if (player) {
                            // to avoid users abusing the email system
                            // we always send an "successful" response (even when it's not)
                            return; // throw { error_message: 'Player with that email does exist!' }
                        }

                        const daCode = generateCode();
                        tempSetCode(req.body.email, daCode);
                        sendCodeMail(req.body.email, daCode);
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't register..."
                    });
                }
            });

            app.post("/api/auth/login", async (req, res) => {
                try {
                    if (!req.body.email || !(req.body.email as string).includes('@'))
                        throw { error_message: 'Invalid Email Address!' }

                    const player = await getPlayerByEmail(req.body.email);
                    
                    if (req.body.code) {
                        if (req.body.code != emailCodes.get(req.body.email)) {
                            emailCodes.delete(req.body.email);
                            throw { error_message: 'Invalid Code!' }
                        }

                        emailCodes.delete(req.body.email);
                        res.json({
                            id: player.id,
                            token: await genAccessToken(player.id)
                        });
                    }
                    else {
                        res.sendStatus(200);
                        if (!player) {
                            // to avoid users abusing the email system
                            // we always send an "successful" response (even when it's not)
                            return; // throw { error_message: 'Player with that email doesn\'t exist!' }
                        }

                        const daCode = generateCode();
                        tempSetCode(req.body.email, daCode);
                        sendCodeMail(req.body.email, daCode);
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't login..."
                    });
                }
            });

            app.post("/api/account/email/set", checkAccess, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    if (!req.body.email || !(req.body.email as string).includes('@'))
                        throw { error_message: 'Invalid Email Address!' }

                    if (!validateEmail(req.body.email)) {
                        throw { error_message: 'This Email Host is Blocked!' }
                    }

                    const player = await getPlayerByID(id);
                    if (player.email && player.email != req.body.old_email)
                        throw { error_message: 'Currently Set Email is Not Provided!' }

                    if (req.body.code) {
                        if (req.body.code != emailCodes.get(req.body.email)) {
                            emailCodes.delete(req.body.email);
                            throw { error_message: 'Invalid Code!' }
                        }
                        
                        emailCodes.delete(req.body.email);
                        await setEmail(id, req.body.email);
                        res.sendStatus(200);
                    }
                    else {
                        res.sendStatus(200);
                        if (await getPlayerByEmail(req.body.email)) {
                            return;
                        }

                        const daCode = generateCode();
                        tempSetCode(req.body.email, daCode);
                        sendCodeMail(req.body.email, daCode);
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't set the email..."
                    });
                }
            });

            app.all("/api/account/delete", checkAccess, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);
                    const player = await getPlayerByID(id);

                    if (req.query.code) {
                        if (req.query.code != emailCodes.get(player.email)) {
                            emailCodes.delete(player.email);
                            throw { error_message: 'Invalid Code!' }
                        }

                        emailCodes.delete(player.email);
                        await deleteUser(player.id);
                        res.sendStatus(200);
                    }
                    else {
                        const daCode = generateCode();
                        tempSetCode(player.email, daCode);
                        sendCodeMail(player.email, daCode);
                        res.sendStatus(200);
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't delete your account..."
                    });
                }
            });

            app.all("/dev/test", async (req, res) => {
                try {
                    res.send(await getPlayerRank(req.query.name as string) + "");
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Error has accured..."
                    });
                }
            });

            // app.all("/perish_all", checkAccess, async (req, res) => {
            //     try {
            //         const reqPlayer = await authPlayer(req);
            //         if (!reqPlayer || !reqPlayer.isMod)
            //             return res.sendStatus(403);

            //         await perishScores();
            //         res.sendStatus(200);
            //     }
            //     catch (exc: any) {
            //         console.error(exc);
            //         res.status(400).json({
            //             error: exc.error_message ?? "couldn't perish shit"
            //         });
            //     }
            // });

            // app.all("/update_scores", checkAccess, async (req, res) => {
            //     try {
            //         const reqPlayer = await authPlayer(req);
            //         if (!reqPlayer || !reqPlayer.isMod)
            //             return res.sendStatus(403);

            //         await updateScores();
            //         res.sendStatus(200);
            //     }
            //     catch (exc: any) {
            //         console.error(exc);
            //         res.status(400).json({
            //             error: exc.error_message ?? "couldn't update scores"
            //         });
            //     }
            // });
            // app.all('/banagain', async (req, res) => {
            //     try {
            //         const reqPlayer = await authPlayer(req);
            //         if (!reqPlayer || !reqPlayer.isMod)
            //             return res.sendStatus(403);
                    
            //         await banAgain();
            //         res.sendStatus(200);
            //     }
            //     catch (exc: any) {
            //         console.error(exc);
            //         res.status(400).json({
            //             error: exc.error_message ?? "couldn't ban"
            //         });
            //     }
            // });
        }
        else {
            app.all("/api*", async (req, res) => {
                res.status(400).json({
                    error: "This server doesn't support the Network functionality!"
                });
            });
        }

        app.get('/', showIndex);
        app.use(express.static('client/build/'));
        app.get('/*', showIndex);

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
                Data.DAY_PLAYERS.push([
                    (await countPlayers())[0],
                    Date.now()
                ]);

                if (Data.DAY_PLAYERS.length > 300)
                    Data.DAY_PLAYERS.shift();

                if (!fs.existsSync("database/")) {
                    fs.mkdirSync("database/");
                }

                fs.writeFileSync("database/day_players.json", JSON.stringify(Data.DAY_PLAYERS));
            }, 1000 * 60 * 10);

            // stats every minute
            setInterval(async function () {
                if (!fs.existsSync("database/")) {
                    fs.mkdirSync("database/");
                }

                fs.writeFileSync("database/country_players.json", JSON.stringify(Data.COUNTRY_PLAYERS));
            }, 1000 * 60);

            //stats every 2 minutes
            setInterval(async function () {
                let refreshPlayers:string[] = [];
                for (const pName of Data.ONLINE_PLAYERS) {
                    const player = await getPlayerByName(pName);
                    if (player && Date.now() - player.lastActive.getTime() < 1000 * 90) {
                        refreshPlayers.push(pName);
                    }
                };
                for (const item of Data.MAP_USERNAME_PLAYINGROOM) {
                    if (!isUserNameInRoom(item[0], item[1])) {
                        Data.MAP_USERNAME_PLAYINGROOM.delete(item[0]);
                    }
                }
                Data.ONLINE_PLAYERS = refreshPlayers;
            }, 1000 * 60 * 2);
        }
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});

async function showIndex(req: { hostname: string; params: string[]; }, res: { send: (arg0: string) => void; sendStatus: (arg0: number) => void; }) {
    try {
        const indexPath = process.cwd() + '/client/build/index.html';
        if (!fs.existsSync(indexPath)) {
            res.sendStatus(200);
            return;
        }
        let response = fs.readFileSync(indexPath, { encoding: 'utf8', flag: 'r' }).toString();
        let title = "Psych Online";
        let description = "The FNF Multiplayer mod based on Psych Engine!";
        let image = "https://" + req.hostname + "/fingerthumb.png";
        const params = ((req.params as Array<string>)[0] ?? '').split("/");
        switch (params[0]) {
            case "user":
                const player = await getPlayerByName(params[1]);
                if (!player)
                    break;
                title = player.name + "'s " + getFlagEmoji(player.country) + " - Profile";
                description = (player.role ?? DEFAULT_ROLE) + " | " + player.points + "FP" + "\nAvg. Accuracy: " + ((player.avgAccSumAmount > 0 ? player.avgAccSum / player.avgAccSumAmount : 0) * 100).toFixed(2) + '%';
                if (await hasAvatar(player.id))
                    image = "https://" + req.hostname + "/api/avatar/" + encodeURIComponent(player.name);
                else 
                    image = "https://" + req.hostname + "/images/bf1.png";
                    //image = 'https://kickstarter.funkin.me/static/assets/img/stickers/bf1.png';
                break;
            case "song":
                const song = params[1].split('-');
                title = song[0] + " [" + song[1] + "] Leaderboard";
                const daSong = await getSong(params[1]);
                if (daSong) {
                    description = daSong.maxPoints + "FP\n" + daSong._count.scores + ' Score(s) | ' + daSong._count.comments + ' Comment(s)';
                }
                break;
        }
        response = response.replace('%___OG_TITLE___%', title);
        response = response.replace('%___OG_DESC___%', description);
        response = response.replace('%___OG_IMAGE___%', image);
        res.send(response);
    }
    catch (exc) {
        console.error(exc);
        res.sendStatus(404);
    }
}

function getFlagEmoji(countryCode:string) {
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}  

/**
 * @returns [playerCount, roomFreeCount, playingCount]
 */
export async function countPlayers():Promise<number[]> {
    let playerCount = 0;
    let roomFreeCount = 0;
    let playingCount = 0;
    var rooms = await matchMaker.query();
    if (rooms.length >= 1) {
        rooms.forEach((room) => {
            if (room.roomId != networkRoom.roomId) {
                playerCount += room.clients;
                playingCount += room.clients;
                if (!room.private && !room.locked)
                    roomFreeCount++;
            }
        });
    }
    for (const player of Data.ONLINE_PLAYERS) {
        if (isUserNameInRoom(player)) {
            playerCount++;
        }
    }
    return [playerCount, roomFreeCount, playingCount];
}

export async function sendCodeMail(email:string, code:string) {
    transMail.sendMail({
        from: 'Psych Online',
        to: email,
        subject: code + ' is your Verification Code',
        html: '<h3>Your verification code is:<h3><h1>' + code + '</h1>'
    }
    // ,    (error, info) => {
    //         if (res)
    //             if (error)
    //                 res.sendStatus(500);
    //             else
    //                 res.sendStatus(200);
    //     }
    );
}

export function tempSetCode(email:string, code:string) {
    if (emailCodeTimers.has(email)) {
        clearInterval(emailCodeTimers.get(email));
    }

    emailCodes.set(email, code);
    
    emailCodeTimers.set(email, setInterval(() => {
        emailCodes.delete(email);
    }, 1000 * 60 * 10));
}

export function generateCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}