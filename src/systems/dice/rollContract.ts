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

import { SeededRandom } from '../../utils/random/seededRandom';
import { generateId } from '../../utils/core/idGenerator';

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
  presented?: { values: number[]; matchesOutcome: boolean };
  /** Wall-clock ms. Informational only — never part of the deterministic core. */
  timestamp: number;
}

/** Ring-buffer capacity of the session audit log. */
export const ROLL_AUDIT_CAPACITY = 500;

// Same term grammar as the legacy silent roller (utils/combat/combatUtils):
// optional sign, then either XdY or a flat number. Whitespace ignored.
const TERM_REGEX = /([+-]?)(?:(\d+)d(\d+)|(\d+))/g;

/**
 * Derives the per-roll seed from the session base seed and the roll index.
 * Small avalanche mixer so consecutive indices produce unrelated streams.
 */
export function deriveRollSeed(baseSeed: number, index: number): number {
  let h = (baseSeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (index + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  // SeededRandom wants a positive seed below 2147483647.
  return (h % 2147483646) + 1;
}

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
export function executeRoll(spec: RollSpec, seed: number): RollOutcome {
  const { notation, advantage, disadvantage } = spec;
  const outcome: RollOutcome = { dice: [], modifier: 0, total: 0 };
  if (!notation || notation === '0') return outcome;

  const formula = notation.replace(/\s+/g, '');
  const rng = new SeededRandom(seed);
  // Advantage and disadvantage cancel (5e rule).
  const keep: 'max' | 'min' | null =
    advantage && !disadvantage ? 'max' : disadvantage && !advantage ? 'min' : null;

  const regex = new RegExp(TERM_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(formula)) !== null) {
    if (match.index === regex.lastIndex) regex.lastIndex++;
    const sign = match[1] === '-' ? -1 : 1;

    if (match[2] && match[3]) {
      const count = parseInt(match[2], 10);
      const sides = parseInt(match[3], 10);
      for (let i = 0; i < count; i++) {
        const first = rng.nextInt(1, sides + 1);
        if (keep) {
          const second = rng.nextInt(1, sides + 1);
          const kept = keep === 'max' ? Math.max(first, second) : Math.min(first, second);
          const droppedValue = kept === first ? second : first;
          outcome.dice.push({ sides, value: kept });
          outcome.dice.push({ sides, value: droppedValue, dropped: true });
          outcome.total += sign * kept;
        } else {
          outcome.dice.push({ sides, value: first });
          outcome.total += sign * first;
        }
      }
    } else if (match[4]) {
      const flat = sign * parseInt(match[4], 10);
      outcome.modifier += flat;
      outcome.total += flat;
    }
  }

  return outcome;
}

/**
 * Session-scoped audit log + seed stream. Singleton, mirroring DiceService.
 *
 * Self-seeds at startup so gameplay never depends on anyone remembering to
 * call configure() — every roll is still reproducible because its record
 * stores the exact seed used. Tests and replay tooling call `configure()`
 * with a fixed base seed for full-session determinism.
 */
class DiceAuditLogClass {
  private baseSeed: number = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  private nextIndex = 0;
  private records: RollAuditRecord[] = [];

  /** Reset the seed stream (e.g. to a campaign's worldSeed, or a fixed test seed). */
  configure(options: { baseSeed: number }): void {
    this.baseSeed = options.baseSeed >>> 0;
    this.nextIndex = 0;
  }

  /**
   * Perform a roll through the shared contract and record it.
   * This is the ONLY sanctioned way for silent and visual paths to roll.
   */
  perform(spec: RollSpec, options: { mode: RollMode; context?: string }): RollAuditRecord {
    const index = this.nextIndex++;
    const seed = deriveRollSeed(this.baseSeed, index);
    const record: RollAuditRecord = {
      id: generateId(),
      index,
      baseSeed: this.baseSeed,
      seed,
      mode: options.mode,
      context: options.context,
      spec: { ...spec },
      outcome: executeRoll(spec, seed),
      timestamp: Date.now(),
    };
    this.records.push(record);
    if (this.records.length > ROLL_AUDIT_CAPACITY) {
      this.records.splice(0, this.records.length - ROLL_AUDIT_CAPACITY);
    }
    return record;
  }

  /**
   * Attach the die faces the 3D presentation actually displayed. Flags whether
   * they match the authoritative outcome so any presentation gap is auditable.
   */
  attachPresentation(recordId: string, values: number[]): RollAuditRecord | undefined {
    const record = this.records.find(r => r.id === recordId);
    if (!record) return undefined;
    const keptValues = record.outcome.dice.filter(d => !d.dropped).map(d => d.value);
    const matchesOutcome =
      values.length === keptValues.length && values.every((v, i) => v === keptValues[i]);
    record.presented = { values: [...values], matchesOutcome };
    return record;
  }

  /**
   * Re-run a recorded roll from its stored seed + spec and report whether the
   * fresh outcome matches what was recorded. Accepts an id (looked up in the
   * live log) or a detached record object (e.g. from an exported log dump).
   */
  reproduce(
    recordOrId: string | RollAuditRecord
  ): { record: RollAuditRecord; outcome: RollOutcome; matches: boolean } | undefined {
    const record =
      typeof recordOrId === 'string'
        ? this.records.find(r => r.id === recordOrId)
        : recordOrId;
    if (!record) return undefined;
    const outcome = executeRoll(record.spec, record.seed);
    const matches = JSON.stringify(outcome) === JSON.stringify(record.outcome);
    return { record, outcome, matches };
  }

  getRecords(): readonly RollAuditRecord[] {
    return this.records;
  }

  clear(): void {
    this.records = [];
    this.nextIndex = 0;
  }
}

export const DiceAuditLog = new DiceAuditLogClass();
export default DiceAuditLog;
