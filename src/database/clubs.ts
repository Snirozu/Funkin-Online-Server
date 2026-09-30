import { Prisma } from '@prisma/client';
import { hasOnlyLettersAndNumbers, isObjectEmpty, removeFromArray } from '../util';
import { User } from './users';
import { db, prisma } from './db';
import { cooldown, cooldownLeft } from '../cooldown';
import sanitizeHtml from 'sanitize-html';
import { ResponseError } from '../error';

class Club {
    constructor(public readonly where: Prisma.ClubWhereInput) {
        if (isObjectEmpty(where)) throw new ResponseError('Empty Query');
    }

    async get<V extends Prisma.ClubFindFirstArgs>(args?: V): Promise<Prisma.ClubGetPayload<V> | null> {
        return prisma.club.findFirst({
            where: this.where,
            ...args
        }) as unknown as Promise<Prisma.ClubGetPayload<V> | null>;
    }

    private id: string;
    async getID() {
        if (this.id) return this.id;

        this.id = (await this.get({ select: { id: true } }))?.id;
        if (!this.id)
            throw new ResponseError('Could not fetch the ID');

        return this.id;
    }

    private _tag: string;
    async getTag() {
        if (this._tag) return this._tag;

        this._tag = (await this.get({ select: { tag: true } }))?.tag;
        if (!this._tag)
            throw new ResponseError('Could not fetch the tag, record doesn\'t exist?');

        return this._tag;
    }

    async exists() {
        return !!(await this.get({ select: { id: true } }));
    }

    async edit(body: any, byAdmin?:boolean) {
        const club = await this.get();
        if (!club) {
            throw new ResponseError("No club found!");
        }
    
        body.name = body.name.trim();
        if (body.name.length > 20) {
            throw new ResponseError("Name too long!");
        }
    
        if (body.hue > 360)
            body.hue = 360;
        if (body.hue < 0)
            body.hue = 0;
    
        body.tag = await Club.formatNewClubTag(body.tag, club.tag);
    
        if (!byAdmin && body.tag != club.tag) {
            if (!cooldown('club.'+club.id, 'club.edit.tag'))
                throw new ResponseError("You can change the tag in " + cooldownLeft(['club.'+club.id, 'club.edit.tag']) + "s");
        }
    
        await prisma.club.update({
            where: {
                tag: club.tag
            },
            data: {
                content: sanitizeHtml(body.content),
                name: body.name,
                hue: body.hue,
                tag: body.tag
            }
        });

        if (body.tag != club.tag) {
            for (const playerID of club.members) {
                db.cache.cachedUserIDClubTag.set(playerID, body.tag);
            }
        }
        return club;
    }

