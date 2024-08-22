//Establish constants
const config = require('./config.js');
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, REST, Routes } = require('discord.js');

const fs = require('fs')
const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
});
// Liste des permissions mises à jour
const permissions = [
    PermissionsBitField.Flags.Administrator,
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.AddReactions,
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.SendTTSMessages,
    PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.MentionEveryone,
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
    PermissionsBitField.Flags.MoveMembers,
    PermissionsBitField.Flags.UseVAD,
    PermissionsBitField.Flags.ChangeNickname,
    PermissionsBitField.Flags.ManageRoles
];
const version = "0.1"
var timerInterval;
var channelActivityInterval;
var sudoMode = [];
//Used for retrieving the client secret environment variable
require('dotenv').config();

//Called when there is an error.
function logError(ERROR, ERROR_CONTENT, GUILD_ID) {
    // Crée le fichier s'il n'existe pas
    if (!fs.existsSync("log.txt")) {
        fs.writeFileSync("log.txt", '');
    }
    fs.appendFileSync("log.txt","\r\n***ERROR***\r\n")
    fs.appendFileSync("log.txt","Guild ID: " + GUILD_ID + "\r\n")
    fs.appendFileSync("log.txt","Friendly error message: " + ERROR + "\r\n")
    fs.appendFileSync("log.txt","Technical info: " + ERROR_CONTENT + "\r\n")

    //Log the error in the console
    console.log("ERROR: " + ERROR)
}
//Allows an admin to set various options
// function setOption(MESSAGE) {
//     if (MESSAGE.channel.guild.ownerID !== MESSAGE.author.id) {
//         return
//     }
//     var PARAMS = MESSAGE.content.split(' ').slice(1);
//     if (PARAMS.length != 2) {
//         MESSAGE.reply('Sorry that didn\'t work. Did you type the command like this: `!lfgset <SETTING> <VALUE>`')
//         return;
//     }
//     config.setSetting(PARAMS[0], MESSAGE.guild.id, PARAMS[1]).then(RESULT => {
//         MESSAGE.reply(`Success.\n Changed **${PARAMS[0]}** to **${PARAMS[1]}**.`);
//     }).catch(err => {
//         if (err == "NONEXISTANT") {
//             MESSAGE.reply('The setting you tried to change does not exist.');
//         } else {
//             MESSAGE.reply(`Error.\n **${PARAMS[0]}** could not be added.`);
//             if (err != false) {
//                 MESSAGE.reply(err);
//             }
//         }
//     });
// }
//Allow administrators to add games
async function addGame(interaction) {
    // Verify if the user is an administrator
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply('You do not have permission to use this command.');
        return;
    }

    // Get the parameters of the command
    const LIMIT = interaction.options.getInteger('limit'); // Suppose que l'option de commande slash est nommée 'limit'
    const GAME = interaction.options.getString('game'); // Suppose que l'option de commande slash est nommée 'game'
    
    // Validation of the parameters
    if (LIMIT < 2 || LIMIT >= 99) {
        await interaction.reply('Sorry, player limit must be between 2 and 98.');
        return;
    }

    // Makes sure the game name is alphanumerical
    if (GAME.match(/[^a-zA-Z0-9_\-\s]/)) {
        await interaction.reply('Sorry, due to Discord limitations game names must be alphanumerical. Names can also contain dashes/underscores.');
        return;
    }

    // Stores the game in the guild's DB
    try {
        await config.addGame(interaction.guild.id, GAME, LIMIT);
        await interaction.reply(`Success.\n Added **${GAME}** (max. **${LIMIT} players**) to the verified games list.`);
    } catch (err) {
        // Log the error
        logError(`Failed to add game "${GAME}" to the games list.`, err, interaction.guild.id);
        await interaction.reply('There was an error. Try again or contact the bot operators.');
    }
}

//Removes a game from the list of approved games
async function removeGame(interaction) {
    // Verify if the user is an administrator
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply('You do not have permission to use this command.');
        return;
    }

    // Establish the game name parameter
    const GAME = interaction.options.getString('game'); // Suppose que l'option de commande slash est nommée 'game'

    // Attempt to remove the game from the list
    try {
        const result = await config.removeGame(interaction.guild.id, GAME);
        if (result) {
            // Operation was successful
            await interaction.reply(`Success.\n **${GAME}** has been removed from the verified list.`);
        } else {
            // The game was not in the list
            await interaction.reply(`Error.\n **${GAME}** is not in the verified list.`);
        }
    } catch (err) {
        // There was an error during the operation
        await interaction.reply(`There was an error trying to remove **${GAME}** from the list. Please try again later.`);
    }
}

