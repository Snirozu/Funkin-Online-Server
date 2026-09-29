import { Prisma } from '@prisma/client';
import { db, KEYS_LIST, prisma } from './db';
import { filterUsername, isObjectEmpty, isOnlyOneEmoji, removeFromArray, validCountries } from '../util';
import * as crypto from "crypto";
import sanitizeHtml from 'sanitize-html';
import { NetworkRoom } from '../rooms/NetworkRoom';
import { Data } from '../data';
import { ResponseError } from '../error';

type UserFindUniqueArgsWhereless = Omit<Prisma.UserFindUniqueArgs, 'where'> & { where?: Prisma.UserWhereUniqueInput };

export class User {
    constructor(public readonly where: Prisma.UserWhereUniqueInput) {
        if (isObjectEmpty(where)) throw new ResponseError('Empty Query');
    }

    async get<V extends UserFindUniqueArgsWhereless>(args?: V): Promise<Prisma.UserGetPayload<V> | null> {
        return prisma.user.findUnique({
            where: this.where,
            ...args
        }) as unknown as Promise<Prisma.UserGetPayload<V> | null>;
    }

    private _id: string;
    async getID() {
        if (this._id) return this._id;

        this._id = (await this.get({ select: { id: true } })).id;
        if (!this._id)
            throw new ResponseError('Could not fetch the ID, record doesn\'t exist?');

        return this._id;
    }

    private _name: string;
    async getName() {
        if (this._name) return this._name;

        this._name = (await this.get({ select: { name: true } })).name;
        if (!this._name)
            throw new ResponseError('Could not fetch the name, record doesn\'t exist?');

        return this._name;
    }

    async exists() {
        return !!(await this.get({ select: { id: true } }));
    }

