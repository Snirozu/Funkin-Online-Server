import jwt from "jsonwebtoken";
import { PrismaClient } from '@prisma/client'
import * as crypto from "crypto";
import { filterSongName, filterUsername, formatLog, ordinalNum, validCountries } from "./util";
import { logToAll, networkRoom, notifyPlayer } from "./rooms/NetworkRoom";
import sanitizeHtml from 'sanitize-html';
import { Data } from "./Data";
import { DEFAULT_ROLE, ROLES } from "./Config";

export const prisma = new PrismaClient()

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

export async function checkAccess(req: any, res: any, next: any) {
    const [id, token] = getIDToken(req);
    const player = await getLoginPlayerByID(id);

    if (player == null || token == null || id == null) {
        return res.sendStatus(401)
    }

    if (!hasAccess(player, req.path)) {
        return res.sendStatus(401)
    }

    jwt.verify(token, player.secret as string, (err: any, user: any) => {
        if (err) return res.sendStatus(403)

        next()
    })
}

export async function authPlayer(req: any, checkPerms:boolean = true) {
    const [id, token] = getIDToken(req);
    const player = await getPlayerByID(id);

    if (player == null || token == null || id == null) {
        return;
    }

    if (checkPerms && !hasAccess(player, req.path)) {
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

export function hasAccess(user: any, to: string):boolean {
    let role = user.role;
    if (!user.role)
        role = DEFAULT_ROLE;

    for (const access of ROLES.get(role).access) {
        if (matchWildcard(access, to))
            return true;
    }
    return false; 
}

export function getPriority(user: any):number {
    let role = user.role;
    if (!user.role)
        role = DEFAULT_ROLE;

    return ROLES.get(role).priority;
}

function matchWildcard(match:string, to:string) {
    let isNegative = false;
    if (to.startsWith('!')) {
        isNegative = true;
        to.substring(1);
    }
    let w = match.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${w.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
    return re.test(to) != isNegative;
}

//DATABASE STUFF

export async function submitScore(submitterID: string, replay: ReplayData) {
    if (replay.version != 3) {
        throw { error_message: "Replay version mismatch error, can't submit!\nPlease update!" }
    }

    if (!replay)
        throw { error_message: "Empty Replay Data!" }

    // if (!replay.mod_url || !replay.mod_url.startsWith('http'))
    //     throw { error_message: "No Mod URL provided!" }

    const noteEvents = replay.shits + replay.bads + replay.goods + replay.sicks;
    if (noteEvents <= 0 || replay.inputs.length <= 0)
        throw { error_message: "Empty Replay" }

    if (replay.inputs.length < noteEvents)
        throw { error_message: "Dismatched Inputs to Score" }

    if (replay.points < 0 || replay.points > 10000 || replay.score > 100000000)
        throw { error_message: "Illegal Score Value in the Replay Data" }

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
                id: songId,
                maxPoints: 0
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

        removeScore(leaderboardScore.id);
    }

    let playbackRate = 1;
    try {
        playbackRate = replay.gameplay_modifiers.songspeed;
    }
    catch (_) {}

    const replayString = JSON.stringify(replay);
    const replayFile = await prisma.fileReplay.create({
        data: {
            data: Buffer.from(replayString, 'utf8'),
            size: replayString.length
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
            playbackRate: playbackRate
        }
    });

    const prevRank = await getPlayerRank(submitter.name);

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
            //points: (submitter.points - (leaderboardScore?.points ?? 0)) + replay.points,
	    points: await countPlayerFP(submitter.id) ?? 0,
            avgAccSumAmount: (submitter.avgAccSumAmount ?? 0) + 1,
            avgAccSum: (submitter.avgAccSum ?? 0) + replay.accuracy / 100
        },
    })

    const newRank = await getPlayerRank(submitter.name);

    if (newRank <= 30 && newRank < prevRank) {
        logToAll(formatLog(submitter.name + ' climbed to ' + ordinalNum(newRank) + ' place on the global leaderboard!'))
    }

    await prisma.song.update({
        where: {
            id: song.id,
        },
        data: {
            scores: {
                connect: {
                    id: score.id,
                },
            }
        },
    })

    await updateSongMaxPoints(song.id);

    return {
        song: song.id,
        message: "Submitted!",
        gained_points: replay.points - (leaderboardScore?.points ?? 0),
        climbed_ranks: prevRank - newRank
    }
}

