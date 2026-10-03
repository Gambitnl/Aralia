/**
 * @file backgroundBrief.ts — Deterministic mini-backstories for generated NPCs.
 *
 * WHAT: Turns the context an NPC is generated in (role + biome + culture + age +
 * family ties) into a `BackgroundBrief`: a two-sentence history, a motivation, a
 * secret, and a relationship hook.
 *
 * WHY: Generated NPCs previously carried stats, a family tree, and a role
 * template, but nothing that answered "who is this person and what do they
 * want?". Dialogue, quest hooks, and gossip all need that answer, and they need
 * it to be the SAME answer every time the world regenerates from its seed.
 *
 * DETERMINISM CONTRACT: every choice is drawn from a NAMED stream off the
 * worldforge seed path (`wf:<worldSeed>/npc:<identity>/s:<field>`), the same
 * frozen `fnv1a` mapping the worldforge layers use. Named streams mean adding
 * entries to the `secrets` list of a pack cannot shift which motivation an
 * existing NPC already had. Same input object => byte-identical brief.
 *
 * PRESERVED / FUTURE SPACE: `BackgroundPack` is deliberately data-shaped so the
 * five seeded biome/role combinations below can grow to the full matrix (and
 * later be authored in `src/data/`, or post-processed by an LLM pass) without
 * touching the resolver. `sourcePackId` and `seedPath` are carried on the brief
 * so a later pass can trace, cache, or override a specific brief.
 *
 * Called by: services/npcGenerator.ts (every generated NPC).
 * Depends on: systems/worldforge/seedPath (frozen hashing), types/village (the
 * project's existing culture / biome-style vocabularies).
 */

import type { VillagePersonality } from '../../types/village';
import type { RichNPC } from '../../types/world';
import { fnv1a, makeSeedPath, streamPath, type SeedPath } from '../worldforge/seedPath';

// ============================================================================
// Public shape
// ============================================================================

/** Roles the NPC generator can produce. Mirrors `NPCGenerationConfig['role']`. */
export type NpcBackgroundRole = 'merchant' | 'quest_giver' | 'guard' | 'civilian' | 'unique';

/** Reuses the project's existing biome-style vocabulary (see types/village.ts). */
export type NpcBackgroundBiome = VillagePersonality['biomeStyle'];

/** Reuses the project's existing culture vocabulary (see types/village.ts). */
export type NpcBackgroundCulture = VillagePersonality['culture'];

/**
 * A family tie the hook can point at. Structural on purpose: `FamilyMember`
 * from types/world.ts satisfies it without this module depending on world.ts.
 */
export interface BackgroundFamilyTie {
  name: string;
  relation: string;
  isAlive?: boolean;
}

/** The context a brief is derived from. Same input => same brief. */
export interface BackgroundBriefInput {
  /** World seed. Omitted only in isolated tests; defaults to 0. */
  worldSeed?: number;
  /**
   * Stable per-NPC identity (id or full name). Two NPCs with identical
   * role/biome/culture/age must still read differently, so identity is part of
   * the seed path rather than of the content selection.
   */
  identity: string;
  role: NpcBackgroundRole;
  /** Biome style of the place the NPC was generated in. */
  biome?: NpcBackgroundBiome;
  /** Local culture. Colors the motivation clause. */
  culture?: NpcBackgroundCulture;
  age?: number;
  /** Race maturity age, so "young" means young FOR AN ELF, not for a human. */
  maturityAge?: number;
  familyTies?: readonly BackgroundFamilyTie[];
  gender?: 'male' | 'female';
}

/** The generated mini-backstory attached to every generated NPC. */
export interface BackgroundBrief {
  /** Two sentences: where they came from, and what changed. */
  history: string;
  /** What they are working toward right now. */
  motivation: string;
  /** Something they would rather the party did not learn. */
  secret: string;
  /** A named person the party can be pointed at. */
  relationshipHook: string;
  /** Which pack produced this brief — `<biome>:<role>` or `role:<role>`. */
  sourcePackId: string;
  /** The seed path every field was drawn from. Regenerates the brief exactly. */
  seedPath: SeedPath;
}

