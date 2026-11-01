/**
 * This file defines the durable lifecycle of one canonical world-grown dungeon.
 *
 * The world entrance already owns the dungeon's stable id and frozen seed path. This file keeps
 * that receipt beside additive expedition progress so save/load and later revisits address the
 * same place. It deliberately does not decide when an encounter is cleared, a route is opened,
 * treasure is claimed, or an objective is completed. It now also stores explored cell keys under
 * explicit level keys, allowing the diegetic sheet to survive save/load and revisit without
 * duplicating dungeon geometry. Compact level visit receipts now preserve stable child identities,
 * parent links, and transition coordinates while the large generated plans remain regenerable.
 * Accepted combat HP also lives here, so closing a visit cannot heal the same source creature.
 * Combat and interaction owners still supply authoritative identities and outcomes. Monster
 * ability charges and conditions are not covered by the health-only checkpoint.
 *
 * Called by: the world reducer, save migration, and focused dungeon lifecycle tests.
 * Depends on: the lightweight canonical receipt in dungeonIdentity.ts.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 14:53:31
 * Dependents: services/saveLoad/saveLoadCore.ts, state/reducers/worldReducer.ts, systems/gameplay/lodging.ts, systems/worldforge/dungeon/world/dungeonCombatResolution.ts, systems/worldforge/dungeon/world/dungeonDoorActions.ts, systems/worldforge/dungeon/world/dungeonExplorationResume.ts, systems/worldforge/dungeon/world/dungeonGameplay.ts, systems/worldforge/dungeon/world/dungeonLevels.ts, systems/worldforge/dungeon/world/dungeonObjectResolution.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// ============================================================================
// Canonical Identity Dependency
// ============================================================================
// Lifecycle state validates the lightweight receipt and never imports atlas generation machinery.
// ============================================================================

import type { ActiveDungeonEntry } from '../../../../components/World3D/dungeonEntryRuntime';
import type { Cell } from '../types';
import type { DungeonObjectFinding } from './dungeonObjectActions';

export interface DungeonExplorationPosition {
  depth: number;
  playerCell: Cell;
  entranceKind: ActiveDungeonEntry['entranceKind'];
  returnContext: ActiveDungeonEntry['returnContext'];
}

/** Shape validation is deliberately independent of atlas generation for save migration. */
export function normalizeDungeonExplorationPosition(value: unknown): DungeonExplorationPosition | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const p = value as DungeonExplorationPosition;
  if (!Number.isInteger(p.depth) || p.depth < 0 || p.depth > 2 ||
      !p.playerCell || !Number.isInteger(p.playerCell.x) || !Number.isInteger(p.playerCell.y) ||
      !['ruin-door', 'cave-mouth', 'temple-stair', 'sewer-grate'].includes(p.entranceKind)) return undefined;
  const r = p.returnContext;
  if (!r || !['worldSeed', 'cellId', 'tileX', 'tileY', 'xM', 'zM'].every(key => Number.isFinite(r[key as keyof typeof r])) ||
      (r.yM !== undefined && !Number.isFinite(r.yM))) return undefined;
  return {depth:p.depth, playerCell:{...p.playerCell}, entranceKind:p.entranceKind, returnContext:{...r}};
}

import {
  canonicalDungeonId,
  type DungeonIdentity,
} from './dungeonIdentity';

// ============================================================================
// Persisted Expedition Contract
// ============================================================================
// Presence and completion are separate axes. A completed dungeon may be revisited and therefore
// become active again without losing the fact that its objective was already completed.
// ============================================================================

export const DUNGEON_EXPEDITION_SCHEMA_VERSION = 3 as const;

export type DungeonVisitPhase = 'active' | 'retreated';
export type DungeonCompletionState = 'incomplete' | 'completed';
export type DungeonObjectiveState = 'active' | 'completed';