    async updatePoints() {
        const club = await this.get({
            select: {
                members: true,
                id: true,
            }
        });
        if (!club)
            return;
    
        let points = 0;
    
        for (const pid of club.members) {
            const player = await db.users.byID(pid).getStats();
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

    async getRank(): Promise<number> {
        const clubTag = await this.getTag();
        if (!clubTag) {
            throw new ResponseError("No club found!");
        }

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
        return everyone.findIndex(club => club.tag == clubTag) + 1;
    }

    static async formatNewClubTag(tag: string, ignoreTag?: string) {
        tag = tag.trim();
    
        if (tag.length < 2 || tag.length > 5) {
            throw new ResponseError("Too short/long tag!");
        }
    
        if (!hasOnlyLettersAndNumbers(tag)) {
            throw new ResponseError("Tag can't contain non latin letters!");
        }
    
        tag = tag.toUpperCase();
    
        if (tag != (ignoreTag ?? '').toUpperCase() && await db.clubs.byTag(tag).exists())
            throw new ResponseError("Tag taken!");
    
        return tag;
    }

    async delete() {
        const clubTag = await this.getTag();
        if (!clubTag) {
            throw new ResponseError("No club found!");
        }

        try {
            await prisma.fileClubBanner.delete({
                where: {
                    clubTag: clubTag
                }
            })
        } catch (_) { }
    
        const deleted = await prisma.club.delete({
            where: {
                tag: clubTag
            }
        })
    
        for (const playerID of deleted.members) {
            db.cache.cachedUserIDClubTag.delete(playerID);
        }
    }

    async acceptJoin(user: User) {
        const userID = await user.getID();
        if (!userID)
            throw new ResponseError("User doesn't exist!");

        const userClub = await (await user.getClub()).get({
            select: {
                id: true,
                pending: true,
            }
        });
        if (userClub) {
            await prisma.club.update({
                where: {
                    id: userClub.id
                },
                data: {
                    pending: removeFromArray(userClub.pending, userID)
                },
            });
            throw new ResponseError("The user is already in a club!");
        }
    
        const club = await this.get({
            select: {
                pending: true,
                tag: true
            }
        });
        if (!club.pending.includes(userID))
            throw new ResponseError("The user hasn't sent a request!");
    
        db.cache.cachedUserIDClubTag.set(userID, club.tag);
    
        await prisma.club.update({
            where: {
                tag: club.tag
            },
            data: {
                pending: removeFromArray(club.pending, userID),
                members: {
                    push: userID
                }
            },
        });
    
        await this.updatePoints();
    
        await user.sendNotification({
            title: 'Club Join',
            content: 'You\'ve been accepted to the ' + club.tag + ' club!',
            image: '/api/user/avatar/' + encodeURIComponent(await db.users.getNameByID(userID)),
            href: '/club/' + club.tag
        });
    }

    async rejectJoin(userID: string) {
        const club = await this.get({
            select: {
                pending: true,
                tag: true
            }
        });
        if (!club.pending.includes(userID))
            throw new ResponseError("The user hasn't sent a request!");
    
        await prisma.club.update({
            where: {
                tag: club.tag
            },
            data: {
                pending: removeFromArray(club.pending, userID)
            },
        });
    }

    async requestJoin(user: User) {
        const userID = await user.getID();
        if (!userID)
            throw new ResponseError("User doesn't exist!");

        const userClub = await (await user.getClub()).get({
            select: {
                id: true,
                pending: true,
            }
        });
        if (userClub)
            throw new ResponseError("Already in a club!");
    
        const club = await this.get({
            select: {
                pending: true,
                tag: true,
                leaders: true,
            }
        });
        if (club.pending.includes(userID))
            throw new ResponseError("Already pending!");
    
        const requesterName = await db.users.getNameByID(userID);
    
        for (const pid of club.leaders) {
            await db.users.byID(pid).sendNotification({
                title: 'Club Join Request',
                content: requesterName + ' wants to join your club!',
                image: '/api/user/avatar/' + encodeURIComponent(requesterName),
                href: '/club/' + club.tag
            });
        }
    
        return (await prisma.club.update({
            where: {
                tag: club.tag
            },
            data: {
                pending: {
                    push: userID
                }
            },
        }));
    }
}

export class Clubs {
    byID(id: string) {
        if (!id) throw new ResponseError('Empty Identifier');
        return new Club({ id: id });
    }

    byTag(tag: string) {
        if (!tag) throw new ResponseError('Empty Identifier');
        return new Club({ tag: tag });
    }

    byMemberID(userID: string) {
        if (!userID) throw new ResponseError('Empty Identifier'); 
        return new Club({ members: { has: userID } });
    }

    async create(owner: User, reqBody: any) {
        const submitterID = await owner.getID();
        if (!submitterID)
            throw new ResponseError("User doesn't exist.");

        const submitterStats = await owner.getStats();
    
        if (await (await owner.getClub()).exists())
            throw new ResponseError("You're already in a club!");
    
        if (submitterStats["points4k"] < 250)
            throw new ResponseError('You need at least 4k 250FP!');
    
        if (!reqBody.name || !reqBody.tag) {
            throw new ResponseError("Missing fields!");
        }
    
        reqBody.name = reqBody.name.trim();
    
        if (reqBody.name.length > 20) {
            throw new ResponseError("Name too long!");
        }
    
        reqBody.tag = await Club.formatNewClubTag(reqBody.tag);
    
        return (await prisma.club.create({
            data: {
                name: reqBody.name,
                tag: reqBody.tag,
                leaders: [submitterID],
                members: [submitterID],
                points: submitterStats["points4k"]
            },
        }));
    }

    async removePlayerFromClub(user: User) {
        const userID = await user.getID();
        if (!userID)
            throw new ResponseError("User not registered!");
    
        const clubRef = await user.getClub();
        const club = await clubRef.get({
            select: {
                members: true,
                leaders: true,
                id: true,
            }
        });
        if (!club)
            throw new ResponseError("Not in a club!");
        
        const clubMembers = removeFromArray(club.members, userID);
        const clubLeaders = removeFromArray(club.leaders, userID);
    
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
    
        db.cache.cachedUserIDClubTag.delete(userID);
        await clubRef.updatePoints();
    
        //if there are no members left disband the club
        if (clubMembers.length == 0) {
            await clubRef.delete();
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
    
    async promoteClubMember(user: User) {
        const userID = await user.getID();
        if (!userID)
            throw new ResponseError("User doesn't exist!");

        const club = await (await user.getClub()).get({
            select: {
                leaders: true,
                tag: true,
            }
        });
        if (!club)
            throw new ResponseError("The user is not in a club!");
    
        if (club.leaders.includes(userID))
            throw new ResponseError("The user is already a mod!");
    
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

    async demoteMember(user: User) {
        const userID = await user.getID();
        if (!userID)
            throw new ResponseError("User doesn't exist!");

        const club = await (await user.getClub()).get({
            select: {
                leaders: true,
                tag: true,
            }
        });
        if (!club)
            throw new ResponseError("The user is not in a club!");
    
        if (!club.leaders.includes(userID))
            throw new ResponseError("The user is not a mod!");
    
        if (club.leaders.length == 1) {
            throw new ResponseError("A club can't have no leaders!");
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

    async top(page: number): Promise<Array<any>> {
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

    async uploadBannerForTag(tag: string, data: Buffer) {
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

    async getBannerByTag(tag: string) {
        return await prisma.fileClubBanner.findUnique({
            where: {
                clubTag: tag
            }
        });
    }
}