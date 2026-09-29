import { UploadedFile } from "express-fileupload";
import { Data } from "../data";
import { isUserIDInRoom, findPlayerSIDByNID, validateEmail } from "../util";
import { Router } from 'express';
import { emailCodes, generateCode, tempSetCode, sendCodeMail } from "../email";
import { setCooldown } from "../cooldown";
import axios from "axios";
import { checkAccess, getIDToken, userIDsToNames } from "../database/db.util";
import { db } from "../database/db";
import { ResponseError } from "../error";

const accountRouter = Router();
      
accountRouter.get("/info", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);
    const user = await userRef.ping();
    const stats = await userRef.getStats(req.query.category as string);

    res.send({
        name: user.name,
        role: user.role,
        joined: user.joined,
        lastActive: user.lastActive,
        points: stats["points" + (req.query.keys ?? 4) + "k"],
        avgAccuracy: stats["avgAcc" + (req.query.keys ?? 4) + "k"],
        club: await userRef.getClubTag(),
    });
});

// ping for successful authorization
accountRouter.get("/me", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const playerRef = db.users.byID(id);
    const player = await playerRef.ping();
    const stats = await playerRef.getStats(req.query.category as string);

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
        access: Data.CONFIG.ROLES.get(!player.role || !Data.CONFIG.ROLES.has(player.role) ? Data.CONFIG.DEFAULT_ROLE : player.role).access ?? [],
        club: await playerRef.getClubTag(),
        notifs: await playerRef.getNotificationsCount() 
    });
});

accountRouter.get("/friends", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const playerRef = db.users.byID(id);
    const player = await playerRef.get();

    const friendList = await userIDsToNames(player.friends);
    const gotRequests = await userIDsToNames(player.friendRequests);
    const sentRequests = await playerRef.getSentFriendRequests();

    const friends: any[] = [];
    for (const friend of friendList) {
        const hue = await db.users.getProfileHueByName(friend);
        friends.push({
            name: friend,
            status: Data.INFO.ONLINE_PLAYERS.includes(friend) ? 'ONLINE' : 'Offline',
            hue: hue[0],
            hue2: hue[1]
        });
    }

    res.send({
        friends: friends,
        pending: sentRequests,
        requests: gotRequests,
    });
});

setCooldown("/avatar", 10);
accountRouter.post("/avatar", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);

    const file = req.files.file as UploadedFile;
    if (file.size > 1024 * 250) {
        return res.sendStatus(413);
    }
    if (file.mimetype != 'image/png' && file.mimetype != 'image/jpeg' && file.mimetype != 'image/gif') {
        return res.sendStatus(415);
    }
    if (!await db.users.byID(id).uploadAvatar(file.data)) {
        return res.sendStatus(500);
    }
    res.sendStatus(200);
});

setCooldown("/background", 10);
accountRouter.post("/background", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);

    if ((await userRef.getStats()).points4k < 1000) {
        return res.sendStatus(418);
    }

    const file = req.files.file as UploadedFile;
    if (file.size > 1024 * 1000) {
        return res.sendStatus(413);
    }
    if (file.mimetype != 'image/png' && file.mimetype != 'image/jpeg') {
        return res.sendStatus(415);
    }
    if (!await userRef.uploadBackground(file.data)) {
        return res.sendStatus(500);
    }
    res.sendStatus(200);
});

accountRouter.get("/removeimages", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);

    if (!await userRef.removeImages()) {
        return res.sendStatus(500);
    }
    res.sendStatus(200);
});

accountRouter.get("/club", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']
    
    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);

    const clubTag = await userRef.getClubTag();

    if (!clubTag) {
        res.sendStatus(404);
        return;
    }

    res.status(200).send(clubTag as string);
});

setCooldown("/profile/set", 3);
accountRouter.post("/profile/set", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);

    await userRef.setBio(req.body.bio ?? '', Number.parseInt(req.body.hue), req.body.country, Number.parseInt(req.body.hue2 as string ?? "0"));
    res.sendStatus(200);
});

setCooldown("/rename", 60);
accountRouter.post("/rename", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);

    if (await isUserIDInRoom(id)) {
        const room = Data.INFO.MAP_USERNAME_PLAYINGROOM.get(await userRef.getName());
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

    const renameAction = await userRef.rename(req.body.username);
    res.send(renameAction.new);
});