// La fonction help qui explique toutes les commandes disponibles
async function help(interaction) {
    await interaction.reply({
        content: `Here are my available commands:
        \`/lfg GAMENAME\`  - Creates a new guild
        \`/kill\`  - Kills the bot
        \`/add_game PLAYERLIMIT GAMENAME\`  - Add a new playable game
        \`/remove_game PLAYERLIMIT\`  - Remove a playable game
        \`/end_session\`  - Terminate a currently active session (must be run in the session's text channel)
        \`/games\`  - Shows all games playable
        \`/sessions\`  - Shows all active sessions
        \`/purge\`  - Removes all data associated with this server
        \`/clean_roles\`  - Removes all roles related to LFG
        \`/clean_sessions\`  - Removes all LFG sessions
        \`/about\`  - Provides information about the bot
        \`/help\`  - Shows this dialog (help). You already knew that.`,
        ephemeral: true // Optionnel, permet de rendre la réponse visible uniquement pour l'utilisateur qui a exécuté la commande
    });
}

// Donne des informations à l'utilisateur sur le bot
async function about(interaction) {
    await interaction.reply({
        content: `LookingForGroup v${version}
        Developed by the LFG development team.
        https://github.com/starsky135/LookingForGroup
        We <3 Discord!`,
        ephemeral: true
    });
}

// Liste tous les jeux que l'utilisateur peut choisir
async function showGames(interaction) {
    const gamesObject = config.getGames(interaction.guild.id);
    const gamesObjectKeys = Object.keys(gamesObject);

    if (gamesObjectKeys.length === 0) {
        return await interaction.reply({
            content: 'No games available.',
            ephemeral: true
        });
    }

    let allGames = 'Here are all the available games:';
    gamesObjectKeys.forEach((key, index) => {
        allGames += `\n**${key}** (max. ${gamesObject[key].LIMIT} players)`;
        if (index < gamesObjectKeys.length - 1) {
            allGames += ', ';
        }
    });

    await interaction.reply(allGames);
}

// Liste toutes les sessions en cours
async function showSessions(interaction) {
    const sessionsArray = config.getSessions(interaction.guild.id);

    if (sessionsArray.length === 0) {
        return await interaction.reply({
            content: 'No sessions in progress.',
            ephemeral: true
        });
    }

    let allSessions = 'Here are all the available sessions:';
    sessionsArray.forEach((val, index) => {
        allSessions += `\n**${val[0]}** (${val[1]}/${val[2]} players)`;
        if (index < sessionsArray.length - 1) {
            allSessions += ', ';
        }
    });

    await interaction.reply(allSessions);
}

