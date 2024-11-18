import config from "@colyseus/tools";
//import { monitor } from "@colyseus/monitor";
//import { playground } from "@colyseus/playground";

/**
 * Import your Room files
 */
import { GameRoom } from "./rooms/GameRoom";
import { matchMaker } from "colyseus";
import * as fs from 'fs';
import { genAccessToken, createUser, submitScore, checkLogin, submitReport, getPlayerByID, getPlayerByName, renamePlayer, pingPlayer, getIDToken, topScores, getScore, topPlayers, getScoresPlayer, authPlayer, viewReports, removeReport, removeScore, getSongComments, submitSongComment, removeSongComment, searchSongs, searchUsers, setEmail, getPlayerByEmail, deleteUser, setUserBanStatus, setPlayerBio, requestFriendRequest, removeFriendFromUser, getUserFriends, searchFriendRequests, perishScores } from "./network";
import cookieParser from "cookie-parser";
import TimeAgo from "javascript-time-ago";
import en from 'javascript-time-ago/locale/en'
import { Data } from "./Data";
import express from 'express';
import fileUpload, { UploadedFile } from "express-fileupload";
import { networkRoom, NetworkRoom } from "./rooms/NetworkRoom";
import nodemailer from 'nodemailer';
import * as crypto from "crypto";

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
                const player = Data.FRONT_MESSAGES[0] ? await getPlayerByID(Data.FRONT_MESSAGES[0].player) : undefined;

                res.send({
                    online: playerCount,
                    rooms: roomFreeCount,
                    sez: (player ? player.name + ' sez: "' + Data.FRONT_MESSAGES[0].message + '"' : null)
                });
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/online", async (req, res) => {
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

            app.get("/old_network*", async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    const params = (req.params as Array<string>)[0].split("/");
                    switch (params[1]) {
                        case undefined:
                        case "":
                            res.redirect('/old_network/users/online');
                            break;
                        case "users":
                            if (params[2] == "online") {
                                let usersBody = '<h1>Players Online</h1><tr>';
                                for (const playerName of Data.ONLINE_PLAYERS) {
                                    usersBody += '<a href="/old_network/user/' + playerName + '"> ' + playerName + '</a><br>';
                                }
                                res.send(usersBody);
                            }
                            break;
                        case "user":
                            const player = await getPlayerByName(params[2]);

                            if (!player)
                                throw { error_message: "Player not found!" };

                            let trs = '';

                            const score_page = Number.parseInt(req.query.score_page as string ?? "0");

                            const scores = await getScoresPlayer(player.id, score_page);
                            scores.forEach((score:any) => {
                                const songId = (score.songId as string).split('-');
                                songId.pop();
                                trs += '<tr><td><a href="/old_network/song/' + score.songId + '?strum=' + score.strum + '">' + songId.join(" ") + '</a></td><td>' + score.score + '</td><td>' + score.accuracy + '</td><td>' + score.points + '</td><td>' + score.submitted + '</td></tr>';
                            });

                            let scoreStr = ' \
                            <table style="width:1000px"> \
                                <tr> \
                                <td> Song </td> \
                                <td> Score </td> \
                                <td> Accuracy </td> \
                                <td> Points </td> \
                                <td> Submitted </td> \
                                </tr>'
                                + trs +
                                '</table> \
                            ';

                            if (score_page >= 1) {
                                scoreStr += "<br> <a href='/old_network/user/" + player.name + "?score_page=" + (score_page - 1) + "'> <-- Previous Page </a>";
                            }
                            if (scores.length >= 15) {
                                if (score_page >= 1)
                                    scoreStr += '&nbsp';
                                else
                                    scoreStr += '<br>';
                                scoreStr += "<a href='/old_network/user/" + player.name + "?score_page=" + (score_page + 1) + "'> Next Page --> </a>";
                            }

                            res.send("<h2>" + player.name + "</h2> " + (player.isMod ? "Moderator" : '') + " <hr>Points: " + player.points + 
                                "<br>Online: " + (Data.VERIFIED_PLAYING_PLAYERS.includes(player.name) ? 'In a Room' : (Date.now() - player.lastActive.getTime() < 1000 * 90 ? "Now" : timeAgo.format(player.lastActive)))
                                + "<br>Joined: " + new Date(player.joined).toDateString() + '<h3>Scores:</h3><hr>' + scoreStr);
                            break;
                        case 'song':
                            const strum = Number.parseInt(req.query.strum as string ?? "2");
                            const top_page = Number.parseInt(req.query.page as string ?? "0");
                            const top = await topScores(params[2], strum, top_page);

                            let songTitle = '???';
                            let trss = '';

                            for (const score of top) {
                                const songId = params[2].split('-');
                                songId.pop();
                                songTitle = songId.join(" ");
                                const playerName = (await getPlayerByID(score.player)).name;
                                trss += '<tr><td><a href="/old_network/user/' + playerName + '">' + playerName + '</a></td><td>' + score.score + '</td><td>' + score.accuracy + '</td><td>' + score.points + '</td><td>' + score.submitted + '</td></tr>';
                            }

                            let topStr = ' \
                            <table style="width:1000px"> \
                                <tr> \
                                <td> Player </td> \
                                <td> Score </td> \
                                <td> Accuracy </td> \
                                <td> Points </td> \
                                <td> Submitted </td> \
                                </tr>'
                                + trss +
                                '</table> \
                            ';

                            if (top_page >= 1) {
                                topStr += "<br> <a href='/old_network/song/" + params[2] + "?page=" + (top_page - 1) + "'> <-- Previous Page </a>";
                            }
                            if (top.length >= 15) {
                                if (top_page >= 1)
                                    topStr += '&nbsp';
                                else
                                    topStr += '<br>';
                                topStr += "<a href='/old_network/song/" + params[2] + "?page=" + (top_page + 1) + "'> Next Page --> </a>";
                            }

                            const comments = await getSongComments(params[2]);
                            if (comments) {
                                topStr += "<h1>Comments</h1>";
                                for (const comment of comments) {
                                    const cumdate = new Date(comment.at);
                                    topStr += "<hr><b>" + (await getPlayerByID(comment.by)).name + '</b><br>"' + comment.content + '" at ' + cumdate.getMinutes() + ":" + cumdate.getSeconds();
                                    if (reqPlayer.id == comment.by) {
                                        topStr += "<br><a href='/old_network/account/remove?song_comment=" + comment.songid + "'>(REMOVE)</a>"
                                    }
                                }
                                if (comments.length <= 0) {
                                    topStr += "No comments!";
                                }
                            }

                            let strumStr = strum + "";
                            switch (strum) {
                                case 1: 
                                    strumStr += ' (Dad)';
                                    break;
                                case 2:
                                    strumStr += ' (Boyfriend)';
                                    break;
                                default:
                                    strumStr += ' (???)';
                                    break;
                            }

                            res.send('<h1>' + songTitle + "</h1><p>Strum: " + strumStr + "</p><hr>" + topStr);
                            break;
                        case 'search':
                            let resp = "<h1>Search Results for: " + req.query.q + "</h1>";
                            switch (params[2]) {
                                case 'songs':
                                    for (const song of (await searchSongs(req.query.q as string))) {
                                        resp += '<a href="/old_network/song/' + song.id + '"> ' + song.id + '</a><hr>';
                                    }
                                    res.send(resp);
                                    break;
                                case 'users':
                                    for (const user of (await searchUsers(req.query.q as string))) {
                                        resp += '<a href="/old_network/user/' + user.name + '"> ' + user.name + '</a><hr>';
                                    }
                                    res.send(resp);
                                    break;
                            }
                            break;
                        case "account":
                            if (!reqPlayer) {
                                res.send('nuh uh');
                                return;
                            }

                            switch (params[2]) {
                                case "remove":
                                    const removed = [];
                                    if (req.query.song_comment) {
                                        await removeSongComment(reqPlayer.id, req.query.song_comment as string);
                                        removed.push("song comment");
                                    }
                                    if (req.query.score) {
                                        await removeScore(req.query.score as string, reqPlayer.id);
                                        removed.push("score");
                                    }

                                    if (removed.length == 0) {
                                        res.send('none removed! <br><a href="javascript:history.back()"> go bakc </a>');
                                        return;
                                    }

                                    res.send('removed ' + removed.join(',') + '! <br><a href="javascript:history.back()"> go bakc </a>');
                                    break;
                            }

                            break;
                        case "admin":
                            if (!reqPlayer || !reqPlayer.isMod) {
                                res.send('nuh uh');
                                return;
                            }

                            switch (params[2]) {
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
                                        response += 'By: ' + submitter.name;
                                        if (report.content.startsWith("Score #")) {
                                            const score = await getScore(report.content.split("Score #")[1]);
                                            if (!score) {
                                                await removeReport(report.id);
                                                response += "<br>REMOVED<hr>";
                                                continue;
                                            }
                                            const scorePlayer = await getPlayerByID(score.player);
                                            response += "<br> " + "<a href='/api/old_network/score/replay?id=" + score.id + "'>" + scorePlayer.name + "'s Score"
                                                + "</a> on <a href='/old_network/song/" + score.songId + "?strum=" + score.strum + "'>" + score.songId + "</a>"
                                                + "<br><br><a href='/old_network/admin/remove?report=" + report.id + "&score=" + score.id + "'>(REMOVE SCORE)</a>&nbsp;&nbsp;&nbsp;";
                                        }
                                        else {
                                            response += "<br>" + report.content + "<br><br>";
                                        }
                                        response += "<a href='/old_network/admin/remove?report=" + report.id + "'>(REMOVE REPORT)</a>"
                                        response += "<hr>";
                                    }
                                    response += '';

                                    res.send(response);
                                    break;
                            }
                            break;
                        default:
                            res.send("unknown page");
                            break;
                    }
                }
                catch (exc:any) {
                    console.error(exc);
                    res.status(400).send(exc?.error_message ?? "Unknown error...");
                }
            });

            /*
            -
            API STUFF
            -
            */

            app.use('/api/avatar', express.static('database/avatars'));

            //GET

            app.get("/api/network/sezdetal", async (req, res) => {
                try {
                    let sezlist = [];
                    for (const msg of Data.FRONT_MESSAGES) {
                        const player = await getPlayerByID(msg.player);
                        sezlist.push({
                            player: player.name,
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

            app.get("/api/network/online", async (req, res) => {
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

            app.get("/api/network/account/info", checkLogin, async (req, res) => {
                try {
                    const [id, token] = getIDToken(req);
                    const user = await pingPlayer(id);

                    res.send({
                        name: user.name,
                        isMod: user.isMod,
                        joined: user.joined,
                        lastActive: user.lastActive,
                        points: user.points,
                        isBanned: user.isBanned,
                        avgAccuracy: user.avgAccSumAmount > 0 ? user.avgAccSum / user.avgAccSumAmount : 0
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/user/friends/remove", checkLogin, async (req, res) => {
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

            app.get("/api/network/user/friends/request", checkLogin, async (req, res) => {
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

            app.get("/api/network/user/info", async (req, res) => {
                try {
                    if (!req.query.name)
                        return res.sendStatus(400);

                    const user = await getPlayerByName(req.query.name as string);

                    res.send({
                        isMod: user.isMod,
                        joined: user.joined,
                        lastActive: user.lastActive,
                        points: user.points,
                        isBanned: user.isBanned,
                        profileHue: user.profileHue ?? 250,
                        avgAccuracy: user.avgAccSumAmount > 0 ? user.avgAccSum / user.avgAccSumAmount : 0
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/user/details", async (req, res) => {
                try {
                    if (!req.query.name)
                        return res.sendStatus(400);

                    const auth = await authPlayer(req);
                    const user = await getPlayerByName(req.query.name as string);

                    let coolScores:any[] = [];

                    const scores = await getScoresPlayer(user.id, Number.parseInt(req.query.page as string ?? "0"));
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

                    res.send({
                        isMod: user.isMod,
                        joined: user.joined,
                        lastActive: user.lastActive,
                        points: user.points,
                        scores: coolScores,
                        isSelf: auth?.id == user.id,
                        isBanned: user.isBanned,
                        bio: user.bio,
                        friends: await getUserFriends(user.friends),
                        canFriend: !auth.pendingFriends.includes(user?.id),
                        profileHue: user.profileHue,
                        avgAccuracy: user.avgAccSumAmount > 0 ? user.avgAccSum / user.avgAccSumAmount : 0
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/admin/user/data", checkLogin , async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer || !reqPlayer.isMod)
                        return res.sendStatus(403);
                    return res.send(await getPlayerByName(req.query.username as string));
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/admin/user/set/email", checkLogin, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer || !reqPlayer.isMod)
                        return res.sendStatus(403);
                    return res.send(await setEmail((await getPlayerByName(req.query.username as string)).id, req.query.email as string));
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/admin/user/delete", checkLogin, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer || !reqPlayer.isMod)
                        return res.sendStatus(403);
                    await deleteUser((await getPlayerByName(req.query.username as string)).id)
                    return res.sendStatus(200);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/admin/user/ban", checkLogin, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer || !reqPlayer.isMod)
                        return res.sendStatus(403);
                    await setUserBanStatus((await getPlayerByName(req.query.username as string)).id, (req.query.to as string ?? "false") == "true")
                    return res.sendStatus(200);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/admin/score/delete", checkLogin, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer || !reqPlayer.isMod)
                        return res.sendStatus(403);
                    await removeScore(req.query.id as string)
                    return res.sendStatus(200);
                }
                catch (exc) {
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/admin/players", checkLogin, async (req, res) => {
                try {
                    const reqPlayer = await authPlayer(req);
                    if (!reqPlayer || !reqPlayer.isMod)
                        return res.sendStatus(403);

                    let jsonRooms = {
                        rooms: [] as any[],
                        verified_playing: Data.VERIFIED_PLAYING_PLAYERS
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

            app.get("/api/network/song/comments", async (req, res) => {
                try {
                    if (!req.query.id)
                        return res.sendStatus(400);

                    const comments = await getSongComments(req.query.id as string);
                    if (!comments)
                        return res.sendStatus(404);

                    let cmts = [];
                    for (const comment of comments) {
                        cmts.push({
                            player: (await getPlayerByID(comment.by)).name,
                            content: comment.content,
                            at: comment.at
                        });
                    }
                    cmts.sort((a, b) => {
                        return (a?.at ?? -Infinity) - (b?.at ?? -Infinity);
                    });
                    res.send(cmts);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/score/replay", async (req, res) => {
                try {
                    if (!req.query.id)
                        return res.sendStatus(400);

                    res.setHeader('content-type', 'application/json');
                    res.send((await getScore(req.query.id as string)).replayData);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/top/song", async (req, res) => {
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
                            player: (await getPlayerByID(score.player)).name,
                            submitted: score.submitted,
                            id: score.id,
                            misses: score.misses,
                            modURL: score.modURL
                        });
                    }
                    res.send(top);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/top/players", async (req, res) => {
                try {
                    const _top = await topPlayers(Number.parseInt(req.query.page as string ?? "0"));
                    const top: any[] = [];
                    for (const score of _top) {
                        top.push({
                            player: score.name,
                            points: score.points
                        });
                    }
                    res.send(top);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            // ping for successful authorization
            app.get("/api/network/account/me", checkLogin, async (req, res) => {
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
                        isMod: player.isMod,
                        profileHue: player.profileHue ?? 250
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            app.get("/api/network/account/friends", checkLogin, async (req, res) => {
                try {
                    const [id, token] = getIDToken(req);
                    const player = await getPlayerByID(id);
                    const friends = await getUserFriends(player.friends);
                    const pending = await getUserFriends(player.pendingFriends);
                    const request = await searchFriendRequests(player.id);

                    res.send({
                        friends: friends,
                        pending: pending,
                        requests: request
                    });
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });
            
            app.get("/api/network/account/ping", checkLogin, async (req, res) => {
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
            app.get("/api/network/account/cookie", async (req, res) => {
                try {
                    if (!req.query.id || !req.query.token) return;

                    res.cookie("authid", req.query.id, {
                        expires: new Date(253402300000000)
                    });

                    res.cookie("authtoken", req.query.token, {
                        expires: new Date(253402300000000)
                    });

                    const user = await getPlayerByID(String(req.query.id));

                    res.redirect('/user/' + user.name);
                }
                catch (exc) {
                    console.error(exc);
                    res.sendStatus(500);
                }
            });

            // logs out the user of the website
            app.get("/api/network/account/logout", async (req, res) => {
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

            app.post("/api/network/account/avatar", checkLogin, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);
                    const player = await getPlayerByID(id);

                    const file = req.files.file as UploadedFile;
                    if (file.size > 1024 * 100) {
                        return res.sendStatus(413);
                    }
                    if (file.mimetype != 'image/png') {
                        return res.sendStatus(415);
                    }
                    await file.mv('database/avatars/' + btoa(player.name));
                    res.sendStatus(200);
                }
                catch (exc: any) {
                    console.log(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't submit..."
                    });
                }
            });

            app.post("/api/network/song/comment", checkLogin, async (req, res) => {
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

            app.post("/api/network/sez", checkLogin, async (req, res) => {
                try {
                    if (req.body.message && req.body.message.length < 80 && !(req.body.message as string).includes("\n")) {
                        const [id, _] = getIDToken(req);
                        const player = await getPlayerByID(id);
                        
                        Data.FRONT_MESSAGES.push({
                            player: player.id,
                            message: req.body.message
                        });
                        if (Data.FRONT_MESSAGES.length > 5) {
                            Data.FRONT_MESSAGES.pop();
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

            app.post("/api/network/account/profile/set", checkLogin, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    await setPlayerBio(id, req.body.bio, Number.parseInt(req.body.hue));
                    res.sendStatus(200);
                }
                catch (exc: any) {
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't set bio..."
                    });
                }
            });

            app.post("/api/network/account/rename", checkLogin, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    if (Data.VERIFIED_PLAYING_PLAYERS.includes(id)) {
                        res.sendStatus(418);
                        return;
                    }

                    const renameAction = await renamePlayer(id, req.body.username);

                    if (fs.existsSync('database/avatars/' + btoa(renameAction.old)))
                        fs.renameSync('database/avatars/' + btoa(renameAction.old), 'database/avatars/' + btoa(renameAction.new));

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
                    if (!req.body.email || !(req.body.email as string).includes('@'))
                        throw { error_message: 'Invalid Email Address!' }

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
                        const daCode = generateCode();
                        tempSetCode(req.body.email, daCode);
                        sendCodeMail(req.body.email, daCode, res);
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't register..."
                    });
                }
            });

            app.post("/api/network/auth/login", async (req, res) => {
                try {
                    if (!req.body.email || !(req.body.email as string).includes('@'))
                        throw { error_message: 'Invalid Email Address!' }

                    const player = await getPlayerByEmail(req.body.email);
                    if (!player)
                        throw { error_message: 'Player with that email doesn\'t exist!' }
                    
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
                        const daCode = generateCode();
                        tempSetCode(req.body.email, daCode);
                        sendCodeMail(req.body.email, daCode, res);
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't login..."
                    });
                }
            });

            app.post("/api/network/account/email/set", checkLogin, async (req, res) => {
                try {
                    const [id, _] = getIDToken(req);

                    if (!req.body.email || !(req.body.email as string).includes('@'))
                        throw { error_message: 'Invalid Email Address!' }

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
                        const daCode = generateCode();
                        tempSetCode(req.body.email, daCode);
                        sendCodeMail(req.body.email, daCode, res);
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't set the email..."
                    });
                }
            });

            app.all("/api/network/account/delete", checkLogin, async (req, res) => {
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
                        sendCodeMail(player.email, daCode, res);
                    }
                }
                catch (exc: any) {
                    console.error(exc);
                    res.status(400).json({
                        error: exc.error_message ?? "Couldn't delete your account..."
                    });
                }
            });

            // app.all("/perish_all", checkLogin, async (req, res) => {
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
        }
        else {
            app.all("/api/network*", async (req, res) => {
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
                let refreshPlayings:string[] = [];
                for (const pName of Data.VERIFIED_PLAYING_PLAYERS) {
                    if (refreshPlayers.includes(pName)) {
                        refreshPlayings.push(pName);
                    }
                }
                Data.ONLINE_PLAYERS = refreshPlayers;
                Data.VERIFIED_PLAYING_PLAYERS = refreshPlayings;
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
                title = player.name + "'s Profile - Psych Online";
                description = player.points + "FP";
                if (fs.existsSync(process.cwd() + '/database/avatars'))
                    image = "https://" + req.hostname + "/api/avatar/" + btoa(player.name);
                else 
                    image = "https://" + req.hostname + "/images/bf1.png";
                    //image = 'https://kickstarter.funkin.me/static/assets/img/stickers/bf1.png';
                break;
            case "song":
                const song = params[1].split('-');
                title = song[0] + " [" + song[1] + "] Leaderboard - Psych Online";
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
        if (!Data.VERIFIED_PLAYING_PLAYERS.includes(player)) {
            playerCount++;
        }
    }
    return [playerCount, roomFreeCount, playingCount];
}

export async function sendCodeMail(email:string, code:string, res?:any) {
    transMail.sendMail({
        from: 'Psych Online',
        to: email,
        subject: code + ' is your Verification Code',
        html: '<h3>Your verification code is:<h3><h1>' + code + '</h1>'
    },
        (error, info) => {
            if (res)
                if (error)
                    res.sendStatus(500);
                else
                    res.sendStatus(200);
        });
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