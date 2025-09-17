import config from "@colyseus/tools";
//import { monitor } from "@colyseus/monitor";
//import { playground } from "@colyseus/playground";

/**
 * Import your Room files
 */
import { GameRoom } from "./rooms/GameRoom";
import { matchMaker } from "colyseus";
import { NetworkRoom } from "./rooms/NetworkRoom";
import { initNetworkExpress } from "./networkSite";

export default config({

    initializeGameServer: async (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('room', GameRoom);
        if (process.env["NETWORK_ENABLED"] == "true") {
            gameServer.define('network', NetworkRoom);
            await matchMaker.createRoom("network", {});
        }
    },

    initializeExpress: (app) => {
        initNetworkExpress(app);
        // app.get('*', (req, res) => {
        //     res.sendStatus(200);
        // });
    },

    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});

