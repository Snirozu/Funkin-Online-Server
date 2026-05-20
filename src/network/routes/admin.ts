import { matchMaker } from 'colyseus';
import { Application, Express } from 'express';
import { Data } from '../../data';
import { NetworkRoom } from '../../rooms/NetworkRoom';
import { checkAccess, authPlayer, removeReport, removeScore, getPlayerByName, setEmail, deleteUser, deleteClub, updateClubPoints, setUserBanStatus, grantPlayerRole, getPriority, sendNotification, getPlayerIDByName, renamePlayer, getReport, listReports, getPlayerNameByID, endWeekly, updatePlayerStats, prisma, warnUser, removeUserWarn, topScores, getScore, getReplayFile, getLookForWarned } from '../database';
import dotenv from 'dotenv';
import { logActionOnRequest } from '../mods';
import fs from 'fs';
import { clearCooldowns } from '../../cooldown';
import { NetNoteType, NetSong, Rating } from '../../chart_calc';

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
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't create a club..."
                });
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

        app.get("/api/admin/user/warn/list", checkAccess, logActionOnRequest, async (req, res) => {
            try {
                return res.status(200).send(await getLookForWarned());
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

        // very WIP
        // input doesn't work and sustains are not properly counted 
        app.post("/api/admin/song/submit", checkAccess, async (req, res) => {
            try {
                const song:NetSong = req.body;

                // fs.writeFileSync('net_song.json', JSON.stringify(song));

                const defaultNoteType:NetNoteType = {
                    blockHit: false,
                    hitCausesMiss: false,
                    ignoreNote: false,
                    lowPriority: false,
                    name: null,
                    ratingDisabled: false
                };
                function getNoteType(name:string):NetNoteType {
                    for (const noteType of song.noteTypes) {
                        if (noteType.name == name)
                            return noteType;
                    }
                    return defaultNoteType;
                }
                
                const top = await topScores(song.id, 2, 0, song.keys);

                const netScore = await getScore(top[0].id);
                if (!netScore)
                    return res.sendStatus(404);

                const file = await getReplayFile(netScore.replayFileId);
                if (!file)
                    return res.sendStatus(404);

                const replay = JSON.parse(file.data.toString());
                console.log(file.id);

                function inputNameToStrum(inputName:string) {
                    if (inputName.includes('k_note_')) {
                        return Number.parseInt(inputName.substring(inputName.lastIndexOf('_') + 1));
                    }

                    switch (inputName) {
                        case 'note_left': return 0;
                        case 'note_down': return 1;
                        case 'note_up': return 2;
                        case 'note_right': return 3;
                        default: return -1;
                    }
                }

                function sortHitNotes(a:any[], b:any[]):number {
                    if (a[1].lowPriority && !b[1].lowPriority)
                        return 1;
                    else if (!a[1].lowPriority && b[1].lowPriority)
                        return -1;

                    let result = 0;
                    if (a[0][0] < b[0][0]) {
                        result = -1;
                    }
                    else if (a[0][0] > b[0][0]) {
                        result = 1;
                    }

                    return result;
                }

                const playbackRate:number = replay.gameplay_modifiers['songspeed'] ?? 1;
                let songSpeed = song.speed;
                switch(replay.gameplay_modifiers['scrolltype']) {
                    case "multiplicative":
                        songSpeed = song.speed * replay.gameplay_modifiers['scrollspeed'];
                        break;
                    case "constant":
                        songSpeed = replay.gameplay_modifiers['scrollspeed'];
                        break;
                }

                const stepCrochet = (60 / song.bpm) * 1000 / 4;

                const safeFrames = 10; // replay data also stores it
		        const safeZoneOffset = (safeFrames / 60) * 1000 * playbackRate;
		        const noteKillOffset = Math.max(stepCrochet, 350 / songSpeed * playbackRate);

                const holdArray = [];
                const holdArrayTime = [];
                let songPosition = 0;

                const notes = song.notes.at(0).concat();
                notes.sort((a, b) => {
                    let result = 0;
                    if (a[0] < b[0]) {
                        result = -1;
                    }
                    else if (a[0] > b[0]) {
                        result = 1;
                    }
                    return result;
                });

                let removeNoteQueue = [];
                function removeNote(note:any[]) {
                    removeNoteQueue.push(note);
                }

                function forEachAliveNote() {
                    const aliveNotes = [];
                    for (const note of notes) {
                        if (removeNoteQueue.includes(note))
                            continue;

                        const strumTime:number = note[0], noteData:number = note[1], sustainLength:number = note[2], noteType:string = note[3];

                        const canBeHit = (strumTime > songPosition - (safeZoneOffset) && strumTime < songPosition + (safeZoneOffset));
                        const tooLate = strumTime < songPosition - safeZoneOffset;
                        const missed = songPosition - strumTime > noteKillOffset;

                        // you're spared, for now
                        if (!canBeHit && !tooLate && !missed)
                            break;

                        aliveNotes.push(note);
                    }
                    return aliveNotes;
                }

                const ratingsData = Rating.loadDefault();
                function judgeNote(diff:number):Rating {
                    for (let i = 0; i < ratingsData.length - 1; i++) { //skips last window (Shit)
                        if (diff <= ratingsData[i].hitWindow)
                            return ratingsData[i];
                    }

                    return ratingsData[ratingsData.length - 1];
                }

                let combo = 0;
                let score = 0;
                let sicks = 0;
                let goods = 0;
                let bads = 0;
                let shits = 0;
                let misses = 0;

                let totalPlayed = 0;
                let totalNotesHit = 0;
                let hits = 0;

                function goodNoteHit(note:any[]) {
                    // console.log('g: ' + note[0]);
                    const strumTime:number = note[0], noteData:number = note[1], sustainLength:number = note[2], noteType:string = note[3];
                    const isSustainNote = sustainLength == -1; // if this note is a tail then the sustainLength will be -1
                    const noteInfo = getNoteType(noteType);

                    if (noteInfo.hitCausesMiss) {
                        noteMiss(note);

                        if (!isSustainNote) {
                            removeNote(note);
                        }
                        return;
                    }
                    
                    if (isSustainNote) {
                        removeNote(note);
                        return;
                    }

                    combo++;
                    if(combo > 9999) combo = 9999;

		            const noteDiffNoAbs:number = strumTime - songPosition;
		            const noteDiff:number = Math.abs(noteDiffNoAbs);
                    
                    let addScore = 350;
                    var daRating:Rating = judgeNote(noteDiff / playbackRate);
		            totalNotesHit += daRating.ratingMod;
                    if(!noteInfo.ratingDisabled) daRating.hits++;
                    addScore = daRating.score;

                    score += addScore;
                    switch (daRating.name) {
                        case "sick":
                            sicks++;
                            break;
                        case "good":
                            goods++;
                            break;
                        case "bad":
                            bads++;
                            break;
                        case "shit":
                            shits++;
                            combo = 0;
                            break;
                    }

                    if(!noteInfo.ratingDisabled)
                    {
                        hits++;
                        totalPlayed++;
                    }

                    removeNote(note);
                }

                function noteMiss(daNote:any[]) {
                    console.log('b: ' + daNote[0]);
                    //Dupe note remove
                    for (const note of forEachAliveNote()) {
                        if (note != daNote && daNote[1] == note[1] && (daNote[2] == -1) == (note[2] == -1) && Math.abs(daNote[0] - note[0]) < 1) {
                            removeNote(note);
                        }
                    }

                    combo = 0;
                    score -= 10;
                    misses++;
                    totalPlayed++;

                    removeNote(daNote);
                }

                // sort by time
                replay.inputs.sort((a, b) => {
                    let result = 0;
                    if (a[0] < b[0]) {
                        result = -1;
                    }
                    else if (a[0] > b[0]) {
                        result = 1;
                    }
                    return result;
                });

                for (const rawInput of replay.inputs) {
                    songPosition = rawInput[0];// + (replay.note_offset ?? 0);

                    const inputName:string = rawInput[1], key:number = inputNameToStrum(rawInput[1]), isJustPressed:boolean = rawInput[2] == 0;

                    if (key < 0) {
                        // console.log(rawInput[1]);
                        continue;
                    }

                    const prevHold = holdArray[key];
                    holdArray[key] = isJustPressed;
                    if (isJustPressed)
                        holdArrayTime[key] = songPosition;

                    const sortedNotesList = [];
                    for (const note of forEachAliveNote()) {
                        const strumTime:number = note[0], noteData:number = note[1], sustainLength:number = note[2], noteType:string = note[3];

                        const isSustainNote = sustainLength == -1; // if this note is a tail then the sustainLength will be -1
                        const canBeHit = (strumTime > songPosition - (safeZoneOffset) && strumTime < songPosition + (safeZoneOffset));
                        const tooLate = strumTime < songPosition - safeZoneOffset;
                        const missed = songPosition - strumTime > noteKillOffset;
                        const noteInfo = getNoteType(noteType);

                        // good TAIL note hit
                        if (isSustainNote && ((holdArray[key] && canBeHit && !tooLate) || (prevHold && strumTime >= holdArrayTime[key])) && !noteInfo.blockHit) {
                            goodNoteHit(note);
                            continue;
                        }

                        // missed note, can't be hit
                        if (missed) {
                            // console.log(songPosition, strumTime);
                            if (!noteInfo.ignoreNote && tooLate)
                                noteMiss(note);
                            else
                                removeNote(note);
                            continue;
                        }

                        // check if a REGULAR note can be hit and then add it to 'considering' array
                        if (isJustPressed && canBeHit && !tooLate && !isSustainNote && !noteInfo.blockHit) {
                            if(noteData == key) sortedNotesList.push([note, noteInfo]);
                        }
                    }
                    sortedNotesList.sort(sortHitNotes);

                    // regular notes
				    const pressNotes:Array<any[]> = [];
				    let notesStopped:boolean = false;
                    if (sortedNotesList.length > 0) {
                        for (const _epicNote of sortedNotesList) {
                            const rawNote:any[] = _epicNote[0], noteInfo:NetNoteType = _epicNote[1];

                            for (const doubleNote of pressNotes) {
                                if (Math.abs(doubleNote[0] - rawNote[0]) < 1)
                                    removeNote(doubleNote);
                                else
                                    notesStopped = true;
                            }

                            if (!notesStopped) {
                                goodNoteHit(rawNote);
                                pressNotes.push(rawNote);
                            }

                        }
                    }

                    for (const note of removeNoteQueue) {
                        const i = notes.indexOf(note);
                        if (i != -1)
                            notes.splice(i, 1);
                    }
                    removeNoteQueue = [];
                }

                console.log(combo, score);
                console.log(sicks, goods, bads, shits, misses);
                console.log(totalPlayed, totalNotesHit, hits);

                res.sendStatus(200);
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't submit..."
                });
            }
        });
    }
}