    async getRank(category?: string, keys?:number): Promise<number> {
        if (Number.isNaN(keys))
            keys = undefined;
        keys ??= 4;
    
        const userId = await this.getID();
    
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

    async getStats(type?: string) {
        if (![undefined, 'week'].includes(type)) {
            return null;
        }
    
        const userStats = await this._getStats(type);
        if (!userStats)
            return await this.createStats(type);
        return userStats;
    }
    
    private async _getStats(type?: string) {
        const userId = await this.getID();
        return (await prisma.userStats.findFirst({
            where: {
                user: {
                    equals: userId
                },
                type: type == undefined ? {
                    isSet: false
                } : {
                    equals: type
                }
            },
        }));
    }

    async createStats(type?: string) {
        const userId = await this.getID();
        if ((await prisma.userStats.count({
            where: {
                user: userId,
                type: type == undefined ? {
                    isSet: false
                } : {
                    equals: type
                }
            }
        })) == 0) {
            (await prisma.userStats.create({
                data: {
                    user: userId,
                    type: type
                },
            }));
            await this.updateStats();
        }
        return await this._getStats();
    }

    //TODO VERY RESOURCE HEAVY
    async updateStats(keys?: Array<number> | number) {
        if (!keys) {
            keys = KEYS_LIST;
        }
    
        let keysList = [];
        if (typeof keys === "number")
            keysList.push(keys);
        if (Array.isArray(keys))
            keysList = keys;

        const userId = await this.getID();
    
        for (const category of [undefined, 'week']) {
            const statsData = {};
    
            for (let kys of keysList) {
                if (!kys)
                    kys = 4;
    
                if (!KEYS_LIST.includes(kys)) {
                    continue;
                }
    
                statsData["points" + kys + "k"] = await this.getPoints(category, kys);
                statsData["avgAcc" + kys + "k"] = await db.scores.getAverageAccuracyForID(userId, category, kys) / 100;
            }
    
            await prisma.userStats.updateMany({
                where: {
                    user: userId,
                    type: category == undefined ? {
                        isSet: false
                    } : {
                        equals: category
                    }
                },
                data: statsData
            })
        }

        const club = await this.getClub();
        if (await club.exists())
            await club.updatePoints();
    }

    async getClubTag() {
        const userId = await this.getID();
        if (db.cache.cachedUserIDClubTag.has(userId)) {
            return db.cache.cachedUserIDClubTag.get(userId);
        }
        const club = await this.getClub();
        const clubTag = (await club.get({ select: { tag: true } }))?.tag;
        if (!clubTag)
            return null;
        db.cache.cachedUserIDClubTag.set(userId, clubTag);
        return clubTag;
    }

    async getPoints(category?: string, keys?: number) {
        const userId = await this.getID();

        return (await prisma.score.aggregate({
            where: {
                player: userId,
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

    async getClub() {
        const userID = await this.getID();
        return db.clubs.byMemberID(userID);
    }

    async resetSecret() {
        return (await prisma.user.update({
            data: {
                secret: crypto.randomBytes(64).toString('hex')
            },
            where: this.where
        }));
    }

    async setEmail(email: string) {
        if (await db.users.byEmail(email).exists())
            throw new ResponseError("Can't link the same email for two accounts!");
    
        return (await prisma.user.update({
            data: {
                email: email
            },
            where: this.where
        }));
    }

    async linkNewgrounds(ngId: string, ngUrl: string) {
        const linkedPlayer = await db.users.byNewgroundsID(ngId).exists();
        if (linkedPlayer) {
            throw new ResponseError("Can't link the same Newgrounds profile for two accounts!");
        }
    
        return (await prisma.user.update({
            data: {
                ngId: ngId,
                ngUrl: ngUrl
            },
            where: this.where
        }));
    }

    async rename(name: string) {
        if (filterUsername(name) != name) {
            throw new ResponseError("Your username contains invalid characters!");
        }
    
        if (name.length < 3) {
            throw new ResponseError("Your username is too short! (min 3 characters)");
        }
    
        if (name.length > 14) {
            throw new ResponseError("Your username is too long! (max 14 characters)");
        }
    
        const userExiste = await db.users.countByName(name);
        if (userExiste > 0)
            throw new ResponseError("Player with that username exists!");
    
        const oldPlayer = await this.get();
    
        const data = (await prisma.user.update({
            data: {
                name: name
            },
            where: this.where
        }));
    
        db.cache.cachedIDtoName.delete(oldPlayer.id);
        db.cache.cachedNameToID.delete(oldPlayer.name);
        db.cache.cachedProfileNameHue.delete(oldPlayer.name);
    
        db.cache.cacheUserUniques(data.id, data.name);
        db.cache.cachedProfileNameHue.set(data.name, [data.profileHue ?? 250, data.profileHue2]);
    
        return {
            new: data.name,
            old: oldPlayer.name
        };
    }

    async grantRole(role: string) {
        if ((await this.get({ select: { role: true } })).role == role) {
            throw new ResponseError("Already has this role!");
        }
    
        return (await prisma.user.update({
            data: {
                role: role
            },
            where: this.where
        }));
    }

    async setBio(bio: string, hue: number, country: string, hue2: number) {
        if (bio.length > 1500) {
            throw new ResponseError("Your bio reaches 1500 characters!");
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
    
        const userStats = await this.getStats();
        if (userStats["points4k"] < 500)
            hue2 = undefined;
    
        return (await prisma.user.update({
            data: {
                bio: sanitizedHtml,
                profileHue: hue,
                profileHue2: hue2,
                country: country
            },
            where: this.where
        }));
    }

    async getLoginState<V extends UserFindUniqueArgsWhereless>(): Promise<Prisma.UserGetPayload<V> | null> {
        return this.get({
            select: {
                secret: true,
                role: true,
                ips: true,
                id: true
            }
        }) as unknown as Promise<Prisma.UserGetPayload<V> | null>;
    }

    async ping(keys?:number) {
        if (Number.isNaN(keys))
            keys = undefined;
        keys ??= 4;
    
        return (await prisma.user.update({
            data: {
                lastActive: new Date(Date.now())
            },
            where: this.where,
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

    async findSimiliarIPUsers() {
        const user = await this.get({
            select: {
                ips: true,
                id: true
            }
        });

        const similiarUsers = await prisma.user.findMany({
            where: {
                ips: {
                    hasSome: user.ips
                }
            },
            select: {
                id: true
            }
        });

        const ids = [];
        for (const similiar of similiarUsers) {
            if (similiar.id == user.id)
                continue;
            ids.push(similiar.id);
        }
        return ids;
    }

    async removeFriend(target: User) {
        const targetRecord = await target.get({
            select: {
                friends: true,
                id: true,
                name: true,
            }
        });
        const selfRecord = await this.get({
            select: {
                friends: true,
                id: true,
                name: true,
            }
        });
    
        if (!selfRecord || !targetRecord)
            throw new ResponseError("User(s) not found");
    
        if (!selfRecord.friends.includes(targetRecord.id))
            throw new ResponseError("Not on " + selfRecord.name + "'s friend list");
    
        await prisma.user.update({
            where: this.where,
            data: {
                friends: removeFromArray(selfRecord.friends, targetRecord.id)
            }
        })

        if (!targetRecord.friends.includes(selfRecord.id))
            throw new ResponseError("Not on " + targetRecord.name + "'s friend list");
    
        await prisma.user.update({
            where: target.where,
            data: {
                friends: removeFromArray(targetRecord.friends, selfRecord.id)
            }
        })
    }

    async addFriend(target: User) {
        const selfRecord = await this.get({
            select: {
                friends: true,
                friendRequests: true,
                id: true,
                name: true,
            }
        });
        const targetRecord = await target.get({
            select: {
                friends: true,
                friendRequests: true,
                id: true,
                name: true,
            }
        });

        if (!selfRecord || !targetRecord)
            throw new ResponseError("User(s) not found");

        if (selfRecord.friends.includes(targetRecord.id))
            throw new ResponseError("Already frens :)");
    
        // no need to send the request to target, so we accept it
        if (selfRecord.friendRequests.includes(targetRecord.id)) {
            await prisma.user.update({
                data: {
                    friendRequests: removeFromArray(selfRecord.friendRequests, targetRecord.id),
                    friends: {
                        push: targetRecord.id
                    }
                },
                where: this.where
            });
    
            await prisma.user.update({
                data: {
                    friendRequests: removeFromArray(targetRecord.friendRequests, selfRecord.id),
                    friends: {
                        push: selfRecord.id
                    }
                },
                where: target.where
            });
    
            await target.sendNotification({
                title: 'Friend Request Accepted',
                content: 'You are now friends with ' + selfRecord.name + '!',
                image: '/api/user/avatar/' + encodeURIComponent(selfRecord.name),
                href: '/user/' + encodeURIComponent(selfRecord.name)
            });
            NetworkRoom.notifyPlayer(selfRecord.id, 'You are now friends with ' + targetRecord.name + '!');
            return;
        }
    
        // send friend request to target
    
        if (targetRecord.friendRequests.includes(selfRecord.id))
            throw new ResponseError("Friend Request is already pending");
    
        await prisma.user.update({
            data: {
                friendRequests: {
                    push: selfRecord.id
                }
            },
            where: target.where
        });
    
        await target.sendNotification({
            title: 'Friend Request',
            content: selfRecord.name + ' sent you a friend request!',
            image: '/api/user/avatar/' + encodeURIComponent(selfRecord.name),
            href: '/user/' + encodeURIComponent(selfRecord.name)
        });
    }

    async sendNotification(content: NotificationContent) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Can't notify a non-existent user.");

        await prisma.notification.create({
            data: {
                to: userID,
                title: content.title,
                content: content?.content,
                image: content?.image,
                href: content?.href,
            }
        });

        NetworkRoom.notifyPlayer(userID, (content?.content ?? content.title));
    }

    async getSentFriendRequests() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        const value: Array<string> = [];
        for (const pender of await prisma.user.findMany({
            where: {
                friendRequests: {
                    has: userID
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

    async getWarnings(isMod:boolean) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        const warns = await prisma.userWarning.findMany({
            where: {
                on: {
                    equals: userID
                }
            },
            select: {
                by: isMod,
                date: true,
                id: isMod,
                reason: true
            }
        });
        for (const warn of warns) {
            if (warn.by)
                warn.by = await db.users.getNameByID(warn.by);
        }
        return warns;
    }

    async delete() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");
    
        await this.setBanStatus(true);
    
        await prisma.userStats.deleteMany({
            where: {
                user: {
                    equals: userID
                }
            }
        })
        
        const user = await prisma.user.delete({
            where: {
                id: userID
            },
            select: {
                name: true,
                id: true
            }
        })
        
        db.cache.cachedIDtoName.delete(user.id);
        db.cache.cachedNameToID.delete(user.name);
    
        try {
            NetworkRoom.instance.IDtoClient.get(user.id).leave(403);
        }
        catch (_) {}
    
        console.log("Deleted user: " + user.name);
    }

    async setBanStatus(to: boolean, reason?: string) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");
    
        const player = await prisma.user.update({
            where: this.where,
            data: {
                role: to ? 'Banned' : Data.CONFIG.DEFAULT_ROLE,
                bio: {
                    set: 'This account was banned by a moderator!\nReason: ' + reason
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
                    user: userID
                },
                data: {
                    ...statsData
                }
            });
    
            const scores = await prisma.score.findMany({
                where: {
                    player: userID
                },
                select: {
                    songId: true,
                    replayFileId: true
                }
            });
    
            await prisma.score.deleteMany({
                where: {
                    player: userID
                }
            })
    
            for (const score of scores) {
                await db.songs.updateMaxPoints(score.songId);
                await prisma.fileReplay.deleteMany({
                    where: {
                        id: score.replayFileId
                    }
                });
            }
    
            await prisma.songComment.deleteMany({
                where: {
                    by: userID
                }
            })
    
            await prisma.modComment.deleteMany({
                where: {
                    by: userID
                }
            })
    
            for (const reaction of await prisma.modCommentReaction.findMany({
                where: {
                    usersIDs: {
                        has: userID
                    }
                }
            })) {
                await db.mods.updateCommentReaction(userID, reaction.id, false);
            }
    
            await prisma.report.deleteMany({
                where: {
                    by: userID
                }
            })
    
            await prisma.fileAvatar.deleteMany({
                where: {
                    owner: userID
                }
            })
    
            await prisma.fileBackground.deleteMany({
                where: {
                    owner: userID
                }
            })
    
            for (const mod of await db.mods.getFavoritedByUserID(userID)) {
                await db.mods.toggleFavorite(userID, mod.id, true);
            }
    
            const club = await this.getClub();
            if (club && await club.exists())
                await db.clubs.removePlayerFromClub(this);
            
            try {
                NetworkRoom.instance.IDtoClient.get(player.id).leave(403);
            }
            catch (_) { }
        }
    
        console.log("Set " + userID + "'s ban status to " + to);
    }

    async warn(by: User, reason: string) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        if (reason.trim().length < 5) {
            throw new ResponseError("Reason too short!");
        }
    
        await this.sendNotification({
            title: 'You have been warned by a moderator!',
            content: 'Reason: ' + reason
        });
    
        await prisma.userWarning.create({
            data: {
                reason: reason,
                by: await by.getID(),
                onRe: {
                    connect: {
                        id: userID
                    }
                }
            }
        });
    }

    async uploadAvatar(data:Buffer) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        await prisma.fileAvatar.deleteMany({
            where: {
                owner: userID
            }
        })
        return await prisma.fileAvatar.create({
            data: {
                data: data,
                size: data.byteLength,
                ownerRe: {
                    connect: {
                        id: userID
                    }
                }
            }
        });
    }

    async getAvatar() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        return await prisma.fileAvatar.findUnique({
            where: {
                owner: userID
            }
        });
    }

    async hasAvatar() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        return await prisma.fileAvatar.count({
            where: {
                owner: {
                    equals: userID
                }
            }
        }) > 0;
    }

    async uploadBackground(data: Buffer) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        await prisma.fileBackground.deleteMany({
            where: {
                owner: userID
            }
        })
        return await prisma.fileBackground.create({
            data: {
                data: data,
                size: data.byteLength,
                ownerRe: {
                    connect: {
                        id: userID
                    }
                }
            }
        });
    }

    async getBackground() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        return await prisma.fileBackground.findUnique({
            where: {
                owner: userID
            }
        });
    }

    async hasBackgroundForID() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        return await prisma.fileBackground.count({
            where: {
                owner: userID
            }
        }) > 0;
    }
    
    async removeImages() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        await prisma.fileBackground.deleteMany({
            where: {
                owner: userID
            }
        })
        await prisma.fileAvatar.deleteMany({
            where: {
                owner: userID
            }
        })
        return true;
    }

    async getNotifications() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        const list = []

        for (const notif of await prisma.notification.findMany({
            where: {
                to: userID
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

    async getNotificationsCount() {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        return await prisma.notification.count({
            where: {
                to: {
                    equals: userID
                }
            }
        });
    }

    async getComments(page: number = 0) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        const commentCount = await prisma.profileComment.count({
            where: {
                on: {
                    equals: userID
                }
            },
        });
    
        try {
            return {
                count: commentCount,
                comments: (await prisma.profileComment.findMany({
                    where: {
                        on: {
                            equals: userID
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
    
    async submitComment(reqJson: any) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");
    
        if ((reqJson.content as string).length < 2)
            throw new ResponseError("Too short!");
    
        if ((reqJson.content as string).length > 2000)
            throw new ResponseError("Too long!");
    
        return await prisma.profileComment.create({
            data: {
                content: reqJson.content as string,
                byRe: {
                    connect: {
                        id: userID
                    }
                },
                onRe: {
                    connect: {
                        id: await db.users.getIDByName(reqJson.id as string)
                    }
                }
            }
        });
    }
    
    async reactComment(reactionName: string, commentId: string) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        if (!reactionName || !isOnlyOneEmoji(reactionName)) {
            throw new ResponseError("Not an valid emoji! " + reactionName);
        }
    
        let removedThis = false;
    
        for (const reaction of await prisma.profileCommentReaction.findMany({
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
            await this.updateCommentReaction(reaction.id, false);
        }
    
        if (!removedThis) {
            const targetProfileReaction = await db.users.findReactionForCommentID(reactionName, commentId);
            if (targetProfileReaction) {
                await this.updateCommentReaction(targetProfileReaction.id, true);
            }
        }
    
        await prisma.profileCommentReaction.deleteMany({
            where: {
                usersIDs: {
                    isEmpty: true
                }
            },
        });
    }
    
    async updateCommentReaction(reactionId: string, doAdd: boolean) {
        const userID = await this.getID();
        if (!userID)
            throw new ResponseError("Cannot fetch user.");

        const users = (await prisma.profileCommentReaction.findFirst({
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
    
        await prisma.profileCommentReaction.update({
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
}

export class Users {
    byID(id: string) {
        if (!id) throw new ResponseError('Empty Identifier');
        return new User({ id: id });
    }

    byName(name: string) {
        if (!name) throw new ResponseError('Empty Identifier');
        return new User({ name: name });
    }

    byEmail(email: string) {
        if (!email) throw new ResponseError('Empty Identifier');
        return new User({ email: email });
    }

    byNewgroundsID(ngID: string) {
        if (!ngID) throw new ResponseError('Empty Identifier');
        return new User({ ngId: ngID });
    }

    async create(name: string, email: string) {
        if (filterUsername(name) != name) {
            throw new ResponseError("Your username contains invalid characters!");
        }
    
        if (name.length < 3) {
            throw new ResponseError("Your username is too short! (min 3 characters)");
        }
    
        if (name.length > 14) {
            throw new ResponseError("Your username is too long! (max 14 characters)");
        }
    
        if (await this.countByName(name) != 0)
            throw new ResponseError("Player with that username already exists!");
    
        if (await this.byEmail(email).exists())
            throw new ResponseError("Can't set the same email for two accounts!");
    
        const user = (await prisma.user.create({
            data: {
                name: name,
                email: email,
                secret: crypto.randomBytes(64).toString('hex'),
            },
        }));
    
        await this.byID(user.id).createStats();
    
        return user;
    }

    async getNameByID(id: string) {
        if (!db.cache.cachedIDtoName.has(id)) {
            const daName = (await prisma.user.findFirst({
                where: {
                    id: {
                        equals: id
                    }
                },
                select: {
                    name: true
                }
            }))?.name;
            if (!daName)
                return daName;
            db.cache.cacheUserUniques(id, daName);
        }
        
        return db.cache.cachedIDtoName.get(id);
    }

    async getIDByName(name: string) {
        if (!db.cache.cachedNameToID.has(name)) {
            const daID = (await prisma.user.findFirst({
                where: {
                    name: {
                        equals: name
                    }
                },
                select: {
                    id: true
                }
            }))?.id;
            if (!daID)
                return daID;
            db.cache.cacheUserUniques(daID, name);
        }

        return db.cache.cachedNameToID.get(name);
    }

    async getProfileHueByName(name: string) {
        if (!name)
            return null;

        if (!db.cache.cachedProfileNameHue.has(name)) {
            const data = (await prisma.user.findFirst({
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
            if (!data)
                return data;
            db.cache.cachedProfileNameHue.set(name, [data.profileHue ?? 250, data.profileHue2]);
        }

        return db.cache.cachedProfileNameHue.get(name);
    }

    async countByName(name: string) {
        if (!name)
            throw new ResponseError("The field name is null.");
    
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
            // not found any
            return 0;
        }
    }

    async top(page: number, country?: string, category?: string, sortProp?:string):Promise<any> {
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

    async search(query: string, page: number = 0) {
        if (query.trim().length < 3) {
            throw new ResponseError("Search query needs to be longer than 3!");
        }

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
            take: 50,
            skip: 50 * page
        }))
    }

    async removeWarningByID(id: string) {
        return await prisma.userWarning.delete({
            where: {
                id: id
            }
        });
    }

    async deleteNotificationByID(id: string) {
        await prisma.notification.delete({
            where: {
                id: id
            }
        });
    }

    async getCommentByID(commentId: string) {
        return (await prisma.profileComment.findFirstOrThrow({
            where: {
                id: {
                    equals: commentId
                }
            },
        }))
    }
    
    async removeCommentByID(commentId: string) {
        if (!commentId) {
            throw new ResponseError("No ID provided!");
        }
    
        await prisma.profileCommentReaction.deleteMany({
            where: {
                commentID: {
                    equals: commentId
                },
            },
        });
    
        await prisma.profileComment.delete({
            where: {
                id: commentId
            }
        });
    }

    async findReactionForCommentID(reactionName: string, commentId: string) {
        if (await prisma.profileCommentReaction.count({
            where: {
                name: reactionName,
                commentID: commentId
            }
        }) < 1) {
            return await prisma.profileCommentReaction.create({
                data: {
                    name: reactionName,
                    commentID: commentId
                }
            })
        }

        return await prisma.profileCommentReaction.findFirstOrThrow({
            where: {
                name: reactionName,
                commentID: commentId
            }
        })
    }
}

class NotificationContent {
    title: string;
    content?: string;
    image?: string;
    href?: string;
}