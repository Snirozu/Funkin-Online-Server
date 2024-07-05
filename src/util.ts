export function filterSongName(str:string) {
    var re = /[A-Z]|[a-z]|[0-9]/g;
    return (str.match(re) || []).join('');
}

export function filterUsername(str:string) {
    var re = /[^<>\r\n\t]+/g;
    return (str.match(re) || []).join('');
}