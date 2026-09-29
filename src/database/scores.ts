import { db, KEYS_LIST, prisma } from './db';
import { chunkifyArrayForCallback, debugPrint, filterSongName, formatLog, ordinalNum } from '../util';
import { User } from './users';
import { NetworkRoom } from '../rooms/NetworkRoom';
import { logAction } from '../mods';
import { ResponseError } from '../error';

export class Scores {
    async submit(submitter: User, replay: ReplayData) {
        // validate the replay file

        if (replay.version != 4) {
            throw new ResponseError("Replay version mismatch error, can't submit!\nPlease update!");
        }

        if (!replay)
            throw new ResponseError("Empty Replay Data!");

        if (replay.points > 500 && (!replay.mod_url || !replay.mod_url.startsWith('http')))
            throw new ResponseError("No Mod URL provided!");

        const noteEvents = replay.shits + replay.bads + replay.goods + replay.sicks;
        if (noteEvents <= 0 || replay.inputs.length <= 0)
            throw new ResponseError("Empty Replay");

        if (replay.points < 0 || replay.points > 10000 || replay.score > 100000000)
            throw new ResponseError("Illegal Score Value in the Replay Data");

        const daKeyValue = replay.keys ?? 4;
        if (!KEYS_LIST.includes(daKeyValue)) {
            throw new ResponseError("Submit - Invalid Key: " + daKeyValue);
        }

        const daStrum = replay.opponent_mode ? 1 : 2;

        const prevRank = await submitter.getRank(undefined, daKeyValue);
        const prevStats = await submitter.getStats();
        const prevStatsWeek = await submitter.getStats('week');

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

        // remove bad scores

        const userAppendScores = [];

        for (const category of [undefined, 'week']) {
            const leaderboardScore = await prisma.score.findFirst({
                where: {
                    songId: songId, player: await submitter.getID(), strum: daStrum, category: category == undefined ? {
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

                await db.scores.removeByIDs(leaderboardScore.id);
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
            where: submitter.where,
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

        await submitter.updateStats(daKeyValue);
        await db.songs.updateMaxPoints(song.id);

        const newRank = await submitter.getRank(undefined, daKeyValue);

        if (daKeyValue == 4 ? newRank <= 30 && newRank < prevRank : newRank <= 10 && newRank < prevRank) {
            await NetworkRoom.logToAll(formatLog(submitter.getName() + ' climbed to ' + ordinalNum(newRank) + ' place on the global ' + daKeyValue + 'k leaderboard!'))
        }

        const newStats = await submitter.getStats();
        const newStatsWeek = await submitter.getStats('week');

        return {
            song: song.id,
            message: "Submitted!",
            gained_points: newStats["points" + daKeyValue + "k"] - prevStats["points" + daKeyValue + "k"],
            gained_points_week: newStatsWeek["points" + daKeyValue + "k"] - prevStatsWeek["points" + daKeyValue + "k"],
            climbed_ranks: prevRank - newRank
        }
    }

    async getAverageAccuracyForID(id: string, category?: string, keys?: number) {
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
            _avg: {
                accuracy: true
            }
        }))._avg.accuracy;
    }

    async removeByIDs(scores: string | string[], logInfo: boolean = false, checkPlayerID?: string) {
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
                await logAction(null, 'Deleting score on ' + score.songId + ' by ' + (await db.users.getNameByID(score.player)) + ' with FP: ' + score.points);
            }
    
            if (checkPlayerID && score.player != checkPlayerID)
                throw new ResponseError("Unauthorized!");
        }
    
        debugPrint('deleting ' + scoreIds.length + ' scores');
    
        await chunkifyArrayForCallback(scoreIds, async chunk => {
            await prisma.score.deleteMany({
                where: {
                    id: {
                        in: chunk
                    }
                },
            })
        });
        
        debugPrint('updating player stats');
    
        for (const player of players) {
            const user = db.users.byID(player);
            if (await user.exists()) {
                await user.updateStats(keys);
            }
        }
    
        debugPrint('updating songs');
    
        for (const song of songs) {
            await db.songs.updateMaxPoints(song);
        }
    
        debugPrint('deleting replays');
    
        await chunkifyArrayForCallback(replays, async chunk => {
            await prisma.fileReplay.deleteMany({
                where: {
                    id: {
                        in: chunk
                    }
                },
            })
        });
    
        debugPrint('finished removing scores!');
    }
    
    async setModURLForID(scoreID: string, newModURL: string) {
        await prisma.score.update({
            where: {
                id: scoreID
            },
            data: {
                modURL: newModURL
            }
        })
    }

    async getByID(id: string) {
        return await prisma.score.findUnique({
            where: {
                id: id
            }
        });
    }

    async getListForUserID(id: string, page:number, keys?: number, category: string = undefined, sort?: string) {    
        const [_sortBy, _sortDirection] = (sort ?? '').split(':');
    
        let sortBy = 'points';
        let sortDirection = 'desc';
        if (['points', 'accuracy', 'score', 'submitted', 'misses'].includes(_sortBy)) {
            sortBy = _sortBy;
        }
        if (['desc', 'asc'].includes(_sortDirection)) {
            sortDirection = _sortDirection;
        }

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

    async getReplayFileByID(id: string) {
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

    async top(id: string, strum:number, page: number, keys?: number, category: string = undefined, sort?: string): Promise<Array<ScoreData>> {
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
}

export class ReplayData {
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

export class ScoreData {
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