import config from "@colyseus/tools";
//import { monitor } from "@colyseus/monitor";
//import { playground } from "@colyseus/playground";

import { GameRoom } from "./rooms/GameRoom";
import { matchMaker } from "colyseus";
import { NetworkRoom } from "./rooms/NetworkRoom";
import { initExpress } from "./site";

export default config({
    initializeGameServer: async (gameServer) => {
        gameServer.define('room', GameRoom);
    
        if (process.env["NETWORK_ENABLED"] == "true") {
            gameServer.define('network', NetworkRoom);
            await matchMaker.createRoom("network", {});
        }
    },
    initializeExpress: async (app) => {
        await initExpress(app);
        console.log('Express initialized');
    },
    options: {
        greet: false
    },
    displayLogs: false
});

