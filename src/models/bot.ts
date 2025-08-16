import {
    AutocompleteInteraction,
    ButtonInteraction,
    Client,
    CommandInteraction,
    Events,
    Guild,
    Interaction,
    Message,
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    RateLimitData,
    RESTEvents,
    TextChannel,
    User,
} from 'discord.js';
import Enmap from 'enmap';
import { createRequire } from 'node:module';
import { clan } from 'runescape-api';
import { ClanMember } from 'runescape-api/lib/RuneScape.js';
import { request } from 'undici';

import {
    ButtonHandler,
    CommandHandler,
    GuildJoinHandler,
    GuildLeaveHandler,
    MessageHandler,
    ReactionHandler,
} from '../events/index.js';
import { JobService, Logger } from '../services/index.js';
import { PartialUtils } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Debug = require('../../config/debug.json');
let Logs = require('../../lang/logs.json');

export class Bot {
    private ready = false;

    constructor(
        private token: string,
        private client: Client,
        private guildJoinHandler: GuildJoinHandler,
        private guildLeaveHandler: GuildLeaveHandler,
        private messageHandler: MessageHandler,
        private commandHandler: CommandHandler,
        private buttonHandler: ButtonHandler,
        private reactionHandler: ReactionHandler,
        private jobService: JobService
    ) {}

    public async start(): Promise<void> {
        this.registerListeners();
        await this.login(this.token);
    }

    private registerListeners(): void {
        this.client.on(Events.ClientReady, () => this.onReady());
        this.client.on(Events.ShardReady, (shardId: number, unavailableGuilds: Set<string>) =>
            this.onShardReady(shardId, unavailableGuilds)
        );
        this.client.on(Events.GuildCreate, (guild: Guild) => this.onGuildJoin(guild));
        this.client.on(Events.GuildDelete, (guild: Guild) => this.onGuildLeave(guild));
        this.client.on(Events.MessageCreate, (msg: Message) => this.onMessage(msg));
        this.client.on(Events.InteractionCreate, (intr: Interaction) => this.onInteraction(intr));
        this.client.on(
            Events.MessageReactionAdd,
            (messageReaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) =>
                this.onReaction(messageReaction, user)
        );
        this.client.rest.on(RESTEvents.RateLimited, (rateLimitData: RateLimitData) =>
            this.onRateLimit(rateLimitData)
        );
    }

    private async login(token: string): Promise<void> {
        try {
            await this.client.login(token);
        } catch (error) {
            Logger.error(Logs.error.clientLogin, error);
            return;
        }
    }

    private sleep = (ms: number): Promise<void> => { return new Promise((resolve) => { setTimeout(resolve, ms) }) }

	private ClanRankIcons = {
		Admin: `<:Admin:1405621264042819636>`,
		Captain: `<:Captain:1405621166965653514>`,
		Coordinator: `<:Coordinator:1405621353549402242>`,
		Corporal: `<:Corporal:1405621010379833364>`,
		'Deputy Owner': `<:Deputy:1405621447786893332>`,
		General: `<:General:1405621217674788864>`,
		Lieutenant: `<:Lieutenant:1405621121557991454>`,
		Organiser: `<:Organiser:1405621312423989351>`,
		Overseer: `<:Overseer:1405621400966004746>`,
		Owner: `<:Owner:1405621482372993165>`,
		Recruit: `<:Recruit:1405620961239236720>`,
		Sergeant: `<:Sergeant:1405621057955696800>`
	}

	private LootBeam = `<:Loot:1405622614499659958>`;

    private async onReady(): Promise<void> {
        let userTag = this.client.user?.tag;
        let clanMemberEventsMap = new Enmap({name: 'clanMemberEvents'});
        let clanMemberMap = new Enmap({name: 'clanMembers'});
        Logger.info(Logs.info.clientLogin.replaceAll('{USER_TAG}', userTag));

        if (!Debug.dummyMode.enabled) {
            this.jobService.start();
        }

        this.ready = true;
        Logger.info(Logs.info.clientReady);

        if(this.ready){
            
            Logger.info(`Startup Activity checker`)
            let clanMembers = await clan.getMembers('Zer0 sweat');
            this.searchMembers(clanMemberEventsMap, clanMemberMap, clanMembers)

            setInterval(async () => {
                Logger.info(`Routine Activity checker`)
                let clanMembers = await clan.getMembers('Zer0 sweat');
                this.searchMembers(clanMemberEventsMap, clanMemberMap, clanMembers)
            }, 15 * 60 * 1000)

        }
    }

