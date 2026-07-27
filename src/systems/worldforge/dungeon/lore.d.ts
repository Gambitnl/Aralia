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
import type { DungeonEvent, RumorHook, WorldIdentity } from './types';
import type { ArchetypeData } from './archetypes';
import type { Rng, Room } from './buildIntact';
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
/** "a few years", "a generation", "sixty years", "a century", "two centuries", "centuries".
 * Reads as both an age ("sixty years ago/back") and a duration ("for sixty years").
 * Band edges are FACTUAL: 91–110 rounds to "a century" (not "over a century",
 * which would be the wrong side of 100 for 91–99); only past ~110 does the story
 * cross into "two centuries" / "centuries". */
export declare function spokenAge(yearsAgo: number): string;
/** Max rooms a single event may note. Events touching this many rooms or fewer
 * note them all; wider events select their most notable NOTE_CAP rooms. */
export declare const NOTE_CAP = 4;
/**
 * The set of an event's touched rooms that get a note. Rooms the event touched
 * but that are not returned keep their physical evidence — only the note is
 * dropped. Deterministic and rng-free: apex/boss room first (deriveLore runs
 * after assignSemantics in the pipeline, so `room.type === 'boss'` is set),
 * then distinctive purposes, then deepest, then lowest room id.
 */
export declare function selectNotedRoomIds(ev: DungeonEvent, roomById: Map<number, Room>): Set<number>;
/**
 * Derive ALL display text from the event log. Draw order (identity first, then
 * name, then notes in log order, then hooks in log order) is fixed so the same
 * lore stream always yields the same text.
 */
export declare function deriveLore(rng: Rng, arch: ArchetypeData, events: DungeonEvent[], rooms: Room[], world?: WorldIdentity): LoreResult;
