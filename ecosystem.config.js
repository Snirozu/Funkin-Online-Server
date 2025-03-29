module.exports = {
    apps: [
        {
            port: 2567,
            name: "funkin-online",
            script: "build/index.js",
            watch: [
                "src/",
                "assets/",
                "nodemon.json",
                ".env",
                "EMAIL_BLACKLIST",
                "build/"
            ],
            watch_delay: 1000,
            instances: 1,
            exec_mode: 'fork'
        }
    ]
}