// ============================================================================
// Content packs
// ============================================================================
// Placeholders resolved by `fill()`:
//   {They} {they} {their} {them}       — pronouns
//   {are} {have} {were} {do} {s}      — verb agreement (singular vs. neutral 'they')
//   {name}                       — the NPC's identity string
//   {kin}                        — a resolved living family member phrase
// ============================================================================

interface BackgroundPack {
  id: string;
  /**
   * Sentence one: where this person came from.
   *
   * PAIRED WITH `turningPoints` BY INDEX. Drawing the two halves independently
   * produced contradictions ("a dock clerk... a storm took the boat"), so entry
   * N of `origins` must be the setup for entry N of `turningPoints`. Keep the
   * two arrays the same length when extending a pack.
   */
  origins: readonly string[];
  /** Sentence two: what moved them here. Paired by index with `origins`. */
  turningPoints: readonly string[];
  motivations: readonly string[];
  secrets: readonly string[];
  /** Relationship hooks. `{kin}` is substituted with a real family member. */
  hooks: readonly string[];
}

/**
 * The five seeded biome/role combinations the task asked to start with. Keys
 * are `<biomeStyle>:<role>`; anything not covered falls through to ROLE_PACKS,
 * so every generated NPC still gets a brief.
 */
const BIOME_ROLE_PACKS: Readonly<Record<string, BackgroundPack>> = {
  'coastal:merchant': {
    id: 'coastal:merchant',
    origins: [
      'a fisherman out of the shell-lime harbor towns, hauling nets before {they} could read a ledger',
      'the youngest hand on a salt-trader that ran the coast road twice a season',
      'a dock clerk who counted other captains’ catches for a tenth of a share',
    ],
    turningPoints: [
      'A winter storm took the boat and most of the crew, so {they} moved inland and started selling what {they} could carry.',
      'The harbor guild raised its berth fee past what the catch was worth, and {they} sold the last of the tackle to buy a stall.',
      'The shipping factor {they} tallied for collapsed and took the office with it, and {they} came inland to trade where that name means nothing.',
    ],
    motivations: [
      'Wants to save enough to buy back a boat and return to the sea',
      'Wants to clear the old harbor debt before the factor sends someone to collect',
      'Wants a stall on the main square, where the coast traders stop first',
    ],
    secrets: [
      'Smuggles untaxed coastal goods through the market in salt barrels',
      'Sells charts copied from a wreck {they} never reported',
      'Still owes a harbor gang a share of every season’s profit',
    ],
    hooks: [
      '{kin} runs the inn across town and takes deliveries {they} would rather not sign for',
      '{kin} still crews out of the old harbor and carries messages down the coast road',
      '{kin} keeps the ledger {they} will not let anyone else read',
    ],
  },

  'temperate:civilian': {
    id: 'temperate:civilian',
    origins: [
      'raised on a tenant farm three valleys over, third of five and the one who stayed',
      'a miller’s child who learned the town’s gossip before {they} learned the trade',
      'a hedge-road carter’s child, in a different village every market day',
    ],
    turningPoints: [
      'A bad harvest year emptied the farm, and {they} walked here for work and simply never left.',
      'The mill burned in a dry summer and the family scattered, leaving {them} the only one still in the district.',
      'A marriage brought {them} to this town, and the marriage did not last as long as the residency did.',
    ],
    motivations: [
      'Wants to own the plot {they} currently rent{s} before {their} back gives out',
      'Wants the family name back on the district rolls',
      'Wants nothing more than a quiet year, and is quietly furious that {they} cannot have one',
    ],
    secrets: [
      'Has been skimming grain from the tithe store since the lean year',
      'Knows who set the mill fire and has never said',
      'Is hiding a relative who ran from a labor contract',
    ],
    hooks: [
      '{kin} works the tithe barn and can get anyone through the back door',
      '{kin} married into the reeve’s household and hears every ruling early',
      '{kin} owes half the street money and uses {their} name as collateral',
    ],
  },

  'highland:guard': {
    id: 'highland:guard',
    origins: [
      'a shepherd on the high pastures, watching for cats and raiders before {they} ever watched a gate',
      'levied out of a crag village at sixteen to hold a pass nobody could name',
      'born to a line of pass-wardens who have taken the same oath for four generations',
    ],
    turningPoints: [
      'A raid came over the ridge one autumn and took the pasture, and {they} took the town’s coin instead.',
      'The pass company was disbanded after the treaty, and {they} came down to a paid post with worse pay and better walls.',
      'A winter of raids put {their} name on the muster the way it had put every ancestor’s there, and the town wall is where the oath is served now.',
    ],
    motivations: [
      'Wants a transfer back to the pass road before {they} forget{s} what open sky feels like',
      'Wants to send enough coin uphill that the family does not have to winter in the low town',
      'Wants the raiders named and the ledger closed, whatever the treaty says',
    ],
    secrets: [
      'Lets highland kin through the gate after curfew without recording it',
      'Took the raiders’ coin once, on a night nothing happened, and has never spent it',
      'Was the only survivor of a watch that should not have been sleeping',
    ],
    hooks: [
      '{kin} still keeps the family holding above the pass and shelters whoever {they} send{s} up',
      '{kin} serves in the same watch and covers {their} shifts without asking why',
      '{kin} trades over the ridge and knows every path the toll road does not',
    ],
  },

  'arid:quest_giver': {
    id: 'arid:quest_giver',
    origins: [
      'a caravan water-master on the deep desert routes, responsible for how much everyone drank',
      'a well-keeper for an oasis settlement that no longer appears on any current map',
      'a survey scribe sent to chart the dry basins and paid by the league walked',
    ],
    turningPoints: [
      'The route’s last reliable well went bitter, and {they} came here to find someone willing to go back and find out why.',
      'The settlement emptied in one season, and {they} {have} been trying to hire an escort back ever since.',
      'The survey found something the sponsors buried the report on, and {they} {are} funding a second look out of pocket.',
    ],
    motivations: [
      'Wants the dry route reopened before the caravan families give it up for good',
      'Wants to know what emptied the oasis, and will pay past what {they} can afford',
      'Wants the buried survey read aloud in front of the people who buried it',
    ],
    secrets: [
      'Rationed the water on the last crossing in a way {they} {have} never described accurately',
      'Already sent one party out and has not told anyone they never came back',
      'Is spending guild money that was not allocated for this',
    ],
    hooks: [
      '{kin} still holds the deed to the dry well and will not sell it',
      '{kin} drives the last caravan that will take the route and owes {them} a passage',
      '{kin} kept the original survey pages and hid them in town',
    ],
  },

  'swampy:unique': {
    id: 'swampy:unique',
    origins: [
      'raised on stilts over black water, in a fen village that measures wealth in dry firewood',
      'a bog-cutter’s apprentice who pulled older, stranger things than peat out of the ground',
      'a fen guide who took surveyors in and, most seasons, brought them back out',
    ],
    turningPoints: [
      'Something in the deep fen took an interest in {them}, and {they} {have} been putting distance between {them} and it ever since.',
      'The village drowned in a single flood season and {they} walked out carrying what the bog gave up.',
      'A survey party paid {them} to forget a place, and {they} took the coin and did not forget.',
    ],
    motivations: [
      'Wants to be far enough from the fen that the dreams stop',
      'Wants to find the rest of what the bog preserved before someone else does',
      'Wants to warn the right person, and has not decided who that is',
    ],
    secrets: [
      'Carries something out of the bog that has not stopped being warm',
      'Was the reason the survey party went the way they went',
      'Answers to a name from the fen that nobody here has heard',
    ],
    hooks: [
      '{kin} is the last of the fen village still alive and lives two streets over',
      '{kin} buys whatever {they} bring{s} up out of the water, no questions asked',
      '{kin} came out of the fen behind {them} and has been asking after {them} since',
    ],
  },
};

