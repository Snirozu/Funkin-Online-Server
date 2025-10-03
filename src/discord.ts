import { ActivityType, Client, Events, GatewayIntentBits, MessageType, TextChannel } from 'discord.js';
import { logToAll } from './rooms/NetworkRoom';
import { intToHue } from './util';

export class DiscordBot {
    static networkChannel: TextChannel = null;
    static client: Client;

    static init() {
        DiscordBot.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], closeTimeout: 30000 });

        DiscordBot.client.once(Events.ClientReady, async readyClient => {
            console.log(`Ready! Logged in as ${readyClient.user.tag}`);
            DiscordBot.networkChannel = DiscordBot.client.channels.cache.get(process.env["DISCORD_NETWORK_CHANNEL_ID"]) as TextChannel;
            DiscordBot. client.user.setActivity('You', { type: ActivityType.Watching });
        });

        DiscordBot.client.on(Events.MessageCreate, async message => {
            if (!message.author.bot && message.channel.id === process.env["DISCORD_NETWORK_CHANNEL_ID"]) {
                let suffix = '';
                if (message.type == MessageType.Reply) {
                    suffix = ' (replying to @' + (await message.fetchReference()).author.username + ')';
                }
                logToAll(JSON.stringify({
                    content: '[DC] @' + message.author.username + suffix + ': ' + message.content,
                    hue: intToHue(message.member.displayColor),
                    date: message.createdAt.getTime(),
                    isPM: false
                }), true);
            }
        })

        DiscordBot.client.on(Events.Error, async message => {
            console.log('DISCORD ERROR: ' + message);
        });

        DiscordBot.client.login(process.env["DISCORD_TOKEN"]);
    }

    static async getWebhook() {
        if (!DiscordBot.networkChannel || !DiscordBot.client.isReady()) {
            try {
                await DiscordBot.client.destroy();
            } catch (_) {}
            DiscordBot.init();
        }

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

