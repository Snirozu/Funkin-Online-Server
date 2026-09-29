import { prisma } from "./db";

export class DatabaseCache {
    cachedIDtoName: Map<string, string> = new Map<string, string>();
    cachedNameToID: Map<string, string> = new Map<string, string>();
    cachedProfileNameHue: Map<string, number[]> = new Map<string, number[]>();
    cachedUserIDClubTag: Map<string, string> = new Map<string, string>();
    
    cacheUserUniques(id:string, name:string) {
        this.cachedIDtoName.set(id, name);
        this.cachedNameToID.set(name, id);
    }

    async init() {
        if (process.env["SKIP_CACHE"] == "true") {
            return;
        }
    
        console.log('Caching the database...');
        for (const user of await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                profileHue: true,
                profileHue2: true
            },
            orderBy: {
                joined: 'desc'
            }
        })) {
            this.cacheUserUniques(user.id, user.name);
            this.cachedProfileNameHue.set(user.name, [user.profileHue ?? 250, user.profileHue2]);
    
            // console.log(user.name);
            // await updatePlayerStats(user.id);
        }
    
        for (const club of await prisma.club.findMany({
            select: {
                members: true,
                tag: true
            }
        })) {
            for (const member of club.members) {
                this.cachedUserIDClubTag.set(member, club.tag);
            }
        }
    
        //await recountPlayersFP();
        console.log('Successfully cached the database!');
    }
}