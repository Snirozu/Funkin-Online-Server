export function filterSongName(str:string) {
    var re = /[A-Z]|[a-z]|[0-9]/g;
    return (str.match(re) || []).join('');
}

export function filterUsername(str:string) {
    var re = /[^<>\r\n\t]+/g;
    return (str.match(re) || []).join('').trim();
}

export function formatLog(content:string, hue:number = null):string {
    return JSON.stringify({
        content: content, 
        hue: hue
    });
}