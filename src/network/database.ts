import jwt from "jsonwebtoken";
import { PrismaClient } from '@prisma/client'
import * as crypto from "crypto";
import { filterSongName, filterUsername, formatLog, hasOnlyLettersAndNumbers, ordinalNum, removeFromArray, validCountries } from "../util";
import { logToAll, networkRoom, notifyPlayer } from "../rooms/NetworkRoom";
import sanitizeHtml from 'sanitize-html';
import { Data } from "../data";
import { logAction } from "./mods";
import { cooldown, cooldownLeft } from "../cooldown";

// this class is a mess

export const prisma = new PrismaClient()

export async function genAccessToken(id: string) {
    return jwt.sign(id, (await getPlayerByID(id)).secret);
}

export function getIDToken(req:any):Array<string> {
    if (req.networkId && req.networkToken) {
        return [req.networkId, req.networkToken];
    }

    if (req.cookies && req.cookies.authid && req.cookies.authtoken) {
        return [req.cookies.authid, req.cookies.authtoken];
    }

    if (!req.headers?.authorization)
        return [null, null];

    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    let [id, secret] = Buffer.from(b64auth, 'base64').toString().split(':')
    if (id)
        id = id.trim();
    if (secret)
        secret = secret.trim();
    return [id, secret];
}

export async function checkAccess(req: any, res: any, next: any) {
    if (!process.env["DATABASE_URL"]) {
        return res.sendStatus(401);
    }

    const [id, token] = getIDToken(req);
    const player = await getLoginPlayerByID(id);

    if (player == null || token == null || id == null) {
        return res.sendStatus(401)
    }

    if (!hasAccess(player, req.path)) {
        return res.sendStatus(401)
    }
    
    if (!cooldown(id, req.path)) {
        return res.sendStatus(429)
    }

    await jwt.verify(token, player.secret as string, async (err: any, _user: any) => {
        if (err) {
            console.error(err);
            return res.sendStatus(403)
        }

        next()
    })
}

export async function authPlayer(req: any, checkPerms:boolean = true) {
    if (!process.env["DATABASE_URL"]) {
        return;
    }

    const [id, token] = getIDToken(req);
    const player = await getPlayerByID(id);

    if (player == null || token == null || id == null) {
        return;
    }

    if (checkPerms && !hasAccess(player, req.path)) {
        return
    }

    let isValid = false;
    await jwt.verify(token, player.secret as string, (err: any, _user: any) => {
        if (err) return isValid = false;
        isValid = true;
    })
    if (isValid) {
        return player;
    }
    return;
}

export function hasAccess(user: any, to: string):boolean {
    let role = user.role;
    if (!user.role)
        role = Data.CONFIG.DEFAULT_ROLE;

    for (const access of Data.CONFIG.ROLES.get(role).access) {
        if (matchWildcard(access, to))
            return true;
    }
    return false; 
}

export function getPriority(user: any):number {
    let role = user.role;
    if (!user.role)
        role = Data.CONFIG.DEFAULT_ROLE;

    return Data.CONFIG.ROLES.get(role)?.priority ?? 0;
}

function matchWildcard(match:string, to:string) {
    let isNegative = false;
    if (to.startsWith('!')) {
        isNegative = true;
        to.substring(1);
    }
    const w = match.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${w.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
    return re.test(to) != isNegative;
}

//DATABASE STUFF

export const KEYS_LIST:Array<number> = [4, 5, 6, 7, 8, 9];

export async function submitScore(submitterID: string, replay: ReplayData) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    // validate the replay file

    if (replay.version != 4) {
        throw { error_message: "Replay version mismatch error, can't submit!\nPlease update!" }
    }

    if (!replay)
        throw { error_message: "Empty Replay Data!" }

    // if (replay.points > 20 && (!replay.mod_url || !replay.mod_url.startsWith('http')))
    //     throw { error_message: "No Mod URL provided!" }

    const noteEvents = replay.shits + replay.bads + replay.goods + replay.sicks;
    if (noteEvents <= 0 || replay.inputs.length <= 0)
        throw { error_message: "Empty Replay" }

    if (replay.points < 0 || replay.points > 10000 || replay.score > 100000000)
        throw { error_message: "Illegal Score Value in the Replay Data" }

    const submitter = await getPlayerByID(submitterID);
    if (!submitter)
        throw { error_message: "Unknown Submitter!" }
    const prevRank = await getPlayerRank(submitter.name);

    // create the song model

    const songId:string = filterSongName(replay.song) + "-" + filterSongName(replay.difficulty) + "-" + filterSongName(replay.chart_hash);

    let song = await prisma.song.findFirst({
        where: {
            id: songId
        },
        select: {
            id: true
        }
    });
    if (!song) {
        song = await prisma.song.create({
            data: {
                id: songId,
                maxPoints: 0
            },
            select: {
                id: true
            }
        });
    }

    const daKeyValue = replay.keys ?? 4;
    if (!KEYS_LIST.includes(daKeyValue)) {
        throw { error_message: "Invalid Keys!" }
    }

    const daStrum = replay.opponent_mode ? 1 : 2;

    // remove bad scores

    const userAppendScores = [];

    for (const category of [undefined, 'week']) {
        const leaderboardScore = await prisma.score.findFirst({
            where: {
                songId: songId, player: submitter.id, strum: daStrum, category: category == undefined ? {
                    isSet: false
                } : {
                    equals: category
                },
                keys: daKeyValue == 4 ? {
                    isSet: false
                } : {
                    equals: daKeyValue
                }
            },
            select: {
                score: true,
                points: true,
                accuracy: true,
                id: true
            }
        });

        if (leaderboardScore) {
            if (!(
                replay.score > leaderboardScore.score ||
                replay.points > leaderboardScore.points ||
                replay.accuracy > leaderboardScore.accuracy
            ))
                continue;

            await removeScore(leaderboardScore.id);
        }

        let playbackRate = 1;
        try {
            playbackRate = replay.gameplay_modifiers.songspeed;
        }
        catch (_) { }

        const replayString = JSON.stringify(replay);
        const replayFile = await prisma.fileReplay.create({
            data: {
                data: Buffer.from(replayString, 'utf8'),
                size: replayString.length
            },
            select: {
                id: true
            }
        });

        const score = await prisma.score.create({
            data: {
                accuracy: replay.accuracy,
                bads: replay.bads,
                goods: replay.goods,
                points: replay.points,
                replayFileId: replayFile.id,
                score: replay.score,
                shits: replay.shits,
                sicks: replay.sicks,
                misses: replay.misses,
                strum: daStrum,
                modURL: replay.mod_url,
                playbackRate: playbackRate,
                category: category,
                keys: daKeyValue == 4 ? undefined : daKeyValue
            },
            select: {
                id: true
            }
        });
        userAppendScores.push({
            id: score.id,
        });
    }

    if (userAppendScores.length == 0) {
        return { song: song.id }
    }

    await prisma.user.update({
        where: {
            id: submitter.id,
        },
        data: {
            scores: {
                connect: userAppendScores,
            }
        },
        select: {
            id: true
        }
    })

    await prisma.song.update({
        where: {
            id: song.id,
        },
        data: {
            scores: {
                connect: userAppendScores,
            }
        },
        select: {
            id: true
        }
    })

    const prevStats = await getUserStats(submitter.id);
    const prevStatsWeek = await getUserStats(submitter.id, 'week');

    await updatePlayerStats(submitter.id, daKeyValue);
    await updateSongMaxPoints(song.id);

    const newRank = await getPlayerRank(submitter.name);

    if (newRank <= 30 && newRank < prevRank) {
        await logToAll(formatLog(submitter.name + ' climbed to ' + ordinalNum(newRank) + ' place on the global leaderboard!'))
    }

    const newStats = await getUserStats(submitter.id);
    const newStatsWeek = await getUserStats(submitter.id, 'week');

    return {
        song: song.id,
        message: "Submitted!",
        gained_points: newStats["points" + daKeyValue + "k"] - prevStats["points" + daKeyValue + "k"],
        gained_points_week: newStatsWeek["points" + daKeyValue + "k"] - prevStatsWeek["points" + daKeyValue + "k"],
        climbed_ranks: prevRank - newRank
    }
}