/**
 * Role-only fallbacks. Every role has one, so an NPC generated with no biome or
 * culture context still gets a coherent brief rather than an empty field.
 */
const ROLE_PACKS: Readonly<Record<NpcBackgroundRole, BackgroundPack>> = {
  merchant: {
    id: 'role:merchant',
    origins: [
      'a pack-peddler’s child who learned prices before letters',
      'a warehouse tally-hand for a house that no longer trades here',
      'an apprentice to a trader who taught {them} the trade and none of the contacts',
    ],
    turningPoints: [
      'A caravan {they} had staked everything on came back one wagon short, and {they} {have} been rebuilding since.',
      'The house folded in a bad season, and {they} bought its last stock at auction and started over alone.',
      'A better road opened past this town, so {they} settled where the old road still brings custom.',
    ],
    motivations: [
      'Wants a second stall, and a name worth more than the stock',
      'Wants to be out of debt before the next audit',
      'Wants to be the buyer the caravans come to first',
    ],
    secrets: [
      'Keeps two ledgers and shows the auditor the thinner one',
      'Fences goods for a crew {they} would not name under oath',
      'Sold a forged provenance once and the buyer is still in town',
    ],
    hooks: [
      '{kin} runs a stall on the far side of the market and quietly splits the takings',
      '{kin} handles the deliveries {they} {do} not want {their} name on',
      '{kin} lent {them} the stake money and has started asking about it',
    ],
  },
  quest_giver: {
    id: 'role:quest_giver',
    origins: [
      'a minor clerk whose office covered more ground than its budget',
      'the last responsible adult of a household that used to be larger',
      'a factor for a concern that has stopped answering letters',
    ],
    turningPoints: [
      'The problem {they} {were} supposed to report got worse while the report sat unread, so {they} started hiring instead.',
      'Someone {they} {are} responsible for is missing, and the town has decided that is not the town’s problem.',
      'Every official channel came back closed, and {they} {are} now spending {their} own coin on the matter.',
    ],
    motivations: [
      'Wants the matter closed before it becomes public',
      'Wants the missing accounted for, alive or otherwise',
      'Wants proof solid enough that the office cannot shelve it again',
    ],
    secrets: [
      'Caused the problem {they} {are} now hiring people to solve',
      'Has already hired one party and cannot say what became of them',
      'Is paying with money that belongs to someone else',
    ],
    hooks: [
      '{kin} works inside the office and passes {them} what the record does not show',
      '{kin} is the one {they} {are} actually looking for',
      '{kin} advised against all of this and is still helping anyway',
    ],
  },
  guard: {
    id: 'role:guard',
    origins: [
      'a levy recruit from a district that sends its spare sons to the walls',
      'a caravan escort who wanted a post that did not move',
      'the child of a watch sergeant, on the roster before {they} chose it',
    ],
    turningPoints: [
      'A bad night on the gate cost {them} a friend and any taste for the road, so {they} took the fixed post and kept it.',
      'The company was cut after the last treaty, and this watch was the only roster still hiring.',
      'A promotion {they} had earned went to someone else’s cousin, and {they} {have} been walking the same wall since.',
    ],
    motivations: [
      'Wants the sergeant’s stripe {they} {were} passed over for',
      'Wants a quiet watch and one honest pension',
      'Wants to finish an investigation the captain ordered closed',
    ],
    secrets: [
      'Takes a small toll at the gate that appears on no ledger',
      'Let someone through once who should have been held',
      'Is reporting on {their} own watch to someone outside it',
    ],
    hooks: [
      '{kin} keeps the tavern the whole watch drinks at and hears everything first',
      '{kin} serves on the opposite shift and swaps rosters with {them}',
      '{kin} is on the list {they} {are} supposed to be watching for',
    ],
  },
  civilian: {
    id: 'role:civilian',
    origins: [
      'born four streets from where {they} still stand{s} and rarely further',
      'brought here as a child by a parent chasing work that did not last',
      'a journeyman who ran out of road and stayed',
    ],
    turningPoints: [
      'The trade {they} trained for stopped paying, and {they} {have} been patching a living together ever since.',
      'A death in the household turned an ordinary life into a ledger of obligations.',
      'A good year let {them} put down a deposit, and everything since has been about keeping it.',
    ],
    motivations: [
      'Wants the household solvent through one more winter',
      'Wants a child of theirs apprenticed somewhere with a future',
      'Wants to be spoken of as someone who mattered on this street',
    ],
    secrets: [
      'Owes money to someone the watch would like to meet',
      'Saw something on the night everyone is asking about',
      'Has been quietly selling off the family’s last valuables',
    ],
    hooks: [
      '{kin} lives in the same house and knows every one of {their} moods',
      '{kin} works for the person {they} owe{s} money to',
      '{kin} is the only one who still writes to {them}',
    ],
  },
  unique: {
    id: 'role:unique',
    origins: [
      'from somewhere {they} name{s} differently depending on who is asking',
      'the sole survivor of an expedition whose sponsors deny it existed',
      'a former member of an order that does not acknowledge former members',
    ],
    turningPoints: [
      'Something happened on the road here that {they} will describe only in outline, and it is why {they} stopped moving.',
      'What {they} carried out is worth more than what {they} left behind, and {they} {are} still deciding what to do with it.',
      'The order came looking, and this town is far enough down the map to be worth trying.',
    ],
    motivations: [
      'Wants to stay lost for one more season',
      'Wants to hand what {they} {are} carrying to someone who can be trusted with it',
      'Wants the record corrected, even if it costs {them} the anonymity',
    ],
    secrets: [
      'Is traveling under a name that belonged to someone else',
      'Is being followed, and knows exactly by whom',
      'Left someone behind who could have been brought out',
    ],
    hooks: [
      '{kin} is the only person here who knows {their} real name',
      '{kin} shelters {them} and has never asked what for',
      '{kin} came looking for {them} and has not yet been noticed',
    ],
  },
};

