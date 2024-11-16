import jwt from "jsonwebtoken";
import { PrismaClient } from '@prisma/client'
import * as crypto from "crypto";
import { filterSongName, filterUsername } from "./util";
import { notifyPlayer } from "./rooms/NetworkRoom";
import * as fs from 'fs';
import sanitizeHtml from 'sanitize-html';

const prisma = new PrismaClient()

export async function genAccessToken(id: string) {
    return jwt.sign(id, (await getPlayerByID(id)).secret);
}

export function getIDToken(req:any):Array<string> {
    if (req.networkId && req.networkToken) {
        return [req.networkId, req.networkToken];
    }

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

    if (player.isBanned) {
        return res.sendStatus(418)
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

    if (player.isBanned) {
        return
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

//DATABASE STUFF

export async function submitScore(submitterID: string, replay: ReplayData) {
    if (replay.version != 2) {
        throw { error_message: "Replay version mismatch error, can't submit!" }
    }

    if (!replay)
        throw { error_message: "Empty Replay Data!" }

    // if (!replay.mod_url || !replay.mod_url.startsWith('http'))
    //     throw { error_message: "No Mod URL provided!" }

    const noteEvents = replay.shits + replay.bads + replay.goods + replay.sicks;
    if (noteEvents <= 0 || replay.inputs.length <= 0) {
        throw { error_message: "Empty Replay" }
    }

    if (replay.points < 0 || replay.points > 10000 || replay.score > 100000000 || replay.inputs.length < noteEvents)
        throw { error_message: "Illegal Values in the Replay Data" }

    const submitter = await getPlayerByID(submitterID);
    if (!submitter)
        throw { error_message: "Unknown Submitter!" }

    const songId:string = filterSongName(replay.song) + "-" + filterSongName(replay.difficulty) + "-" + filterSongName(replay.chart_hash);

    let song = null;
    try {
        song = await prisma.song.findFirstOrThrow({
            where: {
                id: songId
            }
        });
    } catch (exc) {}
    if (!songId || !song) {
        song = await prisma.song.create({
            data: {
                id: songId
            }
        });
    }

    const daStrum = replay.opponent_mode ? 1 : 2;

    let leaderboardScore = null;
    try {
        leaderboardScore = (await prisma.score.findFirstOrThrow({ where: { songId: songId, player: submitter.id, strum: daStrum } }))
    } catch (exc) {}

    if (songId && leaderboardScore) {
        if (!(
            replay.score > leaderboardScore.score ||
            replay.points > leaderboardScore.points ||
            replay.accuracy > leaderboardScore.accuracy
        ))
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
            strum: daStrum,
            modURL: replay.mod_url
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
            points: (submitter.points - (leaderboardScore?.points ?? 0)) + replay.points,
            avgAccSumAmount: (submitter.avgAccSumAmount ?? 0) + 1,
            avgAccSum: (submitter.avgAccSum ?? 0) + replay.accuracy / 100
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

    try {
        await prisma.user.update({
            data: {
                points: {
                    decrement: score.points
                }
            },
            where: {
                id: score.player
            }
        })
    }
    catch (exc) {
        console.error(exc);
    }
}

export async function createUser(name: string, email: string) {
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
        throw { error_message: "Player with that username already exists!" }

    if (await getPlayerByEmail(email))
        throw { error_message: "Player with that email already exists!" }

    return (await prisma.user.create({
        data: {
            name: name,
            email: email,
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

export async function setEmail(id: string, email: string) {
    if (await getPlayerByEmail(email))
        throw { error_message: "Player with that email already exists!" }

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

export async function setPlayerBio(id: string, bio: string, hue: number) {
    if (bio.length > 1500) {
        return null;
    }

    if (hue > 360)
        hue = 360;
    if (hue < 0)
        hue = 0;

    const sanitizedHtml = sanitizeHtml(bio);

    return (await prisma.user.update({
        data: {
            bio: sanitizedHtml,
            profileHue: hue
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

export async function getPlayerByEmail(email: string) {
    if (!email)
        return null;

    try {
        return await prisma.user.findFirstOrThrow({
            where: {
                email: {
                    equals: email,
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
            },
            select: {
                name: true,
                points: true,
                isMod: true,
                joined: true,
                lastActive: true,
                isBanned: true,
                profileHue: true,
                avgAccSum: true,
                avgAccSumAmount: true,
            }
        }));
    }
    catch (exc) {
        return null;
    }
}

export async function topScores(id: string, strum:number, page: number) {
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
                misses: true,
                modURL: true
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

export async function getScoresPlayer(id: string, page:number) {
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
                id: true,
                modURL: true
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

export async function removeFriendFromUser(req: any) {
    const me = await getPlayerByName(req.query.name as string);
    const remove = await authPlayer(req);

    if (!me || !remove)
        throw { error_message: "Player not found" }

    if (!me.friends.includes(remove.id)) 
        throw { error_message: "Not on friend list" }

    let meFriends = me.friends;
    meFriends.splice(meFriends.indexOf(remove.id, 0), 1);
    
    let removedFriends = remove.friends;
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
    // to and from is confusing for me sorry lol
    const me = await getPlayerByName(req.query.name as string);
    const want = await authPlayer(req);

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

        let newMePending = me.pendingFriends;
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

        let newPending = want.pendingFriends;
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

        notifyPlayer(want.id, 'You are now friends with ' + me.name + '!');
        notifyPlayer(me.id, 'You are now friends with ' + want.name + '!');

        return;
    }

    if (!want.pendingFriends.includes(me.id)) {
        //send invite

        notifyPlayer(me.id, want.name + ' sent you a friend request!');

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
    let value: Array<string> = [];
    for (const friendID of friends) {
        const friend = await getPlayerByID(friendID);
        value.push(friend.name);
    }
    return value;
}

export async function searchFriendRequests(id:string) {
    let value: Array<string> = [];
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

export async function deleteUser(id:string):Promise<any> {
    if (!id) {
        return null;
    }

    const player = await getPlayerByID(id);
    if (player.isMod)
        return null;
    
    await prisma.score.deleteMany({
        where: {
            player: id
        }
    })
    await prisma.report.deleteMany({
        where: {
            by: id
        }
    })
    await prisma.songComment.deleteMany({
        where: {
            by: id
        }
    })
    const user = await prisma.user.delete({
        where: {
            id: id
        },
        select: {
            name: true
        }
    })

    console.log("Deleted user: " + user.name);
}

export async function setUserBanStatus(id: string, to: boolean): Promise<any> {
    if (!id) {
        return null;
    }

    const user = await getPlayerByID(id);
    if (user.isMod)
        return null;

    const player = await prisma.user.update({
        where: {
            id: id
        },
        data: {
            isBanned: to,
            bio: {
                unset: true
            }
        }
    })
    if (to && fs.existsSync('database/avatars/' + btoa(player.name)))
        fs.unlinkSync('database/avatars/' + btoa(player.name));

    console.log("Set " + id + "'s ban status to " + to);
}

export async function perishScores() {
    console.log("deleting rankings");
    await prisma.score.deleteMany();
    console.log("deleting reports");
    await prisma.report.deleteMany();
    
    console.log("zeroing players");
    await prisma.user.updateMany({
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
    mod_url: string;
}