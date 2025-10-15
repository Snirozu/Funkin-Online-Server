import { matchMaker } from 'colyseus';
import { Express } from 'express';
import { Data } from '../../data';
import { networkRoom } from '../../rooms/NetworkRoom';
import { checkAccess, authPlayer, removeReport, removeScore, viewReports, getPlayerByID, getScore, getPlayerByName, setEmail, deleteUser, deleteClub, updateClubPoints, setUserBanStatus, grantPlayerRole, getPriority, sendNotification, getPlayerIDByName, renamePlayer } from '../database';
import dotenv from 'dotenv';

export class AdminRoute {
    static init(app: Express) {
        app.get("/admin*", checkAccess, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                if (!reqPlayer)
                    return res.sendStatus(403);

                const params = (req.params as Array<string>)[0].split("/");
                switch (params[1]) {
                    case "remove": {
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
                    }
                    default: {
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
            }
            catch (exc) {
                console.error(exc);
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/admin/user/data", checkAccess, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                if (!reqPlayer)
                    return res.sendStatus(403);
                return res.send(await getPlayerByName(req.query.username as string));
            }
            catch (exc) {
                console.error(exc);
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
                console.error(exc);
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

        app.get("/api/admin/club/delete", checkAccess, async (req, res) => {
            try {
                await deleteClub(req.query.tag as string);
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/club/updatefp", checkAccess, async (req, res) => {
            try {
                await updateClubPoints(req.query.tag as string);
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
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/players", checkAccess, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                if (!reqPlayer)
                    return res.sendStatus(403);

                const jsonRooms = {
                    rooms: [] as any[],
                    playing_rooms: Data.INFO.MAP_USERNAME_PLAYINGROOM
                };
                for (const room of await matchMaker.query()) {
                    if (!networkRoom || room.roomId != networkRoom.roomId) {
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
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/reloadconfig", checkAccess, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                if (!reqPlayer)
                    return res.sendStatus(403);

                dotenv.config();
                Data.PERSIST.load();
                Data.INFO.load();
                await Data.CONFIG.load();

                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/user/grant", checkAccess, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                const target = await getPlayerByName(req.query.username as string);
                if (!reqPlayer
                    || getPriority(target) >= getPriority(reqPlayer)
                    || Data.CONFIG.ROLES.get(req.query.role as string).priority >= getPriority(reqPlayer))
                    return res.sendStatus(403);

                if (grantPlayerRole(req.query.username as string, req.query.role as string))
                    res.sendStatus(200);
                else
                    res.sendStatus(400);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/user/notify", checkAccess, async (req, res) => {
            try {
                await sendNotification(await getPlayerIDByName(req.query.user as string), req.query as any);
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/user/rename", checkAccess, async (req, res) => {
            try {
                await renamePlayer(await getPlayerIDByName(req.query.user as string), req.query.new as string);
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });
    }
}