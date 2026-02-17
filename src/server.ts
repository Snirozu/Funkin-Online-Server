import { listen } from "@colyseus/tools";
import app from "./colyseus.app";
import dotenv from 'dotenv';
import { initDatabaseCache } from "./network/database";
import { DiscordBot } from "./discord";
import { Data } from "./data";
import ip from 'ip';
import { saveAndCleanCooldownData } from "./cooldown";
import { Encoder } from "@colyseus/schema";

export class ServerInstance {
    public static PROTOCOL_VERSION = 11;
    public static NETWORK_PROTOCOL_VERSION = 8;

    static async init() {
        console.log('\n⌚ Starting the Psych Online server...\n');
        //load .env
        dotenv.config();

        await Data.init();

        process.on('exit', function () {
            void saveAndCleanCooldownData();
            console.log('Saved cooldown data!');
        });

        // every 30s save cooldowns
        setInterval(async () => {
            await saveAndCleanCooldownData();
        }, 1000 * 30);

        Encoder.BUFFER_SIZE = 16 * 1024;

        try {
            if (process.env["DISCORD_TOKEN"]) {
                await DiscordBot.init();

                setInterval(async () => {
                    await DiscordBot.tryAlive();
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