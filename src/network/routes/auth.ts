import { Application, Express } from 'express';
import { validateEmail, getPlayerByEmail, createUser, genAccessToken, getPlayerNameByID } from '../database';
import { emailCodes, generateCode, sendCodeMail, tempSetCode } from '../email';
import { cooldownReq, CooldownTime, setCooldown } from '../../cooldown';

export class AuthRoute {
    static init(app: Application) {
        // registers the user to the database
        // requires 'username' json body field
        // todo to add user deletion from the database
        setCooldown("create-account", CooldownTime.DAY);
        app.all("/api/auth/register", async (req, res) => {
            try {
                if (!req.body.email || !(req.body.email as string).includes('@'))
                    throw { error_message: 'Invalid Email Address!' }

                if (!validateEmail(req.body.email)) {
                    throw { error_message: 'This Email Host is Blocked!' }
                }

                const player = await getPlayerByEmail(req.body.email);

                if (req.body.code) {
                    if (req.body.code != emailCodes.get(req.body.email)) {
                        emailCodes.delete(req.body.email);
                        throw { error_message: 'Invalid Code!' }
                    }

                    emailCodes.delete(req.body.email);

                    if (!cooldownReq(req, 'create-account')) {
                        return res.sendStatus(429);
                    }

                    const user = await createUser(req.body.username, req.body.email);
                    res.json({
                        id: user.id,
                        token: await genAccessToken(user.id),
                        secret: user.secret
                    });
                }
                else {
                    res.sendStatus(200);
                    if (player) {
                        // to avoid users abusing the email system
                        // we always send an "successful" response (even when it's not)
                        return; // throw { error_message: 'Player with that email does exist!' }
                    }

                    const daCode = generateCode();
                    tempSetCode(req.body.email, daCode);
                    await sendCodeMail(req.body.email, daCode);
                }
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't register..."
                });
            }
        });

        app.post("/api/auth/login", async (req, res) => {
            try {
                if (!req.body.email || !(req.body.email as string).includes('@'))
                    throw { error_message: 'Invalid Email Address!' }

                const player = await getPlayerByEmail(req.body.email);

                if (req.body.code) {
                    if (req.body.code != emailCodes.get(req.body.email)) {
                        emailCodes.delete(req.body.email);
                        throw { error_message: 'Invalid Code!' }
                    }

                    emailCodes.delete(req.body.email);
                    res.json({
                        id: player.id,
                        token: await genAccessToken(player.id)
                    });
                }
                else {
                    res.sendStatus(200);
                    // res.sendStatus(200);
                    if (!player) {
                        // to avoid users abusing the email system
                        // we always send an "successful" response (even when it's not)
                        return; // throw { error_message: 'Player with that email doesn\'t exist!' }
                    }

                    const daCode = generateCode();
                    tempSetCode(req.body.email, daCode);
                    await sendCodeMail(req.body.email, daCode);
                }
            }
            catch (exc: any) {
                console.error(exc);
                res.status(400).json({
                    error: exc.error_message ?? "Couldn't login..."
                });
            }
        });
        
        // saves the auth cookie in the browser
        app.get("/api/auth/cookie", async (req, res) => {
            try {
                if (!req.query.id || !req.query.token) return;

                res.cookie("authid", req.query.id, {
                    expires: new Date(253402300000000)
                });

                res.cookie("authtoken", req.query.token, {
                    expires: new Date(253402300000000)
                });

                const userName = await getPlayerNameByID(req.query.id + "");
                if (!userName)
                    return res.sendStatus(400);

                res.redirect('/user/' + userName);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });

        // logs out the user of the website
        app.get("/api/auth/logout", async (_req, res) => {
            try {
                res.clearCookie('authid');
                res.clearCookie('authtoken');
                res.sendStatus(200);
            }
            catch (exc) {
                console.error(exc);
                res.sendStatus(500);
            }
        });
    }
}