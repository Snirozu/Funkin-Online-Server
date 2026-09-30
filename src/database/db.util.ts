import { debugPrint, isObjectEmpty, matchWildcard } from "../util";
import jwt from "jsonwebtoken";
import { Data } from "../data";
import { cooldown } from "../cooldown";
import { Request } from "express";
import { db, KEYS_LIST, prisma } from "./db";
import { Prisma } from "@prisma/client";

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

export async function userIDsToNames(IDs: Array<string>) {
    const value: Array<string> = [];
    for (const id of IDs) {
        const friend = await db.users.getNameByID(id);
        if (!friend)
            continue;
        value.push(friend);
    }
    return value;
}

export async function getLookForWarned() {
    const warnedObj = {};

    // let orBody:any[] = [{
    //     report: isReport
    // }];
    // if (!isReport) {
    //     orBody.push({
    //         report: {
    //             isSet: false
    //         }
    //     });
    // }

    const warns = await prisma.userWarning.findMany({
        // where: {
        //     OR: orBody
        // },
        select: {
            on: true,
            reason: true,
            date: true
        }
    });
    for (const warn of warns) {
        const _role = await prisma.user.findUnique({
            where: {
                id: warn.on
            },
            select: {
                role: true
            }
        });

        if (_role.role == 'Banned')
            continue;

        warnedObj[await db.users.getNameByID(warn.on)] ??= [];
        warnedObj[await db.users.getNameByID(warn.on)].push({
            reason: warn.reason,
            date: warn.date
        });
    }

    return warnedObj;
}

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
    await db.scores.removeByIDs(scoreIDs);
}

export function getUserPriority<V extends Prisma.UserFindUniqueArgs>(user: Prisma.UserGetPayload<V> | null):number {
    return getRolePriority(user?.role);
}

export function getRolePriority(role: string) {
    if (!role || !Data.CONFIG.ROLES.has(role))
        role = Data.CONFIG.DEFAULT_ROLE;

    return Data.CONFIG.ROLES.get(role)?.priority ?? 0;
}

export async function genAccessToken(id: string) {
    return jwt.sign(id, (await db.users.byID(id).getLoginState()).secret);
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

const INVALID_IPS = ['::1', '::ffff:127.0.0.1'];

export async function checkAccess(req: Request, res: any, next: any) {
    if (!process.env["DATABASE_URL"]) {
        return res.sendStatus(418);
    }

    const [id, token] = getIDToken(req);

    if (token == null || isObjectEmpty(id)) {
        return res.sendStatus(401)
    }

    const player = await db.users.byID(id).getLoginState();

    if (player == null) {
        return res.sendStatus(401)
    }

    if (!hasAccess(player?.role, req.baseUrl + req.path)) {
        return res.sendStatus(403)
    }
    
    if (!cooldown(id, req.baseUrl + req.path)) {
        return res.sendStatus(429)
    }

    await jwt.verify(token, player.secret as string, async (err: any, _user: any) => {
        if (err) {
            // console.error(err);
            return res.sendStatus(401)
        }

        if (req.ip && !INVALID_IPS.includes(req.ip) && !player.ips.includes(req.ip)) {
            await prisma.user.update({
                data: {
                    ips: {
                        push: req.ip
                    }
                },
                where: {
                    id: id
                }
            });
        }

        next()
    })
}

export async function authUser(req: any, checkPerms:boolean = true) {
    const [id, token] = getIDToken(req);

    if (isObjectEmpty(id))
        return;

    const self = db.users.byID(id);
    const player = await self.get({
        select: {
            role: true,
            secret: true
        }
    });

    if (player == null || token == null || id == null) {
        return;
    }

    if (checkPerms && !hasAccess(player?.role, req.baseUrl + req.path)) {
        return
    }

    let isValid = false;
    await jwt.verify(token, player.secret as string, (err: any, _user: any) => {
        if (err) return isValid = false;
        isValid = true;
    })
    if (isValid) {
        return self;
    }
    return;
}

export function hasAccess(role: string, to: string):boolean {
    if (!role || !Data.CONFIG.ROLES.has(role))
        role = Data.CONFIG.DEFAULT_ROLE;

    for (const access of Data.CONFIG.ROLES.get(role).access) {
        if (matchWildcard(access, to))
            return true;
    }
    return false; 
}