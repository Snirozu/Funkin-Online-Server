import fs from 'fs';

export class PersistentData {
    public props: PersistentDataProps;

    load() {
        if (fs.existsSync("database/public_data.json"))
            this.props = JSON.parse(fs.readFileSync("database/public_data.json", 'utf8'));
        else
            this.props = new PersistentDataProps();

        if (!this.props.NEXT_WEEKLY_DATE) {
            this.props.NEXT_WEEKLY_DATE = Date.now();
            this.save();
        }
    }

    save() {
        fs.writeFileSync("database/public_data.json", JSON.stringify(this.props));
    }
}

class PersistentDataProps {
    public FRONT_MESSAGES: SezData[] = [];
    public LOGGED_MESSAGES: Array<Array<any>> = []; // array<any> is [content, unix_timestamp]
    public NEXT_WEEKLY_DATE: number;
    public LOGGED_MOD_ACTIONS: string[] = [];
}

class SezData {
    player: string
    message: string
}