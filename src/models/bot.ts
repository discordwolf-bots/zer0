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
            }, 20 * 60 * 1000)

        }
    }

    private async searchMembers(clanMemberEventsMap: Enmap, clanMemberMap: Enmap, clanData: ClanMember[]): Promise<void> {
        let clanActivities = [];
        let privateUsers = [];
        let unknownItems = [];
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
                        // let previousTimestamp = clanMemberEventsMap.get('lastTimestamp');
                        let lastEvent = clanMemberMap.get(uname);
                        // Logger.warn(lastEvent);
                        
                        // let previousEvent = clanMemberEventsMap.(val => val.date == epochTime && val.title == activity.text && val.details == activity.details)
                        // console.log(previousEvent);
                        
                        if(epochTime > lastEvent) {

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
                                let itemIcon = this.getItemIcon(item);
                                if(itemIcon === this.LootBeam) unknownItems.push(item);
                                clanActivities.push({
                                    date: new Date(activity.date).getTime() / 1000,
                                    user: uname,
                                    message: `${timestamp} ${itemIcon} ${username} received **${item}**!`,
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
                // clanMemberEventsMap.set('lastTimestamp', s.date);
                // Logger.info(s);
                // console.log(s);
                clanMemberMap.set(s.user, s.date);
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
        let announceUnknownItems = [...new Set(unknownItems)];
        Logger.warn(`${announceUnknownItems.length} No icon items`)
        if(announceUnknownItems.length > 0){
            for(let i=0; i<announceUnknownItems.length; i++){
                Logger.warn(`${announceUnknownItems[i]}`);
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
            case 'Virtus mask': return '<:Virtus_mask:1406281640153452677>';
            case 'Virtus robe top': return '<:Virtus_robe_top:1406281677080100894>';
            case 'Virtus robe legs': return '<:Virtus_robe_legs:1406281711075065957> ';
            case 'Virtus boots': return '<:Virtus_boots:1406281789529526363>';
            case 'Virtus gloves': return '<:Virtus_gloves:1406281826682535966>';
            case 'Virtus wand': return '<:Virtus_wand:1406281871742206084>';
            case 'Virtus book': return '<:Virtus_book:1406281906147954820>';
            case 'Zaryte bow': return '<:Zaryte_bow:1406281941556264960>';
            case 'Crest of Zamorak': return '<:Crest_of_Zamorak:1406299969073184939>';
            case 'Crest of Sliske': return '<:Crest_of_Sliske:1406300002174898236>';
            case 'Crest of Zaros': return '<:Crest_of_Zaros:1406300041202765944>';
            case 'Crest of Seren': return '<:Crest_of_Seren:1406300072118976573>';
            case 'Dragon rider lance': return '<:Dragon_Rider_lance:1406300204269047930>';
            case 'Shadow glaive': return '<:Shadow_glaive:1406300240658698342>';
            case 'Off-hand shadow glaive': return '<:Offhand_shadow_glaive:1406300292206825615>';
            case 'Wand of the cywir elders': return '<:Wand_of_the_Cywir_elders:1406300406270656542>';
            case 'Ord of the cywir elders': return '<:Orb_of_the_Cywir_elders:1406300451191783444>';
            case 'Seismic wand': return '<:Seismic_wand:1406300492010885181>';
            case 'Seismic singularity': return '<:Seismic_singularity:1406300530262675518>';
            case 'Drygore longsword': return '<:Drygore_longsword:1406301546135683202>';
            case 'Drygore mace': return '<:Drygore_mace:1406301578633416754>';
            case 'Drygore rapier': return '<:Drygore_rapier:1406301612414337175>';
            case 'Off-hand drygore longsword': return '<:Offhand_drygore_longsword:1406301663936909362>';
            case 'Off-hand drygore mace': return '<:Offhand_drygore_mace:1406301719750508725>';
            case 'Off-hand drygore rapier': return '<:Offhand_drygore_rapier:1406301756018921613>';
            case 'Arraxi\'s eye': return '<:Araxxis_eye:1406301798326603796>';
            case 'Arraxi\'s fang': return '<:Araxxis_fang:1406301873320755320>';
            case 'Arraxi\'s web': return '<:Araxxis_web:1406301910092484669>';
            case 'Wyrm heart': return '<:Wyrm_heart:1406302960681484471>';
            case 'Wyrm scalp': return '<:Wyrm_scalp:1406302958672678992>';
            case 'Wyrm spike': return '<:Wyrm_spike:1406302956013486182>';
            case 'Mazcab ability codex': return '<:Mazcab_ability_codex:1406302947532345404>';
            case 'Achto Primeval boots': return '<:Achto_Primeval_boots:1406304680031682650>';
            case 'Achto Primeval gloves': return '<:Achto_Primeval_gloves:1406304675677995079>';
            case 'Achto Primeval mask': return '<:Achto_Primeval_mask:1406304671827759145>';
            case 'Achto Primeval robe legs': return '<:Achto_Primeval_robe_legs_detail:1406304668279378082>';
            case 'Achto Primeval robe top': return '<:Achto_Primeval_robe_top_detail:1406304665229856808>';
            case 'Achto Tempest body': return '<:Achto_Tempest_body_detail:1406304662109556857>';
            case 'Achto Tempest boots': return '<:Achto_Tempest_boots_detail:1406304657797681234>';
            case 'Achto Tempest chaps': return '<:Achto_Tempest_chaps_detail:1406304654480117780>';
            case 'Achto Tempest cowl': return '<:Achto_Tempest_cowl_detail:1406304583747113154>';
            case 'Achto Tempest gloves': return '<:Achto_Tempest_gloves:1406304580115107860>';
            case 'Achto Teralith boots': return '<:Achto_Teralith_boots:1406304576830705757>';
            case 'Achto Teralith cuirass': return '<:Achto_Teralith_cuirass:1406304573358084189>';
            case 'Achto Teralith gauntlets': return '<:Achto_Teralith_gauntlets:1406304569448861807>';
            case 'Achto Teralith helmet': return '<:Achto_Teralith_helmet:1406304698897797230>';
            case 'Achto Teralith leggings': return '<:Achto_Teralith_leggings:1406304696313974826>';
            case 'Lil\' Tuzzy': return '<:Lil_Tuzzy:1406302944617566228>';
            case 'Praesul codex': return '<:Praesul_codex:1406302971414839306>';
            case 'Wand of the praesul': return '<:Wand_of_the_praesul:1406302968684220506>';
            case 'Imperium core': return '<:Imperium_core:1406302965601407097>';
            case 'Intricate blood stained chest': return '<:Intricate_blood_stained_chest:1406304693445202082>';
            case 'Intricate ice chest': return '<:Intricate_ice_chest:1406304689095704657>';
            case 'Intricate shadow chest': return '<:Intricate_shadow_chest:1406304686637580328>';
            case 'Intricate smoke-shrouded chest': return '<:Intricate_smokeshrouded_chest:1406304683949162547>';
            case 'Eddy': return '<:Eddy_pet:1406302953488519249>';
            case 'Parasitic orb': return '<:Nipper_demon:1406302949415850004>';
            case 'Hexhunter bow': return '<:Hexhunter_bow:1406302963143671989>';
            case 'Soulgazer\'s charm': return '<:Soulgazers_charm:1406304682070249714>';
            case 'Erethdor\'s blightbound crossbow': return '<:Blightbound_crossbow:1406306326510047252>';
            case 'Erethdor\'s offhand blightbound crossbow': return '<:Offhand_Blightbound_crossbow:1406306323834077295>';
            case 'Erethdor\'s grimoire': return '<:Erethdors_grimoire:1406306319648161975>';
            case 'Abomination cape': return '<:Abomination_cape:1406306316921602141>';
            case 'Eldritch crossbow limb': return '<:Eldritch_crossbow_limb:1406306313990045796>';
            case 'Eldritch crossbow stock': return '<:Eldritch_crossbow_stock:1406306311720800306>';
            case 'Eldritch crossbow mechanism': return '<:Eldritch_crossbow_mechanism:1406306337528352768>';
            case 'Swordy McSwordface': return '<:Swordy_McSwordFace:1406306333623451708>';
            case 'Greater flurry ability codex': return '<:Greater_ability_codex:1406307577838440529>';
            case 'Greater fury ability codex': return '<:Greater_ability_codex:1406307577838440529>';
            case 'Greater barge ability codex': return '<:Greater_ability_codex:1406307577838440529>';
            case 'Statius\'s warhammer': return '<:Statiuss_warhammer:1406306331593281718>';
            case 'Blast diffusion boots': return '<:Blast_diffusion_boots:1406306328846012529>';
            case 'Superior long bone': return '<:Superior_long_bone:1406307573807714365>';
            case 'Tribal fin': return '<:Tribal_fin:1406307569667932221>';
            case 'Volcanic fragments': return '<:Volcanic_fragments:1406307567248085012>';
            case 'Inquisitor\'s staff censer': return '<:Inquisitors_staff_censer:1406307564647612568>';
            case 'Inquisitor\'s staff rod': return '<:Inquisitors_staff_rod:1406307560197460060>';
            case 'Inquisitor\'s staff ornament': return '<:Inquisitors_staff_ornament:1406307557399855134>';
            case 'Spear of Annihilation tip': return '<:Spear_of_Annihilation_tip:1406307554010857674>';
            case 'Divert ability codex': return '<:Divert_ability_codex:1406307585656754207>';
            case 'Greater Chain ability codex': return '<:Greater_Chain_ability_codex:1406308889678446632>';
            case 'Greater Ricochet ability codex': return '<:Greater_Ricochet_ability_codex:1406308887585624185>';
            case 'Fleeting boots': return '<:Fleeting_boots:1406307581378691132>';
            case 'Shadow spike': return '<:Shadow_spike:1406312347886288967>';
            case 'Heart of the Archer': return '<:Heart_of_the_Archer:1406308891394048000>';
            case 'Heart of the Berserker': return '<:Heart_of_the_Berserker:1406308883525402804>';
            case 'Heart of the Seer': return '<:Heart_of_the_Seer:1406308881268867163>';
            case 'Heart of the Warrior': return '<:Heart_of_the_Warrior:1406308878924124210>';
            case 'Savage spear cap': return '<:Savage_spear_cap:1406308911853867058>';
            case 'Savage spear tip': return '<:Savage_spear_tip:1406308908863193131>';
            case 'Savage spear shaft': return '<:Savage_spear_shaft:1406308898754789377>';
            case 'Savage plume': return '<:Savage_plume:1406308895856529478>';
            case 'Dormant Zaros godsword': return '<:Dormant_Zaros_godsword:1406312345541673043>';
            case 'Dormant Seren godbow': return '<:Dormant_Seren_godbow:1406312342844866780>';
            case 'Dormant Staff of Sliske': return '<:Dormant_staff_of_Sliske:1406312339946475520>';
            case 'Reprisal ability codex': return '<:Reprisal_ability_codex:1406312337027235870>';
            case 'Orb of pure anima': return '<:Orb_of_pure_anima:1406312333307019445>';
            case 'Orb of volcanic anima': return '<:Orb_of_volcanic_anima:1406312329402126500>';
            case 'Orb of corrupted anima': return '<:Orb_of_corrupted_anima:1406312326251937932>';
            case 'Staff of Armadyl\'s fractured shaft': return '<:Fractured_Armadyl_shaft:1406312361081704498>';
            case 'Fractured stabilisation gem': return '<:Fractured_stabilisation_gem:1406312353405993131>';
            case 'Fractured Armadyl symbol': return '<:Fractured_Armadyl_symbol:1406312350465921245>';
            case 'Greater Concentrated blast ability codex': return '<:Greater_Concentrated_blast:1406313899346755696>';
            case 'a pair of Kerapac\'s wristwraps': return '<:Kerapacs_wrist_wraps:1406313894544277646>';
            case 'Frozen core of Leng': return '<:Frozen_core_of_Leng:1406313887644520540>';
            case 'Leng artefact': return '<:Leng_artefact:1406313884050133012>';
            case 'Croesus foultorch': return '<:Croesus_foultorch:1406313881001005188>';
            case 'Croesus spore sack': return '<:Croesus_spore_sack:1406313878450868224>';
            case 'Croesus sporehammer': return '<:Croesus_sporehammer:1406313875133169764>';
            case 'incomplete Cryptbloom boots': return '<:Cryptbloom_boots_incomplete:1406313872377253910>';
            case 'incomplete Cryptbloom bottoms': return '<:Cryptbloom_bottoms_incomplete:1406313869265076325>';
            case 'incomplete Cryptbloom gloves': return '<:Cryptbloom_gloves_incomplete:1406313865956036770>';
            case 'incomplete Cryptbloom helm': return '<:Cryptbloom_helm_incomplete:1406313863007178802>';
            case 'incomplete Cryptbloom top': return '<:Cryptbloom_top_incomplete:1406313759093297263>';
            case 'Magma Tempest ability codex': return '<:Magma_Tempest_ability_codex:1406313754030772345>';
            case 'Magma core': return '<:Magma_core:1406313750532718613>';
            case 'Ancient hilt': return '<:Ancient_hilt:1406313916929151106>';
            case 'Obsidian blade': return '<:Obsidian_blade:1406313913796005899>';
            case 'Scripture of Jas': return '<:Scripture_of_Jas:1406315404896501890>';
            case 'Scripture of Wen': return '<:Scripture_of_Wen:1406315403134894150>';
            case 'Scripture of Bik': return '<:Scripture_of_Bik:1406315401230549073>';
            case 'Scripture of Ful': return '<:Scripture_of_Ful:1406315398332416020>';
            case 'Bottom of the Last Guardian\'s bow': return '<:Bottom_of_the_Last_Guardians_bow:1406313909182529768>';
            case 'Top of the Last Guardian\'s bow': return '<:Top_of_the_Last_Guardians_bow:1406313905814245406>';
            case 'Divine bowstring': return '<:Divine_bowstring:1406313901930451004>';
            case 'Chaos Roar ability codex': return '<:Chaos_Roar_ability_codex:1406315395543077036>';
            case 'Codex of lost knowledge': return '<:Codex_of_lost_knowledge:1406315391180996608>';
            case 'Vestments of Havoc boots': return '<:Vestments_of_havoc_boots:1406315387779416175>';
            case 'Vestments of Havoc hood': return '<:Vestments_of_havoc_hood:1406315423502438410>';
            case 'Vestments of Havoc Robe Bottom': return '<:Vestments_of_havoc_robe_bottom:1406315419870040197>';
            case 'Vestments of Havoc Robe Top': return '<:Vestments_of_havoc_robe_top:1406315415864344816>';
            case 'Crown of the First Necromancer': return '<:Crown_of_the_First_Necro:1406316395184001064>';
            case 'Robe top of the First Necromancer': return '<:Robe_top_of_the_First_Necro:1406316392050987218>';
            case 'Robe bottom of the First Necromancer': return '<:Robe_bottom_of_the_First_Necro:1406316388146217062>';
            case 'Hand wrap of the First Necromancer': return '<:Hand_wrap_of_the_First_Necro:1406316385172455475>';
            case 'Foot wraps of the First Necromancer': return '<:Foot_wraps_of_the_First_Necro:1406316408576540693>';
            case 'Invoke Lord of Bones incantation codex': return '<:Invoke_Lord_of_Bones_incantation:1406316405875539998>';
            case 'Vorkath\'s scale': return '<:Vorkaths_scale:1406316404042633347>';
            case 'Jail cell key': return '<:Jail_cell_key:1406316402067116062>';
            case 'Occultist\'s ring': return '<:Occultists_ring:1406316400401715310>';
            case 'Balarak\'s sash brush base': return '<:Balaraks_sash_brush_base:1406317850263814236>';
            case 'Balarak\'s sash brush handle': return '<:Balaraks_sash_brush_handle:1406317847839510660>';
            case 'Balarak\'s sash brush head': return '<:Balaraks_sash_brush_head:1406317844764950688>';
            case 'Skeka\'s hypnowand base': return '<:Skekas_hypnowand_base:1406317841170432144>';
            case 'Skeka\'s hypnowand focus': return '<:Skekas_hypnowand_focus:1406317839152975923>';
            case 'Skeka\'s hypnowand handle': return '<:Skekas_hypnowand_handle_detail:1406317835025649816>';
            case 'Skeka\'s hypnowand projector': return '<:Skekas_hypnowand_projector_detai:1406317832232243323>';
            case 'Divine Rage prayer codex': return '<:Divine_Rage_prayer_codex:1406316398006763692>';
            case 'Ode to Deceit': return '<:Ode_to_Deceit_detail:1406317829325721680>';
            case 'Roar of Awakening': return '<:Roar_of_Awakening_detail:1406317826309885982>';
            case 'Scripture of Amascut': return '<:Scripture_of_Amascut:1406317822338142229>';
            case 'Shard of Genesis Essence': return '<:Shard_of_Genesis_Essence:1406317819229900842>';
            case 'Eclipsed Soul prayer codex': return '<:Eclipsed_Soul_prayer_codex:1406317816050749520>';
            case 'Memory dowser': return '<:Memory_dowser:1406317813328642232>';
            case 'Runic attuner': return '<:Runic_attuner:1406317810249891891>';
            case 'Scripture of Elidinis': return '<:Scripture_of_Elidinis:1406317806223491122>';
            case 'Mask of Tumeken\'s resplendence': return '<:Mask_of_Tumekens:1406317802792419359>';
            case 'Robe top of Tumeken\'s resplendence': return '<:Robe_top_of_Tumekens:1406317798422085692>';
            case 'Robe bottom of Tumeken\'s resplendence': return '<:Robe_bottom_of_Tumekens:1406317865568571422>';
            case 'Gloves of Tumeken\'s resplendence': return '<:Gloves_of_Tumekens:1406317862808977429>';
            case 'Boots of Tumeken\'s resplendence': return '<:Boots_of_Tumekens:1406317858312683550>';
            case 'Tumeken\'s Light': return '<:Tumekens_Light:1406317856051826840>';
            case 'Devourer\'s Guard': return '<:Devourers_Guard:1406317853396963478>';
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
