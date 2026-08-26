// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 09:34:22
 * Dependents: state/appState.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file npcMemoryMigration.ts
 * @description Loader-side migration policy for per-NPC memory (board task
 * agora-f4e9, "NPC Memory G3"). Turns an untrusted saved `npcMemory` payload
 * into the canonical `NpcMemory` shape without discarding anything a newer or
 * sibling system wrote onto the same object.
 *
 * WHAT THIS OWNS
 * The whole `NpcMemory` record shape on load: disposition, knownFacts,
 * suspicion, goals, and the pass-through of every optional field. Before this
 * file existed, the loader had an inline loop in `appState.ts` that owned only
 * `knownFacts`; that behavior is preserved here verbatim (legacy string facts
 * become canonical records, and structured facts get the strength-derived
 * `confidence`/`significance` backfill) and the rest of the shape is now healed
 * around it.
 *
 * WHY IT IS A SEPARATE MODULE
 * The loader reducer is already long, and the migration needs to be unit
 * testable against raw `unknown` payloads that no longer satisfy today's types.
 * It also matches the existing loader-migration pattern in this directory
 * (`playerCellMigration`, `worldDataMigration`): a pure, idempotent function
 * called once from the load path.
 *
 * WHAT IS DELIBERATELY PRESERVED
 * 1. Unknown optional fields survive untouched. Sibling systems attach data to
 *    `NpcMemory` through intersection types rather than editing the locked
 *    `src/types/world.ts` — `emotionalMarkers` (npcEmotionalMemory.ts) and
 *    `witnessedActs` (npcWitnessMemory.ts) today, more later. A migration that
 *    rebuilt only the known keys would silently delete an NPC's grudges on the
 *    next load. So we spread the raw object first and overwrite only the fields
 *    we own.
 * 2. Object identity for values that need no repair. Callers (and the existing
 *    load test) rely on unchanged goals/facts/interactions arrays keeping their
 *    reference, so a canonical save is a true no-op rather than a deep clone.
 *
 * WHAT IS DEFERRED
 * The task body described the default memory as
 * `{ disposition: 0, knownFacts: [], goals: [] }`, which omits `suspicion` —
 * a required field on `NpcMemory`. The default below includes
 * `SuspicionLevel.Unaware` so the result actually type-checks; that is the same
 * neutral value `createEmptyMemory()` uses.
 */

import { SuspicionLevel, type KnownFact, type NpcMemory } from '../../types/world';
import { generateId } from '../../utils/core/idGenerator';

/** Provenance labels a `KnownFact.source` is allowed to carry. */
const VALID_FACT_SOURCES: ReadonlySet<string> = new Set([
  'direct',
  'gossip',
  'witnessed',
  'told_by_player',
  'inference',
]);

/**
 * Neutral memory for an NPC whose saved entry is missing or unusable.
 * Matches `createEmptyMemory()`'s live-lane defaults; the richer optional
 * fields are left absent rather than invented, so a healed entry is
 * distinguishable from one an NPC actually accumulated.
 */
export const createDefaultNpcMemory = (): NpcMemory => ({
  disposition: 0,
  knownFacts: [],
  suspicion: SuspicionLevel.Unaware,
  goals: [],
});

/** True when `value` is a non-null, non-array object we can read keys from. */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A structured fact is keepable only when it carries the three fields every
 * reader dereferences without guarding: `id`, `text`, and a recognized
 * `source`. Anything else is corrupt data that would surface as an empty line
 * of dialogue or a crash, so it is dropped rather than repaired — we have no
 * honest value to invent for a missing fact body.
 */
const isUsableKnownFact = (value: unknown): value is KnownFact => {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (typeof value.text !== 'string' || value.text.length === 0) return false;
  if (typeof value.source !== 'string' || !VALID_FACT_SOURCES.has(value.source)) return false;
  return true;
};

/**
 * Backfills the two optional strength-derived fields added by the memory merge.
 * Returns the SAME object when both are already present, so a canonical save
 * round-trips by reference.
 */
const backfillFactStrengthFields = (fact: KnownFact): KnownFact => {
  if (fact.confidence !== undefined && fact.significance !== undefined) return fact;
  const baseStrength = typeof fact.strength === 'number' ? fact.strength : 5;
  return {
    ...fact,
    confidence: fact.confidence ?? Math.max(0, Math.min(1, baseStrength / 10)),
    significance: fact.significance ?? Math.max(0, Math.min(10, baseStrength)),
  };
};