//Creats a new session (group)
async function addLFG(interaction) {
    const AUTHOR = interaction.user;
    const GUILD_ID = interaction.guild.id;

    console.log('Command received: addLFG');
    console.log('User:', AUTHOR.username);
    console.log('Guild ID:', GUILD_ID);

    // Récupération des options de l'interaction
    const GAME = interaction.options.getString('game');
    let LOBBY_LIMIT = interaction.options.getInteger('limit');

    console.log('Game:', GAME);
    console.log('Lobby Limit:', LOBBY_LIMIT);

    try {
        // Vérification si le jeu est approuvé
        const RESULT = await config.getGame(GUILD_ID, GAME);
        if (!RESULT) {
            console.log('Game not approved');
            return await interaction.reply({
                content: `Error.\nInvalid game specified (Please contact a server admin to add the game). Alternatively, if you are an admin use the /add_game command.`,
                ephemeral: true
            });
        }
        console.log('Game approved:', GAME);

        // Vérification si l'utilisateur est déjà dans un groupe
        const USER_ROLES = interaction.member.roles;
        if (USER_ROLES.cache.some(role => role.name === 'lfg')) {
            console.log('User already in a group');
            return await interaction.reply({
                content: `Error.\nYou are already in a group. Please leave the group or contact the server admin for help.`,
                ephemeral: true
            });
        }

        // Obtention des paramètres du jeu depuis la configuration
        const games = await config.getGames(GUILD_ID);
        console.log('Games config retrieved');

        // Si la limite n'est pas spécifiée, utiliser la limite par défaut
        if (!LOBBY_LIMIT) {
            LOBBY_LIMIT = games[GAME]['LIMIT'];
        } else {
            if (LOBBY_LIMIT > games[GAME]['LIMIT']) {
                console.log('Lobby limit exceeds maximum allowed');
                return await interaction.reply({
                    content: `Error.\nYou cannot have more than ${games[GAME]['LIMIT']} people in a group for this game.`,
                    ephemeral: true
                });
            } else if (LOBBY_LIMIT < 2) {
                console.log('Lobby limit too low');
                return await interaction.reply({
                    content: `Error.\nThere must be at least 2 people in a group.`,
                    ephemeral: true
                });
            } else if (isNaN(LOBBY_LIMIT)) {
                console.log('Lobby limit is not a number');
                return await interaction.reply({
                    content: `Error.\nInvalid number.`,
                    ephemeral: true
                });
            }
        }

        console.log('Lobby limit set to:', LOBBY_LIMIT);

        // Recherche d'une session existante avant de créer une nouvelle session
        const sessionExists = await config.findSession(GUILD_ID, GAME);
        if (!sessionExists) {
            console.log('No existing session found, creating new session');

            // Création d'un nouveau rôle
            const ROLE = await interaction.guild.roles.create({
                name: 'lfg',
                reason: `Temporary LFG role for ${GAME}`
            });

            console.log('Role created:', ROLE.name);

            // Ajout du rôle à l'utilisateur
            await interaction.member.roles.add(ROLE);

            console.log('Role added to user:', AUTHOR.username);

            // Création d'un canal texte
            const TEXT_CHANNEL = await interaction.guild.channels.create({
                name: `lfg_${GAME.toLowerCase()}_${ROLE.id}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: ROLE.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Administrator]
                    }
                ]
            });

            console.log('Text channel created:', TEXT_CHANNEL.name);

            await TEXT_CHANNEL.send(`Text channel for ${GAME}`);
            await TEXT_CHANNEL.send(`<@${AUTHOR.id}> Welcome to your group's text channel. You also have a voice channel to use.`);
            await TEXT_CHANNEL.send('Please don\'t forget to type /end_lfg when you are done!');

            // Création d'un canal vocal avec une limite de joueurs
            const VOICE_CHANNEL = await interaction.guild.channels.create({
                name: `lfg_${GAME.toLowerCase()}_${ROLE.id}`,
                type: ChannelType.GuildVoice,
                userLimit: LOBBY_LIMIT,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.Connect]
                    },
                    {
                        id: ROLE.id,
                        allow: [PermissionsBitField.Flags.Connect]
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [PermissionsBitField.Flags.Connect]
                    }
                ]
            });

            console.log('Voice channel created:', VOICE_CHANNEL.name);

            const message = await interaction.reply({
                content: `Lobby for ${LOBBY_LIMIT} ${GAME} players. Click the + reaction below to join. Click it again to leave.`,
                fetchReply: true
            });

            await message.react('➕');
            console.log('Reaction added to message');

            // Stockage des informations de session
            await config.createSession(GUILD_ID, AUTHOR.id, ROLE.id, GAME, TEXT_CHANNEL.id, VOICE_CHANNEL.id, message.id, message.channel.id);
            await config.addUser(GUILD_ID, ROLE.id, AUTHOR.id);

            const sessionData = config.data[GUILD_ID][ROLE.id];
            if (sessionData.members.length >= LOBBY_LIMIT) {
                await interaction.followUp(`**${GAME}** is now full!`);
            } else {
                await interaction.followUp(`${sessionData.members.length}/${LOBBY_LIMIT} members have joined **${GAME}**.`);
            }

            console.log('Session created successfully');

        } else {
            // Si une session existe déjà, ajout de l'utilisateur
            await interaction.reply("A session already exists for this game.");
            console.log('Session already exists');
        }

    } catch (err) {
        console.error('Error occurred in addLFG:', err);
        await interaction.reply(`An error occurred while creating the LFG session. Please try again later.`);
    }
}

function deleteCreationMessage(guild, groupID) {
    session = config.getSession(guild.id, groupID)
    guild.channels.get(session['channelid']).messages.get(session['messageid']).delete()
}
/*
    Ends a session
 */
