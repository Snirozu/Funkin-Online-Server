import { Router } from 'express';
import { matchMaker } from 'colyseus';
import { NetworkRoom } from "../rooms/NetworkRoom";
import { Data } from '../data';
import { countPlayers } from '../site';
import { CooldownTime, setCooldown } from '../cooldown';
import { db } from '../database/db';
import { checkAccess, getIDToken } from '../database/db.util';

const apiRouter = Router();

apiRouter.get("/front", async (_req, res) => {
    // #swagger.tags = ['Generic']

    const [playerCount, roomFreeCount] = await countPlayers();
    const playerName = Data.PERSIST.props.FRONT_MESSAGES[0] ? await db.users.getNameByID(Data.PERSIST.props.FRONT_MESSAGES[0].player) : undefined;

    res.send({
        online: playerCount,
        rooms: roomFreeCount,
        sez: (playerName ? playerName + ' sez: "' + Data.PERSIST.props.FRONT_MESSAGES[0].message + '"' : '')
    });
});

apiRouter.get("/onlinecount", async (_req, res) => {
    // #swagger.tags = ['Generic']

    res.send('' + (await countPlayers())[0]);
});

apiRouter.get("/sezdetal", async (_req, res) => {
    // #swagger.tags = ['Generic']

    const sezlist = [];
    for (const msg of Data.PERSIST.props.FRONT_MESSAGES) {
        const playerName = await db.users.getNameByID(msg.player);
        sezlist.push({
            player: playerName,
            message: msg.message
        });
    }
    res.send(sezlist);
});

apiRouter.get("/online", async (_req, res) => {
    // #swagger.tags = ['Generic']

    const roomArray: any = [];
    const rooms = await matchMaker.query();
    if (rooms.length >= 1) {
        rooms.forEach((room) => {
            if (!room.private && !room.locked && (!NetworkRoom.instance || room.roomId != NetworkRoom.instance.roomId))
                roomArray.push({
                    code: room.roomId,
                    player: room?.metadata?.name ?? "???",
                    ping: room?.metadata?.ping ?? NaN
                });
        });
    }

    res.send({
        network: Data.INFO.ONLINE_PLAYERS,
        playing: (await countPlayers())[2],
        rooms: roomArray
    });
});

setCooldown("/api/sez", CooldownTime.DAY);
apiRouter.post("/sez", checkAccess, (req, res) => {
    // #swagger.tags = ['Generic']

    if (req.body.message && req.body.message.length < 100 && !(req.body.message as string).includes("\n")) {
        const [id, _] = getIDToken(req);

        if (Data.PERSIST.props.FRONT_MESSAGES.length > 0 && Data.PERSIST.props.FRONT_MESSAGES[0].player == id) {
            return res.sendStatus(418);
        }

        Data.PERSIST.props.FRONT_MESSAGES.unshift({
            player: id,
            message: req.body.message
        });
        if (Data.PERSIST.props.FRONT_MESSAGES.length > 5) {
            Data.PERSIST.props.FRONT_MESSAGES.pop();
        }
        Data.PERSIST.save();

        res.sendStatus(200);
        return;
    }
    if (!req.body.message)
        res.sendStatus(418);
    else
        res.sendStatus(413);
});

export default apiRouter;