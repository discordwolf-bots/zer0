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
import { ClanMember } from 'runescape-api/lib/RuneScape';
import { request } from 'undici';

import {
    ButtonHandler,
    CommandHandler,
    GuildJoinHandler,
    GuildLeaveHandler,
    MessageHandler,
    ReactionHandler,
} from '../events/index';
import { JobService, Logger } from '../services/index';
import { PartialUtils } from '../utils/index';

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
        switch(itemName.toLowerCase()){
            case 'torva full helm': return '<:Torva_full_helm:1406274647644835952>';
            case 'torva platebody': return '<:Torva_platebody:1406274687016898591>';
            case 'torva platelegs': return '<:Torva_platelegs:1406274722374619237>';
            case 'torva gloves': return '<:Torva_gloves:1406275301218193499>';
            case 'torva boots': return '<:Torva_boots:1406275341516935219>';
            case 'pernix cowl': return '<:Pernix_cowl:1406275752206270578>';
            case 'pernix body': return '<:Pernix_body:1406275825074044958>';
            case 'pernix chaps': return '<:Pernix_chaps:1406275860192821299> ';
            case 'pernix gloves': return '<:Pernix_gloves:1406275943143706847>';
            case 'pernix boots': return '<:Pernix_boots:1406275979109990441>';
            case 'virtus mask': return '<:Virtus_mask:1406281640153452677>';
            case 'virtus robe top': return '<:Virtus_robe_top:1406281677080100894>';
            case 'virtus robe legs': return '<:Virtus_robe_legs:1406281711075065957> ';
            case 'virtus boots': return '<:Virtus_boots:1406281789529526363>';
            case 'virtus gloves': return '<:Virtus_gloves:1406281826682535966>';
            case 'virtus wand': return '<:Virtus_wand:1406281871742206084>';
            case 'virtus book': return '<:Virtus_book:1406281906147954820>';
            case 'zaryte bow': return '<:Zaryte_bow:1406281941556264960>';
            case 'crest of zamorak': return '<:Crest_of_Zamorak:1406299969073184939>';
            case 'crest of sliske': return '<:Crest_of_Sliske:1406300002174898236>';
            case 'crest of zaros': return '<:Crest_of_Zaros:1406300041202765944>';
            case 'crest of seren': return '<:Crest_of_Seren:1406300072118976573>';
            case 'dragon rider lance': return '<:Dragon_Rider_lance:1406300204269047930>';
            case 'shadow glaive': return '<:Shadow_glaive:1406300240658698342>';
            case 'off-hand shadow glaive': return '<:Offhand_shadow_glaive:1406300292206825615>';
            case 'wand of the cywir elders': return '<:Wand_of_the_Cywir_elders:1406300406270656542>';
            case 'ord of the cywir elders': return '<:Orb_of_the_Cywir_elders:1406300451191783444>';
            case 'seismic wand': return '<:Seismic_wand:1406300492010885181>';
            case 'seismic singularity': return '<:Seismic_singularity:1406300530262675518>';
            case 'drygore longsword': return '<:Drygore_longsword:1406301546135683202>';
            case 'drygore mace': return '<:Drygore_mace:1406301578633416754>';
            case 'drygore rapier': return '<:Drygore_rapier:1406301612414337175>';
            case 'off-hand drygore longsword': return '<:Offhand_drygore_longsword:1406301663936909362>';
            case 'off-hand drygore mace': return '<:Offhand_drygore_mace:1406301719750508725>';
            case 'off-hand drygore rapier': return '<:Offhand_drygore_rapier:1406301756018921613>';
            case 'arraxi\'s eye': return '<:Araxxis_eye:1406301798326603796>';
            case 'arraxi\'s fang': return '<:Araxxis_fang:1406301873320755320>';
            case 'arraxi\'s web': return '<:Araxxis_web:1406301910092484669>';
            case 'wyrm heart': return '<:Wyrm_heart:1406302960681484471>';
            case 'wyrm scalp': return '<:Wyrm_scalp:1406302958672678992>';
            case 'wyrm spike': return '<:Wyrm_spike:1406302956013486182>';
            case 'mazcab ability codex': return '<:Mazcab_ability_codex:1406302947532345404>';
            case 'pair achto primeval boots': return '<:Achto_Primeval_boots:1406304680031682650>';
            case 'achto primeval gloves': return '<:Achto_Primeval_gloves:1406304675677995079>';
            case 'achto primeval mask': return '<:Achto_Primeval_mask:1406304671827759145>';
            case 'achto primeval robe legs': return '<:Achto_Primeval_robe_legs_detail:1406304668279378082>';
            case 'achto primeval robe top': return '<:Achto_Primeval_robe_top_detail:1406304665229856808>';
            case 'achto tempest body': return '<:Achto_Tempest_body_detail:1406304662109556857>';
            case 'pair achto tempest boots': return '<:Achto_Tempest_boots_detail:1406304657797681234>';
            case 'achto tempest chaps': return '<:Achto_Tempest_chaps_detail:1406304654480117780>';
            case 'achto tempest cowl': return '<:Achto_Tempest_cowl_detail:1406304583747113154>';
            case 'achto tempest gloves': return '<:Achto_Tempest_gloves:1406304580115107860>';
            case 'pair achto teralith boots': return '<:Achto_Teralith_boots:1406304576830705757>';
            case 'achto teralith cuirass': return '<:Achto_Teralith_cuirass:1406304573358084189>';
            case 'achto teralith gauntlets': return '<:Achto_Teralith_gauntlets:1406304569448861807>';
            case 'achto teralith helmet': return '<:Achto_Teralith_helmet:1406304698897797230>';
            case 'achto teralith leggings': return '<:Achto_Teralith_leggings:1406304696313974826>';
            case 'lil\' tuzzy': return '<:Lil_Tuzzy:1406302944617566228>';
            case 'praesul codex': return '<:Praesul_codex:1406302971414839306>';
            case 'wand of the praesul': return '<:Wand_of_the_praesul:1406302968684220506>';
            case 'imperium core': return '<:Imperium_core:1406302965601407097>';
            case 'intricate blood stained chest': return '<:Intricate_blood_stained_chest:1406304693445202082>';
            case 'intricate ice chest': return '<:Intricate_ice_chest:1406304689095704657>';
            case 'intricate shadow chest': return '<:Intricate_shadow_chest:1406304686637580328>';
            case 'intricate smoke-shrouded chest': return '<:Intricate_smokeshrouded_chest:1406304683949162547>';
            case 'eddy': return '<:Eddy_pet:1406302953488519249>';
            case 'parasitic orb': return '<:Nipper_demon:1406302949415850004>';
            case 'hexhunter bow': return '<:Hexhunter_bow:1406302963143671989>';
            case 'soulgazer\'s charm': return '<:Soulgazers_charm:1406304682070249714>';
            case 'erethdor\'s blightbound crossbow': return '<:Blightbound_crossbow:1406306326510047252>';
            case 'erethdor\'s offhand blightbound crossbow': return '<:Offhand_Blightbound_crossbow:1406306323834077295>';
            case 'erethdor\'s grimoire': return '<:Erethdors_grimoire:1406306319648161975>';
            case 'abomination cape': return '<:Abomination_cape:1406306316921602141>';
            case 'eldritch crossbow limb': return '<:Eldritch_crossbow_limb:1406306313990045796>';
            case 'eldritch crossbow stock': return '<:Eldritch_crossbow_stock:1406306311720800306>';
            case 'eldritch crossbow mechanism': return '<:Eldritch_crossbow_mechanism:1406306337528352768>';
            case 'swordy mcswordface': return '<:Swordy_McSwordFace:1406306333623451708>';
            case 'greater flurry ability codex': return '<:Greater_ability_codex:1406307577838440529>';
            case 'greater fury ability codex': return '<:Greater_ability_codex:1406307577838440529>';
            case 'greater barge ability codex': return '<:Greater_ability_codex:1406307577838440529>';
            case 'statius\'s warhammer': return '<:Statiuss_warhammer:1406306331593281718>';
            case 'blast diffusion boots': return '<:Blast_diffusion_boots:1406306328846012529>';
            case 'superior long bone': return '<:Superior_long_bone:1406307573807714365>';
            case 'tribal fin': return '<:Tribal_fin:1406307569667932221>';
            case 'volcanic fragments': return '<:Volcanic_fragments:1406307567248085012>';
            case 'inquisitor\'s staff censer': return '<:Inquisitors_staff_censer:1406307564647612568>';
            case 'inquisitor\'s staff rod': return '<:Inquisitors_staff_rod:1406307560197460060>';
            case 'inquisitor\'s staff ornament': return '<:Inquisitors_staff_ornament:1406307557399855134>';
            case 'spear of annihilation tip': return '<:Spear_of_Annihilation_tip:1406307554010857674>';
            case 'divert ability codex': return '<:Divert_ability_codex:1406307585656754207>';
            case 'greater chain ability codex': return '<:Greater_Chain_ability_codex:1406308889678446632>';
            case 'greater ricochet ability codex': return '<:Greater_Ricochet_ability_codex:1406308887585624185>';
            case 'fleeting boots': return '<:Fleeting_boots:1406307581378691132>';
            case 'shadow spike': return '<:Shadow_spike:1406312347886288967>';
            case 'heart of the archer': return '<:Heart_of_the_Archer:1406308891394048000>';
            case 'heart of the berserker': return '<:Heart_of_the_Berserker:1406308883525402804>';
            case 'heart of the seer': return '<:Heart_of_the_Seer:1406308881268867163>';
            case 'heart of the warrior': return '<:Heart_of_the_Warrior:1406308878924124210>';
            case 'savage spear cap': return '<:Savage_spear_cap:1406308911853867058>';
            case 'savage spear tip': return '<:Savage_spear_tip:1406308908863193131>';
            case 'savage spear shaft': return '<:Savage_spear_shaft:1406308898754789377>';
            case 'savage plume': return '<:Savage_plume:1406308895856529478>';
            case 'dormant zaros godsword': return '<:Dormant_Zaros_godsword:1406312345541673043>';
            case 'dormant seren godbow': return '<:Dormant_Seren_godbow:1406312342844866780>';
            case 'dormant staff of sliske': return '<:Dormant_staff_of_Sliske:1406312339946475520>';
            case 'reprisal ability codex': return '<:Reprisal_ability_codex:1406312337027235870>';
            case 'orb of pure anima': return '<:Orb_of_pure_anima:1406312333307019445>';
            case 'orb of volcanic anima': return '<:Orb_of_volcanic_anima:1406312329402126500>';
            case 'orb of corrupted anima': return '<:Orb_of_corrupted_anima:1406312326251937932>';
            case 'staff of armadyl\'s fractured shaft': return '<:Fractured_Armadyl_shaft:1406312361081704498>';
            case 'fractured stabilisation gem': return '<:Fractured_stabilisation_gem:1406312353405993131>';
            case 'fractured armadyl symbol': return '<:Fractured_Armadyl_symbol:1406312350465921245>';
            case 'greater concentrated blast ability codex': return '<:Greater_Concentrated_blast:1406313899346755696>';
            case 'a pair of kerapac\'s wristwraps': return '<:Kerapacs_wrist_wraps:1406313894544277646>';
            case 'frozen core of Leng': return '<:Frozen_core_of_Leng:1406313887644520540>';
            case 'leng artefact': return '<:Leng_artefact:1406313884050133012>';
            case 'croesus foultorch': return '<:Croesus_foultorch:1406313881001005188>';
            case 'croesus spore sack': return '<:Croesus_spore_sack:1406313878450868224>';
            case 'croesus sporehammer': return '<:Croesus_sporehammer:1406313875133169764>';
            case 'incomplete cryptbloom boots': return '<:Cryptbloom_boots_incomplete:1406313872377253910>';
            case 'incomplete cryptbloom bottoms': return '<:Cryptbloom_bottoms_incomplete:1406313869265076325>';
            case 'incomplete cryptbloom gloves': return '<:Cryptbloom_gloves_incomplete:1406313865956036770>';
            case 'incomplete cryptbloom helm': return '<:Cryptbloom_helm_incomplete:1406313863007178802>';
            case 'incomplete cryptbloom top': return '<:Cryptbloom_top_incomplete:1406313759093297263>';
            case 'magma tempest ability codex': return '<:Magma_Tempest_ability_codex:1406313754030772345>';
            case 'magma core': return '<:Magma_core:1406313750532718613>';
            case 'ancient hilt': return '<:Ancient_hilt:1406313916929151106>';
            case 'obsidian blade': return '<:Obsidian_blade:1406313913796005899>';
            case 'scriptures of jas': return '<:Scripture_of_Jas:1406315404896501890>';
            case 'scriptures of wen': return '<:Scripture_of_Wen:1406315403134894150>';
            case 'scriptures of bik': return '<:Scripture_of_Bik:1406315401230549073>';
            case 'scriptures of ful': return '<:Scripture_of_Ful:1406315398332416020>';
            case 'bottom of the last guardian\'s bow': return '<:Bottom_of_the_Last_Guardians_bow:1406313909182529768>';
            case 'top of the last guardian\'s bow': return '<:Top_of_the_Last_Guardians_bow:1406313905814245406>';
            case 'divine bowstring': return '<:Divine_bowstring:1406313901930451004>';
            case 'chaos roar ability codex': return '<:Chaos_Roar_ability_codex:1406315395543077036>';
            case 'codex of lost knowledge': return '<:Codex_of_lost_knowledge:1406315391180996608>';
            case 'vestments of havoc boots': return '<:Vestments_of_havoc_boots:1406315387779416175>';
            case 'vestments of havoc hood': return '<:Vestments_of_havoc_hood:1406315423502438410>';
            case 'vestments of havoc robe bottom': return '<:Vestments_of_havoc_robe_bottom:1406315419870040197>';
            case 'vestments of havoc robe top': return '<:Vestments_of_havoc_robe_top:1406315415864344816>';
            case 'crown of the first necromancer': return '<:Crown_of_the_First_Necro:1406316395184001064>';
            case 'robe top of the first necromancer': return '<:Robe_top_of_the_First_Necro:1406316392050987218>';
            case 'robe bottom of the first necromancer': return '<:Robe_bottom_of_the_First_Necro:1406316388146217062>';
            case 'hand wrap of the first necromancer': return '<:Hand_wrap_of_the_First_Necro:1406316385172455475>';
            case 'foot wraps of the first necromancer': return '<:Foot_wraps_of_the_First_Necro:1406316408576540693>';
            case 'invoke lord of bones incantation codex': return '<:Invoke_Lord_of_Bones_incantation:1406316405875539998>';
            case 'vorkath\'s scale': return '<:Vorkaths_scale:1406316404042633347>';
            case 'jail cell key': return '<:Jail_cell_key:1406316402067116062>';
            case 'occultist\'s ring': return '<:Occultists_ring:1406316400401715310>';
            case 'balarak\'s sash brush base': return '<:Balaraks_sash_brush_base:1406317850263814236>';
            case 'balarak\'s sash brush handle': return '<:Balaraks_sash_brush_handle:1406317847839510660>';
            case 'balarak\'s sash brush head': return '<:Balaraks_sash_brush_head:1406317844764950688>';
            case 'skeka\'s hypnowand base': return '<:Skekas_hypnowand_base:1406317841170432144>';
            case 'skeka\'s hypnowand focus': return '<:Skekas_hypnowand_focus:1406317839152975923>';
            case 'skeka\'s hypnowand handle': return '<:Skekas_hypnowand_handle_detail:1406317835025649816>';
            case 'skeka\'s hypnowand projector': return '<:Skekas_hypnowand_projector_detai:1406317832232243323>';
            case 'divine rage prayer codex': return '<:Divine_Rage_prayer_codex:1406316398006763692>';
            case 'ode to deceit': return '<:Ode_to_Deceit_detail:1406317829325721680>';
            case 'roar of awakening': return '<:Roar_of_Awakening_detail:1406317826309885982>';
            case 'scripture of amascut': return '<:Scripture_of_Amascut:1406317822338142229>';
            case 'shard of genesis essence': return '<:Shard_of_Genesis_Essence:1406317819229900842>';
            case 'eclipsed soul prayer codex': return '<:Eclipsed_Soul_prayer_codex:1406317816050749520>';
            case 'memory dowser': return '<:Memory_dowser:1406317813328642232>';
            case 'runic attuner': return '<:Runic_attuner:1406317810249891891>';
            case 'scripture of elidinis': return '<:Scripture_of_Elidinis:1406317806223491122>';
            case 'mask of tumeken\'s resplendence': return '<:Mask_of_Tumekens:1406317802792419359>';
            case 'robe top of tumeken\'s resplendence': return '<:Robe_top_of_Tumekens:1406317798422085692>';
            case 'robe bottom of tumeken\'s resplendence': return '<:Robe_bottom_of_Tumekens:1406317865568571422>';
            case 'gloves of tumeken\'s resplendence': return '<:Gloves_of_Tumekens:1406317862808977429>';
            case 'boots of tumeken\'s resplendence': return '<:Boots_of_Tumekens:1406317858312683550>';
            case 'tumeken\'s light': return '<:Tumekens_Light:1406317856051826840>';
            case 'devourer\'s guard': return '<:Devourers_Guard:1406317853396963478>';
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