accountRouter.post("/email/set", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const playerRef = db.users.byID(id);

    if (!req.body.email || !(req.body.email as string).includes('@'))
        throw new ResponseError('Invalid Email Address!');

    if (!validateEmail(req.body.email)) {
        throw new ResponseError('This Email Host is Blocked!');
    }

    const player = await playerRef.get();
    if (player.email && player.email != req.body.old_email)
        throw new ResponseError('Currently Set Email is Not Provided!');

    // fake successful request for existing emails
    if (await db.users.byEmail(req.body.email).exists()) {
        return res.sendStatus(200);
    }

    if (req.body.code) {
        if (req.body.code != emailCodes.get(req.body.email)) {
            emailCodes.delete(req.body.email);
            throw new ResponseError('Invalid Code!');
        }

        emailCodes.delete(req.body.email);
        await playerRef.setEmail(req.body.email);
        res.sendStatus(200);
    }
    else {
        res.sendStatus(200);

        const daCode = generateCode();
        tempSetCode(req.body.email, daCode);
        await sendCodeMail(req.body.email, daCode);
    }
});

accountRouter.all("/delete", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const playerRef = db.users.byID(id);
    const player = await playerRef.get();

    if (req.query.code) {
        if (req.query.code != emailCodes.get(player.email)) {
            emailCodes.delete(player.email);
            throw new ResponseError('Invalid Code!');
        }

        emailCodes.delete(player.email);
        await playerRef.delete();
        res.sendStatus(200);
    }
    else {
        const daCode = generateCode();
        tempSetCode(player.email, daCode);
        await sendCodeMail(player.email, daCode);
        res.sendStatus(200);
    }
});

accountRouter.get("/notifications", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const playerRef = db.users.byID(id);

    res.status(200).send(await playerRef.getNotifications());
});

accountRouter.get("/notifications/delete/:id", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const playerRef = db.users.byID(id);

    const notifs = await playerRef.getNotifications();
    let hasNotif = false;

    for (const notif of notifs) {
        if (notif.id === req.params.id)
            hasNotif = true;
    }

    if (!hasNotif) {
        res.sendStatus(401);
        return;
    }

    await db.users.deleteNotificationByID(req.params.id as string);
    res.sendStatus(200);
});

async function requestNGio(execute: any, sessionId?:string) {
    const ngReq = {
        "app_id": process.env["NG_IO_APP_ID"],
        "execute": execute,
        "session_id": sessionId
    };

    const formData = new FormData();
    formData.append('request', JSON.stringify(ngReq));

    const response = await axios.post("https://www.newgrounds.io/gateway_v3.php", formData, {
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
        }
    });

    if (response.status !== 200 || !response.data) {
        throw new Error('NG Refused');
    }

    if (!response.data.success) {
        throw response.data.error;
    }

    return response.data.result.data;
}

const ngSessions:Map<string, any> = new Map();
setCooldown("/link/newgrounds", 5);
accountRouter.get("/link/newgrounds", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);

    const user = await userRef.get();
    if (user.ngId) {
        res.sendStatus(200);
        return;
    }

    const lastSession = ngSessions.get(id);
    if (lastSession) {
        const response = await requestNGio({
            "component": "accountRouter.checkSession"
        }, lastSession.id);

        if (!response.expired) {
            if (!response.session.user) {
                res.status(200).send(response.session.passport_url);
                ngSessions.set(id, response.session);
                return;
            }
            await userRef.linkNewgrounds(Number(response.session.user.id).toString(), response.session.user.url);
            res.sendStatus(200);
            ngSessions.delete(id);
            return;
        }
        else {
            await requestNGio({
                "component": "accountRouter.endSession"
            }, lastSession.id);
            ngSessions.delete(id);
        }
    }

    const response = await requestNGio({
        "component": "accountRouter.startSession"
    });

    res.status(200).send(response.session.passport_url);
    ngSessions.set(id, response.session);
});

accountRouter.get("/unlink/newgrounds", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);

    ngSessions.delete(id);
    await userRef.linkNewgrounds(null, null);

    res.sendStatus(200);
});

accountRouter.get("/resetsecret", checkAccess, async (req, res) => {
    // #swagger.tags = ['Account']

    const [id] = getIDToken(req);
    const userRef = db.users.byID(id);

    await userRef.resetSecret();

    res.sendStatus(200);
});

export default accountRouter;