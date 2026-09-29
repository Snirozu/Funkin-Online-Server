import { ResponseError } from '../error';
import { prisma } from './db';
import { User } from './users';

export class Songs {
    async updateMaxPoints(songId:string) {
        if (!songId)
            throw new ResponseError("Can't update points for unknown song!");

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

    async removeComment(userId: string, songId: string) {
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

    async submitComment(user: User, reqJson: any) {
        const userID = await user.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        await this.removeComment(userID, reqJson.id as string);
    
        if ((reqJson.content as string).length < 2)
            throw new ResponseError("Too short!");
    
        if ((reqJson.content as string).length > 100)
            throw new ResponseError("Too long!");
    
        return await prisma.songComment.create({
            data: {
                content: reqJson.content as string,
                at: Number.parseFloat(reqJson.at as string),
                userRe: {
                    connect: {
                        id: userID
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

    async getByID(id: string) {
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

    async getComments(id: string) {
        return (await prisma.songComment.findMany({
            where: {
                songid: {
                    equals: id
                }
            },
            orderBy: {
                at: "asc"
            }
        }))
    }

    async search(query: string, page: number = 0) {
        if (query.trim().length < 3) {
            throw new ResponseError("Search query needs to be longer than 3!");
        }

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
            take: 50,
            skip: 50 * page
        });

        const res = [];
        for (const song of rawRes) {
            res.push({
                id: song.id,
                fp: song.maxPoints ?? 0
            });
        }
        return res;
    }
}