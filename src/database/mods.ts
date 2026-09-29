import axios from 'axios';
import { fetchSizeForURLs, fetchTrueDownloadURL, isOnlyOneEmoji, sortDownloads } from '../util';
import { User } from './users';
import { db, prisma } from './db';
import { ResponseError } from '../error';

export class Mods {
    async getByID(id: string) {
        const mod:any = await prisma.mod.findFirst({
            where: {
                id: {
                    equals: id
                }
            },
            include: {
                downloads: true
            },
        });

        if (!mod)
            throw new ResponseError("Mod not found.");

        const downloadHits = await this.getDownloadHitsForID(id);
        mod.downloadsHits = downloadHits;
        return mod;
    }

    async submit(data: any) {
        if (data.id.trim().length < 3) {
            throw new ResponseError("ID needs 3 letters at least");
        }
    
        if (/[^a-z0-9_\-]/gmi.test(data.id)) {
            throw new ResponseError("ID Contains invalid characters");
        }
    
        if (data.title.trim().length < 3) {
            throw new ResponseError("Title needs 3 letters at least");
        }
    
        if (await prisma.mod.count({
            where: {
                id: {
                    equals: data.id,
                    mode: "insensitive"
                }
            }
        }) > 0)
            throw new ResponseError("The ID for this mod is already taken!");
    
        return (await prisma.mod.create({
            data: {
                description: data.description,
                keywords: data.keywords,
                images: data.images,
                id: data.id,
                title: data.title
            },
        }));
    }

    async edit(data: any) {
        if (data.title.trim().length < 3) {
            throw new ResponseError("Title needs 3 letters at least");
        }
    
        return (await prisma.mod.update({
            where: {
                id: data.id,
            },
            data: {
                title: data.title,
                description: data.description,
                keywords: data.keywords,
                images: data.images,
            },
        }));
    }

    async delete(data: any) {
        await prisma.modDownload.deleteMany({
            where: {
                modID: {
                    equals: data.id
                }
            },
        });
    
        await prisma.mod.delete({
            where: {
                id: data.id,
            },
        });
    }

    async toggleFavorite(userID: string, modID:string, forceRemove: boolean = false) {    
        const favorited = (await prisma.mod.findFirst({
            where: {
                id: {
                    equals: modID
                },
            },
            select: {
                favorited: true
            }
        })).favorited;
        if (favorited.includes(userID))
            favorited.splice(favorited.indexOf(userID), 1);
        else if (!forceRemove)
            favorited.unshift(userID);
    
        return (await prisma.mod.update({
            where: {
                id: modID,
            },
            data: {
                favorited: {
                    set: favorited
                },
                favoritedCount: favorited.length
            },
        }));
    }

    async getFavoritedByUserID(userID: string) {
        const mods = (await prisma.mod.findMany({
            where: {
                favorited: {
                    has: userID
                },
            },
            select: {
                id: true
            }
        }));
    
        return mods;
    }

    async submitDownloadForID(id: string, urls: string[], forModId:string) {
        if (id.trim().length < 1) {
            throw new ResponseError("The ID needs at least one letter");
        }

        if (/[^a-z0-9_\-\.]/gmi.test(id)) {
            throw new ResponseError("The ID contains invalid characters");
        }

        if (await prisma.modDownload.count({
            where: {
                id: {
                    equals: forModId + ':' + id,
                    mode: "insensitive"
                }
            }
        }) > 0)
            throw new ResponseError("The ID for this download is already taken!");

        await prisma.mod.update({
            where: {
                id: forModId,
            },
            data: {
                downloads: {
                    create: {
                        id: forModId + ':' + id,
                        urls: urls,
                        hits: 0,
                        size: BigInt(await fetchSizeForURLs(urls))
                    }
                }
            },
        });
    }

    async editDownload(data:any) {
        await prisma.modDownload.update({
            where: {
                id: data.id,
            },
            data: {
                urls: data.urls,
                size: BigInt(await fetchSizeForURLs(data.urls))
            },
        })
    }

    async removeDownloadForID(id: string) {
        if (!id.includes(':'))
            throw new ResponseError("The ID is incomplete!");
    
        const modId = id.split(':')[0];
    
        await prisma.mod.update({
            where: {
                id: modId,
            },
            data: {
                downloads: {
                    delete: {
                        id: id
                    }
                }
            },
        })
    }

