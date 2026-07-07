/**
 * @file lore.ts
 * @description Derived text — Task 5 of the history-first dungeon generator
 * (spec docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md,
 * tone reference .agent/scratch/dungeon-history-mock-event-logs.md).
 *
 * THE HARD RULE: every emitted sentence is a TRUE statement about a logged
 * `DungeonEvent`. The name comes from the builder identity plus the loudest
 * event; the blurb from the two loudest; room notes only for rooms an event
 * touched; rumor hooks one per event, in spoken register. No syllable-bag
 * generators, no decorative mad-libs — templates may only reference fields
 * present on the event and the room it touched.
 *
 * NOTE CAP (Remy feedback): a dungeon-wide event (awaken sweeping every burial
 * gallery, bloom overtaking 15+ rooms) must not put a near-identical note in
 * EVERY touched room — the keyed map sheet numbers every noted room, so the map
 * degenerated into 39 numbered rooms all reading "the dead don't lie quiet".
 * An event touching more than NOTE_CAP rooms notes only its NOTE_CAP most
 * notable ones: the boss room if touched, then distinctive purposes (chapel,
 * treasury, ossuary… over generic galleries/passages), then deepest. The other
 * touched rooms keep their evidence (props/overlay/spawns — not lore's concern)
 * but get no note. Selection is rng-free and ordered, so it is deterministic.
 *
 * Pure data, zero THREE imports, deterministic from the lore rng stream.
 */

import type { ChronicleKind, DungeonEvent, EventKind, RoomPurpose, RumorHook, WorldIdentity } from './types';
import type { ArchetypeData } from './archetypes';
import type { Rng, Room } from './buildIntact';

// ─── Public result ───────────────────────────────────────────────────────────

export interface LoreResult {
  /** e.g. "the Marrowick family" */
  builderName: string;
  /** e.g. "The Marrowick Crypt" */
  name: string;
  /** 1-2 sentences derived from the two loudest events. */
  blurb: string;
  /** roomId → DM note; only rooms an event touched get a key. */
  notes: Map<number, string>;
  rumorHooks: RumorHook[];
}

// ─── Loudness (fixed rank, brief-binding): how far and hard a story carries ──

const LOUDNESS: Readonly<Record<EventKind, number>> = {
  seal: 0,
  reoccupy: 1,
  den: 2,
  tunnel: 3,
  collapse: 4,
  plunder: 5,
  'brick-off': 6,
  fire: 7,
  flood: 8,
  awaken: 9,
  bloom: 10,
};

// ─── Spoken age bands (brief-binding) ────────────────────────────────────────

const TENS: Readonly<Record<number, string>> = {
  20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty',
  60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety',
};

/** "a few years", "a generation", "sixty years", "a century", "two centuries", "centuries".
 * Reads as both an age ("sixty years ago/back") and a duration ("for sixty years").
 * Band edges are FACTUAL: 91–110 rounds to "a century" (not "over a century",
 * which would be the wrong side of 100 for 91–99); only past ~110 does the story
 * cross into "two centuries" / "centuries". */
export function spokenAge(yearsAgo: number): string {
  if (yearsAgo <= 15) return 'a few years';
  if (yearsAgo <= 40) return 'a generation';
  if (yearsAgo <= 90) {
    const n = Math.min(90, Math.max(20, Math.round(yearsAgo / 10) * 10));
    return `${TENS[n]} years`;
  }
  if (yearsAgo <= 110) return 'a century';
  if (yearsAgo <= 250) return 'two centuries';
  return 'centuries';
}

// ─── Vocabulary: purposes and actors as plain noun phrases ───────────────────

/** Every RoomPurpose as the noun a note or rumor would use. */
const PURPOSE_NOUN: Readonly<Record<RoomPurpose, string>> = {
  // mausoleum
  stair: 'processional stair',
  antechamber: 'antechamber',
  chapel: 'chapel',
  'burial-gallery': 'burial gallery',
  ossuary: 'ossuary',
  treasury: 'treasury vault',
  embalming: 'embalming room',
  // mine
  adit: 'entry adit',
  hoist: 'hoist chamber',
  'tool-store': 'tool store',
  barracks: 'barracks',
  'vein-gallery': 'vein gallery',
  sump: 'sump',
  // fortress
  gatehouse: 'gatehouse',
  'great-hall': 'great hall',
  armory: 'armory',
  granary: 'granary',
  kitchen: 'kitchen',
  cellar: 'cellar',
  'chapel-wing': 'chapel wing',
  // waterworks
  junction: 'junction chamber',
  cistern: 'cistern',
  'maintenance-walk': 'maintenance walk',
  'ladder-shaft': 'ladder shaft',
  outfall: 'outfall',
  // generic
  'passage-room': 'side chamber',
};

