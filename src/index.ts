import { listen } from "@colyseus/tools";
import app from "./app.config";
import * as fs from 'fs';
import dotenv from 'dotenv';
import { Data } from "./Data";
import { grantPlayerMod } from "./network";
import sanitizeHtml from 'sanitize-html';

if (!fs.existsSync("database/"))
    fs.mkdirSync("database/");
if (!fs.existsSync("database/avatars"))
    fs.mkdirSync("database/avatars");

if (fs.existsSync("database/day_players.json"))
    Data.DAY_PLAYERS = JSON.parse(fs.readFileSync("database/day_players.json", 'utf8'));
if (fs.existsSync("database/country_players.json"))
    Data.COUNTRY_PLAYERS = JSON.parse(fs.readFileSync("database/country_players.json", 'utf8'));

//load .env
dotenv.config();

sanitizeHtml.defaults.allowedTags.push('img');

// load email blacklist
Data.EMAIL_BLACKLIST = fs.readFileSync("EMAIL_BLACKLIST", 'utf8').split('\n');

// Create and listen on 2567 (or PORT environment variable.)
listen(app)
    .then(async server => {
        if (process.env["STATS_ENABLED"] == "true") {
            console.log("Stats are enabled")
        }

        if (process.env["NETWORK_ENABLED"] == "true") {
            console.log("Network is enabled")
        }

        if (process.env["GRANT_MODS"]) {
            for (const id of process.env["GRANT_MODS"].split(" ")) {
                try {
                    const player = await grantPlayerMod(id);
                    console.log(player.name + " is a mod!");
                }
                catch (exc) {
                }
            }
        }

        process.on('uncaughtException', function (exception) {
            console.error(exception);
        });
    })
    .catch(reason => {
        console.log("Server failed to start!");
        console.log(reason);
    });