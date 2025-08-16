import { Guild } from 'discord.js';
import { createRequire } from 'node:module';

import { EventHandler } from './index';
import { Logger } from '../services/index';

const require = createRequire(import.meta.url);
let Logs = require('../../lang/logs.json');

export class GuildLeaveHandler implements EventHandler {
    public async process(guild: Guild): Promise<void> {
        Logger.info(
            Logs.info.guildLeft
                .replaceAll('{GUILD_NAME}', guild.name)
                .replaceAll('{GUILD_ID}', guild.id)
        );
    }
}
