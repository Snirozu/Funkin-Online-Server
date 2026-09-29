import { AuthContext } from "colyseus";
import { Data } from "./data";
import { GameRoom } from "./rooms/GameRoom";
import axios from "axios";
import { JSDOM } from "jsdom";
import { db } from "./database/db";

export async function fetchSizeForURLs(urls:string[]):Promise<number> {
    urls = sortDownloads(urls);
    for (const url of urls) {
        let head = await axios.head(url, {
            maxRedirects: 5,
            validateStatus: () => true,
        })

        const trueURL = await fetchTrueDownloadURL(head.config.url);
        if (head.config.url != trueURL) {
            head = await axios.head(trueURL, {
                maxRedirects: 5,
                validateStatus: () => true,
            })
        }

        if (head.status == 200 && head.headers.getContentLength) {
            return Number(head.headers["Content-Length"] ?? head.headers["content-length"]); // fine i guess
        }
    }
    return -1;
}

export async function fetchTrueDownloadURL(url: string) {
    if (url.startsWith('https://drive.google.com/file/d/')) {
        const gdriveId = url.substring("https://drive.google.com/file/d/".length).split("/")[0];
        return 'https://drive.usercontent.google.com/download?id=' + gdriveId + '&export=download&confirm=t';
    }

    if (url.startsWith('https://www.mediafire.com/file/')) {
        const res = await axios.get(url, {
            validateStatus: () => true
        })
        if (res.status != 200)
            return;

        const dom = new JSDOM(res.data);
        const doc = dom.window.document;
        const node = doc.querySelector('#downloadButton');
        if (node) {
            if (node.hasAttribute('data-scrambled-url'))
                return atob(node.getAttribute('data-scrambled-url'));

            if (node.hasAttribute('href'))
                return node.getAttribute('href');
        }
        return;
    }

    return url;
}

export function sortDownloads(urls: string[]) {
    urls = urls.concat();

    function getDownloadPriority(url: string) {
        if (url.startsWith('https://drive.google.com/file/d/')) {
            return 3;
        }
        if (url.startsWith('https://www.mediafire.com/file/')) {
            return 2;
        }
        if (url.startsWith('https://gamebanana.com/dl/')) {
            return 1;
        }
        return 0;
    }

    urls.sort((a, b) => {
        const pr1 = getDownloadPriority(a);
        const pr2 = getDownloadPriority(b);
        return pr1 == pr2 ? 0 : pr1 > pr2 ? -1 : 1;
    });

    return urls;
}

export function debugPrint(content: unknown) {
    if (process.env["DEBUG_ENABLED"] != "true") {
        return;
    }

    console.log(content);
}

export function validateEmail(email:string) {
    const emailHost = email.split('@')[1].trim();
    for (const v of Data.CONFIG.EMAIL_BLACKLIST) {
        const domain = v.split(' ')[0].trim();
        if (domain.trim().length > 0 && emailHost.endsWith(domain))
            return false;
    }
    return true;
}