/**
 * Culture qualifiers appended to the motivation. Culture is already part of the
 * seed path, so it perturbs every draw; this clause makes it legible in the
 * output rather than only statistical.
 */
const CULTURE_MOTIVATION_CLAUSE: Readonly<Record<NpcBackgroundCulture, string>> = {
  stoic: 'and will not be the one to bring it up',
  festive: 'and talks about it freely, usually after the second drink',
  scholarly: 'and has written down exactly what it would cost',
  martial: 'and treats it as an obligation rather than a wish',
};

/** Age leads, so the history reads its subject's age rather than implying it. */
const AGE_LEADS: Readonly<Record<AgeBand, readonly string[]>> = {
  young: ['Barely out of apprenticeship,', 'Young enough that people still ask whose child {they} {are},'],
  prime: ['In the working middle of {their} life,', 'Settled, if not comfortable,'],
  veteran: ['After decades at it,', 'Old enough now that the trade has outlasted most of {their} peers,'],
};

type AgeBand = 'young' | 'prime' | 'veteran';

// ============================================================================
// Resolver
// ============================================================================

/** Deterministic index into a list from a named stream off the brief's path. */
function pickIndex(path: SeedPath, stream: string, length: number): number {
  if (length <= 0) return 0;
  return fnv1a(streamPath(path, stream)) % length;
}

