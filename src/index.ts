import { listen } from "@colyseus/tools";
import app from "./app.config";
import fs from 'fs';
import dotenv from 'dotenv';
import { Data, PublicData } from "./Data";
import { initDatabaseCache, prisma } from "./network";
import sanitizeHtml from 'sanitize-html';
import { loadConfig } from "./Config";
import { DiscordBot } from "./discord";
import { initNetworkExpress } from "./networkSite";
import express from 'express';

BigInt.prototype['toJSON'] = function () {
    return this.toString()
}

process.on('uncaughtException', function (exception) {
    console.error(exception);
});

process.on('exit', () => {
    console.log('Saving PublicData...');
    fs.writeFileSync("database/public_data.json", JSON.stringify(Data.PUBLIC));
    console.log('Done!');
});

if (!fs.existsSync("database/"))
    fs.mkdirSync("database/");

Data.PUBLIC = new PublicData();
if (fs.existsSync("database/public_data.json"))
    Data.PUBLIC = JSON.parse(fs.readFileSync("database/public_data.json", 'utf8'));
if (fs.existsSync("database/day_players.json"))
    Data.DAY_PLAYERS = JSON.parse(fs.readFileSync("database/day_players.json", 'utf8'));
if (fs.existsSync("database/country_players.json"))
    Data.COUNTRY_PLAYERS = JSON.parse(fs.readFileSync("database/country_players.json", 'utf8'));

//load .env
dotenv.config();

sanitizeHtml.defaults.allowedTags.push('img');

// load email blacklist
Data.EMAIL_BLACKLIST = fs.readFileSync("EMAIL_BLACKLIST", 'utf8').split('\n');

// load config
loadConfig();

// prisma refuses to work when not in the main() function, why? idk
async function main() {
    try {
        // Create and listen on 2567 (or PORT environment variable.)
        listen(app)
            .then(async server => {
                if (process.env["STATS_ENABLED"] == "true") {
                    console.log("Stats are enabled")
                }

                if (process.env["NETWORK_ENABLED"] == "true") {
                    console.log("Network is enabled")
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

                if (process.env["DATABASE_URL"]) {
                    await initDatabaseCache();
                }

                if (process.env["DISCORD_TOKEN"]) {
                    DiscordBot.init();
                    setInterval(async () => {
                        if (!DiscordBot.networkChannel || !DiscordBot.client.isReady()) {
                            try {
                                await DiscordBot.client.destroy();
                            } catch (_) { }
                            DiscordBot.init();
                        }
                    }, 1000 * 60);
                }

                if (process.env["SITE_ENABLED"] == "true") {
                    // const app = express();
                    // initNetworkExpress(app);
                    // app.listen(3000, () => {
                    //     console.log("Site is enabled")
                    // });
                }
            })
            .catch(reason => {
                console.log("Server failed to start!");
                console.log(reason);
            });
    } catch (e) {
        console.error(e);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())