import toml from 'toml';
import fs from 'fs';
import { grantPlayerRole } from './network';

export var ROLES: Map<String, Role>;
export var DEFAULT_ROLE: string = null;

export class ConfigData {
    public roles: Array<RoleData>;
    public users: Array<UserData>;
}

export class UserData {
    public name: string;
    public role: string;
}

export class RoleData {
    public name: string;
    public access: string[];
    public extends: string;
    public priority: number;
    public default: boolean;
}

export class Role {
    public access: string[];
    public priority: number;
    public extends: string;
}

export function loadConfig() {
    const data: ConfigData = toml.parse(fs.readFileSync("config.toml", 'utf8'));

    ROLES = new Map();

    for (const role of data.roles) {
        let newRole = new Role();
        newRole.access = role.access;
        newRole.priority = role.priority;
        newRole.extends = role.extends;
        ROLES.set(role.name, newRole);
        if (role.default) {
            DEFAULT_ROLE = role.name;
        }
    }

    function extendDong(role: Role, to: Role) {
        if (to.access)
            role.access.concat(to.access);

        if (to.extends)
            extendDong(role, ROLES.get(to.extends));
    }

    for (const role of data.roles) {
        if (role.extends)
            extendDong(ROLES.get(role.name), ROLES.get(role.extends));
    }

    for (const user of data.users) {
        grantPlayerRole(user.name, user.role);
    }

    return ROLES;
}