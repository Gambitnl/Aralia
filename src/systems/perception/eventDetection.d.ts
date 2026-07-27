/**
 * @file src/systems/perception/eventDetection.ts
 *
 * Reusable per-event detection mechanic.
 *
 * Given an event's detection difficulty (a DC) and the set of observers present
 * (player characters and/or NPCs), decide WHO notices a signal — a sound or a
 * sight — and HOW (passively, or via a deliberate active roll).
 *
 * This is a standalone, PURE, deterministic utility. It has no side effects, no
 * dispatch, and no dependency on any specific feature (e.g. the AI-arbitrated
 * ritual). It reuses the project's existing D&D 5e scoring helpers rather than
 * re-deriving the formulas:
 *   - `calculatePassiveScore`      (10 + mod + proficiency)   — passive perception
 *   - `getAbilityModifierValue`    (floor((score - 10) / 2))  — Wisdom modifier
 *   - `calculateProficiencyBonus`  (2 + floor((level-1)/4))   — proficiency bonus
 *
 * Randomness (for the optional active-roll mode) is INJECTED via a seeded RNG so
 * results are reproducible for a given seed.
 */
import { SeededRandom } from '../../utils/random/seededRandom';
/** The physical sense an event's signal is perceived through. */
export type EventSense = 'sight' | 'sound';
/**
 * A small typed descriptor for an arbitrary event's detection difficulty.
 *
 * `dc` is the Difficulty Class an observer's perception must meet or beat to
 * notice the signal. `sense` optionally records whether the signal is seen or
 * heard (useful for callers that gate on line-of-sight vs. earshot). `label`
 * is an optional human-readable tag for logging / narration.
 */
export interface EventDC {
    /** The Difficulty Class to meet or beat to detect the event. */
    dc: number;
    /** Whether the signal is a sight or a sound. Optional. */
    sense?: EventSense;
    /** Optional descriptive label, e.g. "muffled chanting". */
    label?: string;
}
/**
 * Named difficulty bands, mapping a coarse description to a concrete DC.
 * Mirrors the D&D 5e typical-DC ladder. Callers can pass a band instead of a
 * raw number when they want a qualitative difficulty.
 */
export type EventDifficultyBand = 'trivial' | 'easy' | 'medium' | 'hard' | 'veryHard' | 'nearlyImpossible';
/**
 * TUNABLE: DC values for each named difficulty band.
 *
 * These follow the 5e "typical DC" table. Adjust here to retune every consumer
 * of the named bands at once.
 */
export declare const EVENT_DIFFICULTY_DCS: Readonly<Record<EventDifficultyBand, number>>;
/**
 * Builds an {@link EventDC} from a named difficulty band.
 *
 * @param band  The qualitative difficulty band.
 * @param sense Optional sense the signal is perceived through.
 * @param label Optional descriptive label.
 */
export declare function eventDCForBand(band: EventDifficultyBand, sense?: EventSense, label?: string): EventDC;
/**
 * A structural view of anything that can observe an event.
 *
 * Deliberately structural (not a hard dependency on `PlayerCharacter` or
 * `RichNPC`) so this utility stays additive and decoupled. Resolution order in
 * {@link passivePerceptionOf}:
 *   1. an explicit top-level `passivePerception` number (plain NPC),
 *   2. `stats.passivePerception` (RichNPC carries it there),
 *   3. compute from `finalAbilityScores.Wisdom` + Perception proficiency (PC).
 *
 * At least one of those must be resolvable, or resolution throws (fail honestly
 * rather than silently substituting a default).
 */