function pick<T>(path: SeedPath, stream: string, list: readonly T[]): T {
  return list[pickIndex(path, stream, list.length)];
}

/**
 * Age band relative to the race's own maturity age, so a 120-year-old elf is
 * not filed as a veteran human.
 */
function ageBandOf(age: number | undefined, maturityAge: number | undefined): AgeBand {
  if (age === undefined) return 'prime';
  const maturity = maturityAge && maturityAge > 0 ? maturityAge : 18;
  const ratio = age / maturity;
  if (ratio < 1.6) return 'young';
  if (ratio < 3.2) return 'prime';
  return 'veteran';
}

interface Pronouns {
  They: string;
  they: string;
  their: string;
  them: string;
  /** Verb agreement: templates are authored in the neutral "they" voice, and
   *  these forms let one template read correctly for he/she as well. */
  are: string;
  have: string;
  were: string;
  do: string;
  /** Third-person singular verb suffix: "he rents" vs. "they rent". */
  s: string;
}

function pronounsFor(gender: 'male' | 'female' | undefined): Pronouns {
  const singular = { are: 'is', have: 'has', were: 'was', do: 'does', s: 's' };
  if (gender === 'male') return { They: 'He', they: 'he', their: 'his', them: 'him', ...singular };
  if (gender === 'female') return { They: 'She', they: 'she', their: 'her', them: 'her', ...singular };
  return { They: 'They', they: 'they', their: 'their', them: 'them', are: 'are', have: 'have', were: 'were', do: 'do', s: '' };
}

/**
 * Resolve `{kin}` into a real named relative when the NPC has one, so the
 * relationship hook points at a person the party can actually be sent to.
 * Living ties are preferred; a dead relative makes a poor errand.
 */
