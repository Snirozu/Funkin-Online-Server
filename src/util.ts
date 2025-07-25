import { Data } from "./Data";
import { getPlayerIDByName, getPlayerNameByID } from "./network";
import { GameRoom } from "./rooms/GameRoom";

export function filterSongName(str:string) {
    var re = /[A-Z]|[a-z]|[0-9]/g;
    return (str.match(re) || []).join('');
}

export function filterUsername(str:string) {
    var re = /[^<>\r\n\t]+/g;
    return (str.match(re) || []).join('').trim();
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
    if (!room) room = Data.MAP_USERNAME_PLAYINGROOM.get(userName);
    return await isUserIDInRoom(await getPlayerIDByName(userName), room);
}

export async function isUserIDInRoom(userID: string, room?: GameRoom) {
    if (!room) room = Data.MAP_USERNAME_PLAYINGROOM.get(await getPlayerNameByID(userID));
    return room && room.clients.length > 0 && findPlayerSIDByNID(room, userID);
}

export function findPlayerSIDByNID(room: GameRoom, networkId: any) {
    for (const [clientSessionId, info] of room.clientsInfo) {
        if (info.networkId == networkId)
            return clientSessionId;
    }
    return null;
}

export function hasValue(map:Map<any, any>, value:any) {
    for (const v of map.values()) {
        if (v == value)
            return true;
    }
    return false;
}

export function intToHue(num:number) {
    num >>>= 0;
    var b = num & 0xFF,
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