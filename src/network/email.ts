import nodemailer from 'nodemailer';
import * as crypto from "crypto";

export const transMail = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_ID,
        pass: process.env.GMAIL_PASSWORD
    }
});

export const emailCodes: Map<string, string> = new Map<string, string>();
export const emailCodeTimers: Map<string, NodeJS.Timeout> = new Map<string, NodeJS.Timeout>();

export async function sendCodeMail(email: string, code: string) {
    await transMail.sendMail({
        from: 'Psych Online',
        to: email,
        subject: code + ' is your Verification Code',
        html: '<h3>Your verification code is:<h3><h1>' + code + '</h1>'
    }
        // ,    (error, info) => {
        //         if (res)
        //             if (error)
        //                 res.sendStatus(500);
        //             else
        //                 res.sendStatus(200);
        //     }
    );
}

export function tempSetCode(email: string, code: string) {
    if (emailCodeTimers.has(email)) {
        clearInterval(emailCodeTimers.get(email));
    }

    emailCodes.set(email, code);

    emailCodeTimers.set(email, setInterval(() => {
        emailCodes.delete(email);
    }, 1000 * 60 * 10));
}

export function generateCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}