function resolveKin(
  path: SeedPath,
  ties: readonly BackgroundFamilyTie[] | undefined,
  pronouns: Pronouns,
): string {
  const living = (ties ?? []).filter((tie) => tie.isAlive !== false && !!tie.name);
  if (living.length === 0) {
    // No family on record: fall back to an unnamed but still actionable contact.
    const strangers = [
      `Someone ${pronouns.they} came here with`,
      `An old acquaintance of ${pronouns.them}s`,
      'A neighbor',
    ];
    return pick(path, 'kin-fallback', strangers);
  }
  const tie = pick(path, 'kin', living);
  return `${tie.name}, ${pronouns.their} ${tie.relation},`;
}

function fill(template: string, pronouns: Pronouns, name: string, kin: string): string {
  return template
    .replace(/\{They\}/g, pronouns.They)
    .replace(/\{they\}/g, pronouns.they)
    .replace(/\{their\}/g, pronouns.their)
    .replace(/\{them\}/g, pronouns.them)
    .replace(/\{are\}/g, pronouns.are)
    .replace(/\{have\}/g, pronouns.have)
    .replace(/\{were\}/g, pronouns.were)
    .replace(/\{do\}/g, pronouns.do)
    .replace(/\{s\}/g, pronouns.s)
    .replace(/\{name\}/g, name)
    .replace(/\{kin\}/g, kin);
}

/** Uppercase the first character of a sentence built from a clause fragment. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/**
 * Select the content pack for a context. A `<biome>:<role>` pack wins when one
 * of the seeded combinations matches; otherwise the role fallback is used, so
 * every NPC gets a brief regardless of how much context the caller had.
 */
export function selectBackgroundPack(
  role: NpcBackgroundRole,
  biome?: NpcBackgroundBiome,
): BackgroundPack {
  if (biome) {
    const combo = BIOME_ROLE_PACKS[`${biome}:${role}`];
    if (combo) return combo;
  }
  return ROLE_PACKS[role] ?? ROLE_PACKS.civilian;
}

/** The seed path a brief is drawn from. Exported so callers can cache by it. */
export function backgroundBriefSeedPath(input: BackgroundBriefInput): SeedPath {
  // ONLY caller-stable context belongs in the path. `age` and the family tree
  // are generated INSIDE `generateNPC` from its own (non-seeded) RNG, so keying
  // the path on them would make the brief re-roll on every call for the same
  // NPC. They still shape the OUTPUT deterministically — age picks the age band,
  // the family tree names the relationship hook — they just do not pick the
  // stream. Result: for a fixed world seed and identity the pack, motivation,
  // secret, and hook template are pinned.
  const context = [input.role, input.biome ?? 'any', input.culture ?? 'any'].join('-');
  return makeSeedPath(
    input.worldSeed ?? 0,
    `npc:${input.identity.replace(/\//g, '_') || 'anon'}`,
    'bg',
    `ctx:${context}`,
  );
}

/**
 * Build the deterministic mini-backstory for one NPC.
 *
 * Same input object => identical output, forever: every field is drawn from a
 * named stream off `backgroundBriefSeedPath(input)`.
 */
export function generateBackgroundBrief(input: BackgroundBriefInput): BackgroundBrief {
  const path = backgroundBriefSeedPath(input);
  const pack = selectBackgroundPack(input.role, input.biome);
  const pronouns = pronounsFor(input.gender);
  const kin = resolveKin(path, input.familyTies, pronouns);
  const band = ageBandOf(input.age, input.maturityAge);

  const lead = pick(path, 'age-lead', AGE_LEADS[band]);
  // One draw for both halves: the turning point must follow from the origin.
  const storyIndex = pickIndex(path, 'origin', pack.origins.length);
  const origin = pack.origins[storyIndex];
  const turningPoint = pack.turningPoints[storyIndex] ?? pack.turningPoints[0];
  const motivationCore = pick(path, 'motivation', pack.motivations);
  const secret = pick(path, 'secret', pack.secrets);
  const hook = pick(path, 'hook', pack.hooks);

  const cultureClause = input.culture ? ` ${CULTURE_MOTIVATION_CLAUSE[input.culture]}` : '';

  const sentenceOne = fill(`${lead} {they} {were} ${origin}.`, pronouns, input.identity, kin);
  const sentenceTwo = fill(turningPoint, pronouns, input.identity, kin);

  return {
    history: `${capitalize(sentenceOne)} ${sentenceTwo}`,
    motivation: `${fill(motivationCore, pronouns, input.identity, kin)}${cultureClause}.`,
    secret: `${fill(secret, pronouns, input.identity, kin)}.`,
    relationshipHook: `${capitalize(fill(hook, pronouns, input.identity, kin))}.`,
    sourcePackId: pack.id,
    seedPath: path,
  };
}

