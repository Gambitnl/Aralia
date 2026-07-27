/**
 * @file rollContract.ts
 * ONE shared deterministic + audit contract for ALL dice rolls (D-G3).
 *
 * Decision (Remy, 2026-07-21): silent (auto-resolved) rolls and visual
 * (shown-to-player) rolls go through the SAME deterministic seed + audit
 * contract. A visual roll is presentation layered on top of the same
 * underlying roll — the roll itself is decided here, never by the 3D physics.
 *
 * The contract has two layers:
 *
 * 1. `executeRoll(spec, seed)` — a PURE function. Same spec + same seed always
 *    produce the same per-die values and total. This is the single source of
 *    truth for what a roll IS.
 *
 * 2. `DiceAuditLog` — a session audit log. Every roll performed through it is
 *    recorded with the exact seed used, the spec, the mode (silent/visual),
 *    an optional human context, and the full per-die outcome. Because the seed
 *    is stored, any record — including a silent roll nobody saw — can be
 *    reproduced and inspected after the fact via `reproduce()`.
 *
 * Presentation honesty: the bundled @3d-dice/dice-box engine cannot be forced
 * to land on predetermined faces (its notation parser has no value-forcing
 * support — verified against the shipped bundle). The authoritative result is
 * therefore always the contract outcome; the physics animation is flavor. The
 * faces the player saw are attached to the audit record via
 * `attachPresentation()` with an explicit `matchesOutcome` flag, so the gap is
 * auditable rather than hidden.
 */
export type RollMode = 'silent' | 'visual';
/** One physical die in a roll. Dropped dice (advantage/disadvantage) stay in the record. */
export interface DieResult {
    sides: number;
    value: number;
    /** True when this die was rolled but not counted (adv/dis discard). */
    dropped?: boolean;
}
/** What to roll. Advantage/disadvantage roll each die twice and keep max/min. */
export interface RollSpec {
    notation: string;
    advantage?: boolean;
    disadvantage?: boolean;
}
/** The deterministic result of a roll: every die, the flat modifier, the total. */
export interface RollOutcome {
    dice: DieResult[];
    modifier: number;
    total: number;
}
/** A single entry in the audit log — everything needed to reproduce the roll. */
export interface RollAuditRecord {
    id: string;
    /** Monotonic roll counter for the session (survives ring-buffer eviction). */
    index: number;
    /** The base seed the log was configured with when this roll happened. */
    baseSeed: number;
    /** The exact per-roll seed handed to executeRoll. Reproduction key. */
    seed: number;
    mode: RollMode;
    /** Optional human-readable purpose, e.g. "persuasion check vs guard". */
    context?: string;
    spec: RollSpec;
    outcome: RollOutcome;
    /** What the 3D dice actually displayed (visual rolls only, best effort). */
    presented?: {
        values: number[];
        matchesOutcome: boolean;
    };
    /** Wall-clock ms. Informational only — never part of the deterministic core. */
    timestamp: number;
}
/** Ring-buffer capacity of the session audit log. */
export declare const ROLL_AUDIT_CAPACITY = 500;
/**
 * Derives the per-roll seed from the session base seed and the roll index.
 * Small avalanche mixer so consecutive indices produce unrelated streams.
 */
export declare function deriveRollSeed(baseSeed: number, index: number): number;
/**
 * The pure deterministic core: same spec + same seed => same outcome.
 *
 * Semantics match the legacy silent roller: supports multi-group formulas
 * ("1d8 + 1d6 + 2"), +/- flat modifiers, and returns a zero outcome for
 * empty/invalid notation. Advantage/disadvantage roll each die in the formula
 * twice and keep the higher/lower — for the standard "1d20" check this is
 * exactly the 5e rule; both dice stay in the record with the loser flagged
 * `dropped` so audits show what was discarded.
 */
export declare function executeRoll(spec: RollSpec, seed: number): RollOutcome;
/**
 * Session-scoped audit log + seed stream. Singleton, mirroring DiceService.
 *
 * Self-seeds at startup so gameplay never depends on anyone remembering to
 * call configure() — every roll is still reproducible because its record
 * stores the exact seed used. Tests and replay tooling call `configure()`
 * with a fixed base seed for full-session determinism.
 */
declare class DiceAuditLogClass {
    private baseSeed;
    private nextIndex;
    private records;
    /** Reset the seed stream (e.g. to a campaign's worldSeed, or a fixed test seed). */
    configure(options: {
        baseSeed: number;
    }): void;
    /**
     * Perform a roll through the shared contract and record it.
     * This is the ONLY sanctioned way for silent and visual paths to roll.
     */
    perform(spec: RollSpec, options: {
        mode: RollMode;
        context?: string;
    }): RollAuditRecord;
    /**
     * Attach the die faces the 3D presentation actually displayed. Flags whether
     * they match the authoritative outcome so any presentation gap is auditable.
     */
    attachPresentation(recordId: string, values: number[]): RollAuditRecord | undefined;
    /**
     * Re-run a recorded roll from its stored seed + spec and report whether the
     * fresh outcome matches what was recorded. Accepts an id (looked up in the
     * live log) or a detached record object (e.g. from an exported log dump).
     */
    reproduce(recordOrId: string | RollAuditRecord): {
        record: RollAuditRecord;
        outcome: RollOutcome;
        matches: boolean;
    } | undefined;
    getRecords(): readonly RollAuditRecord[];
    clear(): void;
}
export declare const DiceAuditLog: DiceAuditLogClass;
export default DiceAuditLog;