export async function updatePlayerStats(id: string, keys?: Array<number> | number) {
    if (!keys) {
        keys = KEYS_LIST;
    }

    let keysList = [];
    if (typeof keys === "number")
        keysList.push(keys);
    if (Array.isArray(keys))
        keysList = keys;

    for (const category of [undefined, 'week']) {
        const statsData = {};

        for (const kys of keysList) {
            if (!KEYS_LIST.includes(kys)) {
                throw { error_message: "Invalid Keys!" }
            }

            statsData["points" + kys + "k"] = await countPlayerFP(id, category, kys);
            statsData["avgAcc" + kys + "k"] = (await aggregatePlayerAccuracy(id, category, kys))._avg.accuracy / 100;
        }

        await prisma.userStats.updateMany({
            where: {
                user: id,
                type: category == undefined ? {
                    isSet: false
                } : {
                    equals: category
                }
            },
            data: statsData
        })
    }

    await updateClubPoints(await getPlayerClubTag(id));
}

async function countPlayerFP(id: string, category?: string, keys?: number) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return (await prisma.score.aggregate({
            where: {
                player: id,
                category: {
                    isSet: category ? true : false,
                    equals: category
                },
                keys: !keys || keys == 4 ? {
                    isSet: false
                } : {
                    equals: keys
                }
            },
            _sum: {
                points: true
            }
        }))._sum.points ?? 0;
    }
    catch (exc) {
        console.error(exc);
        return 0;
    }
}

async function updateSongMaxPoints(songId:string) {
    if (!process.env["DATABASE_URL"]) {
        return;
    }

    const data = await prisma.score.aggregate({
        where: {
            songId: songId
        },
	    _max: {
            points: true
        }
    });

    await prisma.song.update({
        where: {
            id: songId
        },
        data: {
            maxPoints: data._max.points
        },
        select: {
            id: true
        }
    });
}

export async function submitReport(id: string, content: any) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    // const submitter = await getPlayerByID(id);
    // if (!submitter)
    //     throw { error_message: "Not registered!" }

    return (await prisma.report.create({
        data: {
            by: id,
            content: content
        },
    }));
}

export async function demoteClubMember(userID: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    const club = await getPlayerClub(userID);
    if (!club)
        throw { error_message: "The user is not in a club!" }

    if (!club.leaders.includes(userID))
        throw { error_message: "The user is not a mod!" }

    if (club.leaders.length == 1) {
        throw { error_message: "A club can't have no leaders!" }
    }

    return (await prisma.club.update({
        where: {
            tag: club.tag
        },
        data: {
            leaders: removeFromArray(club.leaders, userID)
        },
    }));
}

export async function promoteClubMember(userID: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    const club = await getPlayerClub(userID);
    if (!club)
        throw { error_message: "The user is not in a club!" }

    if (club.leaders.includes(userID))
        throw { error_message: "The user is already a mod!" }

    return (await prisma.club.update({
        where: {
            tag: club.tag
        },
        data: {
            leaders: {
                push: userID
            }
        },
    }));
}

export async function acceptJoinClub(clubTag: string, userID: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    const userClub = await getPlayerClub(userID);

    if (userClub) {
        await prisma.club.update({
            where: {
                id: userClub.id
            },
            data: {
                pending: removeFromArray(userClub.pending, userID)
            },
        });
        throw { error_message: "The user is already in a club!" }
    }

    const club = await getClub(clubTag);
    if (!club.pending.includes(userID))
        throw { error_message: "The user hasn't sent a request!" }

    cachedUserIDClubTag.set(userID, clubTag);

    await prisma.club.update({
        where: {
            tag: clubTag
        },
        data: {
            pending: removeFromArray(club.pending, userID),
            members: {
                push: userID
            }
        },
    });

    await updateClubPoints(clubTag);

    await sendNotification(userID, {
        title: 'Club Join',
        content: 'You\'ve been accepted to the ' + clubTag + ' club!',
        image: '/api/user/avatar/' + encodeURIComponent(await getPlayerNameByID(userID)),
        href: '/club/' + clubTag
    });
}

export async function requestJoinClub(clubTag: string, userID: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    if (await getPlayerClub(userID))
        throw { error_message: "You're already in a club!" }

    const club = await getClub(clubTag);
    if (club.pending.includes(userID))
        throw { error_message: "Already pending!" }

    const requesterName = await getPlayerNameByID(userID);

    for (const pid of club.leaders) {
        await sendNotification(pid, {
            title: 'Club Join Request',
            content: requesterName + ' wants to join your club!',
            image: '/api/user/avatar/' + encodeURIComponent(requesterName),
            href: '/club/' + clubTag
        });
    }

    return (await prisma.club.update({
        where: {
            tag: clubTag
        },
        data: {
            pending: {
                push: userID
            }
        },
    }));
}