export function matchWildcard(match:string, to:string) {
    let isNegative = false;
    if (to.startsWith('!')) {
        isNegative = true;
        to.substring(1);
    }
    const w = match.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${w.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
    return re.test(to) != isNegative;
}

export async function chunkifyArrayForCallback(array:any[], callback: (chunk: any[])=>void | Promise<void>, chunkSize:number = 100) {
    while (array.length > 0) {
        const chunk = array.splice(0, chunkSize);
        // try {
        await callback(chunk);
        // }
        // catch (exc) {
        //     console.error(exc);
        //     array = array.concat(chunk);
        //     continue;
        // }
    }
}

const songNameRegex = /[A-Z]|[a-z]|[0-9]/g;
const userNameRegex = /[^<>\r\n\t]+/g;

export function filterSongName(str:string) {
    return (str.match(songNameRegex) || []).join('');
}

export function filterUsername(str:string) {
    return (str.match(userNameRegex) || []).join('').trim();
}

export function getRequestIP(req: AuthContext) {
    if (Array.isArray(req.ip))
        return req.ip.toString();
    return req.ip;
}

export function formatLog(content:string, hue:number = null, isPM:boolean = false):string {
    return JSON.stringify({
        content: content, 
        hue: hue,
        date: Date.now(),
        isPM: isPM
    });
}

export function ordinalNum(num:number) {
    if (num % 10 === 1 && num !== 11)
        return num + 'st';
    if (num % 10 === 2 && num !== 12)
        return num + 'nd';
    if (num % 10 === 3 && num !== 13)
        return num + 'rd';
    return num + "th";
}

export async function isUserNameInRoom(userName:string, room?:GameRoom) {
    if (!room) room = Data.INFO.MAP_USERNAME_PLAYINGROOM.get(userName);
    return await isUserIDInRoom(await db.users.getIDByName(userName), room);
}

export async function isUserIDInRoom(userID: string, room?: GameRoom) {
    if (!room) room = Data.INFO.MAP_USERNAME_PLAYINGROOM.get(await db.users.getNameByID(userID));
    return room && room.clients.length > 0 && findPlayerSIDByNID(room, userID);
}

export function findPlayerSIDByNID(room: GameRoom, networkId: string) {
    for (const [clientSessionId, info] of room.clientsInfo) {
        if (info.networkId == networkId)
            return clientSessionId;
    }
    return null;
}

export function hasValue(map: Map<any, any>, value: any) {
    for (const v of map.values()) {
        if (v == value)
            return true;
    }
    return false;
}

export function intToHue(num:number) {
    num >>>= 0;
    const b = num & 0xFF,
        g = (num & 0xFF00) >>> 8,
        r = (num & 0xFF0000) >>> 16;

    const cMax = Math.max(r, g , b);
    const cMin = Math.min(r, g, b);

    if (cMax == r)
        return 60 * ((g - b) / (cMax - cMin));
    if (cMax == g)
        return 60 * (2.0 + (b - r) / (cMax - cMin));

    // cMax is b
    return 60 * (4.0 + (r - g) / (cMax - cMin));
}

export function hasOnlyLettersAndNumbers(str:string) {
    return /^[A-Za-z0-9]*$/.test(str);
}

export function removeFromArray(arr:any[], item:any) {
    const index = arr.indexOf(item, 0);
    if (index == -1)
        return arr;
    arr.splice(index, 1);
    return arr;
}

export function filterChatMessage(msg:string) {
    msg = msg.replaceAll('\n', ' ');

    const words = [];
    for (const word of msg.split(' ')) {
        const filter = Data.CONFIG.CHAT_FILTER.get(word.toLowerCase());
        words.push(filter ?? word);
    }
    return words.join(' ');
}

export function isOnlyOneEmoji(s) {
    const withEmojis = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
    return withEmojis.test(s);
}

export function isObjectEmpty(obj: any) {
    if (obj == null || obj == undefined || obj == "undefined" || obj == "null")
        return true;

    if (Object.prototype.toString.call(obj) === '[object Object]') {
        for (const [_, value] of Object.entries(obj)) {
            if (!isObjectEmpty(value)) {
                return false;
            }
        }
        return true;
    }

    return false;
}

export const validCountries = [
    null,
    'AF',
    'AX',
    'AL',
    'DZ',
    'AS',
    'AD',
    'AO',
    'AI',
    'AG',
    'AR',
    'AM',
    'AW',
    'AU',
    'AT',
    'AZ',
    'BS',
    'BH',
    'BD',
    'BB',
    'BY',
    'BE',
    'BZ',
    'BJ',
    'BM',
    'BT',
    'BO',
    'BA',
    'BW',
    'BV',
    'BR',
    'IO',
    'BN',
    'BG',
    'BF',
    'BI',
    'KH',
    'CM',
    'CA',
    'CV',
    'KY',
    'CF',
    'TD',
    'CL',
    'CN',
    'CX',
    'CC',
    'CO',
    'KM',
    'CG',
    'CD',
    'CK',
    'CR',
    'CI',
    'HR',
    'CU',
    'CY',
    'CZ',
    'DK',
    'DJ',
    'DM',
    'DO',
    'EC',
    'EG',
    'SV',
    'GQ',
    'ER',
    'EE',
    'ET',
    'FK',
    'FO',
    'FJ',
    'FI',
    'FR',
    'GF',
    'PF',
    'TF',
    'GA',
    'GM',
    'GE',
    'DE',
    'GH',
    'GI',
    'GR',
    'GL',
    'GD',
    'GP',
    'GU',
    'GT',
    'GG',
    'GN',
    'GW',
    'GY',
    'HT',
    'HM',
    'HN',
    'HK',
    'HU',
    'IS',
    'IN',
    'ID',
    'IR',
    'IQ',
    'IE',
    'IM',
    'IT',
    'JM',
    'JP',
    'JE',
    'JO',
    'KZ',
    'KE',
    'KI',
    'KR',
    'KW',
    'KG',
    'LA',
    'LV',
    'LB',
    'LS',
    'LR',
    'LY',
    'LI',
    'LT',
    'LU',
    'MO',
    'MK',
    'MG',
    'MW',
    'MY',
    'MV',
    'ML',
    'MT',
    'MH',
    'MQ',
    'MR',
    'MU',
    'YT',
    'MX',
    'FM',
    'MD',
    'MC',
    'MN',
    'ME',
    'MS',
    'MA',
    'MZ',
    'MM',
    'NA',
    'NR',
    'NP',
    'NL',
    'AN',
    'NC',
    'NZ',
    'NI',
    'NE',
    'NG',
    'NU',
    'NF',
    'MP',
    'NO',
    'OM',
    'PK',
    'PW',
    'PS',
    'PA',
    'PG',
    'PY',
    'PE',
    'PH',
    'PN',
    'PL',
    'PT',
    'PR',
    'QA',
    'RE',
    'RO',
    'RU',
    'RW',
    'BL',
    'SH',
    'KN',
    'LC',
    'MF',
    'PM',
    'VC',
    'WS',
    'SM',
    'ST',
    'SA',
    'SN',
    'RS',
    'SC',
    'SL',
    'SG',
    'SK',
    'SI',
    'SB',
    'SO',
    'ZA',
    'GS',
    'ES',
    'LK',
    'SD',
    'SR',
    'SJ',
    'SZ',
    'SE',
    'CH',
    'SY',
    'TW',
    'TJ',
    'TZ',
    'TH',
    'TL',
    'TG',
    'TK',
    'TO',
    'TT',
    'TN',
    'TR',
    'TM',
    'TC',
    'TV',
    'UG',
    'UA',
    'AE',
    'GB',
    'US',
    'UM',
    'UY',
    'UZ',
    'VU',
    'VA',
    'VE',
    'VN',
    'VG',
    'VI',
    'WF',
    'EH',
    'YE',
    'ZM',
    'ZW',
];