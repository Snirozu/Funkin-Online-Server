import { defineServer, defineRoom, matchMaker } from "colyseus";

//import { monitor } from "@colyseus/monitor";
//import { playground } from "@colyseus/playground";

import { initExpress } from "./site";
import { GameRoom } from "./rooms/GameRoom";
import { NetworkRoom } from "./rooms/NetworkRoom";
import { setCooldown } from "./cooldown";

function registerRooms() {
    let rooms = {
        room: defineRoom(GameRoom)
    };
    if (process.env["NETWORK_ENABLED"] == "true") {
        rooms["network"] = defineRoom(NetworkRoom);
    }
    return rooms;
}

export default defineServer({
    rooms: registerRooms(),
    express: async (app) => {
        await initExpress(app);
        console.log('Express initialized');
    },
    greet: false,
    async beforeListen() {
        setCooldown('command.report', 30);
        if (process.env["NETWORK_ENABLED"] == "true") {
            await matchMaker.createRoom("network", {});
        }
    },
});