async function formatNewClubTag(tag: string, ignoreTag?: string) {
    tag = tag.trim();

    if (tag.length < 2 || tag.length > 5) {
        throw { error_message: "Too short/long tag!" }
    }

    if (!hasOnlyLettersAndNumbers(tag)) {
        throw { error_message: "Tag can't contain non latin letters!" }
    }

    tag = tag.toUpperCase();

    if (tag != ignoreTag && await getClub(tag))
        throw { error_message: "Tag taken!" }

    return tag;
}

export async function createClub(ownerID: string, reqBody: any) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    const submitter = await getPlayerByID(ownerID);
    const submitterStats = await getUserStats(ownerID);
    if (!submitter)
        throw { error_message: "Not registered!" }

    if (await getPlayerClub(ownerID))
        throw { error_message: "You're already in a club!" }

    if (submitterStats["points4k"] < 250)
        throw { error_message: 'You need at least 4k 250FP!' }

    if (!reqBody.name || !reqBody.tag) {
        throw { error_message: "Missing fields!" }
    }

    reqBody.name = reqBody.name.trim();

    if (reqBody.name.length > 20) {
        throw { error_message: "Name too long!" }
    }

    reqBody.tag = await formatNewClubTag(reqBody.tag);

    return (await prisma.club.create({
        data: {
            name: reqBody.name,
            tag: reqBody.tag,
            leaders: [ownerID],
            members: [ownerID],
            points: submitterStats["points4k"]
        },
    }));
}

export async function removePlayerFromClub(playerID: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    const submitter = await getPlayerByID(playerID);
    if (!submitter)
        throw { error_message: "Not registered!" }

    const club = await getPlayerClub(playerID);
    if (!club)
        throw { error_message: "Not in a club!" }
    
    const clubMembers = removeFromArray(club.members, playerID);
    const clubLeaders = removeFromArray(club.leaders, playerID);

    //remove from member list first
    await prisma.club.update({
        where: {
            id: club.id
        },
        data: {
            members: clubMembers,
            leaders: clubLeaders
        }
    })

    cachedUserIDClubTag.delete(playerID);
    await updateClubPoints(club.tag);

    //if there are no members left disband the club
    if (clubMembers.length == 0) {
        await deleteClub(club.tag);
        return;
    }

    //if the last leader left switch to another person
    if (clubLeaders.length == 0) {
        // if mods are in a club the earliest picked will be chosen otherwise the earliest member
        let newOwner: string = clubMembers[0];
        if (clubLeaders.length > 0) {
            newOwner = clubLeaders[0];
        }

        await prisma.club.update({
            where: {
                id: club.id
            },
            data: {
                leaders: {
                    push: newOwner
                }
            }
        })
    }
}

export async function deleteClub(tag: string) {
    try {
        await prisma.fileClubBanner.delete({
            where: {
                clubTag: tag
            }
        })
    } catch (_) { }

    const deleted = await prisma.club.delete({
        where: {
            tag: tag
        }
    })

    for (const playerID of deleted.members) {
        cachedUserIDClubTag.delete(playerID);
    }
}

export async function getPlayerClub(id: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    try {
        const club = await prisma.club.findFirstOrThrow({
            where: {
                members: {
                    has: id
                }
            }
        });
        cachedUserIDClubTag.set(id, club.tag);
        return club;
    }
    catch (_exc) {
        // club not found
        return null;
    }
}