/** Compact evidence that one deterministic generated page has been reached. */
export interface DungeonLevelVisitReceipt {
  levelId: string;
  depth: number;
  identity: DungeonIdentity;
  parentLevelId: string | null;
  entryCellKey: string;
  parentReturnCellKey?: string;
  downTransitionCellKey?: string;
  bossObjectiveCellKey?: string;
}

export interface DungeonProgressState {
  /** Examined or physically collected source props; collection is monotonic. */
  objectFindings?: Record<string, DungeonObjectFinding>;
  /** Current visit footing; cleared on retreat, independent of lasting discoveries. */
  activeVisit?: DungeonExplorationPosition;
  /** Last authoritative HP by source encounter; leaving a visit does not heal its creature. */
  encounterHitPoints?: Record<string, number>;
  /** Stable encounter keys reported by future playable-room combat. */
  clearedEncounterIds: string[];
  /** Stable door, passage, or route keys reported by future interaction gameplay. */
  openedRouteIds: string[];
  /** Stable treasure keys reported by future loot interaction gameplay. */
  claimedTreasureIds: string[];
  /** Known objective keys and their latest durable state. */
  objectives: Record<string, DungeonObjectiveState>;
  /** Explored canonical grid-cell keys grouped by a forward-compatible dungeon level key. */
  exploredCellKeysByLevel: Record<string, string[]>;
  /** Reached child pages and their reliable parent-return coordinates, keyed by level id. */
  levelVisits: Record<string, DungeonLevelVisitReceipt>;
}

export interface DungeonExpeditionRecord {
  schemaVersion: typeof DUNGEON_EXPEDITION_SCHEMA_VERSION;
  identity: DungeonIdentity;
  /** Explicit proof that the canonical entrance has been used at least once. */
  hasEntered: true;
  /** Whether the current visit is open or the party last returned to the world. */
  visitPhase: DungeonVisitPhase;
  /** Completion never resets merely because the dungeon is entered again. */
  completion: DungeonCompletionState;
  /** Starts at one on first entry and increments for every later entry. */
  visitCount: number;
  /** Stored explicitly for consumers that should not reproduce visit-count policy. */
  hasRevisited: boolean;
  progress: DungeonProgressState;
}

export type DungeonExpeditionLedger = Record<string, DungeonExpeditionRecord>;

export interface DungeonProgressPatch {
  objectFindings?: Readonly<Record<string, DungeonObjectFinding>>;
  activeVisit?: DungeonExplorationPosition;
  encounterHitPoints?: Readonly<Record<string, number>>;
  clearedEncounterIds?: readonly string[];
  openedRouteIds?: readonly string[];
  claimedTreasureIds?: readonly string[];
  objectives?: Readonly<Record<string, DungeonObjectiveState>>;
  exploredCellKeysByLevel?: Readonly<Record<string, readonly string[]>>;
  levelVisits?: Readonly<Record<string, DungeonLevelVisitReceipt>>;
}

// ============================================================================
// Canonical Receipt Validation
// ============================================================================
// The live entry boundary performs the expensive world-site resolution. This persistence boundary
// enforces the cheap invariant that the ledger key, receipt id, and frozen seed path all agree.
// ============================================================================

function hasCanonicalIdentity(identity: unknown, expectedDungeonId?: string): identity is DungeonIdentity {
  if (!identity || typeof identity !== 'object') return false;
  const candidate = identity as Partial<DungeonIdentity>;
  if (typeof candidate.dungeonId !== 'string' || typeof candidate.seedPath !== 'string') {
    return false;
  }

  return (
    candidate.dungeonId === canonicalDungeonId(candidate.seedPath) &&
    (expectedDungeonId === undefined || candidate.dungeonId === expectedDungeonId)
  );
}

function requireCanonicalIdentity(identity: DungeonIdentity): void {
  if (!hasCanonicalIdentity(identity)) {
    throw new Error('Dungeon expedition identity does not match its canonical seed path.');
  }
}

