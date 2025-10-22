import { Data } from "../data";
import { getIDToken, getPlayerNameByID } from "./database";

export async function logActionOnRequest(req: any, _: any, next: any) {
    const [id, __] = getIDToken(req);
    await logAction(id, req.url + ' ' + JSON.stringify(req.body ?? ''));
    next();
}

export async function logAction(uid: string, content: string) {
    const date = new Date(Date.now()).toISOString();

    if (!Data.PERSIST.props.LOGGED_MOD_ACTIONS)
        Data.PERSIST.props.LOGGED_MOD_ACTIONS = [];

    if (Data.PERSIST.props.LOGGED_MOD_ACTIONS.length > 1000) {
        Data.PERSIST.props.LOGGED_MOD_ACTIONS.pop();
    }

    Data.PERSIST.props.LOGGED_MOD_ACTIONS.unshift(`[${date}]: ${uid ? await getPlayerNameByID(uid) : 'SERVER'}: ${content}`);
    Data.PERSIST.save();
}