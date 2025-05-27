module.exports = {
    apps: [
        {
            port: 2567,
            name: "funkin-online",
            script: "build/index.js",
            watch: [
                "assets/",
                "nodemon.json",
                ".env",
                "EMAIL_BLACKLIST",
                "build/",
                "config.toml",
            ],
            watch_delay: 1000,
            instances: 1,
            exec_mode: 'fork'
        }
    ]
}
