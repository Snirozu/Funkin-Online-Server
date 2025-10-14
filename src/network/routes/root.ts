import { Express } from 'express';
import { checkAccess, getIDToken, getPlayerNameByID } from '../database';
import { matchMaker } from 'colyseus';
import { networkRoom } from "../../rooms/NetworkRoom";
import { Data } from '../../data';
import { countPlayers } from '../../site';

export class RootRoute {
    static init(app: Express) {
        app.get("/api/sezdetal", async (_req, res) => {
            try {
                const sezlist = [];
                for (const msg of Data.PERSIST.props.FRONT_MESSAGES) {
                    const playerName = await getPlayerNameByID(msg.player);
                    sezlist.push({
                        player: playerName,
                        message: msg.message
                    });
                }
                res.send(sezlist);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/online", async (_req, res) => {
            try {
                const roomArray: any = [];
                const rooms = await matchMaker.query();
                if (rooms.length >= 1) {
                    rooms.forEach((room) => {
                        if (!room.private && !room.locked && (!networkRoom || room.roomId != networkRoom.roomId))
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
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.post("/api/sez", checkAccess, async (req, res) => {
            try {
                if (req.body.message && req.body.message.length < 80 && !(req.body.message as string).includes("\n")) {
                    const [id, _] = getIDToken(req);

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
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/nextweekreset", async (_req, res) => {
            try {
                res.status(200).send(Data.PERSIST.props.NEXT_WEEKLY_DATE + '');
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });
    }
}