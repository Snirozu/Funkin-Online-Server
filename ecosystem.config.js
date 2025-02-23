module.exports = {
    apps: [
        {
            port: 2567,
            name: "funkin-online",
            script: "build/index.js",
            watch: false,
            instances: 1,
            exec_mode: 'fork'
        }
    ]
}