/** Actor keys (simulateHistory's ACTORS vocabulary) as plain noun phrases. */
const ACTOR_NOUN: Readonly<Record<string, string>> = {
  ghoul_pack: 'a ghoul pack',
  restless_dead: 'the restless dead',
  grave_cult: 'a grave cult',
  giant_spider_brood: 'a brood of giant spiders',
  crawling_dead: 'the crawling dead',
  goblin_smugglers: 'goblin smugglers',
  winter_wolf_pack: 'winter wolves',
  frozen_dead: 'the frozen dead',
  ice_reavers: 'ice reavers',
  carrion_crawler_nest: 'carrion crawlers',
  drowned_dead: 'the drowned dead',
  thieves_guild: "the thieves' guild",
  myconid_ring: 'a myconid ring',
  sporebound_dead: 'the sporebound dead',
  spore_cult: 'a spore cult',
};

function actorNoun(key: string | undefined): string {
  if (!key) return 'something';
  return ACTOR_NOUN[key] ?? key.replace(/_/g, ' ');
}

/** What townsfolk call the whole structure (singular, so verbs agree). */
function structureNoun(arch: ArchetypeData): string {
  switch (arch.archetype) {
    case 'mausoleum': return 'crypt';
    case 'mine': return 'old mine';
    case 'fortress': return 'hold';
    case 'waterworks': return 'undercity';
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fill {N} (builder stem) and {T} (town) in an archetype pattern. The town
 * placeholder starts with an article, so collapse "the the old town works
 * board" → "the old town works board". */
function fill(pattern: string, stem: string, town: string): string {
  return pattern
    .replace(/\{N\}/g, stem)
    .replace(/\{T\}/g, town)
    .replace(/\bthe the\b/g, 'the');
}

/** The tunnel applier's rejected roll ("gouged … no way through") — the only
 * event whose fact differs from its kind's happy path; templates must branch.
 * Read the structural `failed` flag simulateHistory set, not the summary text. */
function tunnelFailed(ev: DungeonEvent): boolean {
  return ev.kind === 'tunnel' && ev.failed === true;
}

// ─── Note cap: dungeon-wide events note only their most notable rooms ────────

/** Max rooms a single event may note. Events touching this many rooms or fewer
 * note them all; wider events select their most notable NOTE_CAP rooms. */
export const NOTE_CAP = 4;

/** Distinctiveness rank for capped-event note selection: 2 = a room worth a
 * numbered key (chapel, treasury, ossuary, sump, cistern, great hall), 1 =
 * working rooms with some character, 0 = the generic galleries and passages a
 * sweep event drowns the map sheet in. */
const NOTE_WORTHY_PURPOSE: Readonly<Record<RoomPurpose, number>> = {
  chapel: 2, 'chapel-wing': 2, treasury: 2, ossuary: 2, 'great-hall': 2,
  sump: 2, cistern: 2,
  embalming: 1, armory: 1, granary: 1, kitchen: 1, cellar: 1, hoist: 1,
  'tool-store': 1, barracks: 1, junction: 1, outfall: 1, 'ladder-shaft': 1,
  adit: 1, gatehouse: 1,
  stair: 0, antechamber: 0, 'burial-gallery': 0, 'vein-gallery': 0,
  'maintenance-walk': 0, 'passage-room': 0,
};

/**
 * The set of an event's touched rooms that get a note. Rooms the event touched
 * but that are not returned keep their physical evidence — only the note is
 * dropped. Deterministic and rng-free: apex/boss room first (deriveLore runs
 * after assignSemantics in the pipeline, so `room.type === 'boss'` is set),
 * then distinctive purposes, then deepest, then lowest room id.
 */
export function selectNotedRoomIds(ev: DungeonEvent, roomById: Map<number, Room>): Set<number> {
  const touched: Room[] = [];
  const seen = new Set<number>();
  for (const id of ev.roomIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const room = roomById.get(id);
    if (room) touched.push(room);
  }
  if (touched.length <= NOTE_CAP) return new Set(touched.map((r) => r.id));
  const ranked = [...touched].sort(
    (a, b) =>
      Number(b.type === 'boss') - Number(a.type === 'boss') ||
      NOTE_WORTHY_PURPOSE[b.purpose] - NOTE_WORTHY_PURPOSE[a.purpose] ||
      b.depth - a.depth ||
      a.id - b.id,
  );
  return new Set(ranked.slice(0, NOTE_CAP).map((r) => r.id));
}

// ─── Room notes: 2-3 true-variant templates per event kind ───────────────────

interface NoteCtx {
  age: string; // spokenAge — reads after "ago"/"back" or after "for"
  noun: string; // the touched room's purpose noun
  actor: string; // actorKey as noun phrase ("a ghoul pack")
  builder: string; // builderName
}

const NOTE_TEMPLATES: Readonly<Record<EventKind, ReadonlyArray<(c: NoteCtx) => string>>> = {
  seal: [
    (c) => `The entrance was sealed ${c.age} ago. The seal-bar lies snapped on the floor, forced from the outside.`,
    (c) => `Sealed by ${c.builder} ${c.age} ago. The bar that held it lies broken by the door.`,
    (c) => `A snapped seal-bar on the ${c.noun}. ${cap(c.builder)} closed this place ${c.age} ago.`,
  ],
  collapse: [
    (c) => `Rubble chokes the passage out of this ${c.noun}. It came down ${c.age} ago.`,
    (c) => `The connecting passage caved in ${c.age} ago. No one dug it out.`,
    (c) => `A rockfall, ${c.age} old, seals the far way out of the ${c.noun}.`,
  ],
  flood: [
    (c) => `Standing water fills the ${c.noun}. It rose ${c.age} ago and never drained.`,
    (c) => `Flooded ${c.age} ago. The waterline on the walls has not moved since.`,
    (c) => `The ${c.noun} sits under still black water, ${c.age} old.`,
  ],
  tunnel: [
    (c) => `A rough tunnel breaks through the ${c.noun} wall, dug with hand tools ${c.age} ago.`,
    (c) => `Robbers cut their way into this ${c.noun} ${c.age} ago. The tunnel mouth is still open.`,
    (c) => `The break in the ${c.noun} wall is robber work, ${c.age} old.`,
  ],
  'brick-off': [
    (c) => `Bricked shut ${c.age} ago. The mortar is newer than the walls.`,
    (c) => `Masons closed the robbers' way through this ${c.noun} ${c.age} ago. The brickwork is plain and hurried.`,
    (c) => `A bricked-up breach in the ${c.noun} wall, ${c.age} old.`,
  ],
  den: [
    (c) => `Nest litter fills the ${c.noun} — bones, dung, dragged bedding. ${cap(c.actor)} den here.`,
    (c) => `The ${c.noun} is a den now. ${cap(c.actor)} claimed it ${c.age} ago.`,
    (c) => `Nesting sign everywhere. ${cap(c.actor)} have held this ${c.noun} for ${c.age}.`,
  ],
  awaken: [
    (c) => `The lids here sit ajar. The dead of this ${c.noun} woke ${c.age} ago and did not lie back down.`,
    (c) => `Disturbed ${c.age} ago, the dead of this ${c.noun} no longer rest.`,
    (c) => `Every grave in this ${c.noun} stands open from the inside. They woke ${c.age} ago.`,
  ],
  plunder: [
    (c) => `Pried open and stripped ${c.age} ago. A scatter of dropped coins trails toward the door.`,
    (c) => `The ${c.noun} was forced and emptied ${c.age} ago. Dropped coins mark the robbers' way out.`,
    (c) => `Robbed ${c.age} ago. Pry-marks scar the stone of the ${c.noun}.`,
  ],
  fire: [
    (c) => `Charred beams and scorched stone. Fire took this ${c.noun} ${c.age} ago.`,
    (c) => `Fire gutted the ${c.noun} ${c.age} ago. The soot never washed off.`,
    (c) => `Everything that could burn in this ${c.noun} did, ${c.age} ago.`,
  ],
  reoccupy: [
    (c) => `Someone lives here. ${cap(c.actor)} moved into the ${c.noun} ${c.age} ago — crates, candles, a swept floor.`,
    (c) => `Fresh candle-wax and stacked crates. ${cap(c.actor)} claimed this ${c.noun} ${c.age} ago.`,
    (c) => `The ${c.noun} has new tenants: ${c.actor}, settled in ${c.age} ago.`,
  ],
  bloom: [
    (c) => `Fungal growth sheets the walls of this ${c.noun}. The bloom reached here ${c.age} ago.`,
    (c) => `Spore-fall drifts in the still air of the ${c.noun}. The bloom took it ${c.age} ago.`,
    (c) => `Caps and shelf-fungus crowd this ${c.noun}. The bloom has held it for ${c.age}.`,
  ],
};

// ─── Chronicle quoting (Pillar 2, Task 4) ────────────────────────────────────
//
// When simulateHistory bound an event to a REAL world zone (`ev.chronicleRef`),
// its note and rumor hook QUOTE the zone name. Every template is front-loaded and
// laconic (the tone bar), US English, and true of the event. `{name}` is the real
// atlas zone name ("the Onerean Occupation", "Black Pox").

interface ChronicleCtx {
  name: string; // the real zone name
  age: string; // spokenAge
  noun: string; // touched room's purpose noun
  s: string; // structure noun
}

/** One quote note per chronicle kind — names the real event that scarred the room.
 * These are the EVENT-shaped templates ("fell in the Onerean Occupation");
 * faction-shaped refs (Rebels-family zones) use {@link FACTION_NOTE} instead —
 * a room falls TO the Damunvilian Rebels, it cannot fall *in* them. */
const CHRONICLE_NOTE: Readonly<Record<Exclude<ChronicleKind, 'war'> | 'war', (c: ChronicleCtx) => string>> = {
  war: (c) => `They say it fell in the ${c.name}. Nobody rebuilt.`,
  plague: (c) => `The ${c.name} filled this ${c.noun}. The dead never settled.`,
  eruption: (c) => `The ${c.name} reached even here, ${c.age} ago.`,
  // World-chronicle inferences — one true quote note apiece.
  schism: (c) => `The ${c.name} split this ${c.noun} from its faith. It was sealed after.`,
  crusade: (c) => `The ${c.name} passed through this ${c.noun}. What it left, it left burning.`,
  migration: (c) => `The ${c.name} brought new folk to this ${c.noun} after the old were gone.`,
  fall: (c) => `They say this ${c.noun} outlived ${c.name}. Its builders never came back.`,
};

/** One quote hook per chronicle kind — spoken register, names the real event.
 * Event-shaped only; faction-shaped refs use {@link FACTION_HOOK}. */
const CHRONICLE_HOOK: Readonly<Record<Exclude<ChronicleKind, 'war'> | 'war', (c: ChronicleCtx) => string>> = {
  war: (c) => `They say the ${c.s} fell in the ${c.name}. Nobody rebuilt it.`,
  plague: (c) => `The ${c.name} emptied the ${c.s}, ${c.age} back. What's down there now isn't people.`,
  eruption: (c) => `When the ${c.name} came, the ${c.s} was lost with it.`,
  // World-chronicle inferences — spoken register, names the real event.
  schism: (c) => `They say the ${c.name} tore the ${c.s} from its faith, ${c.age} back. It's been shut ever since.`,
  crusade: (c) => `The ${c.name} came through the ${c.s}, ${c.age} ago. It burned and moved on.`,
  migration: (c) => `New folk took the ${c.s} after the ${c.name} — ${c.age} back. Their kind are still down there.`,
  fall: (c) => `The ${c.s} outlasted ${c.name}. Its people are ${c.age} gone, they say.`,
};

/** Faction-shaped quote notes — the name is a GROUP ("Damunvilian Rebels"), so
 * the templates make the faction the ACTOR. Two variants; picked by seedless
 * arithmetic on (eventId + zoneId), zero extra rng draws. Faction refs only
 * occur for kind 'war', so a single family suffices. */
const FACTION_NOTE: ReadonlyArray<(c: ChronicleCtx) => string> = [
  (c) => `They say the ${c.name} took this ${c.noun}. Nobody took it back.`,
  (c) => `The ${c.name} came through this ${c.noun} and left it as you find it.`,
];

/** Faction-shaped quote hooks — spoken register, faction as actor. Two variants,
 * same seedless selection as {@link FACTION_NOTE}. */
const FACTION_HOOK: ReadonlyArray<(c: ChronicleCtx) => string> = [
  (c) => `They say the ${c.s} fell to the ${c.name}. Nobody took it back.`,
  (c) => `The ${c.name} overran the ${c.s}, ${c.age} back. What they left is still down there.`,
];

/** The tunnel-failed note family (pick-scars, no way through). */
const TUNNEL_FAILED_NOTES: ReadonlyArray<(c: NoteCtx) => string> = [
  (c) => `Pick-scars gouge the ${c.noun} wall. Someone tried to dig through ${c.age} ago and gave up.`,
  (c) => `The ${c.noun} wall is scarred by hand tools, ${c.age} old. Whoever dug got nowhere.`,
];

/** Past-only tunnel notes (F1b): used when a LATER brick-off/collapse touching
 * the same room falsifies any present-state claim ("still open"). These describe
 * only what was DONE — the break was cut — never the tunnel's current openness. */
const TUNNEL_PAST_NOTES: ReadonlyArray<(c: NoteCtx) => string> = [
  (c) => `The break in the ${c.noun} wall is robber work, ${c.age} old.`,
  (c) => `Robbers cut through the ${c.noun} wall here ${c.age} ago, with hand tools.`,
];

/**
 * Choose the note template family for one (event, room). Tunnel events branch:
 *  - failed dig → the pick-scar family;
 *  - a tunnel whose room a LATER brick-off/collapse also touches → past-only
 *    variants (F1b), because "the tunnel mouth is still open" would be a lie once
 *    the masons wall it or the roof drops on it;
 *  - otherwise the normal family.
 */
function noteFamilyFor(
  ev: DungeonEvent,
  roomId: number,
  events: DungeonEvent[],
): ReadonlyArray<(c: NoteCtx) => string> {
  if (ev.kind !== 'tunnel') return NOTE_TEMPLATES[ev.kind];
  if (tunnelFailed(ev)) return TUNNEL_FAILED_NOTES;
  const laterSeal = events.some(
    (e2) =>
      e2.id > ev.id &&
      (e2.kind === 'brick-off' || e2.kind === 'collapse') &&
      e2.roomIds.includes(roomId),
  );
  return laterSeal ? TUNNEL_PAST_NOTES : NOTE_TEMPLATES.tunnel;
}

// ─── Blurb: one sentence per kind, top two loudest, joined in log order ──────

function blurbSentence(ev: DungeonEvent, builder: string): string {
  const age = spokenAge(ev.yearsAgo);
  const actor = actorNoun(ev.actorKey);
  switch (ev.kind) {
    case 'seal': return `Sealed by ${builder} ${age} ago.`;
    case 'collapse': return `Part of it caved in ${age} ago.`;
    case 'flood': return `Water took the lower levels ${age} ago and never left.`;
    case 'tunnel':
      return tunnelFailed(ev)
        ? `Robbers tried to dig in ${age} ago and failed.`
        : `Robbers dug their own way in ${age} ago.`;
    case 'brick-off': return `Someone bricked off the robbers' way in ${age} ago.`;
    case 'den': return `${cap(actor)} den there now, moved in ${age} ago.`;
    case 'awaken': return `The dead woke ${age} ago.`;
    case 'plunder': return `Robbed ${age} ago.`;
    case 'fire': return `Fire gutted it ${age} ago.`;
    case 'reoccupy': return `${cap(actor)} moved in ${age} ago.`;
    case 'bloom': return `A fungal bloom overtook it ${age} ago.`;
  }
}

/**
 * The SECOND (newer, consequent) blurb sentence, deliberately AGE-FREE (F3): a
 * two-sentence blurb that ends BOTH clauses with "…ago" reads like a ledger, not
 * a story. The first sentence carries the date; this one carries the consequence.
 * Every claim is still grounded in the log — awaken follows plunder/tunnel by
 * construction, a den/reoccupy follows the way-in that let it in, and so on.
 */
function blurbConsequent(ev: DungeonEvent, builder: string): string {
  const actor = actorNoun(ev.actorKey);
  switch (ev.kind) {
    case 'seal': return `${cap(builder)} meant it to stay shut.`;
    case 'collapse': return 'A passage came down and was never dug clear.';
    case 'flood': return 'The water rose and never drained.';
    case 'tunnel':
      return tunnelFailed(ev)
        ? 'Robbers went at the walls and got nowhere.'
        : 'Robbers dug their own way in, and it still gapes.';
    case 'brick-off': return "Masons walled the robbers' way back up.";
    case 'den': return `${cap(actor)} den in the deep of it now.`;
    case 'awaken': return 'The dead noticed, and did not lie back down.';
    case 'plunder': return 'Robbers stripped what they could carry.';
    case 'fire': return 'Fire gutted the near halls and nobody rebuilt.';
    case 'reoccupy': return `${cap(actor)} live there now.`;
    case 'bloom': return 'A bloom has been spreading in the dark ever since.';
  }
}

// ─── Rumor hooks: spoken register, one per event ─────────────────────────────

interface HookCtx {
  age: string; // spokenAge — reads after "ago"/"back" or after "for"
  actor: string; // actorKey as noun phrase ("a ghoul pack")
  builder: string; // builderName
  s: string; // structure noun ("crypt", "workings", "hold", "tunnels")
  /** True when a later awaken event follows this one in the log. */
  laterAwaken: boolean;
}

const HOOK_TEMPLATES: Readonly<Record<EventKind, ReadonlyArray<(c: HookCtx) => string>>> = {
  seal: [
    (c) => `They say ${c.builder} sealed the ${c.s} shut ${c.age} back, and meant it to stay that way.`,
    (c) => `Old folk say the ${c.s} has been sealed for ${c.age}. Sealed things get unsealed.`,
  ],
  collapse: [
    (c) => `Part of the ${c.s} came down ${c.age} back. What's behind the rubble is anyone's guess.`,
    (c) => `They say a passage in the ${c.s} caved in ${c.age} ago, and nobody went to dig it clear.`,
  ],
  flood: [
    (c) => `The low levels of the ${c.s} flooded ${c.age} back. The water never went down.`,
    (c) => `Half the ${c.s} has been underwater for ${c.age}. Nobody's pumped it, and nobody will.`,
  ],
  tunnel: [
    (c) => `Robbers dug a back way into the ${c.s}, ${c.age} back. Odds are it's still open.`,
    (c) => `They say there's more than one way into the ${c.s} — robbers dug their own, ${c.age} ago.`,
  ],
  'brick-off': [
    (c) => `Masons bricked off a passage in the ${c.s} ${c.age} back. Nobody remembers what was on the other side.`,
    (c) => `There's a wall down in the ${c.s} that's newer than the rest — ${c.age} newer. Walls like that get built for a reason.`,
  ],
  den: [
    (c) => `Something denned in the ${c.s} ${c.age} back — ${c.actor}, they say. Nobody's been down to argue.`,
    (c) => `Hunters say ${c.actor} laired up in the ${c.s}, ${c.age} back.`,
  ],
  awaken: [
    (c) => `They say the dead in the ${c.s} woke ${c.age} back, after the robbers went in.`,
    (c) => `The dead of the ${c.s} don't lie quiet. Haven't for ${c.age}.`,
  ],
  plunder: [
    (c) =>
      c.laterAwaken
        ? `They say the ${c.s} was robbed, ${c.age} back — and that the dead noticed.`
        : `The ${c.s} was stripped by robbers ${c.age} back. Whatever they missed is still down there.`,
    (c) =>
      c.laterAwaken
        ? `The ${c.s} was robbed ${c.age} ago. They say what the robbers woke was worth more than what they took.`
        : `They say robbers cracked the ${c.s} ${c.age} back and carried out all they could.`,
  ],
  fire: [
    (c) => `Fire took the ${c.s} ${c.age} back. You can still smell it in the near halls, they say.`,
    (c) => `The ${c.s} burned ${c.age} ago. Nobody rebuilt.`,
  ],
  reoccupy: [
    (c) => `The ${c.s} isn't empty. ${cap(c.actor)} moved in ${c.age} back and they're still there.`,
    (c) => `They say ${c.actor} run things out of the ${c.s} now — set up ${c.age} ago.`,
  ],
  bloom: [
    (c) => `They say the ${c.s} has gone strange — a bloom took it, ${c.age} back. Don't breathe deep down there.`,
    (c) => `Something's been growing down in the ${c.s} for ${c.age}. Nothing natural grows in the dark like that.`,
  ],
};

const TUNNEL_FAILED_HOOKS: ReadonlyArray<(c: HookCtx) => string> = [
  (c) => `Robbers tried to dig into the ${c.s} ${c.age} back and gave up. Or so the story goes.`,
  (c) => `They say someone went at the ${c.s} walls with picks, ${c.age} ago, and got nothing for it.`,
];

// ─── Cleared hooks (Pillar 2, Task 8) ────────────────────────────────────────
//
// Once the party clears a dungeon, its rumor flips to a past-tense "cleared"
// line — same laconic tone, same structure noun, but the menace is spoken of as
// DONE (with the wary coda that empty is not the same as safe). Two variants per
// kind FAMILY, grouped by what clearing meant: OCCUPIED (a den/reoccupy/awaken/
// bloom that was driven out) vs STRUCTURAL (a seal/collapse/flood/fire/plunder
// that was simply gone into). Variant is chosen seedlessly by the event id — no
// new rng draw, so existing (uncleared) outputs stay byte-identical.

interface ClearedCtx {
  s: string; // structure noun ("crypt", "old mine", "hold", "undercity")
  age: string; // spokenAge
}

/** Kind → which cleared family it speaks. */
function clearedFamilyKey(kind: EventKind): 'occupied' | 'structural' {
  switch (kind) {
    case 'den':
    case 'reoccupy':
    case 'awaken':
    case 'bloom':
      return 'occupied';
    default:
      return 'structural';
  }
}

const CLEARED_HOOKS: Readonly<Record<'occupied' | 'structural', ReadonlyArray<(c: ClearedCtx) => string>>> = {
  occupied: [
    (c) => `They cleared what denned in the ${c.s} last season. Doesn't mean anyone's moved back in.`,
    (c) => `Whatever held the ${c.s} was put down. The dark it lived in is still down there.`,
  ],
  structural: [
    (c) => `Someone finally went through the ${c.s} and came back out. Cleared, they say — for what that's worth.`,
    (c) => `The ${c.s} was cleared out at last. Empty's not the same as safe, mind.`,
  ],
};

/** The cleared-state line for one event's hook, chosen seedlessly by event id. */
function clearedHookText(ev: DungeonEvent, arch: ArchetypeData): string {
  const family = CLEARED_HOOKS[clearedFamilyKey(ev.kind)];
  const ctx: ClearedCtx = { s: structureNoun(arch), age: spokenAge(ev.yearsAgo) };
  return family[Math.abs(ev.id) % family.length](ctx);
}

function speakerBiasFor(kind: EventKind, yearsAgo: number): RumorHook['speakerBias'] {
  if (kind === 'seal' || kind === 'collapse' || kind === 'fire') return 'elder';
  if (kind === 'plunder' || kind === 'tunnel' || kind === 'reoccupy') return 'adventurer';
  // awaken / bloom / flood / den / brick-off
  return yearsAgo < 40 ? 'elder' : 'scholar';
}

// ─── Derivation ──────────────────────────────────────────────────────────────

/**
 * Derive ALL display text from the event log. Draw order (identity first, then
 * name, then notes in log order, then hooks in log order) is fixed so the same
 * lore stream always yields the same text.
 */
export function deriveLore(
  rng: Rng,
  arch: ArchetypeData,
  events: DungeonEvent[],
  rooms: Room[],
  world?: WorldIdentity,
): LoreResult {
  // {T} in title/name patterns: the real town name when world identity supplies
  // one, else the archetype's interim placeholder.
  const town = world?.townName ?? arch.townPlaceholder ?? 'the old town';

  // Builder identity — one stem through one pattern. DRAW ORDER IS SACRED: we
  // draw the placeholder stem and pattern EVEN WHEN world identity is present
  // (then discard them), so the lore stream advances by the identical number of
  // picks either way — a world-grown plan and a bare plan from the same path
  // keep byte-identical grids/props/spawns; only the emitted text differs.
  const drawnStem = rng.pick(arch.namePool);
  const drawnPattern = rng.pick(arch.builderPatterns);
  const stem = world?.builderStem ?? drawnStem;
  const builderName = world?.builderName ?? fill(drawnPattern, drawnStem, town);

  // Loudest event drives the title choice.
  const byLoudness = [...events].sort(
    (a, b) => LOUDNESS[b.kind] - LOUDNESS[a.kind] || a.id - b.id,
  );
  const loudest = byLoudness[0];
  // Until Pillar 2 supplies a real town name, {T} display-name patterns would
  // read "The Old the old town Sewers" — prefer the grounded {N} titles and
  // only fall back to a title-cased placeholder if no {N} pattern exists.
  const titlePool = arch.titlePatterns.some((p) => !p.includes('{T}'))
    ? arch.titlePatterns.filter((p) => !p.includes('{T}'))
    : arch.titlePatterns;
  const titleTown = town.replace(/^the\s+/i, '').replace(/\b\w/g, (m) => m.toUpperCase());
  let titlePattern: string | undefined;
  if (loudest) {
    if (loudest.kind === 'flood') {
      titlePattern = titlePool.find((p) => p.includes('Drowned'));
    } else if (loudest.kind === 'fire') {
      titlePattern = titlePool.find((p) => p.includes('Fall') || p.includes('Ruin'));
    }
  }
  titlePattern ??= rng.pick(titlePool);
  const name = fill(titlePattern, stem, titleTown);

  // Blurb — the two loudest events, joined oldest-first so it reads as history.
  // A second event of the SAME kind adds nothing ("flooded… then flooded"), so
  // prefer the loudest event of a different kind when one exists.
  const second =
    byLoudness.find((e) => e.kind !== loudest?.kind) ?? byLoudness[1];
  const topTwo = [loudest, second]
    .filter((e): e is DungeonEvent => e !== undefined)
    .sort((a, b) => a.id - b.id);
  // First (older) sentence carries the date; the second (newer) is age-free so
  // the blurb reads as cause-then-consequence, not two dated ledger lines (F3).
  const blurb = topTwo
    .map((ev, i) =>
      i === 0 ? blurbSentence(ev, builderName) : blurbConsequent(ev, builderName),
    )
    .join(' ');

  // Room notes — one sentence per (event × touched room), joined in log order.
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const notes = new Map<number, string>();
  // A room hit twice by the SAME kind (a cistern that flooded twice) would just
  // repeat itself — keep the first (oldest) sentence per (room, kind).
  const notedKinds = new Map<number, Set<EventKind>>();
  for (const ev of events) {
    // Dungeon-wide events note only their NOTE_CAP most notable rooms; the rest
    // keep evidence but no note. A room skipped here can still be noted by a
    // different event that selects it.
    const allowed = selectNotedRoomIds(ev, roomById);
    for (const roomId of ev.roomIds) {
      const room = roomById.get(roomId);
      if (!room) continue;
      if (!allowed.has(roomId)) continue;
      const seen = notedKinds.get(roomId) ?? new Set<EventKind>();
      if (seen.has(ev.kind)) continue;
      seen.add(ev.kind);
      notedKinds.set(roomId, seen);
      const ctx: NoteCtx = {
        age: spokenAge(ev.yearsAgo),
        noun: PURPOSE_NOUN[room.purpose],
        actor: actorNoun(ev.actorKey),
        builder: builderName,
      };
      const family = noteFamilyFor(ev, roomId, events);
      // DRAW ORDER IS SACRED: pick from the normal family even for a chronicle-
      // bound event (then discard), so the lore stream advances identically
      // whether or not the event was grounded — only the emitted text differs.
      const drawn = rng.pick(family)(ctx);
      const sentence = ev.chronicleRef
        ? (ev.chronicleRef.shape === 'faction'
            ? FACTION_NOTE[(ev.id + ev.chronicleRef.zoneId) % FACTION_NOTE.length]
            : CHRONICLE_NOTE[ev.chronicleRef.kind])({
            name: ev.chronicleRef.zoneName || (ev.chronicleRef.shape === 'faction' ? 'rebels' : 'the war'),
            age: ctx.age,
            noun: ctx.noun,
            s: structureNoun(arch),
          })
        : drawn;
      const prior = notes.get(roomId);
      notes.set(roomId, prior ? `${prior} ${sentence}` : sentence);
    }
  }

  // Rumor hooks — one per event, spoken register, radius by loudness. Two events
  // of the SAME kind must not emit byte-identical hooks (F4: the sewer's double
  // flood read the same line twice). Cycle the variant index per kind across the
  // dungeon's hooks so same-kind events walk distinct variants until the family
  // is exhausted, then wrap (repeats allowed only past that point). The starting
  // offset per kind is drawn once so the choice stays seeded, not fixed to [0].
  const hookVariantOffset = new Map<string, number>();
  const hookVariantSeen = new Map<string, number>();
  const rumorHooks: RumorHook[] = events.map((ev) => {
    const ctx: HookCtx = {
      age: spokenAge(ev.yearsAgo),
      actor: actorNoun(ev.actorKey),
      builder: builderName,
      s: structureNoun(arch),
      laterAwaken: events.some((e2) => e2.id > ev.id && e2.kind === 'awaken'),
    };
    const family = tunnelFailed(ev) ? TUNNEL_FAILED_HOOKS : HOOK_TEMPLATES[ev.kind];
    // Key on the family, not the raw kind, so failed tunnels cycle separately.
    const key = tunnelFailed(ev) ? 'tunnel:failed' : ev.kind;
    if (!hookVariantOffset.has(key)) hookVariantOffset.set(key, rng.int(0, family.length - 1));
    const seen = hookVariantSeen.get(key) ?? 0;
    hookVariantSeen.set(key, seen + 1);
    const idx = (hookVariantOffset.get(key)! + seen) % family.length;
    // A chronicle-bound event speaks the quote hook naming the real zone; the
    // variant machinery above still ran (draw order preserved), we just override
    // the text. Unbound events keep the cycled variant.
    const text = ev.chronicleRef
      ? (ev.chronicleRef.shape === 'faction'
          ? FACTION_HOOK[(ev.id + ev.chronicleRef.zoneId) % FACTION_HOOK.length]
          : CHRONICLE_HOOK[ev.chronicleRef.kind])({
          name: ev.chronicleRef.zoneName || (ev.chronicleRef.shape === 'faction' ? 'rebels' : 'the war'),
          age: ctx.age,
          noun: '',
          s: structureNoun(arch),
        })
      : family[idx](ctx);
    return {
      eventRef: ev.id,
      text,
      // Task 8: the past-tense line spoken once this dungeon is cleared. Derived
      // from the same event with NO new rng draw (seedless variant by event id),
      // so uncleared outputs are byte-identical to before.
      clearedText: clearedHookText(ev, arch),
      speakerBias: speakerBiasFor(ev.kind, ev.yearsAgo),
      radiusFt: 5280 * (2 + LOUDNESS[ev.kind]),
    };
  });

  return { builderName, name, blurb, notes, rumorHooks };
}