// ============================================================================
// Additive Progress Helpers
// ============================================================================
// Progress only grows in this first contract. Resetting or respawning content requires explicit
// future design rules and therefore cannot happen accidentally through entry or save migration.
// ============================================================================

function normalizeObjectFindings(value:unknown, identity:DungeonIdentity):Record<string,DungeonObjectFinding> {
  if(!value || typeof value!=='object' || Array.isArray(value)) return {};
  const prefix=`object.v1:${identity.dungeonId}`;
  return Object.fromEntries(Object.entries(value).filter(([id,finding])=>
    id.startsWith(prefix) && (
      (/^(?::(?:prop|cache):\d+|\/level:\d+:(?:prop|cache):\d+)$/.test(id.slice(prefix.length)) &&
        (finding==='examined'||finding==='collected')) ||
      // An examined floor hazard is knowledge, not a secured reward or a disarm.
      (/^(?::trap:\d+|\/level:\d+:trap:\d+)$/.test(id.slice(prefix.length)) && finding==='examined') ||
      // Surface inspection records observation only; it cannot become a collection claim.
      (/^(?::surface:bloom:\d+|\/level:\d+:surface:bloom:\d+)$/.test(id.slice(prefix.length)) && finding==='examined'))));
}

function mergeObjectFindings(current:unknown,incoming:unknown,identity:DungeonIdentity):Record<string,DungeonObjectFinding> {
  const result=normalizeObjectFindings(current,identity);
  for(const [id,finding] of Object.entries(normalizeObjectFindings(incoming,identity))) {
    if(result[id]!=='collected') result[id]=finding;
  }
  return result;
}

function normalizeStableIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();

  // Empty or non-string values cannot address authored dungeon content, so they are omitted while
  // preserving the first-seen order of every valid stable key.
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) unique.add(item);
  }

  return [...unique];
}

function appendStableIds(current: readonly string[], incoming?: readonly string[]): string[] {
  return normalizeStableIds(incoming ? [...current, ...incoming] : current);
}

function normalizeObjectives(value: unknown): Record<string, DungeonObjectiveState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, DungeonObjectiveState> = {};

  // Objective ids remain opaque. Only the two states this schema can honestly preserve are kept.
  for (const [objectiveId, state] of Object.entries(value)) {
    if (objectiveId.length > 0 && (state === 'active' || state === 'completed')) {
      normalized[objectiveId] = state;
    }
  }

  return normalized;
}

function mergeObjectives(
  current: Readonly<Record<string, DungeonObjectiveState>>,
  incoming: unknown,
): Record<string, DungeonObjectiveState> {
  const merged = { ...current };

  // Completion is monotonic. A delayed "active" event cannot reopen an objective the party has
  // already completed, while a real completion still advances an active objective normally.
  for (const [objectiveId, state] of Object.entries(normalizeObjectives(incoming))) {
    if (merged[objectiveId] === 'completed' && state === 'active') continue;
    merged[objectiveId] = state;
  }

  return merged;
}

function normalizeExploredCellKeysByLevel(
  value: unknown,
): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, string[]> = {};

  // Level identifiers stay opaque for the later descent lane. Cell keys are limited to the shared
  // integer coordinate grammar so corrupt save data cannot become arbitrary parchment content.
  for (const [levelId, cellKeys] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    if (levelId.length === 0) continue;
    const stableCellKeys = normalizeStableIds(cellKeys).filter((cellKey) => /^\d+,\d+$/.test(cellKey));
    if (stableCellKeys.length > 0) normalized[levelId] = stableCellKeys;
  }

  return normalized;
}

