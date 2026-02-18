import { ActivityType, BaseMessageOptions, Client, Collection, Events, GatewayIntentBits, MessagePayload, MessageType, REST, Routes, SlashCommandBuilder, TextChannel, WebhookMessageCreateOptions } from 'discord.js';
import { NetworkRoom } from './rooms/NetworkRoom';
import { intToHue } from './util';

//add timed matchmaking role for 30 minutes

interface ClientWithCommands extends Client {
    commands: Collection<string, SlashCommandBuilder>
}

export class DiscordBot {
    private static networkChannel: TextChannel = null;
    private static client: ClientWithCommands;

    static async init() {
        //initialize the client and basic stuff before it starts anything
        DiscordBot.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], closeTimeout: 30000 }) as ClientWithCommands;

        DiscordBot.client.once(Events.ClientReady, async readyClient => {
            console.log(`Ready! Logged in as ${readyClient.user.tag}`);
            DiscordBot.networkChannel = DiscordBot.client.channels.cache.get(process.env["DISCORD_NETWORK_CHANNEL_ID"]) as TextChannel;
            DiscordBot. client.user.setActivity('You', { type: ActivityType.Watching });
        });

        DiscordBot.client.on(Events.Error, async message => {
            console.log('DISCORD ERROR: ');
            console.error(message);
        });

        await DiscordBot.client.login(process.env["DISCORD_TOKEN"]);

        //listen for messages to forward from discord to the network chat

        DiscordBot.client.on(Events.MessageCreate, async message => {
            if (!message.author.bot && message.channel.id === process.env["DISCORD_NETWORK_CHANNEL_ID"]) {
                let suffix = '';
                if (message.type == MessageType.Reply) {
                    suffix = ' (replying to @' + (await message.fetchReference()).author.username + ')';
                }
                await NetworkRoom.logToAll(JSON.stringify({
                    content: '[DC] @' + message.author.username + suffix + ': ' + message.content,
                    hue: intToHue(message.member.displayColor),
                    date: message.createdAt.getTime(),
                    isPM: false
                }), true);
            }
        })

        //register commands, this is oversimplified for the sake of readibility lol

        DiscordBot.client.commands = new Collection();

        const matchmakeCommand = new SlashCommandBuilder().setName('matchmake').setDescription('Gives you a pingable @Matchmaking role for an hour.');;
        DiscordBot.client.commands.set(matchmakeCommand.name, matchmakeCommand);

        const rest = new REST().setToken(process.env["DISCORD_TOKEN"]);
        const commands = [];
        for (const [_, cmd] of DiscordBot.client.commands) {
            commands.push(cmd.toJSON());
        }
        await rest.put(Routes.applicationCommands(process.env["DISCORD_APP_ID"]), { body: commands });

        // now listen for interaction with them

        const remMatchmakeRoleTimeout = new Map();

        DiscordBot.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            if (interaction.commandName === 'matchmake') {
                const guild = await DiscordBot.client.guilds.fetch(process.env["DISCORD_GUILD_ID"]);
                const role = await guild.roles.fetch(process.env["DISCORD_MATCHMAKING_ROLE_ID"]);
                const member = await guild.members.fetch({ user: interaction.user, force: true }); // force is true so it refreshes the cache

                if (!role || !member) {
                    return interaction.reply('Error occured with fetching user or role.');
                }

                clearInterval(remMatchmakeRoleTimeout.get(member.id));

                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                    await interaction.reply({ content: 'Removed!' });
                }
                else {
                    await member.roles.add(role);
                    if (interaction.guildId == process.env["DISCORD_GUILD_ID"]) {
                        await interaction.reply({ content: '<@&' + role.id + '> <@' + member.id + '> is now looking to play!' });
                    }
                    else {
                        await interaction.reply({ content: 'Gave you the matchmaking role! (silently....)' });
                    }
                    remMatchmakeRoleTimeout.set(member.id, setTimeout(async () => {
                        await member.roles.remove(role);
                    }, 1000 * 60 * 30));
                }
            }
        });
    }

    static async sendNetworkMessage(content:string) {
        content = DiscordBot.filterText(content);
        await DiscordBot.networkChannel.send(content);
    }

    static async sendWebhookMessage(options: WebhookMessageCreateOptions) {
        options.content = DiscordBot.filterText(options.content);
        await (await DiscordBot.getWebhook()).send(options);
    }

    static filterText(content:string) {
        content = content.replaceAll('<@', '?');
        content = content.replaceAll('@everyone', '?');
        content = content.replaceAll('@here', '?');
        return content;
    }

    private static async getWebhook(channel?:TextChannel) {
        if (!channel)
            channel = DiscordBot.networkChannel;

        if (!channel || !DiscordBot.client.isReady()) {
            try {
                await DiscordBot.client.destroy();
            } catch (exc) {
                console.error(exc);
            }
            await DiscordBot.init();
        }

        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.token);

        if(!webhook) {
            webhook = await channel.createWebhook({
                name: 'Psych Online Weeb-Hook',
                avatar: ''
            });
        }

        return webhook;
    }

    static async tryAlive() {
        if (!DiscordBot.networkChannel || !DiscordBot.client.isReady()) {
            try {
                await DiscordBot.client.destroy();
            } catch (exc) {
                console.error(exc);
            }
            await DiscordBot.init();
        }
    }
}

