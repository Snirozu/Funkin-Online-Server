import jwt from "jsonwebtoken";
import { PrismaClient } from '@prisma/client'
import * as crypto from "crypto";
import { filterSongName, filterUsername } from "./util";

const prisma = new PrismaClient()

export async function genAccessToken(id: string) {
    return jwt.sign(id, (await getPlayerByID(id)).secret);
}

export function getIDToken(req:any):Array<string> {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    return (req.cookies.authid && req.cookies.authtoken)
        ? [req.cookies.authid, req.cookies.authtoken]
        : Buffer.from(b64auth, 'base64').toString().split(':');
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

export async function checkSecret(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization']

    if (!authHeader)
        return res.sendStatus(400)

    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    const [id, secret] = Buffer.from(b64auth, 'base64').toString().split(':')
    const player = await getPlayerByID(id);

    if (player == null || id == null || secret == null) return res.sendStatus(401)

    if (player.secret != secret) {
        return res.sendStatus(403)
    }

    next();
}

//DATABASE STUFF

export async function submitScore(submitterID: string, replay: ReplayData) {
    if (!replay)
        throw { error_message: "Empty Replay Data!" }

    const submitter = await getPlayerByID(submitterID);
    if (!submitter)
        throw { error_message: "Unknown Submitter!" }

    const songId:string = filterSongName(replay.song) + "-" + filterSongName(replay.difficulty) + "-" + filterSongName(replay.chart_hash);

    let song = await prisma.song.findFirst({
        where: {
            id: songId
        }
    });
    if (!song) {
        song = await prisma.song.create({
            data: {
                id: songId
            }
        });
    }

    const daStrum = replay.opponent_mode ? 1 : 2;

    const leaderboardScore = (await prisma.score.findFirst({ where: { songId: songId, player: submitter.id, strum: daStrum } }));
    if (leaderboardScore) {
        if (replay.score < leaderboardScore.score)
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
            points: submitter.points + replay.points
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
        message: "Submitted!"
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

    if (await getPlayerByName(name))
        throw { error_message: "Player with that username exists!" }

    return (await prisma.user.update({
        data: {
            name: name
        },
        where: {
            id: id
        }
    }));
}

export async function getPlayerByName(name: string) {
    try {
        return await prisma.user.findFirst({
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
    try {
        return await prisma.user.findFirst({
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
                id: true
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

export async function getScoreReplay(id: string): Promise<any> {
    try {
        return (await prisma.score.findUnique({
            where: {
                id: id
            }
        })).replayData;
    }
    catch (exc) {
        return null;
    }
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

    mod_url: string;
    opponent_mode: boolean;
    beat_time: number;
    chart_hash: string;
    inputs: Array<Array<any>>;
}