    private async searchMembers(clanMemberEventsMap: Enmap, clanMemberMap: Enmap, clanData: ClanMember[]): Promise<void> {
        let clanActivities = [];
        let privateUsers = [];
        // for(let i = 4; i < 7; i++){
        for(let i = 0; i < clanData.length; i++){
            await this.sleep(3500);
            Logger.info(`Clan Member search ${i+1}/${clanData.length} :: (${clanData[i].rank}) ${clanData[i].name} :: ${clanActivities.length} events`);
            try {
                let uname = clanData[i].name;
                let rankIcon = '';
                switch (clanData[i].rank){
                    case 'Owner':
                        rankIcon = this.ClanRankIcons.Owner;
                        break;
                    case 'Deputy Owner':
                        rankIcon = this.ClanRankIcons['Deputy Owner'];
                        break;
                    case 'Overseer':
                        rankIcon = this.ClanRankIcons.Overseer;
                        break;
                    case 'Coordinator':
                        rankIcon = this.ClanRankIcons.Coordinator;
                        break;
                    case 'Organiser':
                        rankIcon = this.ClanRankIcons.Organiser;
                        break;
                    case 'Admin':
                    case 'Administrator':
                        rankIcon = this.ClanRankIcons.Admin;
                        break;
                    case 'General':
                        rankIcon = this.ClanRankIcons.General;
                        break;
                    case 'Captain':
                        rankIcon = this.ClanRankIcons.Captain;
                        break;
                    case 'Lieutenant':
                        rankIcon = this.ClanRankIcons.Lieutenant;
                        break;
                    case 'Sergeant':
                        rankIcon = this.ClanRankIcons.Sergeant;
                        break;
                    case 'Corporal':
                        rankIcon = this.ClanRankIcons.Corporal;
                        break;
                    case 'Recruit':
                        rankIcon = this.ClanRankIcons.Recruit;
                        break;
                    default:
                        rankIcon = '';
                        break;
                }
                const username = `${rankIcon} **${uname}**`;
                const user = await request(`https://apps.runescape.com/runemetrics/profile/profile?user=${uname}&activities=20`);
                let userData: any = await user.body.json();

                if(userData.error != 'PROFILE_PRIVATE'){
                    await userData.activities.forEach(async (activity: { text: any; details: any; date: string | number | Date; }) => {
                        let title = activity.text;
                        let description = activity.details;
                        let epochTime = new Date(activity.date).getTime() / 1000;
                        let timestamp = `**[<t:${epochTime}>]**`;
                        let previousTimestamp = clanMemberEventsMap.get('lastTimestamp');
                        let lastEvent = clanMemberMap.get(uname);
                        Logger.warn(lastEvent);
                        
                        // let previousEvent = clanMemberEventsMap.(val => val.date == epochTime && val.title == activity.text && val.details == activity.details)
                        // console.log(previousEvent);
                        
                        if(epochTime > previousTimestamp) {

                            if(title.includes(`Levelled all`)){ 
                                let target = parseInt(activity.details.slice(-4).replace(' ','').replace('.',''));
                                if(target % 10 === 0 || target == 99){
                                    clanActivities.push({
                                        date: new Date(activity.date).getTime() / 1000,
                                        user: uname,
                                        message: `${timestamp} ${this.getSkillIcon('Total')} ${username} reached at least level ${target} in all skills!`,
                                        activity
                                    })
                                }
                            }

                            else if(title.includes(`XP in`)){ 
                                let skill = activity.text.split('XP in')[1].replace(' ','').replace('.','');
                                let target = parseInt(activity.text.split('XP')[0]);
                                if(target % 20_000_000 === 0){
                                    clanActivities.push({
                                        date: new Date(activity.date).getTime() / 1000,
                                        user: uname,
                                        message: `${timestamp} ${this.getSkillIcon(skill)} ${username} reached **${(target/1_000_000)}M XP** in **${skill}**!`,
                                        activity
                                    })
                                }
                            }

                            else if(title.startsWith(`Levelled up`)){ 
                                let skill = activity.text.split('Levelled up')[1].replace(' ','').replace('.','');
                                let target = parseInt(activity.details.slice(-4).replace(' ','').replace('.',''));
                                if(target % 10 === 0 || target == 99){
                                    clanActivities.push({
                                        date: new Date(activity.date).getTime() / 1000,
                                        user: uname,
                                        message: `${timestamp} ${this.getSkillIcon(skill)} ${username} reached level ${target.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} in **${skill}**!`,
                                        activity
                                    })
                                }
                            }

                            else if(title.startsWith(`Unlocked all spells`)){ 
                                clanActivities.push({
                                    date: new Date(activity.date).getTime() / 1000,
                                    user: uname,
                                    message: `${timestamp} ${username} unlocked all the spells at **Livid Farm**!`,
                                    activity
                                })
                            }

                            else if(title.includes(`completionist cape`)){ 
                                clanActivities.push({
                                    date: new Date(activity.date).getTime() / 1000,
                                    user: uname,
                                    message: `${timestamp} ${username} bought their first **Completionist Cape**!`,
                                    activity
                                })
                            }
                            
                            else if(title.includes(`max cape`)){ 
                                clanActivities.push({
                                    date: new Date(activity.date).getTime() / 1000,
                                    user: uname,
                                    message: `${timestamp} ${username} bought their first **Max Cape**!`,
                                    activity
                                })
                            }
                            
                            else if(title.includes(`pet`)){ 
                                let skill = activity.text.split(', the')[1].split('pet')[0].replace(' ','').replace('.','').replace(' ','');
                                let petName = activity.text.split(', the')[0].split('found')[1].replace(' ','').replace('.','');
                                let petIcon = this.getSkillPetIcon(skill);
                                clanActivities.push({
                                    date: new Date(activity.date).getTime() / 1000,
                                    user: uname,
                                    message: `${timestamp} ${petIcon} ${username} found **${petName}**, whilst training **${skill}**!`,
                                    activity
                                })
                            }

                            else if(title.includes(`I found`) && description.includes(`After killing`) && description.includes(`it dropped`)){ 
                                let item = activity.text.split('I found a ')[1];
                                if(!item) item = activity.text.split('I found an ')[1];
                                clanActivities.push({
                                    date: new Date(activity.date).getTime() / 1000,
                                    user: uname,
                                    message: `${timestamp} ${this.getItemIcon(item)} ${username} received **${item}**!`,
                                    activity
                                })
                            }
                        }
                    });
                    
                    // console.log(clanActivities);
                }

                else {
                    privateUsers.push(`${username}`);
                }

            } catch (error) {
            Logger.error(error);
            }
        }

        const sorted = clanActivities.sort((b,a) => { return b.date-a.date});
        const listChannel = await this.client.channels.fetch('1405620443930427525') as TextChannel
        if(sorted.length > 0)
            sorted.forEach(async s => {
                listChannel.send(s.message);
                clanMemberEventsMap.set('lastTimestamp', s.date);
                clanMemberMap.set(s.uname, s.date);
                // if(clanMemberEventsMap.has('lastTimestamp'))
                //     clanMemberEventsMap.push('lastTimestamp', { date: s.date, title: s.activity.text, details: s.activity.details });
                // else {
                //     clanMemberEventsMap.set('lastTimestamp', []);
                //     clanMemberEventsMap.push('lastTimestamp', { date: s.date, title: s.activity.text, details: s.activity.details });
                // }
                // console.log(clanMemberEventsMap.find(val => val.date === s.date && val.title === s.activity.text && val.details === s.activity.details));
                await this.sleep(1500);
            })
        Logger.warn(`${privateUsers.length} Hidden profiles`)
        if(privateUsers.length > 0){
            for(let i = 0; i<privateUsers.length; i++){
                Logger.warn(`${privateUsers[i]}`);
            }
        }

    }

