import { prisma } from "./network/database";
import { ServerInstance } from "./server"

process.on('uncaughtException', function (exception) {
    console.error(exception);
});

BigInt.prototype['toJSON'] = function () {
    return this.toString()
}

if (process.env["DEBUG_ENABLED"] == "true") {
    const log = console.log;
    console.log = function (...d) {
        log.apply(console, d);
        log(new Error().stack.split('\n')[2]);
    };
}

async function main() {
    try {
        await ServerInstance.init();
    }
    catch (exc) {
        console.error(exc);
    }
    finally {
        if (prisma)
            await prisma.$disconnect();
    }
}

void main();