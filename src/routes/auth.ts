import { Router } from 'express';
import { emailCodes, generateCode, sendCodeMail, tempSetCode } from '../email';
import { cooldownReq, CooldownTime, setCooldown } from '../cooldown';
import { validateEmail } from '../util';
import { db } from '../database/db';
import { genAccessToken } from '../database/db.util';
import { ResponseError } from '../error';

const authRouter = Router();

// registers the user to the database
// requires 'username' json body field
// todo to add user deletion from the database
setCooldown("create-account", CooldownTime.DAY);
authRouter.all("/register", async (req, res) => {
    // #swagger.tags = ['Authentication']

    if (!req.body.email || !(req.body.email as string).includes('@'))
        throw new ResponseError('Invalid Email Address!');

    if (!validateEmail(req.body.email)) {
        throw new ResponseError('This Email Host is Blocked!');
    }

    const player = db.users.byEmail(req.body.email);
    if (await player.exists()) {
        // to avoid users abusing the email system
        // we always send an "successful" response (even when it's not)
        return res.sendStatus(200);
    }

    if (req.body.code) {
        if (req.body.code != emailCodes.get(req.body.email)) {
            emailCodes.delete(req.body.email);
            throw new ResponseError('Invalid Code!');
        }

        emailCodes.delete(req.body.email);

        if (!cooldownReq(req, 'create-account')) {
            return res.sendStatus(429);
        }

        const user = await db.users.create(req.body.username, req.body.email);
        res.json({
            id: user.id,
            token: await genAccessToken(user.id),
            secret: user.secret
        });
    }
    else {
        res.sendStatus(200);

        const daCode = generateCode();
        tempSetCode(req.body.email, daCode);
        await sendCodeMail(req.body.email, daCode);
    }
});

authRouter.post("/login", async (req, res) => {
    // #swagger.tags = ['Authentication']

    if (!req.body.email || !(req.body.email as string).includes('@'))
        throw new ResponseError('Invalid Email Address!');

    const playerID = await db.users.byEmail(req.body.email).getID();
    if (!playerID) {
        // to avoid users abusing the email system
        // we always send an "successful" response (even when it's not)
        return res.sendStatus(200);
    }

    if (req.body.code) {
        if (req.body.code != emailCodes.get(req.body.email)) {
            emailCodes.delete(req.body.email);
            throw new ResponseError('Invalid Code!');
        }

        emailCodes.delete(req.body.email);
        res.json({
            id: playerID,
            token: await genAccessToken(playerID)
        });
    }
    else {
        res.sendStatus(200);

        const daCode = generateCode();
        tempSetCode(req.body.email, daCode);
        await sendCodeMail(req.body.email, daCode);
    }
});

// saves the auth cookie in the browser
authRouter.get("/cookie", async (req, res) => {
    // #swagger.tags = ['Authentication']

    if (!req.query.id || !req.query.token) return;

    res.cookie("authid", req.query.id, {
        expires: new Date(253402300000000)
    });

    res.cookie("authtoken", req.query.token, {
        expires: new Date(253402300000000)
    });

    const userName = await db.users.getNameByID(req.query.id as string);
    if (!userName)
        return res.sendStatus(400);

    res.redirect('/user/' + userName);
});

// logs out the user of the website
authRouter.get("/logout", (_req, res) => {
    // #swagger.tags = ['Authentication']

    res.clearCookie('authid');
    res.clearCookie('authtoken');
    res.sendStatus(200);
});

export default authRouter;