    private getSkillIcon(skillName: string): string{
        switch(skillName){
            case 'Agility': return `<:Agility:1405624273426583684>`;
            case 'Archaeology': return `<:Archaeology:1405623846031200379>`;
            case 'Attack': return `<:Attack:1405625117089861636>`;
            case 'Constitution': return `<:Constitution:1405625075058872460>`;
            case 'Construction': return `<:Construction:1405624057768054884>`;
            case 'Cooking': return `<:Cooking:1405624738784481466>`;
            case 'Crafting': return `<:Crafting:1405624646270976122>`;
            case 'Defence': return `<:Defence:1405624879579140136>`;
            case 'Divination': return `<:Divination:1405623938276655104>`;
            case 'Dungeoneering': return `<:Dungeoneering:1405624314597871686>`;
            case 'Farming': return `<:Farming:1405624105268678727>`;
            case 'Firemaking': return `<:Firemaking:1405624606919757844>`;
            case 'Fishing': return `<:Fishing:1405624838068113469>`;
            case 'Fletching': return `<:Fletching:1405624467924844615>`;
            case 'Herblore': return `<:Herblore:1405624233475702834>`;
            case 'Hunter': return `<:Hunter:1405624018165305425>`;
            case 'Invention': return `<:Invention:1405623889471471667>`;
            case 'Magic': return `<:Magic:1405624555317231748>`;
            case 'Mining': return `<:Mining:1405625028346773554>`;
            case 'Necromancy': return `<:Necromancy:1405623804423569548>`;
            case 'Prayer': return `<:Prayer:1405624697286295612>`;
            case 'Ranged': return `<:Ranged:1405624798368890920>`;
            case 'Runecrafting': return `<:RC:1405624359422263326>`;
            case 'Slayer': return `<:Slayer:1405624148608291017>`;
            case 'Smithing': return `<:Smithing:1405624925229940910>`;
            case 'Strength': return `<:Strength:1405624974605156353>`;
            case 'Summoning': return `<:Summoning:1405623979103883264>`;
            case 'Thieving': return `<:Thieving:1405624188919615670>`;
            case 'Woodcutting': return `<:Woodcutting:1405624419271049267>`;
            case 'Milestone': return `<:Milestone:1405625459928076339>`;
            case 'Total': return `<:Total:1405625358178455772>`;
            default: return '';
        };
    }

