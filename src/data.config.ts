import toml from 'toml';
import fs from 'fs';
import { grantPlayerRole } from './network/database';

// server configuration
// read-only data

export class ConfigData {
    public EMAIL_BLACKLIST: string[] = [];
    public ROLES: Map<string, Role>;
    public DEFAULT_ROLE: string = null;
    public CHAT_FILTER: Map<string, string> = new Map<string, string>();

    async load() {
        this.EMAIL_BLACKLIST = fs.readFileSync("EMAIL_BLACKLIST", 'utf8').split('\n');
        
        if (fs.existsSync("chat_filter.json")) {
            const chatFilterData = JSON.parse(fs.readFileSync("chat_filter.json", 'utf8'));
            for (const [key, value] of Object.entries(chatFilterData)) {
                this.CHAT_FILTER.set(key, value as string);
            }
        }

        const props: ConfigProps = toml.parse(fs.readFileSync("config.toml", 'utf8'));

        this.ROLES = new Map();

        for (const role of props.roles) {
            const newRole = new Role();
            newRole.access = role.access;
            newRole.priority = role.priority;
            newRole.extends = role.extends;
            this.ROLES.set(role.name, newRole);
            if (role.default) {
                this.DEFAULT_ROLE = role.name;
            }
        }

        for (const role of props.roles) {
            if (role.extends) {
                this._extendDong(this.ROLES.get(role.name), this.ROLES.get(role.extends));
            }
        }

        for (const user of props.users) {
            await grantPlayerRole(user.name, user.role);
        }

        return this.ROLES;
    }

    _extendDong(role: Role, to: Role) {
        if (to.access)
            role.access = role.access.concat(to.access);

        if (to.extends)
            this._extendDong(role, this.ROLES.get(to.extends));
    }
}

export class ConfigProps {
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