function mergeExploredCellKeysByLevel(
  current: Readonly<Record<string, readonly string[]>>,
  incoming: unknown,
): Record<string, string[]> {
  const normalizedIncoming = normalizeExploredCellKeysByLevel(incoming);
  const levelIds = new Set([...Object.keys(current), ...Object.keys(normalizedIncoming)]);
  const merged: Record<string, string[]> = {};

  // Exploration is additive. Revisit and delayed save events may add ink, but cannot erase cells
  // already remembered on another level or earlier in the current one.
  for (const levelId of [...levelIds].sort()) {
    merged[levelId] = appendStableIds(current[levelId] ?? [], normalizedIncoming[levelId]);
  }

  return merged;
}

function normalizeLevelVisits(
  value: unknown,
  rootIdentity: DungeonIdentity,
): Record<string, DungeonLevelVisitReceipt> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, DungeonLevelVisitReceipt> = {};

  // A visit must be a direct member of this root stack. This rejects a valid receipt copied from
  // another dungeon as firmly as the top-level ledger rejects a mismatched entrance identity.
  for (const [levelId, raw] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<DungeonLevelVisitReceipt>;
    if (!Number.isInteger(candidate.depth) || (candidate.depth ?? -1) < 0) continue;
    const depth = candidate.depth!;
    const expectedLevelId = `level:${depth}`;
    const expectedSeedPath = depth === 0
      ? rootIdentity.seedPath
      : `${rootIdentity.seedPath}/${expectedLevelId}`;
    const expectedParentLevelId = depth === 0 ? null : `level:${depth - 1}`;
    if (levelId !== expectedLevelId || candidate.levelId !== expectedLevelId) continue;
    if (candidate.parentLevelId !== expectedParentLevelId) continue;
    if (!hasCanonicalIdentity(candidate.identity)) continue;
    if (candidate.identity.seedPath !== expectedSeedPath) continue;

    const cellFields = [
      candidate.entryCellKey,
      candidate.parentReturnCellKey,
      candidate.downTransitionCellKey,
      candidate.bossObjectiveCellKey,
    ];
    if (typeof candidate.entryCellKey !== 'string') continue;
    if (cellFields.some((cellKey) => cellKey !== undefined && !/^\d+,\d+$/.test(cellKey))) continue;

    normalized[levelId] = {
      levelId,
      depth,
      identity: { ...candidate.identity },
      parentLevelId: expectedParentLevelId,
      entryCellKey: candidate.entryCellKey,
      ...(candidate.parentReturnCellKey ? { parentReturnCellKey: candidate.parentReturnCellKey } : {}),
      ...(candidate.downTransitionCellKey ? { downTransitionCellKey: candidate.downTransitionCellKey } : {}),
      ...(candidate.bossObjectiveCellKey ? { bossObjectiveCellKey: candidate.bossObjectiveCellKey } : {}),
    };
  }

  return normalized;
}

// Keep only finite whole HP belonging to this dungeon or one of its child pages.
// Old saves can omit this optional field. It records health, not a clear or reward.
function normalizeEncounterHitPoints(value: unknown, identity: DungeonIdentity): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, hp]) =>
    (id.startsWith(`encounter.v1:${identity.dungeonId}:room:`)
      || id.startsWith(`encounter.v1:${identity.dungeonId}/`))
    && /:room:\d+:cell:\d+,\d+$/.test(id)
    && typeof hp === 'number' && Number.isSafeInteger(hp) && hp >= 0,
  ));
}

function mergeLevelVisits(
  current: Readonly<Record<string, DungeonLevelVisitReceipt>>,
  incoming: unknown,
  rootIdentity: DungeonIdentity,
): Record<string, DungeonLevelVisitReceipt> {
  const normalizedCurrent = normalizeLevelVisits(current, rootIdentity);
  const normalizedIncoming = normalizeLevelVisits(incoming, rootIdentity);

  // Reaching a level twice confirms the same deterministic receipt. Existing evidence wins if a
  // delayed event disagrees, preventing an old browser event from rewriting a return coordinate.
  return { ...normalizedIncoming, ...normalizedCurrent };
}

