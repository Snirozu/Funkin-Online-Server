import { listen } from "@colyseus/tools";
import app from "./colyseus.app";
import dotenv from 'dotenv';
import { initDatabaseCache } from "./network/database";
import { DiscordBot } from "./discord";
import { Data } from "./data";
import ip from 'ip';

export class ServerInstance {
    public static PROTOCOL_VERSION = 9;
    public static NETWORK_PROTOCOL_VERSION = 8;

    static async init() {
        console.log('\n⌚ Starting the Psych Online server...\n');
        //load .env
        dotenv.config();

        await Data.init();

        try {
            if (process.env["DISCORD_TOKEN"]) {
                await DiscordBot.init();

                setInterval(async () => {
                    if (!DiscordBot.networkChannel || !DiscordBot.client.isReady()) {
                        try {
                            await DiscordBot.client.destroy();
                        } catch (exc) {
                            console.error(exc);
                        }
                        await DiscordBot.init();
                    }
                }, 1000 * 60);
            }

            if (process.env["DATABASE_URL"]) {
                await initDatabaseCache();
            }
        
            // if (process.env["GRANT_MODS"]) {
            //     for (const id of process.env["GRANT_MODS"].split(" ")) {
            //         try {
            //             const player = await grantPlayerMod(id);
            //             console.log(player.name + " is a mod!");
            //         }
            //         catch (exc) {
            //         }
            //     }
            // }

            // Create and listen on 2567 (or PORT environment variable.)
            await listen(app);

            const localAddress = ip.address();

            console.log('\n❕ Your local server address is: ws://' + localAddress + ':' + (process.env.PORT ?? 2567));
        } 
        catch (e) {
            console.log("Server failed to start!");
            console.error(e);
        }
    }
}