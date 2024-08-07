import { listen } from "@colyseus/tools";
import app from "./app.config";
import * as fs from 'fs';
import { Assets } from './Assets';
import dotenv from 'dotenv';
import { Data } from "./Data";
import { grantPlayerMod } from "./network";

// load files to memory
Assets.HTML_ROOMS = fs.readFileSync('assets/rooms.html', 'utf8');
Assets.HTML_HOME = fs.readFileSync('assets/index.html', 'utf8');
Assets.HTML_STATS = fs.readFileSync('assets/stats.html', 'utf8');
if (fs.existsSync("database/day_players.json"))
    Data.DAY_PLAYERS = JSON.parse(fs.readFileSync("database/day_players.json", 'utf8'));
if (fs.existsSync("database/country_players.json"))
    Data.COUNTRY_PLAYERS = JSON.parse(fs.readFileSync("database/country_players.json", 'utf8'));

//load .env
dotenv.config();

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
    })
    .catch(reason => {
        console.log("Server failed to start!");
        console.log(reason);
    });