    private getSkillPetIcon(skillName: string): string{
        switch(skillName){
            case 'Agility': return `<:Dojo_Mojo:1406001253644898485>`;
            case 'Archaeology': return `<:Archie:1406001202432573490>`;
            case 'Attack': return `<:Sifu:1406001156668522669>`;
            case 'Constitution': return `<:Morty:1406001113886359636>`;
            case 'Construction': return `<:Baby_Yagas_House:1406001067342430238>`;
            case 'Cooking': return `<:Ramsay:1406001006147538944>`;
            case 'Crafting': return `<:Gemi:1406000945095245894>`;
            case 'Defence': return `<:Wallace:1406000900853731541>`;
            case 'Divination': return `<:Willow:1406000844914163762>`;
            case 'Dungeoneering': return `<:Gordie:1406000795073253477>`;
            case 'Farming': return `<:Brains:1406000755235880970>`;
            case 'Firemaking': return `<:Bernie:1406000711040241784>`;
            case 'Fishing': return `<:Bubbles:1406000666673152062>`;
            case 'Fletching': return `<:Flo:1406000617570435172>`;
            case 'Herblore': return `<:Herbert:1406000570623332392>`;
            case 'Hunter': return `<:Ace:1406000527417933894>`;
            case 'Invention': return `<:Malcolm:1406000482132033757>`;
            case 'Magic': return `<:Newton:1406000316519809264>`;
            case 'Mining': return `<:Rocky:1406000276103495732>`;
            case 'Necromancy': return `<:Omen:1406000225889419264>`;
            case 'Prayer': return `<:Ghostly:1406000133791027263>`;
            case 'Ranged': return `<:Sparky:1406000092028211241>`;
            case 'Runecrafting': return `<:Rue:1406000040379420805>`;
            case 'Slayer': return `<:Crabbe:1405999999501996034>`;
            case 'Smithing': return `<:Smithy:1405999905595723847>`;
            case 'Strength': return `<:Kangali:1405999861681356931>`;
            case 'Summoning': return `<:Shamini:1405999944061419601>`;
            case 'Thieving': return `<:Ralph:1405999810762510336>`;
            case 'Woodcutting': return `<:Woody:1405999742944542801>`;
            default: return '';
        };
    }

