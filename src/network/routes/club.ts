import { Express } from 'express';
import { UploadedFile } from 'express-fileupload';
import { getClub, getPlayerByID, getPlayerNameByID, getClubRank, getClubBanner, checkAccess, getIDToken, getPlayerClub, createClub, requestJoinClub, acceptJoinClub, getPlayerIDByName, removePlayerFromClub, promoteClubMember, demoteClubMember, uploadClubBanner, postClubEdit } from '../database';
import { setCooldown } from '../../cooldown';
import { Image } from 'canvas';

export class ClubRoute {
    static init(app: Express) {
        app.get("/api/club/details", async (req, res) => {
            try {
                if (!req.query.tag)
                    return res.sendStatus(400);

                const club = await getClub(req.query.tag as string);

                const members = [];
                for (const member of club.members) {
                    const user = await getPlayerByID(member);
                    members.push({
                        player: user.name,
                        points: user.points,
                        profileHue: user.profileHue ?? 250,
                        profileHue2: user.profileHue2,
                        country: user.country
                    });
                }

                const leaders = [];
                for (const member of club.leaders)
                    leaders.push(await getPlayerNameByID(member));

                members.sort((a, b) => {
                    if (leaders.includes(a.player) === leaders.includes(b.player)) {
                        return b.points - a.points;
                    }
                    return leaders.includes(a.player) ? -1 : 1;
                });

                res.status(200).json({
                    name: club.name,
                    tag: club.tag,
                    members: members,
                    leaders: leaders,
                    content: club.content,
                    created: club.created,
                    points: Number(club.points),
                    rank: await getClubRank(club.tag),
                    hue: club.hue
                });
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/club/banner/:tag", async (req, res) => {
            try {
                if (!req.params.tag)
                    return res.sendStatus(400);

                const file = await getClubBanner(req.params.tag);
                if (!file)
                    return res.sendStatus(404);

                res.send(file.data);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/club/pending", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);
                const club = await getPlayerClub(id);
                if (!club.leaders.includes(id)) {
                    throw { error_message: 'Only club leaders can do that!' }
                }

                const pending = [];
                for (const user of club.pending)
                    pending.push(await getPlayerNameByID(user));

                res.status(200).json(pending);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.post("/api/club/create", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);
                const club = await createClub(id, req.body);
                res.status(200).send(club.tag);
            }
            catch (exc: any) {
                if (!exc?.error_message)
                    console.error(exc);

                res.status(400).json({
                    error: exc.error_message ?? "Couldn't create a club..."
                });
            }
        });

        app.get("/api/club/join", checkAccess, async (req, res) => {
            try {
                if (!req.query.tag)
                    return res.sendStatus(400);

                const [id, _] = getIDToken(req);
                await requestJoinClub(req.query.tag as string, id);
                res.sendStatus(200);
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/club/accept", checkAccess, async (req, res) => {
            try {
                if (!req.query.user)
                    return res.sendStatus(400);

                const [id, _] = getIDToken(req);
                const club = await getPlayerClub(id);
                if (!club.leaders.includes(id)) {
                    throw { error_message: 'Only club leaders can do that!' }
                }
                await acceptJoinClub(club.tag, await getPlayerIDByName(req.query.user as string));
                res.sendStatus(200);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/club/kick", checkAccess, async (req, res) => {
            try {
                if (!req.query.user)
                    return res.sendStatus(400);

                const [id, _] = getIDToken(req);
                const club = await getPlayerClub(id);
                const reqID = await getPlayerIDByName(req.query.user as string);
                if (reqID == id) {
                    throw { error_message: 'You cannot kick yourself!' }
                }
                const clubReq = await getPlayerClub(reqID);
                if (!club.leaders.includes(id)) {
                    throw { error_message: 'Only club leaders can do that!' }
                }
                if (club.id != clubReq.id) {
                    throw { error_message: 'You can\'t manage this club!' }
                }
                await removePlayerFromClub(reqID);
                res.sendStatus(200);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/club/promote", checkAccess, async (req, res) => {
            try {
                if (!req.query.user)
                    return res.sendStatus(400);

                const [id, _] = getIDToken(req);
                const club = await getPlayerClub(id);
                const clubReq = await getPlayerClub(await getPlayerIDByName(req.query.user as string));
                if (!club.leaders.includes(id)) {
                    throw { error_message: 'Only club leaders can do that!' }
                }
                if (club.id != clubReq.id) {
                    throw { error_message: 'You can\'t manage this club!' }
                }
                await promoteClubMember(await getPlayerIDByName(req.query.user as string));
                res.sendStatus(200);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/club/demote", checkAccess, async (req, res) => {
            try {
                if (!req.query.user)
                    return res.sendStatus(400);

                const [id, _] = getIDToken(req);
                const club = await getPlayerClub(id);
                const clubReq = await getPlayerClub(await getPlayerIDByName(req.query.user as string));
                if (!club.leaders.includes(id)) {
                    throw { error_message: 'Only club leaders can do that!' }
                }
                if (club.id != clubReq.id) {
                    throw { error_message: 'You can\'t manage this club!' }
                }
                await demoteClubMember(await getPlayerIDByName(req.query.user as string));
                res.sendStatus(200);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });
        
        app.get("/api/club/leave", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);
                const club = await getPlayerClub(id);
                if (!club) {
                    throw { error_message: 'You are not in a club!' }
                }
                await removePlayerFromClub(id);
                res.sendStatus(200);
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        setCooldown("/api/club/banner", 10);
        app.post("/api/club/banner", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);
                const club = await getPlayerClub(id);
                if (!club.leaders.includes(id)) {
                    throw { error_message: 'Only club leaders can do that!' }
                }

                const file = req.files.file as UploadedFile;
                if (file.size > 1024 * 350) {
                    return res.sendStatus(413);
                }

                if (file.mimetype != 'image/png' && file.mimetype != 'image/jpeg' && file.mimetype != 'image/gif') {
                    return res.sendStatus(415);
                }

                const img = new Image();
                img.onload = async function () {
                    if (img.width != 256 && img.height != 128) {
                        return res.status(400).json({
                            error: 'Image must be in size of 256x128!'
                        });
                    }

                    if (!await uploadClubBanner(club.tag, file.data)) {
                        return res.sendStatus(500);
                    }
                    res.sendStatus(200);
                }
                img.onerror = async function () {
                    res.status(500).json({
                        error: 'Server failed to read the image.'
                    });
                }
                img.src = "data:" + file.mimetype + ";base64," + file.data.toString("base64");
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't upload..."
                });
            }
        });

        setCooldown("/api/club/edit", 3);
        app.post("/api/club/edit", checkAccess, async (req, res) => {
            try {
                const [id, _] = getIDToken(req);
                const club = await getPlayerClub(id);
                if (!club.leaders.includes(id)) {
                    throw { error_message: 'Only club leaders can do that!' }
                }
                await postClubEdit(club.tag, req.body);
                res.sendStatus(200);
            }
            catch (exc: any) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });
    }
}