import TimeAgo from "javascript-time-ago";
import en from 'javascript-time-ago/locale/en'

TimeAgo.addDefaultLocale(en);
export const timeAgo = new TimeAgo('en-US')

export function ordinalNum(num) {
    if (num % 10 === 1 && num !== 11)
        return num + 'st';
    if (num % 10 === 2 && num !== 12)
        return num + 'nd';
    if (num % 10 === 3 && num !== 13)
        return num + 'rd';
    return num + "th";
}

export function getHost() {
    return window.location.protocol + "//" + window.location.host;
}