    private getItemIcon(itemName: string): string{
        switch(itemName){
            case 'Torva full helm': return '<:Torva_full_helm:1406274647644835952>';
            case 'Torva platebody': return '<:Torva_platebody:1406274687016898591>';
            case 'Torva platelegs': return '<:Torva_platelegs:1406274722374619237>';
            case 'Torva gloves': return '<:Torva_gloves:1406275301218193499>';
            case 'Torva boots': return '<:Torva_boots:1406275341516935219>';
            case 'Pernix cowl': return '<:Pernix_cowl:1406275752206270578>';
            case 'Pernix body': return '<:Pernix_body:1406275825074044958>';
            case 'Pernix chaps': return '<:Pernix_chaps:1406275860192821299> ';
            case 'Pernix gloves': return '<:Pernix_gloves:1406275943143706847>';
            case 'Pernix boots': return '<:Pernix_boots:1406275979109990441>';
            case '': return '';
            default: return this.LootBeam;
        };
    }

    private onShardReady(shardId: number, _unavailableGuilds: Set<string>): void {
        Logger.setShardId(shardId);
    }

    private async onGuildJoin(guild: Guild): Promise<void> {
        if (!this.ready || Debug.dummyMode.enabled) {
            return;
        }

        try {
            await this.guildJoinHandler.process(guild);
        } catch (error) {
            Logger.error(Logs.error.guildJoin, error);
        }
    }

    private async onGuildLeave(guild: Guild): Promise<void> {
        if (!this.ready || Debug.dummyMode.enabled) {
            return;
        }

        try {
            await this.guildLeaveHandler.process(guild);
        } catch (error) {
            Logger.error(Logs.error.guildLeave, error);
        }
    }

    private async onMessage(msg: Message): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(msg.author.id))
        ) {
            return;
        }

        try {
            msg = await PartialUtils.fillMessage(msg);
            if (!msg) {
                return;
            }

            await this.messageHandler.process(msg);
        } catch (error) {
            Logger.error(Logs.error.message, error);
        }
    }

    private async onInteraction(intr: Interaction): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(intr.user.id))
        ) {
            return;
        }

        if (intr instanceof CommandInteraction || intr instanceof AutocompleteInteraction) {
            try {
                await this.commandHandler.process(intr);
            } catch (error) {
                Logger.error(Logs.error.command, error);
            }
        } else if (intr instanceof ButtonInteraction) {
            try {
                await this.buttonHandler.process(intr);
            } catch (error) {
                Logger.error(Logs.error.button, error);
            }
        }
    }

    private async onReaction(
        msgReaction: MessageReaction | PartialMessageReaction,
        reactor: User | PartialUser
    ): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(reactor.id))
        ) {
            return;
        }

        try {
            msgReaction = await PartialUtils.fillReaction(msgReaction);
            if (!msgReaction) {
                return;
            }

            reactor = await PartialUtils.fillUser(reactor);
            if (!reactor) {
                return;
            }

            await this.reactionHandler.process(
                msgReaction,
                msgReaction.message as Message,
                reactor
            );
        } catch (error) {
            Logger.error(Logs.error.reaction, error);
        }
    }

    private async onRateLimit(rateLimitData: RateLimitData): Promise<void> {
        if (rateLimitData.timeToReset >= Config.logging.rateLimit.minTimeout * 1000) {
            Logger.error(Logs.error.apiRateLimit, rateLimitData);
        }
    }
}
