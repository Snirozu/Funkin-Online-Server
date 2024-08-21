import jwt from "jsonwebtoken";
import { PrismaClient } from '@prisma/client'
import * as crypto from "crypto";
import { filterSongName, filterUsername } from "./util";

const prisma = new PrismaClient()

export async function genAccessToken(id: string) {
    return jwt.sign(id, (await getPlayerByID(id)).secret);
}

export function getIDToken(req:any):Array<string> {
    if (req.cookies.authid && req.cookies.authtoken) {
        return [req.cookies.authid, req.cookies.authtoken];
    }

    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    let [id, secret] = Buffer.from(b64auth, 'base64').toString().split(':')
    if (id)
        id = id.trim();
    if (secret)
        secret = secret.trim();
    return [id, secret];
}

export async function checkLogin(req:any, res:any, next:any) {
    const [id, token] = getIDToken(req);
    const player = await getPlayerByID(id);

    if (player == null || token == null || id == null) { 
        return res.sendStatus(401)
    }

    jwt.verify(token, player.secret as string, (err: any, user: any) => {
        if (err) return res.sendStatus(403)

        next()
    })
}

export async function authPlayer(req: any) {
    const [id, token] = getIDToken(req);
    const player = await getPlayerByID(id);

    if (player == null || token == null || id == null) {
        return;
    }

    let isValid = false;
    jwt.verify(token, player.secret as string, (err: any, user: any) => {
        if (err) return isValid = false;
        isValid = true;
    })
    if (isValid) {
        return player;
    }
    return;
}

export async function checkSecret(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization']

    if (!authHeader)
        return res.sendStatus(400)

    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    let [id, secret] = Buffer.from(b64auth, 'base64').toString().split(':')
    if (id)
        id = id.trim();
    if (secret)
        secret = secret.trim();

    const player = await getPlayerByID(id);

    if (player == null || id == null || secret == null) return res.sendStatus(401)

    if (player.secret != secret) {
        return res.sendStatus(403)
    }

    next();
}

//DATABASE STUFF

export async function submitScore(submitterID: string, replay: ReplayData) {
    if (replay.version < 1) {
        throw { error_message: "Outdated Client, can't submit!" }
    }

    if (!replay)
        throw { error_message: "Empty Replay Data!" }

    const submitter = await getPlayerByID(submitterID);
    if (!submitter)
        throw { error_message: "Unknown Submitter!" }

    const songId:string = filterSongName(replay.song) + "-" + filterSongName(replay.difficulty) + "-" + filterSongName(replay.chart_hash);

    let song = await prisma.song.findFirstOrThrow({
        where: {
            id: songId
        }
    });
    if (!songId || !song) {
        song = await prisma.song.create({
            data: {
                id: songId
            }
        });
    }

    const daStrum = replay.opponent_mode ? 1 : 2;

    const leaderboardScore = (await prisma.score.findFirstOrThrow({ where: { songId: songId, player: submitter.id, strum: daStrum } }));
    if (songId && leaderboardScore) {
        if (leaderboardScore.score > replay.score && leaderboardScore.points > replay.points)
            return { song: song.id }

        await prisma.score.delete({
            where: {
                id: leaderboardScore.id
            }
        });
    }

    const score = await prisma.score.create({
        data: {
            accuracy: replay.accuracy,
            bads: replay.bads,
            goods: replay.goods,
            points: replay.points,
            replayData: JSON.stringify(replay),
            score: replay.score,
            shits: replay.shits,
            sicks: replay.sicks,
            misses: replay.misses,
            strum: daStrum
        }
    });

    await prisma.user.update({
        where: {
            id: submitter.id,
        },
        data: {
            scores: {
                connect: {
                    id: score.id,
                },
            },
            points: (submitter.points - (leaderboardScore?.points ?? 0)) + replay.points
        },
    })

    await prisma.song.update({
        where: {
            id: song.id,
        },
        data: {
            scores: {
                connect: {
                    id: score.id,
                },
            },
        },
    })

    return {
        song: song.id,
        message: "Submitted!",
        gained_points: replay.points - (leaderboardScore?.points ?? 0) 
    }
}

export async function submitReport(id: string, reqJson: any) {
    const submitter = await getPlayerByID(id);
    if (!submitter)
        throw { error_message: "Not registered!" }

    return (await prisma.report.create({
        data: {
            userRe: {
                connect: {
                    id: id
                }
            },
            content: reqJson.content
        },
    }));
}