export interface DetectionObserver {
    /** Stable identifier used to report results. Falls back to `name`, then index. */
    id?: string;
    /** Human-readable name, used for reporting when `id` is absent. */
    name?: string;
    /** Precomputed passive perception (plain NPC). Used directly when present. */
    passivePerception?: number;
    /** RichNPC-style nested stats block carrying `passivePerception`. */
    stats?: {
        passivePerception?: number;
    };
    /** Final ability scores; only `Wisdom` is needed for perception. */
    finalAbilityScores?: {
        Wisdom?: number;
    } & Record<string, number | undefined>;
    /** Skill list; presence of `{ id: 'perception' }` grants proficiency. */
    skills?: ReadonlyArray<{
        id: string;
    }>;
    /** Precomputed proficiency bonus. If absent, derived from `level`. */
    proficiencyBonus?: number;
    /** Character level, used to derive the proficiency bonus when needed. */
    level?: number;
}
/**
 * Resolves an observer's passive perception.
 *
 * - A plain NPC that already carries a `passivePerception` number uses it directly.
 * - A RichNPC that carries `stats.passivePerception` uses that.
 * - A PlayerCharacter computes it via the shared `calculatePassiveScore` helper
 *   from its Wisdom modifier plus Perception proficiency (never re-deriving the
 *   10 + mod + prof formula here).
 *
 * @throws if none of those paths can produce a value (no silent fallback).
 */
export declare function passivePerceptionOf(observer: DetectionObserver): number;
/** How an observer detected the event. */
export type DetectionMethod = 'passive' | 'active';
/**
 * Controls whether below-passive observers get a chance to detect via a roll.
 *
 * - `'passive'` (default): passive-only. Passive perception >= DC auto-detects;
 *   anyone below simply "did not notice." No rolls are made. This matches the
 *   "background DC -> auto pass/fail" model (e.g. an ambient ritual signal).
 * - `'active'`: observers whose passive perception is below the DC make an
 *   active perception roll (d20 + perception modifier) against the DC. Models a
 *   deliberate search / heightened attention. Requires an injected `rng`.
 */
export type DetectionMode = 'passive' | 'active';
/** Options for {@link resolveEventDetection}. */
export interface EventDetectionOptions {
    /** Detection mode. Defaults to `'passive'`. */
    mode?: DetectionMode;
}
/** Per-observer detection outcome. */
export interface ObserverDetection {
    /** Resolved observer identifier. */
    observerId: string;
    /** Whether this observer detected the event. */
    detected: boolean;
    /** How they detected it, or `null` if they did not. */
    method: DetectionMethod | null;
    /** The observer's resolved passive perception. */
    passivePerception: number;
    /** The raw d20 result, present only when an active roll was made. */
    roll?: number;
    /** The active-roll total (roll + modifier), present only when a roll was made. */
    total?: number;
}
/** Structured result of resolving detection for a set of observers. */
export interface EventDetectionResult {
    /** Outcome for every observer, in input order. */
    detections: ObserverDetection[];
    /** Convenience view: only the observers that detected the event. */
    detectors: ObserverDetection[];
}
/**
 * Resolves, for each observer, whether they detect an event given its DC.
 *
 * For every observer:
 *   1. If passive perception >= DC, they AUTO-detect passively (no roll).
 *   2. Otherwise, in `'active'` mode, they roll d20 + perception modifier vs the
 *      DC using the injected seeded RNG; a total >= DC detects actively.
 *   3. In `'passive'` mode, below-DC simply means "did not notice."
 *
 * Pure and deterministic: given the same observers, DC, options, and RNG state,
 * the result is identical. The RNG is consumed once per active roll, in observer
 * input order, so seeds are stable.
 *
 * @param observers The characters/NPCs present.
 * @param eventDC   The event's detection difficulty (or a raw DC number).
 * @param rng       Seeded RNG. Required for `'active'` mode; unused in `'passive'`.
 * @param options   Detection options (mode).
 * @throws if `'active'` mode is requested without an `rng`.
 */
export declare function resolveEventDetection(observers: ReadonlyArray<DetectionObserver>, eventDC: EventDC | number, rng?: SeededRandom, options?: EventDetectionOptions): EventDetectionResult;