/** Ids of the seeded biome/role combinations. Exported for tests and tooling. */
export const SEEDED_BIOME_ROLE_COMBINATIONS: readonly string[] = Object.keys(BIOME_ROLE_PACKS);

/**
 * A `RichNPC` whose biography carries its `BackgroundBrief`.
 *
 * WHY THIS IS NOT A FIELD ON `RichNPC` (yet): `src/types/world.ts` is one of the
 * hottest shared files in the repo and was locked continuously through this
 * task. Three other NPC tasks on the same day shipped the same intersection for
 * the same reason, and a consolidation pass to fold them all onto `RichNPC` is
 * tracked in GLOBAL_GAPS. Widening `generateNPC`'s return type this way is
 * assignable to `RichNPC`, so every existing caller is untouched and reading
 * `npc.biography.background` is fully typed at the generator's call sites.
 */
// 2026-09-09: `biography.background` now lives on `RichNPC` (optional). This alias narrows it
// to REQUIRED for the generator's return type, so call sites of generateNPC stay fully typed.
export type RichNpcWithBackground = RichNPC & {
  biography: RichNPC['biography'] & { background: BackgroundBrief };
};

// ============================================================================
// Coercion from the generator's loose context tags
// ============================================================================
// `NPCGenerationConfig` carries `biomeId` / `cultureId` as free-form strings
// (they also feed speech fingerprinting). Rather than adding a second pair of
// strictly-typed config fields, the brief coerces those tags onto its own
// vocabularies and falls back to the role-only pack when a tag says nothing it
// recognizes. Substring matching is deliberate: settlement ids, culture ids and
// background tags all get passed through these same fields.
// ============================================================================

const BIOME_VOCABULARY: readonly NpcBackgroundBiome[] = [
  'temperate', 'arid', 'coastal', 'swampy', 'tundra', 'jungle', 'volcanic', 'blighted', 'highland', 'polar',
];

/** Extra spellings seen in world data that mean one of the vocabulary entries. */
const BIOME_ALIASES: Readonly<Record<string, NpcBackgroundBiome>> = {
  marine: 'coastal',
  harbor: 'coastal',
  harbour: 'coastal',
  coast: 'coastal',
  ocean: 'coastal',
  sea: 'coastal',
  desert: 'arid',
  marsh: 'swampy',
  wetland: 'swampy',
  swamp: 'swampy',
  bog: 'swampy',
  fen: 'swampy',
  cold: 'tundra',
  taiga: 'tundra',
  glacier: 'polar',
  mountain: 'highland',
  hill: 'highland',
  alpine: 'highland',
  crag: 'highland',
  forest: 'temperate',
  grassland: 'temperate',
  savanna: 'temperate',
  rainforest: 'jungle',
  tropical: 'jungle',
};

const CULTURE_VOCABULARY: readonly NpcBackgroundCulture[] = ['stoic', 'festive', 'scholarly', 'martial'];

/** Map a free-form biome tag onto the brief's biome vocabulary. */
export function coerceBackgroundBiome(tag?: string): NpcBackgroundBiome | undefined {
  if (!tag) return undefined;
  const text = tag.toLowerCase();
  for (const biome of BIOME_VOCABULARY) {
    if (text.includes(biome)) return biome;
  }
  for (const [alias, biome] of Object.entries(BIOME_ALIASES)) {
    if (text.includes(alias)) return biome;
  }
  return undefined;
}

/** Map a free-form culture tag onto the brief's culture vocabulary. */
export function coerceBackgroundCulture(tag?: string): NpcBackgroundCulture | undefined {
  if (!tag) return undefined;
  const text = tag.toLowerCase();
  return CULTURE_VOCABULARY.find((culture) => text.includes(culture));
}