export async function postClubEdit(tag: string, body: any) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    const club = await getClub(tag);
    if (!club) {
        throw { error_message: "No club!" }
    }

    body.name = body.name.trim();
    if (body.name.length > 20) {
        throw { error_message: "Name too long!" }
    }

    if (body.hue > 360)
        body.hue = 360;
    if (body.hue < 0)
        body.hue = 0;

    body.tag = await formatNewClubTag(body.tag, tag);

    if (body.tag != tag) {
        if (!cooldown('club.'+club.id, 'club.edit.tag'))
            throw { error_message: "You can change the tag in " + cooldownLeft(['club.'+club.id, 'club.edit.tag']) + "s" }
    }

    try {
        const club = await prisma.club.update({
            where: {
                tag: tag
            },
            data: {
                content: sanitizeHtml(body.content),
                name: body.name,
                hue: body.hue,
                tag: body.tag
            }
        });

        if (body.tag != tag) {
            for (const playerID of club.members) {
                cachedUserIDClubTag.set(playerID, body.tag);
            }
        }
        return club;
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function getClub(tag: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    try {
        return (await prisma.club.findFirstOrThrow({
            where: {
                tag: tag
            }
        }));
    }
    catch (_exc) {
        // club not found
        return null;
    }
}

export async function getPlayerClubTag(id: string) {
    if (cachedUserIDClubTag.has(id)) {
        return cachedUserIDClubTag.get(id);
    }
    const club = await getPlayerClub(id);
    if (!club) {
        return null;
    }
    cachedUserIDClubTag.set(id, club.tag);
    return club.tag;
}

export async function updateClubPoints(tag: string) {
    const club = await getClub(tag);
    if (!club)
        return;

    let points = 0;

    for (const pid of club.members) {
        const player = await getUserStats(pid);
        points += player["points4k"];
    }

    await prisma.club.update({
        where: {
            id: club.id
        },
        data: {
            points: BigInt(points)
        },
        select: {
            id: true
        }
    });
}

export async function getClubRank(tag: string): Promise<number> {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        const everyone = await prisma.club.findMany({
            orderBy: [
                {
                    points: 'desc'
                }
            ],
            select: {
                tag: true,
            }
        });
        return everyone.findIndex(club => club.tag == tag) + 1;
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function topClubs(page: number): Promise<Array<any>> {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return (await prisma.club.findMany({
            orderBy: [
                {
                    points: 'desc'
                },
                {
                    created: 'desc'
                }
            ],
            select: {
                name: true,
                points: true,
                tag: true,
                hue: true
            },
            take: 15,
            skip: 15 * page
        }));
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function removeSongComment(userId: string, songId: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    await prisma.songComment.deleteMany({
        where: {
            songid: {
                equals: songId
            },
            by: {
                equals: userId
            }
        }
    });
}

export async function submitSongComment(userId: string, reqJson: any) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    const submitter = await getPlayerByID(userId);
    if (!submitter)
        throw { error_message: "Not registered!" }

    await removeSongComment(userId, reqJson.id as string);

    if ((reqJson.content as string).length < 2)
        throw { error_message: "Too short!" }

    if ((reqJson.content as string).length > 100)
        throw { error_message: "Too long!" }

    return await prisma.songComment.create({
        data: {
            content: reqJson.content as string,
            at: Number.parseFloat(reqJson.at as string),
            userRe: {
                connect: {
                    id: userId
                }
            },
            song: {
                connect: {
                    id: reqJson.id as string
                }
            }
        }
    });
}

export async function listReports() {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    return (await prisma.report.findMany());
}

export async function getReport(id: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    return (await prisma.report.findUnique({
        where: {
            id: id
        }
    }));
}

export async function removeReport(id:string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    return (await prisma.report.delete({
        where: {
            id: id
        }
    }));
}

export async function removeBloatReplays() {
    debugPrint('fetching');
    const scores = await prisma.score.findMany({
        select: {
            replayFileId: true,
            player: true
        }
    })

    const scoreReplays = [];
    for (const score of scores) {
        scoreReplays.push(score.replayFileId);
    }

    debugPrint(scoreReplays.length);

    const pickReplays = [];

    for (const replay of (await prisma.fileReplay.findMany({select: { id: true }}))) {
        if (!scoreReplays.includes(replay.id)) {
            pickReplays.push(replay.id);
        }
    }

    debugPrint(pickReplays.length);

    let deleted = 0;

    for (const replay of pickReplays) {
        await prisma.fileReplay.delete({
            where: {
                id: replay
            }
        })
        deleted++;
        debugPrint(pickReplays.length - deleted);
    }


    // const replays = await prisma.fileReplay.deleteMany({
    //     where: {
    //         id: {
    //             notIn: pickReplays
    //         }
    //     }
    // })

    // debugPrint(replays.count);

} 

export async function removeScore(scores: string | string[], logInfo: boolean = false, checkPlayerID?: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    debugPrint('removing scores');

    let scoreIds = [];
    if (typeof scores === "string")
        scoreIds.push(scores);
    if (Array.isArray(scores))
        scoreIds = scores;

    const players = [];
    const songs = [];
    const replays = [];
    const keys = [];

    debugPrint('fetching scores');

    const fetchedScores = await prisma.score.findMany({
        where: {
            id: {
                in: scoreIds
            }
        },
        select: {
            songId: true,
            player: true,
            replayFileId: true,
            points: true,
            keys: true
        }
    })

    for (const score of fetchedScores) {
        if (!players.includes(score.player))
            players.push(score.player);

        if (!songs.includes(score.songId))
            songs.push(score.songId);

        if (!replays.includes(score.replayFileId))
            replays.push(score.replayFileId);

        if (!keys.includes(score.keys))
            keys.push(score.keys);

        if (logInfo) {
            await logAction(null, 'Deleting score on ' + score.songId + ' by ' + await getPlayerNameByID(score.player) + ' with FP: ' + score.points);
        }

        if (checkPlayerID && score.player != checkPlayerID)
            throw { error_message: "Unauthorized!" }
    }

    debugPrint('deleting scores');

    await prisma.score.deleteMany({
        where: {
            id: {
                in: scoreIds
            }
        },
    })
    
    debugPrint('updating player stats');

    for (const player of players) {
        await updatePlayerStats(player, keys);
    }

    debugPrint('updating songs');

    for (const song of songs) {
        await updateSongMaxPoints(song);
    }

    debugPrint('deleting replays');

    try {
        await prisma.fileReplay.deleteMany({
            where: {
                id: {
                    in: replays
                }
            }
        });
    }
    catch (exc) {
        console.error(exc);
        for (const replay of replays) {
            await prisma.fileReplay.delete({
                where: {
                    id: replay
                }
            })
        }
    }

    debugPrint('finished removing scores!');
}

export async function setScoreModURL(scoreID: string, newModURL: string) {
    await prisma.score.update({
        where: {
            id: scoreID
        },
        data: {
            modURL: newModURL
        }
    })
}

export function debugPrint(content: unknown) {
    if (process.env["DEBUG_ENABLED"] != "true") {
        return;
    }

    console.log(content);
}

export async function aggregatePlayerAccuracy(id: string, category?: string, keys?: number) {
    return await prisma.score.aggregate({
        where: {
            player: id,
            category: {
                isSet: category ? true : false,
                equals: category
            },
            keys: !keys || keys == 4 ? {
                isSet: false
            } : {
                equals: keys
            }
        },
        _avg: {
            accuracy: true
        }
    })
}

export async function createUser(name: string, email: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    if (filterUsername(name) != name) {
        throw {
            error_message: "Your username contains invalid characters!"
        }
    }

    if (name.length < 3) {
        throw {
            error_message: "Your username is too short! (min 3 characters)"
        }
    }

    if (name.length > 14) {
        throw {
            error_message: "Your username is too long! (max 14 characters)"
        }
    }

    if (await playerNameCount(name) != 0)
        throw { error_message: "Player with that username already exists!" }

    if (await getPlayerByEmail(email))
        throw { error_message: "Can't set the same email for two accounts!" }

    const user = (await prisma.user.create({
        data: {
            name: name,
            email: email,
            secret: crypto.randomBytes(64).toString('hex'),
        },
    }));

    await createUserStats(user.id);

    return user;
}

export async function getUserStats(id: string, type?: string) {
    const userStats = await _getUserStats(id, type);
    if (!userStats)
        return await createUserStats(id, type);
    return userStats;
}

async function _getUserStats(id: string, type?: string) {
    try {
        return (await prisma.userStats.findFirstOrThrow({
            where: {
                user: id,
                type: type == undefined ? {
                    isSet: false
                } : {
                    equals: type
                }
            },
        }));
    }
    catch (_exc) {
        console.log(_exc);
        // not found
        return null;
    }
}

export async function createUserStats(id: string, type?: string) {
    if ((await prisma.userStats.count({
        where: {
            user: id,
            type: type == undefined ? {
                isSet: false
            } : {
                equals: type
            }
        }
    })) == 0) {
        (await prisma.userStats.create({
            data: {
                user: id,
                type: type
            },
        }));
        await updatePlayerStats(id);
    }
    return await _getUserStats(id);
}

export function validateEmail(email:string) {
    const emailHost = email.split('@')[1].trim();
    for (const v of Data.CONFIG.EMAIL_BLACKLIST) {
        const domain = v.split(' ')[0].trim();
        if (domain.trim().length > 0 && emailHost.endsWith(domain))
            return false;
    }
    return true;
} 

export async function resetSecret(id: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    return (await prisma.user.update({
        data: {
            secret: crypto.randomBytes(64).toString('hex')
        },
        where: {
            id: id
        }
    }));
}

export async function setEmail(id: string, email: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    if (await getPlayerByEmail(email))
        throw { error_message: "Can't set the same email for two accounts!" }

    return (await prisma.user.update({
        data: {
            email: email
        },
        where: {
            id: id
        }
    }));
}

export async function renamePlayer(id: string, name: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    if (filterUsername(name) != name) {
        throw {
            error_message: "Your username contains invalid characters!"
        }
    }

    if (name.length < 3) {
        throw {
            error_message: "Your username is too short! (min 3 characters)"
        }
    }

    if (name.length > 14) {
        throw {
            error_message: "Your username is too long! (max 15 characters)"
        }
    }

    const playerExiste = await playerNameCount(name);
    if (playerExiste != 0)
        throw { error_message: "Player with that username exists!" }

    const oldPlayer = await getPlayerByID(id);

    const data = (await prisma.user.update({
        data: {
            name: name
        },
        where: {
            id: id
        }
    }));

    cachedIDtoName.delete(oldPlayer.id);
    cachedNameToID.delete(oldPlayer.name);
    cachedProfileNameHue.delete(oldPlayer.name);

    cachePlayerUniques(data.id, data.name);
    cachedProfileNameHue.set(data.name, [data.profileHue ?? 250, data.profileHue2]);

    return {
        new: data.name,
        old: oldPlayer.name
    };
}

export async function grantPlayerRole(name: string, role: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    if ((await getPlayerByName(name)).role == role) {
        //console.log(name + ' is already already a: ' + role);
        return null;
    }

    return (await prisma.user.update({
        data: {
            role: role
        },
        where: {
            name: name
        }
    }));
}

export async function setPlayerBio(id: string, bio: string, hue: number, country: string, hue2: number) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    if (bio.length > 1500) {
        throw {
            error_message: "Your bio reaches 1500 characters!"
        }
    }

    if (hue > 360)
        hue = 360;
    if (hue < 0)
        hue = 0;

    if (hue2 > 360)
        hue2 = 360;
    if (hue2 < 0)
        hue2 = 0;

    const sanitizedHtml = sanitizeHtml(bio);

    if (!validCountries.includes(country)) {
        country = null;
    }

    const userStats = await getUserStats(id);
    if (userStats["points4k"] < 500)
        hue2 = undefined;

    return (await prisma.user.update({
        data: {
            bio: sanitizedHtml,
            profileHue: hue,
            profileHue2: hue2,
            country: country
        },
        where: {
            id: id
        }
    }));

}

export async function getPlayerByName(name: string) {
    if (!name || !process.env["DATABASE_URL"])
        return null;

    try {
        const user = await prisma.user.findFirstOrThrow({
            where: {
                name: {
                    equals: name,
                    mode: "default"
                }
            }
        });
        //TODO
        // console.log(await prisma.user.findMany({
        //     where: {
        //         avgAcc: {
        //             isSet: false
        //         }
        //     }
        // }));
        //lazy migration
        // if (!user.avgAcc) {
        //     const updated = await updatePlayerStats(user.id);
        //     user.avgAcc = updated.avgAcc;
        // }
        return user;
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function playerNameCount(name: string) {
    if (!name || !process.env["DATABASE_URL"])
        return null;

    try {
        return await prisma.user.count({
            where: {
                name: {
                    equals: name,
                    mode: "insensitive"
                }
            }
        });
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function getPlayerByEmail(email: string) {
    if (!email || !process.env["DATABASE_URL"])
        return null;

    try {
        return await prisma.user.findFirstOrThrow({
            where: {
                email: {
                    equals: email,
                    mode: "default"
                }
            }
        });
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function getLoginPlayerByID(id: string) {
    if (!id || !process.env["DATABASE_URL"])
        return null;

    try {
        return await prisma.user.findFirstOrThrow({
            where: {
                id: {
                    equals: id
                }
            },
            select: {
                secret: true,
                role: true
            }
        });
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function getPlayerByID(id: string) {
    if (!id || !process.env["DATABASE_URL"])
        return null;

    try {
        return await prisma.user.findFirstOrThrow({
            where: {
                id: {
                    equals: id
                }
            }
        });
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function getPlayerNameByID(id: string) {
    if (!id || !process.env["DATABASE_URL"])
        return null;

    try {
        if (!cachedIDtoName.has(id)) {
            const daName = (await prisma.user.findFirstOrThrow({
                where: {
                    id: {
                        equals: id
                    }
                },
                select: {
                    name: true
                }
            })).name;
            cachePlayerUniques(id, daName);
        }
        
        return cachedIDtoName.get(id);
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function getPlayerIDByName(name: string) {
    if (!name || !process.env["DATABASE_URL"])
        return null;

    try {
        if (!cachedNameToID.has(name)) {
            const daID = (await prisma.user.findFirstOrThrow({
                where: {
                    name: {
                        equals: name
                    }
                },
                select: {
                    id: true
                }
            })).id;
            cachePlayerUniques(daID, name);
        }

        return cachedNameToID.get(name);
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function pingPlayer(id: string, keys?:number) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    if (Number.isNaN(keys))
        keys = undefined;
    keys ??= 4;

    try {
        return (await prisma.user.update({
            data: {
                lastActive: new Date(Date.now())
            },
            where: {
                id: id
            },
            select: {
                name: true,
                role: true,
                joined: true,
                lastActive: true,
                profileHue: true,
                profileHue2: true,
                country: true,
                stats: {
                    select: {
                        ['avgAcc' + keys + 'k']: true,
                        ['points' + keys + 'k']: true,
                    }
                }
            }
        }));
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function topScores(id: string, strum:number, page: number, keys?: number, category: string = undefined, sort?: string): Promise<Array<ScoreData>> {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    const [_sortBy, _sortDirection] = (sort ?? '').split(':');

    let sortBy = 'score';
    let sortDirection = 'desc';
    if (['points', 'accuracy', 'score', 'submitted', 'misses'].includes(_sortBy)) {
        sortBy = _sortBy;
    }
    if (['desc', 'asc'].includes(_sortDirection)) {
        sortDirection = _sortDirection;
    }

    const orderBy = [{
        [sortBy]: sortDirection
    }]
    
    for (const remainderSort of ['score', 'accuracy', 'points', 'submitted']) {
        if (remainderSort !== sortBy) {
            orderBy.push({
                [remainderSort]: 'desc'
            });
        }
    }

    try {
        return await prisma.score.findMany({
            where: {
                songId: id,
                strum: strum,
                category: category == undefined ? {
                    isSet: false
                } : {
                    equals: category
                }, 
                keys: !keys || keys == 4 ? {
                    isSet: false
                } : {
                    equals: keys
                }
            },
            orderBy: orderBy,
            select: {
                score: true,
                accuracy: true,
                points: true,
                player: true,
                submitted: true,
                id: true,
                misses: true,
                modURL: true,
                sicks: true,
                goods: true,
                bads: true,
                shits: true,
                playbackRate: true,
            },
            take: 15,
            skip: 15 * page
        });
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function topPlayers(page: number, country?: string, category?: string, sortProp?:string):Promise<any> {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        if (!country || !validCountries.includes(country)) {
            country = undefined;
        }

        sortProp ??= 'points4k';

        if (!sortProp.startsWith('points') && !sortProp.startsWith('avgAcc')) {
            return null;
        }

        return (await prisma.userStats.findMany({
            orderBy: [
                {
                    [sortProp]: 'desc'
                },
                // {
                //     userRe: {
                //         joined: 'desc'
                //     },
                // }
            ],
            where: {
                userRe: {
                    country: country
                },
                type: category == undefined ? {
                    isSet: false
                } : {
                    equals: category
                }
            },
            select: {
                userRe: {
                    select: {
                        id: true,
                        name: true,
                        profileHue: true,
                        profileHue2: true,
                        country: true
                    },
                },
                [sortProp]: true,
            },
            take: 15,
            skip: 15 * page
        }));
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function getScore(id: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return (await prisma.score.findUnique({
            where: {
                id: id
            }
        }));
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function getReplayFile(id: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return (await prisma.fileReplay.findUnique({
            where: {
                id: id
            }
        }));
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function getScoresPlayer(id: string, page:number, keys?: number, category: string = undefined, sort?: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    const [_sortBy, _sortDirection] = (sort ?? '').split(':');

    let sortBy = 'points';
    let sortDirection = 'desc';
    if (['points', 'accuracy', 'score', 'submitted', 'misses'].includes(_sortBy)) {
        sortBy = _sortBy;
    }
    if (['desc', 'asc'].includes(_sortDirection)) {
        sortDirection = _sortDirection;
    }

    try {
        return (await prisma.score.findMany({
            where: {
                player: id,
                category: category == undefined ? {
                    isSet: false
                } : {
                    equals: category
                },
                keys: !keys || keys == 4 ? {
                    isSet: false
                } : {
                    equals: keys
                }
            },
            select: {
                submitted: true,
                songId: true,
                score: true,
                accuracy: true,
                points: true,
                strum: true,
                id: true,
                modURL: true,
                misses: true
            },
            orderBy: {
                [sortBy]: sortDirection,
            },
            take: 15,
            skip: 15 * page
        }));
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function getSong(id: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return (await prisma.song.findUnique({
            where: {
                id: id
            },
            select: {
                maxPoints: true,
                _count: {
                    select: {
                        comments: true,
                        scores: true
                    }
                }
            }
        }))
    }
    catch (_exc) {
        //not found
        return null;
    }
}

export async function getSongComments(id: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return (await prisma.songComment.findMany({
            where: {
                songid: id
            },
            orderBy: {
                at: "asc"
            }
        }))
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function searchSongs(query: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    if (query.trim().length < 3) {
        throw {
            error_message: "Search query needs to be longer than 3!"
        }
    }

    try {
        const rawRes = await prisma.song.findMany({
            where: {
                id: {
                    contains: query,
                    mode: "insensitive"
                }
            },
            select: {
                id: true,
                maxPoints: true
            },
            take: 50
        });

        const res = [];
        for (const song of rawRes) {
            res.push({
                id: song.id,
                fp: song.maxPoints ?? 0
            });
        }
        return res
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function searchUsers(query: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    if (query.trim().length < 3) {
        throw {
            error_message: "Search query needs to be longer than 3!"
        }
    }

    try {
        return (await prisma.user.findMany({
            where: {
                name: {
                    contains: query,
                    mode: "insensitive"
                }
            },
            select: {
                name: true,
                role: true,
            },
            take: 50
        }))
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function removeFriendFromUser(req: any) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    const me = await getPlayerByName(req.query.name as string);
    const remove = await authPlayer(req, false);

    if (!me || !remove)
        throw { error_message: "Player not found" }

    if (!me.friends.includes(remove.id)) 
        throw { error_message: "Not on friend list" }

    const meFriends = me.friends;
    meFriends.splice(meFriends.indexOf(remove.id, 0), 1);
    
    const removedFriends = remove.friends;
    removedFriends.splice(removedFriends.indexOf(me.id, 0), 1);

    await prisma.user.update({
        where: {
            id: me.id
        },
        data: {
            friends: meFriends
        }
    })

    await prisma.user.update({
        where: {
            id: remove.id
        },
        data: {
            friends: removedFriends
        }
    })
}

export async function requestFriendRequest(req:any) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }
    
    // to and from is confusing for me sorry lol
    // ----- aight whatever did i do here
    const me = await getPlayerByName(req.query.name as string);
    const want = await authPlayer(req, false);

    if (!me || !want)
        throw { error_message: "Player not found" }
    
    if (me.id == want.id)
        throw { error_message: "bro" }

    if (want.friends.includes(me.id)) {
        throw { error_message: "Already frens :)" }
    }

    if (me.pendingFriends.includes(want.id)) {
        //accept invite, we frens now
        //https://youtu.be/b858s3ktOsU?si=2nNqP3_VQmqBcVwQ&t=227

        const newMePending = me.pendingFriends;
        newMePending.splice(newMePending.indexOf(want.id, 0), 1);
        
        await prisma.user.update({
            data: {
                pendingFriends: newMePending,
                friends: {
                    push: want.id
                }
            },
            where: {
                id: me.id
            }
        });

        const newPending = want.pendingFriends;
        newPending.splice(newPending.indexOf(me.id, 0), 1);

        await prisma.user.update({
            data: {
                pendingFriends: newPending,
                friends: {
                    push: me.id
                }
            },
            where: {
                id: want.id
            }
        });

        await sendNotification(me.id, {
            title: 'Friend Request Accepted',
            content: 'You are now friends with ' + want.name + '!',
            image: '/api/user/avatar/' + encodeURIComponent(want.name),
            href: '/user/' + encodeURIComponent(want.name)
        });

        notifyPlayer(want.id, 'You are now friends with ' + me.name + '!');

        return;
    }

    if (!want.pendingFriends.includes(me.id)) {
        //send invite

        await sendNotification(me.id, {
            title: 'Friend Request',
            content: want.name + ' sent you a friend request!',
            image: '/api/user/avatar/' + encodeURIComponent(want.name),
            href: '/user/' + encodeURIComponent(want.name)
        });

        return await prisma.user.update({
            data: {
                pendingFriends: {
                    push: me.id
                }
            },
            where: {
                id: want.id
            }
        });
    }
}

export async function getUserFriends(friends: Array<string>) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    const value: Array<string> = [];
    for (const friendID of friends) {
        const friend = await getPlayerNameByID(friendID);
        value.push(friend);
    }
    return value;
}

export async function searchFriendRequests(id:string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    const value: Array<string> = [];
    for (const pender of await prisma.user.findMany({
        where: {
            pendingFriends: {
                has: id
            }
        },
        select: {
            name: true
        }
    })) {
        value.push(pender.name);
    }
    return value;
}

export async function deleteUser(id:string) {
    if (!id || !process.env["DATABASE_URL"]) {
        return null;
    }

    await setUserBanStatus(id, true);

    await prisma.userStats.deleteMany({
        where: {
            user: id
        }
    })
    
    const user = await prisma.user.delete({
        where: {
            id: id
        },
        select: {
            name: true,
            id: true
        }
    })
    cachedIDtoName.delete(user.id);
    cachedNameToID.delete(user.name);

    try {
        networkRoom.IDtoClient.get(user.id).leave(403);
    }
    catch (_) {}

    console.log("Deleted user: " + user.name);
}

export async function setUserBanStatus(id: string, to: boolean) {
    if (!id || !process.env["DATABASE_URL"]) {
        return null;
    }

    const player = await prisma.user.update({
        where: {
            id: id
        },
        data: {
            role: to ? 'Banned' : Data.CONFIG.DEFAULT_ROLE,
            bio: {
                unset: true
            }
        }
    })

    if (to) {
        const statsData = {};
        for (const key of KEYS_LIST) {
            statsData["points" + key + "k"] = 0;
            statsData["avgAcc" + key + "k"] = 0;
        }

        await prisma.userStats.updateMany({
            where: {
                user: id
            },
            data: {
                ...statsData
            }
        });

        const scores = await prisma.score.findMany({
            where: {
                player: id
            },
            select: {
                songId: true,
                replayFileId: true
            }
        });

        await prisma.score.deleteMany({
            where: {
                player: id
            }
        })

        for (const score of scores) {
            await updateSongMaxPoints(score.songId);
            await prisma.fileReplay.deleteMany({
                where: {
                    id: score.replayFileId
                }
            });
        }

        await prisma.songComment.deleteMany({
            where: {
                by: id
            }
        })

        await prisma.report.deleteMany({
            where: {
                by: id
            }
        })

        await prisma.fileAvatar.deleteMany({
            where: {
                owner: id
            }
        })

        await prisma.fileBackground.deleteMany({
            where: {
                owner: id
            }
        })

        try {
            await removePlayerFromClub(id);
        } catch (_) {}
        
        try {
            networkRoom.IDtoClient.get(player.id).leave(403);
        }
        catch (_) { }
    }

    console.log("Set " + id + "'s ban status to " + to);
}

export async function uploadClubBanner(tag: string, data: Buffer) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        await prisma.fileClubBanner.deleteMany({
            where: {
                clubTag: tag
            }
        })
        return await prisma.fileClubBanner.create({
            data: {
                data: data,
                size: data.byteLength,
                clubRe: {
                    connect: {
                        tag: tag
                    }
                }
            }
        });
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function getClubBanner(tag: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return await prisma.fileClubBanner.findUnique({
            where: {
                clubTag: tag
            }
        });
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function uploadAvatar(userId:string, data:Buffer) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        await prisma.fileAvatar.deleteMany({
            where: {
                owner: userId
            }
        })
        return await prisma.fileAvatar.create({
            data: {
                data: data,
                size: data.byteLength,
                ownerRe: {
                    connect: {
                        id: userId
                    }
                }
            }
        });
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function getAvatar(userId: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return await prisma.fileAvatar.findUnique({
            where: {
                owner: userId
            }
        });
    }
    catch (_) {
        return null;
    }
}

export async function hasAvatar(userId: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return await prisma.fileAvatar.count({
            where: {
                owner: userId
            }
        }) > 0;
    }
    catch (_exc) {
        // idk
        return null;
    }
}

export async function uploadBackground(userId: string, data: Buffer) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        await prisma.fileBackground.deleteMany({
            where: {
                owner: userId
            }
        })
        return await prisma.fileBackground.create({
            data: {
                data: data,
                size: data.byteLength,
                ownerRe: {
                    connect: {
                        id: userId
                    }
                }
            }
        });
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function getBackground(userId: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return await prisma.fileBackground.findUnique({
            where: {
                owner: userId
            }
        });
    }
    catch (_exc) {
        // not found
        return null;
    }
}

export async function hasBackground(userId: string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        return await prisma.fileBackground.count({
            where: {
                owner: userId
            }
        }) > 0;
    }
    catch (_exc) {
        return null;
    }
}

export async function removeImages(userId: string) {
    if (!process.env["DATABASE_URL"]) {
        return false;
    }

    try {
        await prisma.fileBackground.deleteMany({
            where: {
                owner: userId
            }
        })
        await prisma.fileAvatar.deleteMany({
            where: {
                owner: userId
            }
        })
        return true;
    }
    catch (exc) {
        console.error(exc);
        return false;
    }
}

// export async function updateScores() {
//     console.log("updating...");

//     let i = 0;
//     const scores = await prisma.song.findMany({
//         select: {
//             id: true,
//         }
//     });

//     for (const song of scores) {
//         //await migrateReplay(score.id);
//         await updateSongMaxPoints(song.id);
//         console.log(i++);
//     }

//     console.log("done!");
// }

export async function migrateReplay(scoreId: string, data?:string) {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    try {
        if (!data) {
            data = (await prisma.score.findFirst({
                where: {
                    id: scoreId,
                    replayData: {
                        isSet: true
                    }
                },
                select: {
                    replayData: true
                },
                take: 100
            })).replayData;
        }

        if (!data || data.length <= 0)
            return null;

        return await prisma.score.update({
            where: {
                id: scoreId
            },
            data: {
                replayFileRe: {
                    create: {
                        data: Buffer.from(data),
                        size: data.length
                    },
                },
                replayData: {
                    unset: true
                }
            },
            select: {
                id: true
            }
        });
    }
    catch (exc) {
        console.error(exc);
        return null;
    }
}

export async function perishScores() {
    if (!process.env["DATABASE_URL"]) {
        console.log("no database set");
        return;
    }

    console.log("deleting rankings");
    await prisma.score.deleteMany();
    await prisma.fileReplay.deleteMany();
    await prisma.song.updateMany({
        data: {
            maxPoints: 0
        }
    });
    console.log("deleting reports");
    await prisma.report.deleteMany();
    
    console.log("zeroing players");
    const statsData = {};
    for (const key of KEYS_LIST) {
        statsData["points" + key + "k"] = 0;
        statsData["avgAcc" + key + "k"] = 0;
    }

    await prisma.userStats.updateMany({
        data: {
            ...statsData
        }
    });
    console.log("deleted ranking shit");

    await prisma.club.updateMany({
        data: {
            points: 0
        }
    })
}

// export async function migrateRoles() {
//     console.log("migrating roles");
//     for (const user of await prisma.user.findMany({
//         where: {
//             OR: [
//                 {
//                     isBanned: {
//                         isSet: true
//                     }
//                 },
//                 {
//                     isMod: {
//                         isSet: true
//                     }
//                 }
//             ]
//         }
//     })) {
//         console.log(user.name + ' found');
//         grantPlayerRole(user.name, user.isBanned ? 'Banned' : user.isMod ? 'Moderator' : DEFAULT_ROLE);
//         await prisma.user.update({
//             where: {
//                 id: user.id,
//             },
//             data: {
//                 isBanned: {
//                     unset: true
//                 },
//                 isMod: {
//                     unset: true
//                 },
//             }
//         });
//     }
//     console.log('done migrating roles');
// }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// async function recountPlayersFP() {
//     if (!process.env["DATABASE_URL"]) {
//         return null;
//     }

//     try {
//         for (const user of await prisma.user.findMany({
//             select: {
//                 id: true,
//             }
//         })) {
//             await prisma.user.update({
//                 where: {
//                     id: user.id,
//                 },
//                 data: {
//                     points: await countPlayerFP(user.id) ?? 0,
//                 },
//             })
//         }
//         return true;
//     }
//     catch (exc) {
//         console.error(exc);
//         return null;
//     }
// }

export async function getPlayerRank(name: string, category?: string, keys?:number): Promise<number> {
    if (!process.env["DATABASE_URL"]) {
        return null;
    }

    if (Number.isNaN(keys))
        keys = undefined;
    keys ??= 4;

    const userId = await getPlayerIDByName(name);

    try {
        const everyone = await prisma.userStats.findMany({
            where: {
                type: category == undefined ? {
                    isSet: false
                } : {
                    equals: category
                },
            },
            orderBy: [
                {
                    ["points" + keys + "k"]: 'desc'
                }
            ],
            select: {
                user: true,
            }
        });
        return everyone.findIndex(user => user.user == userId) + 1;
    }
    catch (_exc) {
        console.error(_exc);
        return null;
    }
}

export async function getPlayerProfileHue(name: string) {
    if (!name || !process.env["DATABASE_URL"])
        return null;

    try {
        if (!cachedProfileNameHue.has(name)) {
            const data = (await prisma.user.findFirstOrThrow({
                where: {
                    name: {
                        equals: name
                    }
                },
                select: {
                    profileHue: true,
                    profileHue2: true
                }
            }));
            cachedProfileNameHue.set(name, [data.profileHue ?? 250, data.profileHue2]);
        }

        return cachedProfileNameHue.get(name);
    }
    catch (_exc) {
        return null;
    }
}

export async function endWeekly() {
    const scores = await prisma.score.findMany({
        where: {
            category: 'week'
        },
        select: {
            id: true
        }
    })

    const scoreIDs = [];
    for (const score of scores) {
        scoreIDs.push(score.id);
    }
    await removeScore(scoreIDs);
}

// CACHE

export const cachedIDtoName: Map<string, string> = new Map<string, string>();
export const cachedNameToID: Map<string, string> = new Map<string, string>();

export const cachedProfileNameHue: Map<string, number[]> = new Map<string, number[]>();
export const cachedUserIDClubTag: Map<string, string> = new Map<string, string>();

export function cachePlayerUniques(id:string, name:string) {
    cachedIDtoName.set(id, name);
    cachedNameToID.set(name, id);
}

export async function initDatabaseCache() {
    if (!process.env["DATABASE_URL"]) {
        return;
    }

    console.log('Caching the database...');
    for (const user of await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            profileHue: true,
            profileHue2: true
        },
        orderBy: {
            joined: 'desc'
        }
    })) {
        cachePlayerUniques(user.id, user.name);
        cachedProfileNameHue.set(user.name, [user.profileHue ?? 250, user.profileHue2]);

        // console.log(user.name);
        // await updatePlayerStats(user.id);
    }

    for (const club of await prisma.club.findMany({
        select: {
            members: true,
            tag: true
        }
    })) {
        for (const member of club.members) {
            cachedUserIDClubTag.set(member, club.tag);
        }
    }

    //await recountPlayersFP();
    console.log('Successfully cached the database!');
}

export async function getNotifications(id: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    try {
        const list = []

        for (const notif of await prisma.notification.findMany({
            where: {
                to: id
            },
            orderBy: {
                date: 'desc'
            }
        })) {
            list.push({
                id: notif.id,
                date: notif.date,
                title: notif.title,
                content: notif.content,
                image: notif.image,
                href: notif.href
            });
        }

        return list;
    }
    catch (_exc) {
        return null;
    }
}

export async function getNotificationsCount(id: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    try {
        return await prisma.notification.count({
            where: {
                to: id
            }
        });
    }
    catch (_exc) {
        return null;
    }
}

export async function deleteNotification(id: string) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    await prisma.notification.delete({
        where: {
            id: id
        }
    });
}

export async function sendNotification(toID: string, content: NotificationContent) {
    if (!process.env["DATABASE_URL"]) {
        throw { error_message: "No database set on the server!" }
    }

    await prisma.notification.create({
        data: {
            to: toID,
            title: content.title,
            content: content?.content,
            image: content?.image,
            href: content?.href,
        }
    });

    notifyPlayer(toID, '[NOTIFICATION] ' + (content?.content ?? content.title));
}

class NotificationContent {
    title: string;
    content: string;
    image: string;
    href: string;
}

// STRUCTURES

class ReplayData {
    player: string;

    song: string;
    difficulty: string;
    accuracy: number;
    sicks: number;
    goods: number;
    bads: number;
    shits: number;
    misses: number;
    score: number;
    points: number;

	opponent_mode: boolean;
    beat_time: number;
    chart_hash: string;
    keys: number;

    note_offset: number;
	gameplay_modifiers: any;
	ghost_tapping: boolean;
    rating_offset: number;
    safe_frames: number;

	inputs: Array<Array<any>>;

    version: number;
    mod_url: string;
}

class ScoreData {
    id: string;
    points: number;
    score: number;
    accuracy: number;
    sicks: number;
    goods: number;
    bads: number;
    shits: number;
    misses: number;
    playbackRate: number;
    submitted: Date;
    modURL: string;
    player: string; 
}
