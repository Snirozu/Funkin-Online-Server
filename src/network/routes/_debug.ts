import { Express } from 'express';
import { prisma } from '../database';

export class DebugRoutes {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static init(app: Express) {
        app.all("/removeclones", async (req, res) => {
            try {
                const datas = [];
                const daMap:Map<string, boolean> = new Map();
                for (const user of await prisma.userStats.findMany({
                    select: {
                        id: true,
                        user: true,
                        type: true,
                    }
                })) {
                    if (daMap.has(user.user + '---' + user.type)) {
                        datas.push(user.id);
                    }
                    daMap.set(user.user + '---' + user.type, true);
                }
                await prisma.userStats.deleteMany({
                    where: {
                        id: {
                            in: datas
                        }
                    }
                })
                res.sendStatus(200);
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Error has accured..."
                });
            }
        });

        // app.all("/migrate", async (req, res) => {
        //     try {
        //         const datas = [];
        //         for (const user of await prisma.user.findMany({
        //             select: {
        //                 id: true,
        //                 points: true,
        //                 pointsWeekly: true,
        //                 avgAcc: true,
        //             }
        //         })) {
        //             datas.push({
        //                 user: user.id,
        //                 points4k: user.points,
        //                 avgAcc4k: user.avgAcc,
        //             });
        //             datas.push({
        //                 user: user.id,
        //                 type: 'week',
        //                 points4k: user.pointsWeekly,
        //                 avgAcc4k: 0,
        //             });
        //         }
        //         await prisma.userStats.createMany({
        //             data: datas
        //         });
        //         await prisma.user.updateMany({
        //             data: {
        //                 points: {
        //                     unset: true,
        //                 },
        //                 pointsWeekly: {
        //                     unset: true,
        //                 },
        //                 avgAcc: {
        //                     unset: true,
        //                 }
        //             }
        //         });
        //         res.sendStatus(200);
        //     }
        //     catch (exc: any) {
        //         console.error(exc);
        //         res.status(400).json({
        //             error: exc.error_message ?? "Error has accured..."
        //         });
        //     }
        // });

        // app.all("/dev/test", async (req, res) => {
        //     try {
        //         res.send(await getPlayerRank(req.query.name as string) + "");
        //     }
        //     catch (exc: any) {
        //         console.error(exc);
        //         res.status(400).json({
        //             error: exc.error_message ?? "Error has accured..."
        //         });
        //     }
        // });

        // app.all("/perish_all", checkAccess, async (req, res) => {
        //     try {
        //         const reqPlayer = await authPlayer(req);
        //         if (!reqPlayer || !reqPlayer.isMod)
        //             return res.sendStatus(403);

        //         await perishScores();
        //         res.sendStatus(200);
        //     }
        //     catch (exc: any) {
        //         console.error(exc);
        //         res.status(400).json({
        //             error: exc.error_message ?? "couldn't perish shit"
        //         });
        //     }
        // });

        // app.all("/update_scores", checkAccess, async (req, res) => {
        //     try {
        //         const reqPlayer = await authPlayer(req);
        //         if (!reqPlayer || !reqPlayer.isMod)
        //             return res.sendStatus(403);

        //         await updateScores();
        //         res.sendStatus(200);
        //     }
        //     catch (exc: any) {
        //         console.error(exc);
        //         res.status(400).json({
        //             error: exc.error_message ?? "couldn't update scores"
        //         });
        //     }
        // });
        // app.all('/banagain', async (req, res) => {
        //     try {
        //         const reqPlayer = await authPlayer(req);
        //         if (!reqPlayer || !reqPlayer.isMod)
        //             return res.sendStatus(403);

        //         await banAgain();
        //         res.sendStatus(200);
        //     }
        //     catch (exc: any) {
        //         console.error(exc);
        //         res.status(400).json({
        //             error: exc.error_message ?? "couldn't ban"
        //         });
        //     }
        // });
    }
}