async function countPlayerFP(id: string) {
    try {
        return (await prisma.score.aggregate({
            where: {
                player: id,
            },
            _sum: {
                points: true
            }
        }))._sum.points;
    }
    catch (exc) {
        return null;
    }
}

async function updateSongMaxPoints(songId:string) {
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
        }
    });
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
    
    await prisma.fileReplay.delete({
        where: {
            id: score.replayFileId
        }
    });

    await updateSongMaxPoints(score.songId);

    try {
        await prisma.user.update({
            data: {
                points: {
                    decrement: score.points
                },
                avgAccSumAmount: {
                    decrement: 1
                },
                avgAccSum: {
                    decrement: score.accuracy / 100
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
        throw { error_message: "Can't set the same email for two accounts!" }

    return (await prisma.user.create({
        data: {
            name: name,
            email: email,
            secret: crypto.randomBytes(64).toString('hex'),
            points: 0
        },
    }));
}

export function validateEmail(email:string) {
    const emailHost = email.split('@')[1].trim();
    for (const v of Data.EMAIL_BLACKLIST) {
        const domain = v.split(' ')[0].trim();
        if (domain.trim().length > 0 && emailHost.endsWith(domain))
            return false;
    }
    return true;
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
    cachedProfileNameHue.set(data.name, data.profileHue ?? 250);

    return {
        new: data.name,
        old: oldPlayer.name
    };
}

export async function grantPlayerRole(name: string, role: string) {
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

export async function setPlayerBio(id: string, bio: string, hue: number, country: string) {
    if (bio.length > 1500) {
        throw {
            error_message: "Your bio reaches 1500 characters!"
        }
    }

    if (hue > 360)
        hue = 360;
    if (hue < 0)
        hue = 0;

    const sanitizedHtml = sanitizeHtml(bio);

    if (!validCountries.includes(country)) {
        country = null;
    }

    return (await prisma.user.update({
        data: {
            bio: sanitizedHtml,
            profileHue: hue,
            country: country
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
        return null;
    }
}

export async function getLoginPlayerByID(id: string) {
    if (!id)
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
    catch (exc) {
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

export async function getPlayerNameByID(id: string) {
    if (!id)
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
    catch (exc) {
        return null;
    }
}

export async function getPlayerIDByName(name: string) {
    if (!name)
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
                role: true,
                joined: true,
                lastActive: true,
                profileHue: true,
                avgAccSum: true,
                avgAccSumAmount: true,
                country: true
            }
        }));
    }
    catch (exc) {
        return null;
    }
}

export async function topScores(id: string, strum:number, page: number): Promise<Array<ScoreData>> {
    try {
        return await prisma.score.findMany({
            where: {
                songId: id,
                strum: strum
            },
            orderBy: [
                {
                    score: 'desc',
                },
                {
                    accuracy: 'desc',
                },
                {
                    points: 'desc',
                },
                {
                    submitted: 'desc'
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

export async function topPlayers(page:number, country?:string): Promise<Array<any>> {
    try {
        if (!country || !validCountries.includes(country)) {
            country = undefined;
        }

        return (await prisma.user.findMany({
            orderBy: [
                {
                    points: 'desc'
                },
                {
                    joined: 'desc'
                }
            ],
            where: country ? {
                country: country
            } : undefined,
            select: {
                name: true,
                points: true,
                profileHue: true,
                country: true
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

export async function getReplayFile(id: string) {
    try {
        return (await prisma.fileReplay.findUnique({
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

export async function getSong(id: string) {
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

        let res = [];
        for (const song of rawRes) {
            res.push({
                id: song.id,
                fp: song.maxPoints ?? 0
            });
        }
        return res
    }
    catch (exc) {
        return null;
    }
}

export async function searchUsers(query: string) {
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
                points: true,
            },
            take: 50
        }))
    }
    catch (exc) {
        return null;
    }
}

export async function removeFriendFromUser(req: any) {
    const me = await getPlayerByName(req.query.name as string);
    const remove = await authPlayer(req, false);

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
        const friend = await getPlayerNameByID(friendID);
        value.push(friend);
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

    await setUserBanStatus(id, true);
    
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

export async function setUserBanStatus(id: string, to: boolean): Promise<any> {
    if (!id) {
        return null;
    }

    const player = await prisma.user.update({
        where: {
            id: id
        },
        data: {
            points: 0,
            role: to ? 'Banned' : DEFAULT_ROLE,
            bio: {
                unset: true
            }
        }
    })

    if (to) {
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
            networkRoom.IDtoClient.get(player.id).leave(403);
        }
        catch (_) { }
    }

    console.log("Set " + id + "'s ban status to " + to);
}

export async function uploadAvatar(userId:string, data:Buffer) {
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
        return null;
    }
}

export async function getAvatar(userId: string) {
    try {
        return await prisma.fileAvatar.findUnique({
            where: {
                owner: userId
            }
        });
    }
    catch (exc) {
        return null;
    }
}

export async function hasAvatar(userId: string) {
    try {
        return await prisma.fileAvatar.count({
            where: {
                owner: userId
            }
        }) > 0;
    }
    catch (exc) {
        return null;
    }
}

export async function uploadBackground(userId: string, data: Buffer) {
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
        return null;
    }
}

export async function getBackground(userId: string) {
    try {
        return await prisma.fileBackground.findUnique({
            where: {
                owner: userId
            }
        });
    }
    catch (exc) {
        return null;
    }
}

export async function hasBackground(userId: string) {
    try {
        return await prisma.fileBackground.count({
            where: {
                owner: userId
            }
        }) > 0;
    }
    catch (exc) {
        return null;
    }
}

export async function removeImages(userId: string) {
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
    await prisma.user.updateMany({
        data: {
            points: 0,
            avgAccSum: 0,
            avgAccSumAmount: 0
        }
    })
    console.log("deleted ranking shit");
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

export async function getPlayerRank(name: string): Promise<number> {
    try {
        const everyone = await prisma.user.findMany({
            orderBy: [
                {
                    points: 'desc'
                }
            ],
            select: {
                name: true,
            }
        });
        return everyone.findIndex(user => user.name == name) + 1;
    }
    catch (exc) {
        return null;
    }
}

export async function getPlayerProfileHue(name: string) {
    if (!name)
        return null;

    try {
        if (!cachedProfileNameHue.has(name)) {
            const daHue = (await prisma.user.findFirstOrThrow({
                where: {
                    name: {
                        equals: name
                    }
                },
                select: {
                    profileHue: true
                }
            })).profileHue ?? 250;
            cachedProfileNameHue.set(name, daHue);
        }

        return cachedProfileNameHue.get(name);
    }
    catch (exc) {
        return null;
    }
}

// CACHE

export let cachedIDtoName: Map<string, string> = new Map<string, string>();
export let cachedNameToID: Map<string, string> = new Map<string, string>();

export let cachedProfileNameHue: Map<string, number> = new Map<string, number>();

export async function cachePlayerUniques(id:string, name:string) {
    cachedIDtoName.set(id, name);
    cachedNameToID.set(name, id);
}

export async function initDatabaseCache() {
    console.log('caching the database...');
    for (const user of await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            profileHue: true
        }
    })) {
        cachePlayerUniques(user.id, user.name);
        cachedProfileNameHue.set(user.name, user.profileHue ?? 250);
    }
    console.log('successfully cached the database!');
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