/**
 * Migrates one NPC's saved memory payload to the canonical `NpcMemory` shape.
 *
 * Policy, in order:
 * - A missing/non-object payload becomes {@link createDefaultNpcMemory}.
 * - `disposition` that is not a finite number defaults to 0.
 * - `suspicion` that is not one of the enum values defaults to `Unaware`.
 * - `knownFacts` that is not an array becomes `[]`. Legacy plain-string entries
 *   are converted to canonical records (stamped with `legacyFactTimestamp`);
 *   structured entries missing `id`/`text`/`source` are filtered out; survivors
 *   keep every saved field and gain only missing `confidence`/`significance`.
 * - `goals` that is not an array becomes `[]`; non-object entries are dropped.
 * - Every other key on the payload is passed through unchanged.
 *
 * Idempotent: `migrateNpcMemory(migrateNpcMemory(x))` deep-equals
 * `migrateNpcMemory(x)`.
 *
 * @param raw The saved payload, treated as untrusted data.
 * @param legacyFactTimestamp Timestamp stamped onto facts converted from legacy
 *   strings (the loader passes the save's game time). Defaults to 0 so the
 *   function stays pure and callable from tests without a clock.
 */
export function migrateNpcMemory(raw: unknown, legacyFactTimestamp = 0): NpcMemory {
  if (!isPlainObject(raw)) return createDefaultNpcMemory();

  // Spread FIRST so unknown optional fields written by sibling systems
  // (emotionalMarkers, witnessedActs, ...) survive the migration untouched.
  // Only the fields this policy owns are overwritten below.
  const migrated = { ...raw } as Record<string, unknown> & NpcMemory;

  migrated.disposition =
    typeof raw.disposition === 'number' && Number.isFinite(raw.disposition) ? raw.disposition : 0;

  migrated.suspicion =
    raw.suspicion === SuspicionLevel.Unaware ||
    raw.suspicion === SuspicionLevel.Suspicious ||
    raw.suspicion === SuspicionLevel.Alert
      ? (raw.suspicion as SuspicionLevel)
      : SuspicionLevel.Unaware;

  migrated.knownFacts = migrateKnownFacts(raw.knownFacts, legacyFactTimestamp);

  // Goals carry no derived fields, so the only repair is shape: a non-array
  // becomes empty, and non-object entries (never a valid Goal) are dropped.
  // A clean array keeps its identity.
  if (!Array.isArray(raw.goals)) {
    migrated.goals = [];
  } else if (raw.goals.every((goal) => isPlainObject(goal))) {
    migrated.goals = raw.goals as unknown as NpcMemory['goals'];
  } else {
    migrated.goals = raw.goals.filter((goal) =>
      isPlainObject(goal),
    ) as unknown as NpcMemory['goals'];
  }

  return migrated;
}

/**
 * Known-fact lane, preserved from the original inline loader migration.
 * Legacy saves stored `knownFacts` as a plain string array before the
 * structured `KnownFact` model existed.
 */
function migrateKnownFacts(raw: unknown, legacyFactTimestamp: number): KnownFact[] {
  if (!Array.isArray(raw)) return [];

  // Legacy string lane: a saved array of bare fact texts. Detected on the first
  // entry, matching the original loader check, then converted entry by entry so
  // a mixed array cannot smuggle a non-string through.
  if (raw.length > 0 && typeof raw[0] === 'string') {
    return raw
      .filter((fact): fact is string => typeof fact === 'string')
      .map((factText): KnownFact => ({
        id: generateId(),
        text: factText,
        // A direct provenance label lets later readers tell imported memories
        // from derived ones. This is fact metadata, not approval routing.
        source: 'direct',
        isPublic: true,
        timestamp: legacyFactTimestamp,
        strength: 5,
        lifespan: 999,
        confidence: 0.5,
        significance: 5,
      }));
  }

  const usable = raw.filter(isUsableKnownFact);
  const backfilled = usable.map(backfillFactStrengthFields);
  // Preserve array identity when nothing at all changed, so a canonical save is
  // a genuine no-op for downstream reference checks.
  if (usable.length === raw.length && backfilled.every((fact, i) => fact === usable[i])) {
    return raw as KnownFact[];
  }
  return backfilled;
}

/**
 * Applies {@link migrateNpcMemory} across a whole saved `npcMemory` record.
 * Returns a new record; entries needing no repair keep their object identity.
 * A missing/malformed record becomes `{}` rather than throwing, so a corrupt
 * social block never blocks a load.
 */
export function migrateNpcMemoryRecord(
  raw: unknown,
  legacyFactTimestamp = 0,
): Record<string, NpcMemory> {
  if (!isPlainObject(raw)) return {};
  const migrated: Record<string, NpcMemory> = {};
  for (const npcId of Object.keys(raw)) {
    migrated[npcId] = migrateNpcMemory(raw[npcId], legacyFactTimestamp);
  }
  return migrated;
}
