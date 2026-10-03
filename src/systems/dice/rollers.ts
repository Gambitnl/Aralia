/**
 * @file rollers.ts
 * The audited roller family. This is where game code rolls dice.
 *
 * WHY THIS FILE EXISTS (agora-f821.4, Remy ruling q1 = RETIRE, 2026-09-20):
 * `utils/combat/combatUtils` used to own `rollDice`, `rollD20` and `rollDamage`.
 * Those three defaulted to `Math.random` and recorded nothing, so 143 of the
 * game's 145 production rolls happened outside the D-G3 roll contract and could
 * not be reproduced or audited. Remy ruled that the legacy family retires and
 * every call site moves here. The signatures are deliberately unchanged, so a
 * call site migrates by changing its import specifier and nothing else.
 *
 * TWO PATHS:
 * 1. No injected `rng` — the live game path, and the only one gameplay uses.
 *    The roll goes through `DiceAuditLog.perform`, which takes a seed off the
 *    session stream, runs the contract's pure core, and keeps a reproducible
 *    record. Every unpinned roll in the game is therefore audited.
 * 2. An injected `rng` — the pinned-caller seam Remy's ruling said to keep.
 *    Design Preview scenarios pin a constant source (`() => 0.5`) so a demo
 *    shows a fixed number. The roll still runs through the contract's pure
 *    core (`executeRollWithSource`), so the grammar, the critical rule and the
 *    minRoll floor are the contract's, but the caller owns the sequence. Such a
 *    roll is reproducible only by re-running the caller's source, so it is NOT
 *    written to the audit log — recording a seed that cannot reproduce it would
 *    make the log lie.
 */

import {
  DiceAuditLog,
  executeRollWithSource,
  type RollMode,
  type RollSpec,
} from './rollContract';

/** A 0..1 random source, the same shape the retired legacy family accepted. */
export type DiceRandomSource = () => number;

/** Options shared by every audited roller. */
interface AuditedRollOptions {
  /** A caller-owned 0..1 source. Supplying it pins the roll to that stream. */
  rng?: DiceRandomSource;
  /** Human-readable purpose recorded on the audit record. */
  context?: string;
  /** Roll mode. Defaults to `silent`; visual rolls come through DiceService. */
  mode?: RollMode;
  /** Pins the contract seed for a caller that owns its own seed stream. */
  seed?: number;
}

/**
 * Runs `spec` and returns its total.
 *
 * With no injected source the roll is performed and recorded by the audit log.
 * With one, the caller's sequence drives the contract's pure core directly.
 */
function rollTotal(spec: RollSpec, options: AuditedRollOptions): number {
  if (options.rng) return executeRollWithSource(spec, options.rng).total;

  const record = DiceAuditLog.perform(spec, {
    mode: options.mode ?? 'silent',
    context: options.context,
    seed: options.seed,
  });
  return record.outcome.total;
}

/**
 * Rolls a dice notation string and returns the total.
 *
 * Supports multi-group formulas ("1d8 + 1d6 + 2"), signed flat modifiers and
 * whitespace, and returns 0 for empty or invalid notation — the same grammar
 * the retired roller used, because `executeRoll` shares its regex.
 *
 * @example rollDice('2d6+3') // 5..15, recorded in the audit log
 */
export function rollDice(diceString: string, options: AuditedRollOptions = {}): number {
  return rollTotal({ notation: diceString }, options);
}

/**
 * Rolls a d20, optionally with advantage or disadvantage.
 *
 * Advantage and disadvantage cancel, matching the 5e rule and the behaviour of
 * the retired `rollD20`. Because the notation is a single die, the contract's
 * "roll every die twice" advantage semantics and the retired roller's "roll the
 * d20 twice" semantics are the same roll.
 */
export function rollD20(
  options: AuditedRollOptions & { advantage?: boolean; disadvantage?: boolean } = {}
): number {
  return rollTotal(
    { notation: '1d20', advantage: options.advantage, disadvantage: options.disadvantage },
    options
  );
}

/**
 * Rolls damage, optionally doubling the DIE COUNT for a critical hit and
 * flooring each individual die at `minRoll` (Elemental Adept).
 *
 * The parameter list is positional because that is the shape the 30 retired
 * `rollDamage` call sites already use; migrating them must not require reading
 * each one's argument order.
 *
 * @example rollDamage('2d6+3', false) // 5..15
 * @example rollDamage('2d6', true)    // 4..24 (4d6)
 */
export function rollDamage(
  diceString: string,
  isCritical: boolean,
  minRoll: number = 1,
  random?: DiceRandomSource,
  context?: string
): number {
  return rollTotal({ notation: diceString, isCritical, minRoll }, { rng: random, context });
}
