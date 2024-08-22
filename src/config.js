const fs = require('fs');
const path = require('path');

const configFilePath = path.join(__dirname, '../data/config.json');
// Vérifiez si le fichier de configuration existe, sinon créez-le
if (!fs.existsSync(configFilePath)) {
    const dataDir = path.dirname(configFilePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(configFilePath, '{}', 'utf8');
}

const config = {
    data: require(configFilePath)
};

// Sauvegarde les modifications apportées à config.json
config.save = function() {
    fs.writeFile(configFilePath, JSON.stringify(config.data, null, 4), 'utf8', err => {
        if (err) {
            console.error('Failed to save configuration:', err);
            throw err;
        } else {
            console.log('Configuration saved successfully.');
        }
    });
};

// Vérifie si l'utilisateur est présent dans l'une des guildes
config.checkUser = function(USER_ID) {
    for (let guildId in config.data) {
        for (let key in config.data[guildId]) {
            if (config.data[guildId][key]?.members?.includes(USER_ID)) {
                return false; // Utilisateur trouvé
            }
        }
    }
    return true; // Utilisateur non trouvé
};

// Nettoie les données d'une guilde spécifique
config.cleanGuild = function(GUILD_ID) {
    return new Promise((resolve, reject) => {
        try {
            delete config.data[GUILD_ID];
            initIfNeeded(GUILD_ID);
            config.save();
            resolve(true);
        } catch (err) {
            console.error('Error cleaning guild:', err);
            reject(false);
        }
    });
};

// Recherche un message par son ID dans une guilde spécifique
config.scanForMsdID = function(MESSAGE_ID, GUILD_ID) {
    console.log("Scanning message " + MESSAGE_ID + " in guild " + GUILD_ID);
    return new Promise((resolve, reject) => {
        for (let key in config.data[GUILD_ID]) {
            if (config.data[GUILD_ID][key].messageid === MESSAGE_ID) {
                console.log('Message found:', config.data[GUILD_ID][key]);
                return resolve(config.data[GUILD_ID][key]);
            }
        }
        console.log('Message not found.');
        reject(false);
    });
};

// Ajoute un utilisateur à une session
config.addUser = function(GUILD_ID, ROLE_ID, USER_ID) {
    return new Promise((resolve, reject) => {
        try {
            initIfNeeded(GUILD_ID);

            const session = config.data[GUILD_ID][ROLE_ID];
            const gameLimit = session.limit;

            if (session.members.length < gameLimit) {
                if (!session.members.includes(USER_ID)) {
                    session.members.push(USER_ID);
                    config.save();

                    if (session.members.length === gameLimit) {
                        resolve('full');
                    } else {
                        resolve(session);
                    }
                } else {
                    resolve('already_in_session');
                }
            } else {
                reject('full');
            }
        } catch (err) {
            console.error('Error adding user to session:', err);
            reject(err);
        }
    });
};

// Retire un utilisateur d'une session
config.removeUser = function(GUILD_ID, ROLE_ID, USER_ID) {
    initIfNeeded(GUILD_ID);
    const session = config.data[GUILD_ID][ROLE_ID];
    if (USER_ID !== session.creator) {
        const index = session.members.indexOf(USER_ID);
        if (index !== -1) {
            session.members.splice(index, 1);
            config.save();
        }
    }
};

// Crée une nouvelle session pour la guilde actuelle
config.createSession = function(GUILD_ID, USER_ID, ROLE_ID, GAME, T_CHANNEL_ID, V_CHANNEL_ID, MESSAGE_ID, CHANNEL_ID) {
    initIfNeeded(GUILD_ID);
    console.log("Add session " + MESSAGE_ID + " in guild " + GUILD_ID);
    config.data[GUILD_ID][ROLE_ID] = {
        creator: USER_ID,
        game: GAME,
        text_channel: T_CHANNEL_ID,
        voice_channel: V_CHANNEL_ID,
        limit: config.data[GUILD_ID].games[GAME].LIMIT,
        members: [USER_ID],
        messageid: MESSAGE_ID,
        channelid: CHANNEL_ID
    };
    config.data[GUILD_ID].sessions.push(ROLE_ID);
    config.save();
};

// Supprime une session d'une guilde
config.removeSession = function(GUILD_ID, ROLE_ID) {
    initIfNeeded(GUILD_ID);
    delete config.data[GUILD_ID][ROLE_ID];
    const index = config.data[GUILD_ID].sessions.indexOf(ROLE_ID);
    if (index !== -1) {
        config.data[GUILD_ID].sessions.splice(index, 1);
    }
    config.save();
};

// Nettoie toutes les sessions d'une guilde
config.cleanSessions = function(GUILD_ID) {
    return new Promise((resolve, reject) => {
        try {
            config.data[GUILD_ID].sessions.forEach(sessionID => {
                delete config.data[GUILD_ID][sessionID];
            });
            config.data[GUILD_ID].sessions = [];
            config.save();
            resolve(true);
        } catch (err) {
            console.error("ERROR: Couldn't clean sessions for guild " + GUILD_ID + ".\n" + err);
            reject(false);
        }
    });
};

// Ajoute un nouveau jeu à la liste des jeux autorisés
config.addGame = function(GUILD_ID, GAME, LIMIT) {
    return new Promise((resolve, reject) => {
        try {
            initIfNeeded(GUILD_ID);
            if (config.data[GUILD_ID].games.hasOwnProperty(GAME)) {
                reject('Game already exists');
            } else {
                config.data[GUILD_ID].games[GAME] = {
                    'LIMIT': parseInt(LIMIT)
                };
                console.log(`Game added: ${GAME}`, config.data[GUILD_ID].games);
                config.save();
                resolve(true);
            }
        } catch (err) {
            console.error('Error adding game:', err);
            reject(err);
        }
    });
};

// Supprime un jeu de la liste des jeux autorisés
config.removeGame = function(GUILD_ID, GAME) {
    return new Promise((resolve, reject) => {
        try {
            initIfNeeded(GUILD_ID);
            if (GAME in config.data[GUILD_ID].games) {
                console.log(`Game removed: ${GAME}`, config.data[GUILD_ID].games);
                delete config.data[GUILD_ID].games[GAME];
                config.save();
                resolve(true);
            } else {
                reject('Game not found');
            }
        } catch (err) {
            console.error('Error removing game:', err);
            reject(err);
        }
    });
};

// Récupère un jeu de la liste des jeux autorisés
config.getGame = function(GUILD_ID, GAME) {
    return new Promise((resolve, reject) => {
        try {
            initIfNeeded(GUILD_ID);
            if (config.data[GUILD_ID] && config.data[GUILD_ID].games[GAME]) {
                resolve(config.data[GUILD_ID].games[GAME]);
            } else {
                resolve(false);
            }
        } catch (err) {
            console.error('Error getting game:', err);
            resolve(false);
        }
    });
};

// Retourne la liste des jeux et du nombre maximum de joueurs
config.getGames = function(GUILD_ID) {
    initIfNeeded(GUILD_ID);
    return config.data[GUILD_ID].games;
};

// Récupère une session spécifique
config.getSession = function(GUILD_ID, ROLE_ID) {
    initIfNeeded(GUILD_ID);
    return config.data[GUILD_ID][ROLE_ID];
};

// Retourne une liste de sessions
config.getSessions = function(GUILD_ID) {
    initIfNeeded(GUILD_ID);
    return config.data[GUILD_ID].sessions.map(roleId => {
        const session = config.data[GUILD_ID][roleId];
        const game = session.game;
        return [game, session.members.length, config.data[GUILD_ID].games[game].LIMIT];
    });
};

// Récupère un rôle en fonction de la réaction
config.getRoleByReaction = function(REACTION, GUILD_ID) {
    initIfNeeded(GUILD_ID);
    for (let prop in config.data[GUILD_ID]) {
        if (config.data[GUILD_ID][prop].messageid === REACTION.message.id) {
            return prop;
        }
    }
};

// Retourne le nombre total de guildes configurées
config.getGuildCount = function() {
    return Object.keys(config.data).length;
};

// Trouve une session basée sur un jeu
config.findSession = function(GUILD_ID, GAME) {
    if (!config.data[GUILD_ID]) {
        return false;
    } else {
        for (let element in config.data[GUILD_ID]) {
            if (config.data[GUILD_ID][element].game === GAME) {
                return element;
            }
        }
        return false;
    }
};

// Récupère un paramètre de configuration pour une guilde spécifique
config.getSetting = function(SETTING, GUILD_ID) {
    return config.data[GUILD_ID]?.options?.[SETTING];
};

// Définit un paramètre de configuration pour une guilde spécifique
config.setSetting = function(SETTING, GUILD_ID, VALUE) {
    initIfNeeded(GUILD_ID);
    return new Promise((resolve, reject) => {
        try {
            if (SETTING in config.data[GUILD_ID].options) {
                if (SETTING === "inactivityDrop" && VALUE < config.getSetting('sessionWarn', GUILD_ID)) {
                    reject("The inactivityDrop value cannot be less than the sessionWarn value.");
                } else {
                    config.data[GUILD_ID].options[SETTING] = parseInt(VALUE);
                    config.save();
                    resolve(true);
                }
            } else {
                reject("NONEXISTENT_SETTING");
            }
        } catch (err) {
            console.error('Error setting configuration:', err);
            reject(false);
        }
    });
};

// Récupère l'ID du canal pour une session spécifique
config.getChannelID = function(GUILD_ID, SESSION) {
    return new Promise((resolve, reject) => {
        initIfNeeded(GUILD_ID);
        const channelId = config.data[GUILD_ID][SESSION]?.channel;
        if (channelId) {
            resolve(channelId);
        } else {
            reject('Channel ID not found');
        }
    });
};

// Initialises GUILD_ID if necessary
function initIfNeeded(GUILD_ID) {
    if (config.data[GUILD_ID] === undefined || config.data[GUILD_ID].games === undefined) {
        config.data[GUILD_ID] = {
            games: {},
            sessions: [],
            options: {
                "sessionWarn": 2,
                "sessionCap": 24,
                "inactivityDrop": 15
            }
        };
    }
}

// Exporte le module
module.exports = config;