    async giveDownloadURLForID(id: string) {
        try {
            const download = await prisma.modDownload.findFirstOrThrow({
                where: {
                    id: {
                        equals: id
                    }
                },
                select: {
                    urls: true,
                    hits: true,
                    modID: true
                }
            });
    
            let pickedDownload = undefined;
            for (const url of sortDownloads(download.urls)) {
                const head = await axios.head(url, {
                    validateStatus: () => true
                })
                if (head.status == 200) {
                    pickedDownload = await fetchTrueDownloadURL(url);
                    if (pickedDownload)
                        break;
                }
            }
    
            if (pickedDownload) {
                download.hits = download.hits + 1n;
                await prisma.modDownload.update({
                    where: {
                        id: id
                    },
                    data: {
                        hits: download.hits
                    }
                });
                await prisma.mod.update({
                    where: {
                        id: download.modID
                    },
                    data: {
                        downloadHits: await db.mods.getDownloadHitsForID(download.modID)
                    }
                });
            }
            return pickedDownload;
        }
        catch (_exc) {
            console.error(_exc);
            // not found
            return null;
        }
    }

    async getDownloadHitsForID(modId:string) {
        return (await prisma.modDownload.aggregate({
            where: {
                modID: {
                    equals: modId
                },
            },
            _sum: {
                hits: true
            }
        }))._sum.hits;
    }

    async getCommentsForID(id: string, page: number = 0) {
        const commentCount = await prisma.modComment.count({
            where: {
                on: {
                    equals: id
                }
            },
        });
    
        try {
            return {
                count: commentCount,
                comments: (await prisma.modComment.findMany({
                    where: {
                        on: {
                            equals: id
                        }
                    },
                    include: {
                        reactions: {
                            select: {
                                name: true,
                                usersIDs: true,
                            }
                        }
                    },
                    orderBy: {
                        submitted: 'desc'
                    },
                    take: 10,
                    skip: 10 * page
                })) 
            }
        }
        catch (_exc) {
            // not found
            return null;
        }
    }
    
    async getComment(id: string) {
        return (await prisma.modComment.findFirstOrThrow({
            where: {
                id: {
                    equals: id
                }
            },
        }))
    }
    
    async removeComment(commentId: string) {
        if (!commentId) {
            throw new ResponseError("No ID provided!");
        }
    
        await prisma.modCommentReaction.deleteMany({
            where: {
                commentID: {
                    equals: commentId
                },
            },
        });
    
        await prisma.modComment.delete({
            where: {
                id: commentId
            }
        });
    }
    
    async submitComment(user: User, reqJson: any) {
        const userID = await user.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");
    
        const mod = await this.getByID(reqJson.mod_id as string);
        if (!mod)
            throw new ResponseError("Mod doesn't exist!");
    
        // await prisma.modComment.deleteMany({
        //     where: {
        //         onID: {
        //             equals: reqJson.mod_id as string
        //         },
        //         by: {
        //             equals: userId
        //         }
        //     }
        // });
    
        if ((reqJson.content as string).length < 2)
            throw new ResponseError("Too short!");
    
        if ((reqJson.content as string).length > 2000)
            throw new ResponseError("Too long!");
    
        return await prisma.modComment.create({
            data: {
                content: reqJson.content as string,
                userRe: {
                    connect: {
                        id: userID
                    }
                },
                mod: {
                    connect: {
                        id: reqJson.id as string
                    }
                }
            }
        });
    }
    
    async findCommentReaction(reactionName: string, commentId: string) {
        try {
            if (await prisma.modCommentReaction.count({
                where: {
                    name: reactionName,
                    commentID: commentId
                }
            }) < 1) {
                return await prisma.modCommentReaction.create({
                    data: {
                        name: reactionName,
                        commentID: commentId
                    }
                })
            }
    
            return await prisma.modCommentReaction.findFirstOrThrow({
                where: {
                    name: reactionName,
                    commentID: commentId
                }
            })
        }
        catch (_exc) {
            // not found
            return null;
        }
    }
    
