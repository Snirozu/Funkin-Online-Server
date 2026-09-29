import { Router } from 'express';
import { UploadedFile } from 'express-fileupload';
import { CooldownTime, setCooldown } from '../cooldown';
import { Image } from 'canvas';
import { authUser, checkAccess, getIDToken, hasAccess } from '../database/db.util';
import { db } from '../database/db';
import { ResponseError } from '../error';

const clubRouter = Router();

clubRouter.get("/details", async (req, res) => {
    // #swagger.tags = ['Club']

    if (!req.query.tag)
        return res.sendStatus(400);

    const clubRef = db.clubs.byTag(req.query.tag as string);
    const club = await clubRef.get();

    const members = [];
    for (const member of club.members) {
        const userRef = db.users.byID(member);
        const user = await userRef.get();
        if (!user)
            continue;

        const stats = await userRef.getStats();
        members.push({
            player: user.name,
            points: stats?.points4k,
            profileHue: user.profileHue ?? 250,
            profileHue2: user.profileHue2,
            country: user.country
        });
    }

    const leaders = [];
    for (const member of club.leaders)
        leaders.push(await db.users.getNameByID(member));

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
        rank: await clubRef.getRank(),
        hue: club.hue
    });
});

clubRouter.get("/banner/:tag", async (req, res) => {
    // #swagger.tags = ['Club']

    if (!req.params.tag)
        return res.sendStatus(400);

    const file = await db.clubs.getBannerByTag(req.params.tag);
    if (!file)
        return res.sendStatus(404);

    res.send(file.data);
});

clubRouter.get("/pending", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    const [id, _] = getIDToken(req);
    const clubRef = await db.users.byID(id).getClub();
    const club = await clubRef.get();
    if (!club.leaders.includes(id)) {
        throw new ResponseError('Only club leaders can do that!');
    }

    const pending = [];
    for (const user of club.pending)
        pending.push(await db.users.getNameByID(user));

    res.status(200).json(pending);
});

clubRouter.post("/create", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    const [id, _] = getIDToken(req);
    const club = await db.clubs.create(db.users.byID(id), req.body);
    res.status(200).send(club.tag);
});

clubRouter.get("/join", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    if (!req.query.tag)
        return res.sendStatus(400);

    const [id, _] = getIDToken(req);
    await db.clubs.byTag(req.query.tag as string).requestJoin(db.users.byID(id));
    res.sendStatus(200);
});

clubRouter.get("/accept", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    if (!req.query.user)
        return res.sendStatus(400);

    const [id, _] = getIDToken(req);
    const club = await db.clubs.byID(id).get({
        select: {
            leaders: true,
            tag: true
        }
    });
    if (!club.leaders.includes(id)) {
        throw new ResponseError('Only club leaders can do that!');
    }
    await db.clubs.byTag(club.tag).acceptJoin(db.users.byName(req.query.user as string));
    res.sendStatus(200);
});

clubRouter.get("/reject", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    if (!req.query.user)
        return res.sendStatus(400);

    const [id, _] = getIDToken(req);
    const club = await (await db.users.byID(id).getClub()).get();
    if (!club.leaders.includes(id)) {
        throw new ResponseError('Only club leaders can do that!');
    }
    await db.clubs.byTag(club.tag).rejectJoin(await db.users.getIDByName(req.query.user as string));
    res.sendStatus(200);
});

clubRouter.get("/kick", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    if (!req.query.user)
        return res.sendStatus(400);

    const [id, _] = getIDToken(req);
    const club = await (await db.users.byID(id).getClub()).get();
    const reqID = await db.users.getIDByName(req.query.user as string);
    if (reqID == id) {
        throw new ResponseError('You cannot kick yourself!');
    }
    const reqUser = db.users.byID(reqID);
    const clubReq = await reqUser.get();
    if (!club.leaders.includes(id)) {
        throw new ResponseError('Only club leaders can do that!');
    }
    if (club.id != clubReq.id) {
        throw new ResponseError('You can\'t manage this club!');
    }
    await db.clubs.removePlayerFromClub(reqUser);
    res.sendStatus(200);
});

clubRouter.get("/promote", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    if (!req.query.user)
        return res.sendStatus(400);

    const [id, _] = getIDToken(req);
    const club = await (await db.users.byID(id).getClub()).get();
    const reqer = db.users.byName(req.query.user as string);
    const clubReq = await (await reqer.getClub()).get();
    if (!club.leaders.includes(id)) {
        throw new ResponseError('Only club leaders can do that!');
    }
    if (club.id != clubReq.id) {
        throw new ResponseError('You can\'t manage this club!');
    }
    await db.clubs.promoteClubMember(reqer);
    res.sendStatus(200);
});

clubRouter.get("/demote", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    if (!req.query.user)
        return res.sendStatus(400);

    const [id, _] = getIDToken(req);
    const club = await (await db.users.byID(id).getClub()).get();
    const reqer = db.users.byName(req.query.user as string);
    const clubReqRef = await reqer.getClub();
    const clubReq = await clubReqRef.get();
    if (!club.leaders.includes(id)) {
        throw new ResponseError('Only club leaders can do that!');
    }
    if (club.id != clubReq.id) {
        throw new ResponseError('You can\'t manage this club!');
    }
    await db.clubs.demoteMember(reqer);
    res.sendStatus(200);
});

clubRouter.get("/leave", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    const [id, _] = getIDToken(req);
    const user = db.users.byID(id);
    const club = await user.getClub();
    if (!club) {
        throw new ResponseError('You are not in a club!');
    }
    await db.clubs.removePlayerFromClub(user);
    res.sendStatus(200);
});

setCooldown("/api/club/banner", 10);
clubRouter.post("/banner", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    const [id, _] = getIDToken(req);

    if (!req.query.tag) {
        throw new ResponseError('Invalid Request!');
    }

    const clubRef = db.clubs.byTag(req.query.tag as string);
    const club = await clubRef.get();
    const canForceEdit = hasAccess((await (await authUser(req)).get({ select: { role: true } })).role, 'admin.club.edit');

    if (!canForceEdit && !club.leaders.includes(id)) {
        throw new ResponseError('Only club leaders can do that!');
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

        if (!await db.clubs.uploadBannerForTag(club.tag, file.data)) {
            return res.sendStatus(500);
        }
        res.sendStatus(200);
    }
    img.onerror = function () {
        res.status(500).json({
            error: 'Server failed to read the image.'
        });
    }
    img.src = "data:" + file.mimetype + ";base64," + file.data.toString("base64");
});

setCooldown("/api/club/edit", 5);
setCooldown("club.edit.tag", CooldownTime.DAY * 7);
clubRouter.post("/edit", checkAccess, async (req, res) => {
    // #swagger.tags = ['Club']

    const [id, _] = getIDToken(req);

    if (!req.query.tag) {
        throw new ResponseError('Invalid Request!');
    }

    const clubRef = db.clubs.byTag(req.query.tag as string);
    const club = await clubRef.get();
    const canForceEdit = hasAccess((await (await authUser(req)).get({ select: { role: true } })).role, 'admin.club.edit');

    if (!canForceEdit && !club.leaders.includes(id)) {
        throw new ResponseError('Only club leaders can do that!');
    }

    await clubRef.edit(req.body, canForceEdit);
    res.sendStatus(200);
});

export default clubRouter;