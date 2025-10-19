import { getIDToken } from "./network/database";
import { getRequestIP } from "./util";
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

export function cooldownTo(uniqueId: string, timeSeconds: CooldownTime | number) {
    if (process.env["COOLDOWNS_ENABLED"] != "true")
        return;

    const curTime = secondsDateNow();

    if ((cooldownMap.get(uniqueId) ?? 0) >= curTime)
        return false;

    cooldownMap.set(uniqueId, curTime + timeSeconds);
    return true;
}

export function setCooldown(cooldownId: string, timeSeconds: CooldownTime | number) {
    cooldownTimes.set(cooldownId, timeSeconds);
}

export function cooldown(cooldownId: string, uniqueId: string) {
    if (!cooldownTimes.has(cooldownId))
        return true;

    return cooldownTo(cooldownId + '.' + uniqueId, cooldownTimes.get(cooldownId));
}

export function cooldownReq(req: any, cooldownId?:string) {
    const [id, token] = getIDToken(req);

    return cooldown(cooldownId ?? req.path, getRequestIP(req)) && ((id && token) ? cooldown(cooldownId ?? req.path, id + '::' + token) : true);
}

export function cooldownRequest(req: any, res: any, next: any) {
    if (cooldownReq(req)) {
        next();
        return;
    }

    return res.sendStatus(429);
}

export function cooldownRemaining(ids: string[]) {
    return Math.ceil((cooldownMap.get(ids.join('.')) ?? 0) - secondsDateNow());
}

export async function loadCooldownData() {
    if (fs.existsSync("database/cooldowns.json"))
        cooldownMap = new Map(Object.entries(JSON.parse(fs.readFileSync("database/cooldowns.json", 'utf8'))));
    await clearUp();
}

export async function saveAndCleanCooldownData() {
    fs.writeFileSync("database/cooldowns.json", JSON.stringify(Object.fromEntries(cooldownMap)));
    await clearUp();
}

export async function clearUp() {
    cooldownMap.forEach(((v, k) => {
        if (v < secondsDateNow()) {
            cooldownMap.delete(k);
        }
    }));
}