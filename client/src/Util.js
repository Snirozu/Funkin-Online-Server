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
    return "https://funkin.sniro.boo";
    if (window.location.hostname === "localhost") {
        return "http://localhost:2567";
    }
    return window.location.protocol + "//" + window.location.host;
}

export function headProfileColor(hue) {
    return "hsl(" + hue + ",20%,30%)";
}

export function contentProfileColor(hue) {
    return "hsl(" + hue + ",20%,20%)";
}

export function textProfileColor(hue) {
    return "hsl(" + hue + ",65%,80%)";
}

export function textProfileRow(hue, alt) {
    if (alt)
        return "hsl(" + hue + ",10%,18%)";
    return "hsl(" + hue + ",10%,22%)";
}