    async reactComment(userID: string, reactionName: string, commentId: string) {
        if (!reactionName || !isOnlyOneEmoji(reactionName)) {
            throw new ResponseError("Not an valid emoji! " + reactionName);
        }
    
        let removedThis = false;
    
        for (const reaction of await prisma.modCommentReaction.findMany({
            where: {
                usersIDs: {
                    has: userID,
                },
                commentID: commentId
            },
            select: {
                id: true,
                name: true
            }
        })) {
            if (reactionName == reaction.name)
                removedThis = true;
            await this.updateCommentReaction(userID, reaction.id, false);
        }
    
        if (!removedThis) {
            const targetModReaction = await this.findCommentReaction(reactionName, commentId);
            if (targetModReaction) {
                await this.updateCommentReaction(userID, targetModReaction.id, true);
            }
        }
    
        await prisma.modCommentReaction.deleteMany({
            where: {
                usersIDs: {
                    isEmpty: true
                }
            },
        });
    }
    
    async updateCommentReaction(userID:string, reactionId: string, doAdd: boolean) {
        const users = (await prisma.modCommentReaction.findFirst({
            where: {
                id: reactionId,
            },
            select: {
                usersIDs: true,
            }
        }))?.usersIDs;
    
        if (!users)
            return null;
    
        if (!doAdd && users.includes(userID))
            users.splice(users.indexOf(userID), 1);
        
        if (doAdd && !users.includes(userID))
            users.unshift(userID);
    
        await prisma.modCommentReaction.update({
            where: {
                id: reactionId,
            },
            data: {
                usersIDs: {
                    set: users
                }
            },
        });
    }

    async search(query: string, page: number = 0, sort: string) {
        const [_sortBy, _sortDirection] = (sort ?? '').split(':');
    
        let sortBy = 'submitted';
        let sortDirection = 'desc';
        if (['title', 'submitted', 'favoritedCount', 'downloadHits'].includes(_sortBy)) {
            sortBy = _sortBy;
        }
        if (['desc', 'asc'].includes(_sortDirection)) {
            sortDirection = _sortDirection;
        }
    
        // brouuughhh how do you do theus 
        // const splitQuery = query.split(' ');
        // const res:any = await prisma.$runCommandRaw({
        //     aggregate: 'Mod',
        //     pipeline: [
        //         // { $match : { "keywords": { "$in": splitQuery } } },
        //         // { $unwind : "$keywords" },
        //         // { $match : { "keywords": { "$in": splitQuery } } },
        //         // { $group : { _id: "$title", numRelTags: { $sum:1 } } },
        //         // { $sort : { numRelTags : -1 } }
        //         // //  optionally
        //         // , { $limit : 10 }
        //         {
        //             $match: { "title": { $in: splitQuery } } 
        //         },
        //         { 
        //             $addFields: { score: { $meta: "textScore" } } 
        //         },
        //         { 
        //             $sort: { score: { $meta: "textScore" } } 
        //         }
        //     ],
        //     // pipeline: [
        //     // {
        //     //     $match: {
        //     //         index: 'default', // The name of your Atlas Search Index
        //     //         text: {
        //     //             query: query,
        //     //             path: ['title', 'keywords'] // Fields to search through
        //     //         }
        //     //     }
        //     // },
        //     // {
        //     //     $project: {
        //     //         _id: 1,
        //     //         title: 1,
        //     //         keywords: 1,
        //     //         score: { $meta: 'searchScore' } 
        //     //     }
        //     // },
        //     // {
        //     //     $sort: {
        //     //         score: -1 
        //     //     }
        //     // }
        //     // ],
        //     cursor: {}
        // })
        // console.log(res.cursor.firstBatch);
        // return res;
    
        return (await prisma.mod.findMany({
            where: {
                OR: [
                    {
                        keywords: {
                            hasSome: query.split(' '),
                        }
                    },
                    {
                        id: {
                            contains: query,
                            mode: "insensitive"
                        }
                    },
                    {
                        title: {
                            contains: query,
                            mode: "insensitive"
                        }
                    }
                ]
            },
            orderBy: {
                [sortBy]: sortDirection,
            },
            select: {
                id: true,
                images: true,
                title: true,
                keywords: true,
                downloadHits: true,
                favoritedCount: true,
                submitted: true,
            },
            take: 15,
            skip: 15 * page
        }))
    }
}