// Fonction pour nettoyer les rôles associés à LFG
async function cleanRoles(interaction) {
    const guildId = interaction.guild.id;

    if (sudoMode.includes(guildId)) {
        sudoMode.splice(sudoMode.indexOf(guildId), 1);
        await interaction.reply("Cleaning...");

        const roles = interaction.guild.roles.cache.filter(role => role.name.startsWith("lfg"));
        await Promise.all(roles.map(role => role.delete('Cleaning LFG roles')));

        await interaction.followUp("Cleaning is complete.");
    } else {
        sudoMode.push(guildId);
        await interaction.reply("WARNING: This will delete all roles associated with the LFG bot. DO NOT run this while sessions are in progress. Use `/purge`. If you wish to continue, type `/clean_roles` again.");
    }
}

// Fonction pour nettoyer toutes les données de la guilde
async function cleanGuild(interaction) {
    const guildId = interaction.guild.id;

    if (sudoMode.includes(guildId)) {
        sudoMode.splice(sudoMode.indexOf(guildId), 1);
        await cleanRoles(interaction);
        try {
            await config.cleanGuild(guildId);
            await interaction.reply(`Success. This server's data has been cleared.`);
        } catch (err) {
            console.error('Error clearing guild data:', err);
            await interaction.reply(`There was an error.`);
        }
    } else {
        sudoMode.push(guildId);
        await interaction.reply("WARNING: This will remove all bot-side data relating to your server. If you really want to do this, type the command again.");
    }
}

// Fonction pour nettoyer toutes les sessions en cours
async function cleanSessions(interaction) {
    try {
        await config.cleanSessions(interaction.guild.id);
        await cleanChannels(interaction);
        await interaction.reply(`Success. All sessions have been cleared.`);
    } catch (err) {
        console.error('Error clearing sessions:', err);
        await interaction.reply(`There was an error.`);
    }
}

// Fonction pour nettoyer les canaux LFG
async function cleanChannels(interaction) {
    const channels = interaction.guild.channels.cache.filter(channel => channel.name.startsWith("lfg"));
    await Promise.all(channels.map(channel => channel.delete('Cleaning LFG channels')));
}

// Fonction pour terminer une session
async function endSession(interaction) {
    const guildId = interaction.guild.id;
    const roles = interaction.member.roles.cache.filter(role => role.name === "lfg");
    const role = roles.first();

    if (role) {
        const session = config.getSession(guildId, role.id);

        if (session) {
            // Supprimer les canaux associés à la session
            const channels = interaction.guild.channels.cache.filter(channel => 
                channel.id === session.text_channel || channel.id === session.voice_channel
            );
            await Promise.all(channels.map(channel => channel.delete('Ending session')));

            config.removeSession(guildId, role.id);
            await role.delete('Ending session');

            await interaction.reply('Session has ended.');
            clearInterval(channelActivityInterval);
        } else {
            await interaction.reply('Oops! Could not find an active session associated with this role!');
        }
    } else {
        await interaction.reply('Oops! Could not find an LFG role!');
    }
}
/*
    Removes a user from a session
 */
