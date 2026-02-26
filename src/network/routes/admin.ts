import { matchMaker } from 'colyseus';
import { Application, Express } from 'express';
import { Data } from '../../data';
import { NetworkRoom } from '../../rooms/NetworkRoom';
import { checkAccess, authPlayer, removeReport, removeScore, getPlayerByName, setEmail, deleteUser, deleteClub, updateClubPoints, setUserBanStatus, grantPlayerRole, getPriority, sendNotification, getPlayerIDByName, renamePlayer, getReport, listReports, getPlayerNameByID, endWeekly, updatePlayerStats, prisma, warnUser, removeUserWarn } from '../database';
import dotenv from 'dotenv';
import { logActionOnRequest } from '../mods';
import fs from 'fs';
import { clearCooldowns } from '../../cooldown';

export class AdminRoute {
    static init(app: Application) {
        app.get("/api/admin/user/data", checkAccess, logActionOnRequest, async (req, res) => {
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

        app.get("/api/admin/user/set/email", checkAccess, logActionOnRequest, async (req, res) => {
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

        app.get("/api/admin/user/delete", checkAccess, logActionOnRequest, async (req, res) => {
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

        app.get("/api/admin/club/delete", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await deleteClub(req.query.tag as string);
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/club/updatefp", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await updateClubPoints(req.query.tag as string);
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/user/ban", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                const target = await getPlayerByName(req.query.username as string);
                if (!reqPlayer || getPriority(target) >= getPriority(reqPlayer))
                    return res.sendStatus(403);
                if ((req.query.to as string ?? "false") == "true") {
                    await warnUser(target.id, reqPlayer.id, req.query.reason as string);
                }
                await setUserBanStatus(target.id, (req.query.to as string ?? "false") == "true", req.query.reason as string)
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/user/warn", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                const target = await getPlayerByName(req.query.username as string);
                if (!reqPlayer || getPriority(target) >= getPriority(reqPlayer))
                    return res.sendStatus(403);
                await warnUser(target.id, reqPlayer.id, req.query.reason as string);
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/user/warn/delete", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await removeUserWarn(req.query.id as string);
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/score/delete", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                if (!reqPlayer)
                    return res.sendStatus(403);
                await removeScore(req.query.id as string, true)
                return res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/players", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                if (!reqPlayer)
                    return res.sendStatus(403);

                const jsonRooms = {
                    rooms: [] as any[],
                    playing_rooms: Data.INFO.MAP_USERNAME_PLAYINGROOM
                };
                for (const room of await matchMaker.query()) {
                    if (!NetworkRoom.instance || room.roomId != NetworkRoom.instance.roomId) {
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

        app.get("/api/admin/reloadconfig", checkAccess, logActionOnRequest, async (req, res) => {
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

        app.get("/api/admin/user/grant", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                const reqPlayer = await authPlayer(req);
                const target = await getPlayerByName(req.query.username as string);
                if (!reqPlayer
                    || getPriority(target) >= getPriority(reqPlayer)
                    || getPriority(req.query.role) >= getPriority(reqPlayer))
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

        app.get("/api/admin/user/notify", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await sendNotification(await getPlayerIDByName(req.query.user as string), req.query as any);
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/user/rename", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await renamePlayer(await getPlayerIDByName(req.query.user as string), req.query.new as string);
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/report/list", checkAccess, logActionOnRequest, async (_, res) => {
            try {
                const reports = await listReports();
                const data = [];
                for (const report of reports) {
                    data.push({
                        id: report.id,
                        by: await getPlayerNameByID(report.by) ?? report.by,
                        content: report.content,
                        date: report.submitted
                    })
                }
                res.send(data);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/report/content", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                const report = await getReport(req.query.id as string);
                if (report.content.startsWith('{')) {
                    return res.json(JSON.parse(report.content));
                }
                res.set('Content-Type', 'text/plain').send(report.content);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/report/delete", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                await removeReport(req.query.id as string);
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/logs", checkAccess, async (_, res) => {
            try {
                res.send(Data.PERSIST.props.LOGGED_MOD_ACTIONS);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/logs/process", checkAccess, async (req, res) => {
            try {
                const logs = fs.readFileSync("/root/.pm2/logs/funkin-online-0.log", 'utf8').split('\n');
                let i = logs.length;
                let remaining = req.query.lines ? (Number.parseInt(req.query.lines as string) + 1) : logs.length;
                const outLogs = [];
                while (--i > 0) {
                    if (--remaining > 0) {
                        outLogs.push(logs[i]);
                    }
                }
                res.send(outLogs);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/cooldown/clear", checkAccess, async (_, res) => {
            try {
                await clearCooldowns();
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/endweekly", checkAccess, async (_, res) => {
            try {
                await endWeekly();
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/admin/updateweekly", checkAccess, async (_, res) => {
            try {
                const stats = await prisma.userStats.findMany({
                    select: {
                        user: true
                    },
                    where: {
                        type: 'week',
                        OR: [
                            {
                                points4k: {
                                    gt: 0
                                }
                            },
                            {
                                points5k: {
                                    gt: 0
                                }
                            },
                            {
                                points6k: {
                                    gt: 0
                                }
                            },
                            {
                                points7k: {
                                    gt: 0
                                }
                            },
                            {
                                points8k: {
                                    gt: 0
                                }
                            },
                            {
                                points9k: {
                                    gt: 0
                                }
                            },
                        ]
                    }
                })
                for (const stat of stats) {
                    await updatePlayerStats(stat.user);
                }
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });
    }
}