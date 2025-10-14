import { Express } from 'express';

export class DebugRoutes {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static init(app: Express) {
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