function removeLFG(message) {}
bot.on('guildCreate', GUILD => {
    config.initIfNeeded(GUILD.id);
});
//EVENTS
bot.once('ready', async () => {
    console.log('Bot is ready.');
    // Générer un lien d'invitation avec les scopes appropriés
    // Générer un lien d'invitation
    const invite = bot.generateInvite({
        scopes: ['bot', 'applications.commands'], // Scopes requis pour inviter le bot
        permissions: permissions  // Permissions mises à jour
    });

    console.log(`Use the following link to invite:\n\n${invite}\n`);
    const commands = [
        {
            name: 'kill',
            description: '(Literally) kills the bot',
        },
        {
            name: 'help',
            description: 'Sends a description about the bot',
        },
        {
            name: 'about',
            description: 'Sends a description about the bot',
        },
        {
            name: 'purge',
            description: 'Cleans the guild',
        },
        {
            name: 'clean_roles',
            description: 'Cleans roles',
        },
        {
            name: 'clean_sessions',
            description: 'Cleans sessions',
        },
        {
            name: 'games',
            description: 'Shows all games',
        },
        {
            name: 'sessions',
            description: 'Shows all sessions',
        },
        {
            name: 'add_lfg',
            description: 'Creates a new LFG session',
            options: [
                {
                    name: 'game',
                    description: 'The name of the game',
                    type: 3, // STRING
                    required: true,
                },
                {
                    name: 'limit',
                    description: 'The maximum number of players',
                    type: 4, // INTEGER
                    required: false, // This could be optional if a default is used
                }
            ],
        },
        {
            name: 'add_game',
            description: 'Adds a game to the current list',
            options: [
                {
                    name: 'limit',
                    description: 'The maximum number of players',
                    type: 4, // INTEGER
                    required: true,
                },
                {
                    name: 'game',
                    description: 'The name of the game to add',
                    type: 3, // STRING
                    required: true,
                }
            ],
        },
        {
            name: 'remove_game',
            description: 'Removes a game from the current list',
            options: [
                {
                    name: 'game',
                    description: 'The name of the game to remove',
                    type: 3, // STRING
                    required: true,
                }
            ],
        },
        {
            name: 'end_session',
            description: 'Ends the current session',
        },
        // {
        //     name: 'set_option',
        //     description: 'Sets an option for the bot',
        // },
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(bot.user.id, 774835458533228555),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});
bot.on('interactionCreate', async interaction => {
    console.log("Interaction: " + interaction);
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    try {
        if (commandName === 'help') {
            await help(interaction);
        } else if (commandName === 'about') {
            await about(interaction);
        } else if (commandName === 'purge') {
            await cleanGuild(interaction);
        } else if (commandName === 'clean_roles') {
            await cleanRoles(interaction);
        } else if (commandName === 'clean_sessions') {
            await cleanSessions(interaction);
        } else if (commandName === 'games') {
            await showGames(interaction);
        } else if (commandName === 'sessions') {
            await showSessions(interaction);
        } else if (commandName === 'add_lfg') {
            await addLFG(interaction);
        } else if (commandName === 'add_game') {
            await addGame(interaction);
        } else if (commandName === 'remove_game') {
            await removeGame(interaction);
        } else if (commandName === 'end_session') {
            await endSession(interaction);
        } else if (commandName === 'kill') {
            await interaction.reply('Shutting down...');
            process.exit(0);
        }
    } catch (error) {
        console.error('Error handling command:', error);
        await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
    }
});

bot.on('messageReactionAdd', async (reaction, user) => {
    // Vérifiez que la réaction est bien celle attendue et que ce n'est pas le bot lui-même qui réagit
    console.log("Reaction: " + reaction, reaction.emoji.name, reaction.emoji.name === '➕' );
    if (
        reaction.emoji.name === '➕' &&
        user.id !== bot.user.id &&
        reaction.message.author.id === bot.user.id &&
        reaction.message.content.includes("Click the + reaction below to join")
    ) {
        try {
            // Récupérez l'ID du message pour vérifier si une session correspondante existe
            const sessionData = await config.scanForMsdID(reaction.message.id, reaction.message.guild.id);

            if (sessionData) {
                const roleID = config.getRoleByReaction(reaction, reaction.message.guild.id);
                const role = reaction.message.guild.roles.cache.get(roleID);

                if (!role) {
                    console.error('Role not found:', roleID);
                    return;
                }

                const member = reaction.message.guild.members.cache.get(user.id);

                if (!member) {
                    console.error('Member not found:', user.id);
                    return;
                }

                // Ajoutez l'utilisateur au rôle correspondant
                await member.roles.add(role);

                // Ajoutez l'utilisateur à la session dans la config
                const data = await config.addUser(reaction.message.guild.id, roleID, user.id);

                if (data === 'full') {
                    await reaction.message.channel.send(`**${sessionData.GAME}** is now full!`);
                }
            } else {
                console.error('No session found for message ID:', reaction.message.id);
            }
        } catch (err) {
            console.error('Error handling reaction:', err);
        }
    }
});

// Gestion des suppressions de réactions
bot.on('messageReactionRemove', async (reaction, user) => {
    if (
        reaction.emoji.name === '➕' &&
        user.id !== bot.user.id &&
        reaction.message.author.id === bot.user.id &&
        reaction.message.content.includes("Game created in")
    ) {
        try {
            const roleID = config.getRoleByReaction(reaction, reaction.message.guild.id);

            if (!roleID) {
                console.error('Role ID not found:', roleID);
                return;
            }

            await config.scanForMsdID(reaction.message.id, reaction.message.guild.id);
            await config.removeUser(reaction.message.guild.id, roleID, user.id);

            const member = reaction.message.guild.members.cache.get(user.id);
            if (member && member.roles.cache.has(roleID)) {
                await member.roles.remove(roleID);
            }
        } catch (err) {
            console.error('Error removing role on reaction remove:', err);
        }
    }
});

// Gestion des erreurs non gérées
process.on('unhandledRejection', err => {
    console.error(`Uncaught Rejection (${err.status}): ${err.stack || err}`);
    logError("Unhandled rejection!", err, "-");
});
bot.login(process.env.TOKEN);