export function createEmptyDungeonProgress(): DungeonProgressState {
  return {
    clearedEncounterIds: [],
    openedRouteIds: [],
    claimedTreasureIds: [],
    objectives: {},
    exploredCellKeysByLevel: {},
    levelVisits: {},
  };
}

// ============================================================================
// Lifecycle Transitions
// ============================================================================
// Each transition is pure and returns a fresh record. Callers may safely use these helpers in the
// reducer and in deterministic migration tests without world generation or browser state.
// ============================================================================

export function enterDungeonExpedition(
  identity: DungeonIdentity,
  previous?: DungeonExpeditionRecord,
): DungeonExpeditionRecord {
  requireCanonicalIdentity(identity);

  // A first entry creates the complete empty contract. No generated room content is guessed here.
  if (!previous) {
    return {
      schemaVersion: DUNGEON_EXPEDITION_SCHEMA_VERSION,
      identity: { ...identity },
      hasEntered: true,
      visitPhase: 'active',
      completion: 'incomplete',
      visitCount: 1,
      hasRevisited: false,
      progress: createEmptyDungeonProgress(),
    };
  }

  // Re-entry keeps every progress and completion field while advancing only visit metadata.
  return {
    ...previous,
    identity: { ...identity },
    visitPhase: 'active',
    visitCount: previous.visitCount + 1,
    hasRevisited: true,
    progress: {
      ...previous.progress,
      activeVisit: undefined,
      ...(previous.progress.encounterHitPoints === undefined ? {} : {
        encounterHitPoints: normalizeEncounterHitPoints(previous.progress.encounterHitPoints, identity),
      }),
      objectives: { ...previous.progress.objectives },
      exploredCellKeysByLevel: mergeExploredCellKeysByLevel(
        previous.progress.exploredCellKeysByLevel ?? {},
        undefined,
      ),
      levelVisits: mergeLevelVisits(
        previous.progress.levelVisits ?? {},
        undefined,
        identity,
      ),
    },
  };
}

export function recordDungeonProgress(
  previous: DungeonExpeditionRecord,
  patch: DungeonProgressPatch,
): DungeonExpeditionRecord {
  return {
    ...previous,
    progress: {
      ...(previous.progress.objectFindings === undefined && patch.objectFindings === undefined ? {} : {
        objectFindings:mergeObjectFindings(previous.progress.objectFindings,patch.objectFindings,previous.identity),
      }),
      ...(normalizeDungeonExplorationPosition(patch.activeVisit ?? previous.progress.activeVisit) ? {
        activeVisit: normalizeDungeonExplorationPosition(patch.activeVisit ?? previous.progress.activeVisit),
      } : {}),
      // An accepted battle replaces only that source creature's last HP. Other
      // encounters, clear credit and rewards keep their existing independent owners.
      ...(previous.progress.encounterHitPoints === undefined && patch.encounterHitPoints === undefined ? {} : {
        encounterHitPoints: normalizeEncounterHitPoints({
          ...previous.progress.encounterHitPoints,
          ...patch.encounterHitPoints,
        }, previous.identity),
      }),
      clearedEncounterIds: appendStableIds(
        previous.progress.clearedEncounterIds,
        patch.clearedEncounterIds,
      ),
      openedRouteIds: appendStableIds(previous.progress.openedRouteIds, patch.openedRouteIds),
      claimedTreasureIds: appendStableIds(
        previous.progress.claimedTreasureIds,
        patch.claimedTreasureIds,
      ),
      objectives: mergeObjectives(previous.progress.objectives, patch.objectives),
      exploredCellKeysByLevel: mergeExploredCellKeysByLevel(
        previous.progress.exploredCellKeysByLevel ?? {},
        patch.exploredCellKeysByLevel,
      ),
      levelVisits: mergeLevelVisits(
        previous.progress.levelVisits ?? {},
        patch.levelVisits,
        previous.identity,
      ),
    },
  };
}

