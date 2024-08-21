if (process.platform !== "linux") {
    throw "only linux services.";
}

const fs = require('fs');
const cp = require('child_process');

cp.execSync("npm i");

let service = "" +
"[Unit]\n" +
"Description = Funkin Online React service\n" +
"After = network.target\n" +
"StartLimitIntervalSec = 0\n" +
"[Service]\n" +
"Type = simple\n" +
"Restart = always\n" +
"RestartSec = 1\n" +
"WorkingDirectory = " + __dirname + "\n" +
"ExecStart = npm start\n" +
"[Install]\n" +
"WantedBy = multi - user.target"
;

fs.writeFileSync('/etc/systemd/system/funkin-online-react.service', service, function (err) {
    if (err) throw err;
    console.log('Service created!');
    try {
        cp.execSync("systemctl stop funkin-online-react.service");
    } catch (exc) {}
    cp.execSync("systemctl start funkin-online-react.service");
});