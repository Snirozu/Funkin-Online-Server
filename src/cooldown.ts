import { getIDToken } from "./network/database";
// import { getRequestIP } from "./util";
import fs from 'fs';

export enum CooldownTime {
    MINUTE = 60,
    HOUR = 3600,
    DAY = 86400,
};

let cooldownMap:Map<string, number> = new Map();
const cooldownTimes: Map<string, number> = new Map();

function secondsDateNow() {
    return Date.now() / 1000;
}

export function cooldownToTime(entityId: string, timeSeconds: CooldownTime | number) {
    const curTime = secondsDateNow();

    if ((cooldownMap.get(entityId) ?? 0) >= curTime)
        return false;

    cooldownMap.set(entityId, curTime + timeSeconds);
    return true;
}

export function setCooldown(timerId: string, timeSeconds: CooldownTime | number) {
    cooldownTimes.set(timerId, timeSeconds);
}

export function cooldown(entityId: string, timerId: string) {
    if (!cooldownTimes.has(timerId))
        return true;

    return cooldownToTime(entityId + '.' + timerId, cooldownTimes.get(timerId));
}

export function cooldownReq(req: any, timerId?:string) {
    if (process.env["HTTP_COOLDOWNS_ENABLED"] != "true") {
        return true;
    }

    const [id, token] = getIDToken(req);

    //return cooldown(timerId ?? req.path, getRequestIP(req)) && ((id && token) ? cooldown(timerId ?? req.path, id + '::' + token) : true);
    return ((id && token) ? cooldown(id + '::' + token, timerId ?? req.path) : true);
}

export function cooldownRequest(req: any, res: any, next: any) {
    if (process.env["HTTP_COOLDOWNS_ENABLED"] != "true") {
        next();
        return;
    }
    
    if (cooldownReq(req)) {
        next();
        return;
    }

    return res.sendStatus(429);
}

export function cooldownLeft(ids: string[]) {
    return Math.ceil((cooldownMap.get(ids.join('.')) ?? secondsDateNow()) - secondsDateNow());
}

export async function clearCooldowns() {
    cooldownMap.clear();
    await saveAndCleanCooldownData();
}

export async function loadCooldownData() {
    if (fs.existsSync("database/cooldowns.json"))
        cooldownMap = new Map(Object.entries(JSON.parse(fs.readFileSync("database/cooldowns.json", 'utf8'))));
    await clearUp();
}

export async function saveAndCleanCooldownData() {
    await clearUp();
    fs.writeFileSync("database/cooldowns.json", JSON.stringify(Object.fromEntries(cooldownMap)));
}

export async function clearUp() {
    cooldownMap.forEach(((v, k) => {
        if (v < secondsDateNow()) {
            cooldownMap.delete(k);
        }
    }));
}