import { UploadedFile } from "express-fileupload";
import { Data } from "../../data";
import { isUserIDInRoom, findPlayerSIDByNID } from "../../util";
import { checkAccess, getIDToken, pingPlayer, getPlayerClubTag, getPlayerByID, getUserFriends, searchFriendRequests, getPlayerProfileHue, getPlayerNameByID, uploadAvatar, uploadBackground, removeImages, setPlayerBio, renamePlayer, deleteUser, getPlayerByEmail, setEmail, validateEmail, getNotifications, deleteNotification, getNotificationsCount, getUserStats } from "../database";
import { Express } from 'express';
import { emailCodes, generateCode, tempSetCode, sendCodeMail } from "../email";
import { setCooldown } from "../../cooldown";

export class AccountRoute {
    static init(app: Express) {        
        app.get("/api/account/info", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                const user = await pingPlayer(id);
                const stats = await getUserStats(id, req.query.category as string);

                res.send({
                    name: user.name,
                    role: user.role,
                    joined: user.joined,
                    lastActive: user.lastActive,
                    points: stats["points" + (req.query.keys ?? 4) + "k"],
                    avgAccuracy: stats["avgAcc" + (req.query.keys ?? 4) + "k"],
                    club: await getPlayerClubTag(id),
                });
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        // ping for successful authorization
        app.get("/api/account/me", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                const player = await pingPlayer(id);
                const stats = await getUserStats(id, req.query.category as string);

                if (!player) {
                    res.sendStatus(403);
                    return;
                }

                if (!Data.INFO.ONLINE_PLAYERS.includes(player.name)) {
                    Data.INFO.ONLINE_PLAYERS.push(player.name);
                }

                res.send({
                    name: player.name,
                    points: stats["points" + (req.query.keys ?? 4) + "k"],
                    avgAccuracy: stats["avgAcc" + (req.query.keys ?? 4) + "k"],
                    role: player.role,
                    profileHue: player.profileHue ?? 250,
                    profileHue2: player.profileHue2,
                    country: player.country,
                    access: Data.CONFIG.ROLES.get(player.role ?? Data.CONFIG.DEFAULT_ROLE).access ?? [],
                    club: await getPlayerClubTag(id),
                    notifs: await getNotificationsCount(id) 
                });
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        app.get("/api/account/friends", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                const player = await getPlayerByID(id);
                const friendList = await getUserFriends(player.friends);
                const pending = await getUserFriends(player.pendingFriends);
                const request = await searchFriendRequests(player.id);

                const friends: any[] = [];
                for (const friend of friendList) {
                    const hue = await getPlayerProfileHue(friend);
                    friends.push({
                        name: friend,
                        status: Data.INFO.ONLINE_PLAYERS.includes(friend) ? 'ONLINE' : 'Offline',
                        hue: hue[0],
                        hue2: hue[1]
                    });
                }

                res.send({
                    friends: friends,
                    pending: pending,
                    requests: request,
                });
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        setCooldown("/api/account/avatar", 10);
        app.post("/api/account/avatar", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);

                const file = req.files.file as UploadedFile;
                if (file.size > 1024 * 200) {
                    return res.sendStatus(413);
                }
                if (file.mimetype != 'image/png' && file.mimetype != 'image/jpeg' && file.mimetype != 'image/gif') {
                    return res.sendStatus(415);
                }
                if (!await uploadAvatar(id, file.data)) {
                    return res.sendStatus(500);
                }
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't upload..."
                });
            }
        });

        setCooldown("/api/account/background", 10);
        app.post("/api/account/background", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                if ((await getUserStats(id)).points4k < 1000) {
                    return res.sendStatus(418);
                }

                const file = req.files.file as UploadedFile;
                if (file.size > 1024 * 1000) {
                    return res.sendStatus(413);
                }
                if (file.mimetype != 'image/png' && file.mimetype != 'image/jpeg') {
                    return res.sendStatus(415);
                }
                if (!await uploadBackground(id, file.data)) {
                    return res.sendStatus(500);
                }
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't upload..."
                });
            }
        });

        app.get("/api/account/removeimages", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                if (!await removeImages(id)) {
                    return res.sendStatus(500);
                }
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't remove..."
                });
            }
        });

        app.get("/api/account/club", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                const clubTag = await getPlayerClubTag(id);

                if (!clubTag) {
                    res.sendStatus(404);
                    return;
                }

                res.status(200).send(clubTag as string);
            }
            catch (exc) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        setCooldown("/api/account/profile/set", 3);
        app.post("/api/account/profile/set", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);

                await setPlayerBio(id, req.body.bio ?? '', Number.parseInt(req.body.hue), req.body.country, Number.parseInt(req.body.hue2 as string ?? "0"));
                res.sendStatus(200);
            }
            catch (exc) {
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't set bio..."
                });
            }
        });

        setCooldown("/api/account/rename", 60);
        app.post("/api/account/rename", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);

                if (await isUserIDInRoom(id)) {
                    const room = Data.INFO.MAP_USERNAME_PLAYINGROOM.get(await getPlayerNameByID(id));
                    const clientSSID = findPlayerSIDByNID(room, id);
                    let client = null;
                    for (const c of room.clients) {
                        if (c.sessionId == clientSSID)
                            client = c;
                    }
                    if (client == null) {
                        res.sendStatus(418);
                        return;
                    }
                    client.leave();
                }

                const renameAction = await renamePlayer(id, req.body.username);
                res.send(renameAction.new);
            }
            catch (exc) {
                if (!exc?.error_message)
                    console.error(exc);

                res.status(400).json({
                    error: exc.error_message ?? "Couldn't change your handle..."
                });
            }
        });

        app.post("/api/account/email/set", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);

                if (!req.body.email || !(req.body.email as string).includes('@'))
                    throw { error_message: 'Invalid Email Address!' }

                if (!validateEmail(req.body.email)) {
                    throw { error_message: 'This Email Host is Blocked!' }
                }

                const player = await getPlayerByID(id);
                if (player.email && player.email != req.body.old_email)
                    throw { error_message: 'Currently Set Email is Not Provided!' }

                if (req.body.code) {
                    if (req.body.code != emailCodes.get(req.body.email)) {
                        emailCodes.delete(req.body.email);
                        throw { error_message: 'Invalid Code!' }
                    }

                    emailCodes.delete(req.body.email);
                    await setEmail(id, req.body.email);
                    res.sendStatus(200);
                }
                else {
                    res.sendStatus(200);
                    if (await getPlayerByEmail(req.body.email)) {
                        return;
                    }

                    const daCode = generateCode();
                    tempSetCode(req.body.email, daCode);
                    await sendCodeMail(req.body.email, daCode);
                }
            }
            catch (exc) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't set the email..."
                });
            }
        });

        app.all("/api/account/delete", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                const player = await getPlayerByID(id);

                if (req.query.code) {
                    if (req.query.code != emailCodes.get(player.email)) {
                        emailCodes.delete(player.email);
                        throw { error_message: 'Invalid Code!' }
                    }

                    emailCodes.delete(player.email);
                    await deleteUser(player.id);
                    res.sendStatus(200);
                }
                else {
                    const daCode = generateCode();
                    tempSetCode(player.email, daCode);
                    await sendCodeMail(player.email, daCode);
                    res.sendStatus(200);
                }
            }
            catch (exc) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't delete your account..."
                });
            }
        });

        app.get("/api/account/notifications", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                res.status(200).send(await getNotifications(id));
            }
            catch (exc) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });

        app.get("/api/account/notifications/delete/:id", checkAccess, async (req, res) => {
            try {
                const [id] = getIDToken(req);
                const notifs = await getNotifications(id);
                let hasNotif = false;

                for (const notif of notifs) {
                    if (notif.id === req.params.id)
                        hasNotif = true;
                }

                if (!hasNotif) {
                    res.sendStatus(401);
                    return;
                }

                await deleteNotification(req.params.id);
                res.sendStatus(200);
            }
            catch (exc) {
                res.status(400).send(exc?.error_message ?? "Unknown error...");
            }
        });
    }
}