export async function removeSongComment(userId: string, songId: string) {
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

export async function viewReports() {
    return (await prisma.report.findMany());
}

export async function removeReport(id:string) {
    return (await prisma.report.delete({
        where: {
            id: id
        }
    }));
}

export async function removeScore(id: string, checkPlayer?: string) {
    if (checkPlayer) {
        if (!id || (await prisma.score.findFirstOrThrow({
            where: {
                id: id
            }
        })).player != checkPlayer)
            throw { error_message: "Unauthorized!" }
    }

    const score = (await prisma.score.delete({
        where: {
            id: id
        }
    }));

    return (await prisma.user.update({
        data: {
            points: {
                decrement: score.points
            }
        },
        where: {
            id: score.player
        }
    }));
}

export async function createUser(name: string) {
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

    if (await getPlayerByName(name))
        throw { error_message: "Player with that username exists!" }

    return (await prisma.user.create({
        data: {
            name: name,
            secret: crypto.randomBytes(64).toString('hex'),
            points: 0
        },
    }));
}

export async function resetSecret(id: string) {
    return (await prisma.user.update({
        data: {
            secret: crypto.randomBytes(64).toString('hex')
        },
        where: {
            id: id
        }
    }));
}

export async function renamePlayer(id: string, name: string) {
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

    const player = await getPlayerByName(name);
    if (player)
        throw { error_message: "Player with that username exists!" }

    const oldName = player.name;

    const data = (await prisma.user.update({
        data: {
            name: name
        },
        where: {
            id: id
        }
    }));

    return {
        new: data.name,
        old: oldName
    };
}

export async function grantPlayerMod(id: string) {
    if ((await getPlayerByID(id))?.isMod) {
        throw "already a mod";
    }

    return (await prisma.user.update({
        data: {
            isMod: true
        },
        where: {
            id: id
        }
    }));
}

export async function getPlayerByName(name: string) {
    if (!name)
        return null;

    try {
        return await prisma.user.findFirstOrThrow({
            where: {
                name: {
                    equals: name,
                    mode: "insensitive"
                }
            }
        });
    }
    catch (exc) {
        console.log(exc);
        return null;
    }
}

export async function getPlayerByID(id: string) {
    if (!id)
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
    catch (exc) {
        return null;
    }
}

export async function pingPlayer(id: string) {
    try {
        return (await prisma.user.update({
            data: {
                lastActive: new Date(Date.now())
            },
            where: {
                id: id
            }
        }));
    }
    catch (exc) {
        return null;
    }
}

export async function topScores(id: string, strum:number, page: number):Promise<Array<any>> {
    try {
        return (await prisma.score.findMany({
            where: {
                songId: id,
                strum: strum
            },
            orderBy: [
                {
                    score: 'desc'
                }
            ],
            select: {
                score: true,
                accuracy: true,
                points: true,
                player: true,
                submitted: true,
                id: true,
                misses: true
            },
            take: 15,
            skip: 15 * page
        }));
    }
    catch (exc) {
        return null;
    }
}

export async function topPlayers(page:number): Promise<Array<any>> {
    try {
        return (await prisma.user.findMany({
            orderBy: [
                {
                    points: 'desc'
                }
            ],
            select: {
                name: true,
                points: true
            },
            take: 15,
            skip: 15 * page
        }));
    }
    catch (exc) {
        return null;
    }
}

export async function getScore(id: string) {
    try {
        return (await prisma.score.findUnique({
            where: {
                id: id
            }
        }));
    }
    catch (exc) {
        return null;
    }
}

export async function getScoresPlayer(id: string, page:number): Promise<any> {
    try {
        return (await prisma.score.findMany({
            where: {
                player: id,
            },
            select: {
                submitted: true,
                songId: true,
                score: true,
                accuracy: true,
                points: true,
                strum: true,
            },
            orderBy: {
                points: "desc"
            },
            take: 15,
            skip: 15 * page
        }));
    }
    catch (exc) {
        return null;
    }
}

export async function getSongComments(id: string) {
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
    catch (exc) {
        return null;
    }
}

export async function searchSongs(query: string) {
    try {
        return (await prisma.song.findMany({
            where: {
                id: {
                    contains: query,
                    mode: "insensitive"
                }
            }
        }))
    }
    catch (exc) {
        return null;
    }
}

export async function searchUsers(query: string) {
    try {
        return (await prisma.user.findMany({
            where: {
                name: {
                    contains: query,
                    mode: "insensitive"
                }
            }
        }))
    }
    catch (exc) {
        return null;
    }
}

export async function perishScores() {
    console.log("deleting rankings");
    prisma.score.deleteMany();
    prisma.report.deleteMany();
    
    prisma.user.updateMany({
        data: {
            points: 0
        }
    })
    console.log("deleted ranking shit");
}

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

    note_offset: number;
	gameplay_modifiers: Map<string, any>;
	ghost_tapping: boolean;
    rating_offset: number;
    safe_frames: number;

	inputs: Array<Array<any>>;

	version: number;
}