export function retreatDungeonExpedition(
  previous: DungeonExpeditionRecord,
): DungeonExpeditionRecord {
  return {
    ...previous,
    visitPhase: 'retreated',
    progress: {
      ...previous.progress,
      activeVisit: undefined,
      objectives: { ...previous.progress.objectives },
      exploredCellKeysByLevel: mergeExploredCellKeysByLevel(
        previous.progress.exploredCellKeysByLevel ?? {},
        undefined,
      ),
      levelVisits: mergeLevelVisits(
        previous.progress.levelVisits ?? {},
        undefined,
        previous.identity,
      ),
    },
  };
}

export function completeDungeonExpedition(
  previous: DungeonExpeditionRecord,
): DungeonExpeditionRecord {
  return {
    ...previous,
    completion: 'completed',
    progress: {
      ...previous.progress,
      objectives: { ...previous.progress.objectives },
      exploredCellKeysByLevel: mergeExploredCellKeysByLevel(
        previous.progress.exploredCellKeysByLevel ?? {},
        undefined,
      ),
      levelVisits: mergeLevelVisits(
        previous.progress.levelVisits ?? {},
        undefined,
        previous.identity,
      ),
    },
  };
}

// ============================================================================
// Save Migration and Validation
// ============================================================================
// Missing legacy data becomes an empty ledger. Malformed or cross-key records are dropped instead
// of being attached to the wrong world entrance; valid progress is normalized deterministically.
// ============================================================================

export function normalizeDungeonExpeditionLedger(value: unknown): DungeonExpeditionLedger {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: DungeonExpeditionLedger = {};

  // Sorting makes migration output stable even when a hand-edited save changes object key order.
  for (const [dungeonId, raw] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<DungeonExpeditionRecord>;
    if (!hasCanonicalIdentity(candidate.identity, dungeonId)) continue;
    if (candidate.visitPhase !== 'active' && candidate.visitPhase !== 'retreated') continue;
    if (candidate.completion !== 'incomplete' && candidate.completion !== 'completed') continue;

    const visitCount = Number.isInteger(candidate.visitCount) && (candidate.visitCount ?? 0) > 0
      ? candidate.visitCount!
      : 1;
    const rawProgress = candidate.progress as Partial<DungeonProgressState> | undefined;

    normalized[dungeonId] = {
      schemaVersion: DUNGEON_EXPEDITION_SCHEMA_VERSION,
      identity: { ...candidate.identity },
      hasEntered: true,
      visitPhase: candidate.visitPhase,
      completion: candidate.completion,
      visitCount,
      hasRevisited: visitCount > 1,
      progress: {
        ...(rawProgress?.objectFindings === undefined ? {} : {
          objectFindings:normalizeObjectFindings(rawProgress.objectFindings,candidate.identity),
        }),
        ...(candidate.visitPhase === 'active' && normalizeDungeonExplorationPosition(rawProgress?.activeVisit) ? {
          activeVisit: normalizeDungeonExplorationPosition(rawProgress?.activeVisit),
        } : {}),
        ...(rawProgress?.encounterHitPoints === undefined ? {} : {
          encounterHitPoints: normalizeEncounterHitPoints(rawProgress.encounterHitPoints, candidate.identity),
        }),
        clearedEncounterIds: normalizeStableIds(rawProgress?.clearedEncounterIds),
        openedRouteIds: normalizeStableIds(rawProgress?.openedRouteIds),
        claimedTreasureIds: normalizeStableIds(rawProgress?.claimedTreasureIds),
        objectives: normalizeObjectives(rawProgress?.objectives),
        exploredCellKeysByLevel: normalizeExploredCellKeysByLevel(
          rawProgress?.exploredCellKeysByLevel,
        ),
        levelVisits: normalizeLevelVisits(
          rawProgress?.levelVisits,
          candidate.identity,
        ),
      },
    };
  }

  return normalized;
}
