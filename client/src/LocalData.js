export const localData = {
    getBool(key, defaultValue) {
        return (localStorage.getItem(key) ?? (defaultValue ? "true" : "false")) === "true";
    },
    setBool(key, value) {
        return localStorage.setItem(key, value ? 'true' : 'false');
    },
    getString(key, defaultValue) {
        return localStorage.getItem(key) ?? defaultValue;
    },
    setString(key, value) {
        return localStorage.setItem(key, value);
    }
}