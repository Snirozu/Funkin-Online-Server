import { ActivityType, Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { logToAll } from './rooms/NetworkRoom';
import { intToHue } from './util';

export class DiscordBot {
    static networkChannel: TextChannel = null;

    static init() {
        const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

        client.once(Events.ClientReady, async readyClient => {
            console.log(`Ready! Logged in as ${readyClient.user.tag}`);
            DiscordBot.networkChannel = client.channels.cache.get(process.env["DISCORD_NETWORK_CHANNEL_ID"]) as TextChannel;
            client.user.setActivity('You', { type: ActivityType.Watching });
        });

        client.on(Events.MessageCreate, async message => {
            if (!message.author.bot && message.channel.id === process.env["DISCORD_NETWORK_CHANNEL_ID"]) {
                logToAll(JSON.stringify({
                    content: '[DC] @' + message.author.username + ': ' + message.content,
                    hue: intToHue(message.member.displayColor),
                    date: message.createdAt.getTime(),
                    isPM: false
                }), true);
            }
        })

        client.login(process.env["DISCORD_TOKEN"]);
    }

    static async getWebhook() {
        const webhooks = await DiscordBot.networkChannel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.token);

        if(!webhook) {
            webhook = await DiscordBot.networkChannel.createWebhook({
                name: 'Psych Online Weeb-Hook',
                avatar: ''
            });
        }

        return webhook;
    }
}

