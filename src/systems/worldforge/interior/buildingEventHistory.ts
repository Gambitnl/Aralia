// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 18:49:41
 * Dependents: components/World3D/World3DWrapper.tsx, systems/worldforge/interior/buildingExtensions.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/townSim.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Fold chronological building events into exact, renderer-ready condition.
 *
 * The save-side event log is the source of truth. This module never mutates a
 * plan or rolls a sequential random stream: targets are ranked with named FNV
 * hashes built from the building identity and event payload. Replaying the same
 * ordered log therefore produces the same room, window, roof, and mass targets
 * even when unrelated generator streams gain new draws.
 *
 * Extension events either activate a legacy secondary mass or identify the
 * mass added by the structural pre-pass. Invalid targets are rejected instead
 * of being approximated with renderer-only geometry.
 */

import { fnv1a } from '../seedPath';
import type {
  AppliedBuildingHistory,
  BlueprintPlan,
  BuildingDamageSeverity,
  BuildingEvent,
  BuildingEventHistory,
  BuildingHistoryJournalV1,
  BuildingHistorySnapshotV1,
  BuildingLiveHistoryFeature,
  SnapshottedStructuralBuildingEvent,
  StyleResolved,
} from './blueprintTypes';

type Ranked<T> = { value: T; score: number; tie: string };

/** JSON with sorted object keys keeps equivalent payloads hash-equivalent. */
function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function eventIdentity(plan: BlueprintPlan, event: BuildingEvent, index: number): string {
  return canonicalJson({
    buildingId: plan.buildingId,
    district: plan.styleResolved?.districtSignature ?? '',
    building: plan.styleResolved?.buildingVariant ?? '',
    event,
    index,
  });
}

function hash01(identity: string, label: string): number {
  return fnv1a(`${identity}|${label}`) / 0x1_0000_0000;
}

function ranked<T>(items: readonly T[], identity: string, label: (item: T) => string): Ranked<T>[] {
  return items
    .map((value) => {
      const tie = label(value);
      return { value, tie, score: hash01(identity, tie) };
    })
    .sort((a, b) => a.score - b.score || a.tie.localeCompare(b.tie));
}

function assertEventLog(
  log: readonly BuildingEvent[],
  startingDay = Number.NEGATIVE_INFINITY,
): void {
  let priorDay = startingDay;
  log.forEach((event, index) => {
    if (!Number.isInteger(event.day)) {
      throw new Error(`applyHistory: event ${index} has non-integer day ${event.day}`);
    }
    if (event.day < priorDay) {
      throw new Error(
        `applyHistory: event ${index} day ${event.day} precedes prior day ${priorDay}`,
      );
    }
    if (event.kind === 'fire-damage' && ![1, 2, 3].includes(event.payload.severity)) {
      throw new Error(`applyHistory: fire event ${index} has invalid severity`);
    }
    priorDay = event.day;
  });
}

/** A legacy array has no folded prefix; version is the reliable journal discriminator. */
export function isBuildingHistoryJournal(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): history is BuildingHistoryJournalV1 {
  return history !== undefined
    && !Array.isArray(history)
    && (history as BuildingHistoryJournalV1).version === 1;
}

/** Copy one event deeply enough that extension rectangles cannot alias save state. */
function cloneEvent(event: BuildingEvent): BuildingEvent {
  return {
    ...event,
    ...(event.payload
      ? {
          payload: {
            ...event.payload,
            ...(event.kind === 'extension' && event.payload.mass
              ? { mass: { ...event.payload.mass } }
              : {}),
          },
        }
      : {}),
  } as BuildingEvent;
}

/** Renderer targets are flat records; copy each one before replay mutates its list. */
function cloneFeatures(
  features: readonly BuildingLiveHistoryFeature[],
): BuildingLiveHistoryFeature[] {
  return features.map((feature) => ({ ...feature }));
}

/** Style contains two arrays/records that need independent snapshot ownership. */
function cloneStyle(style: StyleResolved | undefined): StyleResolved | undefined {
  return style
    ? {
        ...style,
        construction: { ...style.construction },
        weathering: style.weathering ? { ...style.weathering } : undefined,
        motifs: [...style.motifs],
      }
    : undefined;
}

/** Validate snapshot boundaries before any saved outcomes reach geometry. */
function assertJournal(journal: BuildingHistoryJournalV1): void {
  const { snapshot } = journal;
  if (snapshot.version !== 1 || snapshot.history.eventsApplied < 1) {
    throw new Error(`applyHistory: invalid version 1 building-history snapshot`);
  }
  if (snapshot.history.lastDay !== snapshot.throughDay) {
    throw new Error(`applyHistory: snapshot day does not match folded history`);
  }
  if (!/^[0-9a-z]+$/.test(snapshot.eventDigest)) {
    throw new Error(`applyHistory: snapshot event digest is invalid`);
  }
  if (snapshot.useStateSinceDay !== null
    && !Number.isInteger(snapshot.useStateSinceDay)) {
    throw new Error(`applyHistory: snapshot use-state day is invalid`);
  }
  assertEventLog(journal.events, snapshot.throughDay);
  for (const entry of snapshot.structuralEvents) {
    if (!Number.isInteger(entry.eventIndex)
      || entry.eventIndex < 0
      || entry.eventIndex >= snapshot.history.eventsApplied) {
      throw new Error(`applyHistory: snapshot structural ordinal is invalid`);
    }
    if (entry.event.kind !== 'extension' || !entry.event.payload.mass) {
      throw new Error(`applyHistory: snapshot structural event must carry a mass`);
    }
  }
}

function replaceFeature(
  features: BuildingLiveHistoryFeature[],
  next: BuildingLiveHistoryFeature,
  sameTarget: (feature: BuildingLiveHistoryFeature) => boolean,
): void {
  const existing = features.findIndex(sameTarget);
  if (existing >= 0) features.splice(existing, 1, next);
  else features.push(next);
}

function addFireDamage(
  plan: BlueprintPlan,
  features: BuildingLiveHistoryFeature[],
  identity: string,
  severity: BuildingDamageSeverity,
): void {
  const aboveGrade = plan.floors
    .filter((floor) => floor.level >= 0)
    .flatMap((floor) => floor.rooms.map((room) => ({ floorLevel: floor.level, room })));
  const candidates = aboveGrade.length > 0
    ? aboveGrade
    : plan.floors.flatMap((floor) =>
      floor.rooms.map((room) => ({ floorLevel: floor.level, room })));

  for (const target of ranked(
    candidates,
    identity,
    ({ floorLevel, room }) => `room:${floorLevel}:${room.id}`,
  ).slice(0, Math.min(severity, candidates.length))) {
    const next: BuildingLiveHistoryFeature = {
      kind: 'scorched-room',
      floorLevel: target.value.floorLevel,
      roomId: target.value.room.id,
      intensity: severity,
    };
    replaceFeature(features, next, (feature) =>
      feature.kind === 'scorched-room'
      && feature.floorLevel === next.floorLevel
      && feature.roomId === next.roomId);
  }

  addRoofBreach(plan, features, identity, severity);
}

/** Target roof damage independently so non-fire ruins do not gain scorch marks. */
function addRoofBreach(
  plan: BlueprintPlan,
  features: BuildingLiveHistoryFeature[],
  identity: string,
  severity: BuildingDamageSeverity,
): void {
  if (severity < 2 || !plan.roof?.planes.length) return;
  const planeIndex = Math.min(
    plan.roof.planes.length - 1,
    Math.floor(hash01(identity, 'roof-hole:plane') * plan.roof.planes.length),
  );
  const plane = plan.roof.planes[planeIndex];
  const x = plane.pts.reduce((sum, point) => sum + point[0], 0) / plane.pts.length;
  const y = plane.pts.reduce((sum, point) => sum + point[1], 0) / plane.pts.length;
  const next: BuildingLiveHistoryFeature = {
    kind: 'roof-hole',
    planeIndex,
    x,
    y,
    radiusFt: 1.1 + severity * 0.55,
  };
  replaceFeature(features, next, (feature) =>
    feature.kind === 'roof-hole' && feature.planeIndex === planeIndex);
}

function addBoards(
  plan: BlueprintPlan,
  features: BuildingLiveHistoryFeature[],
  identity: string,
  fraction: number,
): void {
  const windows = plan.floors
    .filter((floor) => floor.level >= 0)
    .flatMap((floor) => floor.windows.map((_, windowIndex) => ({
      floorLevel: floor.level,
      windowIndex,
    })));
  const keep = features.filter((feature) => feature.kind !== 'boarded-window');
  features.splice(0, features.length, ...keep);
  if (windows.length === 0 || fraction <= 0) return;

  const count = Math.max(1, Math.min(windows.length, Math.ceil(windows.length * fraction)));
  for (const target of ranked(
    windows,
    identity,
    ({ floorLevel, windowIndex }) => `window:${floorLevel}:${windowIndex}`,
  ).slice(0, count)) {
    features.push({ kind: 'boarded-window', ...target.value });
  }
}

function addRuinEvidence(
  plan: BlueprintPlan,
  features: BuildingLiveHistoryFeature[],
  identity: string,
  severity: BuildingDamageSeverity,
  cause: NonNullable<Extract<BuildingEvent, { kind: 'ruin' }>['payload']>['cause'],
): void {
  addBoards(plan, features, identity, 1);

  if (plan.roof?.planes.length) {
    // Every serious ruin breaches the roof, but only a fire-caused ruin should
    // add scorched rooms. Both paths keep the same deterministic roof target.
    const ruinSeverity = Math.max(2, severity) as 2 | 3;
    if (cause === 'fire') addFireDamage(plan, features, `${identity}|ruin`, ruinSeverity);
    else addRoofBreach(plan, features, `${identity}|ruin`, ruinSeverity);
  }
  if (!plan.roof?.ridges.length) return;
  const ridgeIndex = Math.min(
    plan.roof.ridges.length - 1,
    Math.floor(hash01(identity, 'ruin-sag:ridge') * plan.roof.ridges.length),
  );
  const next: BuildingLiveHistoryFeature = {
    kind: 'ruin-sag',
    ridgeIndex,
    deflectionFt: 0.65 + severity * 0.25,
    colorHex: plan.styleResolved?.roofColor ?? '#4a4039',
  };
  replaceFeature(features, next, (feature) =>
    feature.kind === 'ruin-sag' && feature.ridgeIndex === ridgeIndex);
}

function applyRestyle(
  style: StyleResolved | undefined,
  event: Extract<BuildingEvent, { kind: 'renovation' }>,
): StyleResolved | undefined {
  if (!style || event.payload?.scope !== 'restyle') return style;
  const { wallColor, roofColor, trimColor, facadePattern } = event.payload;
  return {
    ...style,
    ...(wallColor ? { wallColor } : {}),
    ...(roofColor ? { roofColor } : {}),
    ...(trimColor ? { trimColor } : {}),
    ...(facadePattern ? { facadePattern } : {}),
  };
}

/** Seed token for the composable event digest used by full logs and snapshots. */
const EMPTY_EVENT_DIGEST = fnv1a('building-history-events:v1').toString(36);

/** Fold one absolute event ordinal into a fixed-size digest. */
function appendEventDigest(digest: string, event: BuildingEvent, eventIndex: number): string {
  return fnv1a(`${digest}|${eventIndex}|${canonicalJson(event)}`).toString(36);
}

/** Number of chronological events represented by either save shape. */
export function buildingHistoryEventCount(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): number {
  if (!history) return 0;
  return isBuildingHistoryJournal(history)
    ? history.snapshot.history.eventsApplied + history.events.length
    : history.length;
}

/** Fixed digest that remains identical before and after prefix compaction. */
export function buildingHistoryEventDigest(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): string {
  if (!history) return EMPTY_EVENT_DIGEST;
  let digest = isBuildingHistoryJournal(history)
    ? history.snapshot.eventDigest
    : EMPTY_EVENT_DIGEST;
  const offset = isBuildingHistoryJournal(history)
    ? history.snapshot.history.eventsApplied
    : 0;
  const events = isBuildingHistoryJournal(history) ? history.events : history;
  events.forEach((event, index) => {
    digest = appendEventDigest(digest, event, offset + index);
  });
  return digest;
}

/** Stable memo identity for either save-side history representation. */
export function buildingEventLogDigest(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): string {
  const count = buildingHistoryEventCount(history);
  return count > 0 ? `v1:${count}:${buildingHistoryEventDigest(history)}` : '';
}

/** Structural additions with the absolute ordinals expected by footprint replay. */
export function structuralBuildingHistoryEvents(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): SnapshottedStructuralBuildingEvent[] {
  if (!history) return [];
  const retained = isBuildingHistoryJournal(history)
    ? history.snapshot.structuralEvents.map((entry) => ({
        eventIndex: entry.eventIndex,
        event: cloneEvent(entry.event) as Extract<BuildingEvent, { kind: 'extension' }>,
      }))
    : [];
  const offset = isBuildingHistoryJournal(history)
    ? history.snapshot.history.eventsApplied
    : 0;
  const events = isBuildingHistoryJournal(history) ? history.events : history;
  events.forEach((event, index) => {
    if (event.kind === 'extension' && event.payload.mass) {
      retained.push({ eventIndex: offset + index, event: cloneEvent(event) as typeof event });
    }
  });
  return retained;
}

/** Current use state without reconstructing renderer targets. */
export function currentBuildingUse(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): AppliedBuildingHistory['status'] {
  return buildingUseStateSince(history).status;
}

/** Current use plus the day that state began, retained across compaction. */
export function buildingUseStateSince(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): { status: AppliedBuildingHistory['status']; sinceDay: number | null } {
  let status: AppliedBuildingHistory['status'] = isBuildingHistoryJournal(history)
    ? history.snapshot.history.status
    : 'occupied';
  let sinceDay = isBuildingHistoryJournal(history)
    ? history.snapshot.useStateSinceDay
    : null;
  const events = isBuildingHistoryJournal(history) ? history.events : history ?? [];
  for (const event of events) {
    if (event.kind === 'abandonment') {
      status = 'abandoned';
      sinceDay = event.day;
    } else if (event.kind === 'reoccupation' || event.kind === 'renovation') {
      status = 'occupied';
      sinceDay = event.day;
    } else if (event.kind === 'ruin') {
      status = 'ruined';
      sinceDay = event.day;
    }
  }
  return { status, sinceDay };
}

/** Whether fire damage survives the latest repair in either representation. */
export function hasUnrepairedBuildingFire(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): boolean {
  let damaged = isBuildingHistoryJournal(history)
    && history.snapshot.history.features.some((feature) => feature.kind === 'scorched-room');
  const events = isBuildingHistoryJournal(history) ? history.events : history ?? [];
  for (const event of events) {
    if (event.kind === 'fire-damage') damaged = true;
    if (event.kind === 'renovation') damaged = false;
  }
  return damaged;
}

/** Deep clone one journal, including every renderer and structural outcome. */
function cloneJournal(history: BuildingHistoryJournalV1): BuildingHistoryJournalV1 {
  return {
    version: 1,
    snapshot: {
      ...history.snapshot,
      history: {
        ...history.snapshot.history,
        features: cloneFeatures(history.snapshot.history.features),
      },
      useStateSinceDay: history.snapshot.useStateSinceDay,
      ...(history.snapshot.styleResolved
        ? { styleResolved: cloneStyle(history.snapshot.styleResolved) }
        : {}),
      structuralEvents: history.snapshot.structuralEvents.map((entry) => ({
        eventIndex: entry.eventIndex,
        event: cloneEvent(entry.event) as typeof entry.event,
      })),
      fireIncidentIdsOnThroughDay: [...history.snapshot.fireIncidentIdsOnThroughDay],
    },
    events: history.events.map(cloneEvent),
  };
}

/** Deep clone save history before the pure town reducer mutates its tail. */
export function cloneBuildingEventHistory(
  history: BuildingEventHistory | readonly BuildingEvent[],
): BuildingEventHistory {
  return isBuildingHistoryJournal(history)
    ? cloneJournal(history)
    : history.map(cloneEvent);
}

/**
 * Append one event without mutation. Fire incident ids are idempotent per log,
 * which prevents a multi-victim household from recording the same fire twice.
 */
export function appendBuildingEvent(
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
  event: BuildingEvent,
): BuildingEventHistory {
  const current = history ?? [];
  const tail = isBuildingHistoryJournal(current) ? current.events : current;
  const duplicateInSnapshot = event.kind === 'fire-damage'
    && isBuildingHistoryJournal(current)
    && event.day === current.snapshot.throughDay
    && current.snapshot.fireIncidentIdsOnThroughDay.includes(event.payload.incidentId);
  if (event.kind === 'fire-damage' && (duplicateInSnapshot || tail.some((candidate) =>
    candidate.kind === 'fire-damage'
    && candidate.payload.incidentId === event.payload.incidentId))) {
    return cloneBuildingEventHistory(current);
  }
  const nextTail = [...tail, cloneEvent(event)];
  assertEventLog(
    nextTail,
    isBuildingHistoryJournal(current)
      ? current.snapshot.throughDay
      : Number.NEGATIVE_INFINITY,
  );
  if (!isBuildingHistoryJournal(current)) return nextTail;
  return {
    version: 1,
    snapshot: cloneJournal(current).snapshot,
    events: nextTail,
  };
}

/**
 * Replay an ordered event log over a canonical plan and return a new plan.
 * Empty logs are a byte-compatible no-op for legacy callers.
 */
export function applyHistory(
  plan: BlueprintPlan,
  history: BuildingEventHistory | readonly BuildingEvent[],
): BlueprintPlan {
  const journal = isBuildingHistoryJournal(history) ? history : undefined;
  const log: readonly BuildingEvent[] = journal
    ? journal.events
    : history as readonly BuildingEvent[];
  if (!journal && log.length === 0) return plan;
  if (journal) assertJournal(journal);
  else assertEventLog(log);

  let status: AppliedBuildingHistory['status'] =
    journal?.snapshot.history.status ?? 'occupied';
  let renovatedBackstory = journal?.snapshot.history.renovatedBackstory ?? false;
  let styleResolved = journal
    ? cloneStyle(journal.snapshot.styleResolved)
    : plan.styleResolved;
  const features: BuildingLiveHistoryFeature[] = journal
    ? cloneFeatures(journal.snapshot.history.features)
    : [];
  const indexOffset = journal?.snapshot.history.eventsApplied ?? 0;

  log.forEach((event, index) => {
    const absoluteIndex = indexOffset + index;
    const identity = eventIdentity(plan, event, absoluteIndex);
    if (event.kind === 'fire-damage') {
      addFireDamage(plan, features, identity, event.payload.severity);
      return;
    }
    if (event.kind === 'renovation') {
      const retained = features.filter((feature) => feature.kind === 'extension-phase');
      features.splice(0, features.length, ...retained);
      renovatedBackstory = true;
      status = 'occupied';
      styleResolved = applyRestyle(styleResolved, event);
      return;
    }
    if (event.kind === 'extension') {
      const { phase } = event.payload;
      const massIndex = event.payload.mass
        ? plan.masses.findIndex((mass) => mass.extensionEventIndex === absoluteIndex)
        : event.payload.massIndex;
      if (!Number.isInteger(massIndex) || massIndex <= 0 || !plan.masses[massIndex]) {
        throw new Error(
          `applyHistory: extension targets missing secondary mass ${massIndex ?? 'structural'}`,
        );
      }
      if (!Number.isInteger(phase) || phase < 1) {
        throw new Error(`applyHistory: extension phase must be a positive integer`);
      }
      const next: BuildingLiveHistoryFeature = {
        kind: 'extension-phase',
        massIndex,
        phase,
        colorHex: event.payload.colorHex
          ?? styleResolved?.trimColor
          ?? styleResolved?.wallColor
          ?? '#756653',
      };
      replaceFeature(features, next, (feature) =>
        feature.kind === 'extension-phase' && feature.massIndex === massIndex);
      return;
    }
    if (event.kind === 'abandonment') {
      status = 'abandoned';
      const fraction = Math.max(0, Math.min(1, event.payload?.boardedFraction ?? 0.65));
      addBoards(plan, features, identity, fraction);
      return;
    }
    if (event.kind === 'reoccupation') {
      status = 'occupied';
      const retained = features.filter((feature) => feature.kind !== 'boarded-window');
      features.splice(0, features.length, ...retained);
      return;
    }

    status = 'ruined';
    const severity = event.payload?.severity ?? 3;
    if (![1, 2, 3].includes(severity)) {
      throw new Error(`applyHistory: ruin event ${absoluteIndex} has invalid severity`);
    }
    addRuinEvidence(plan, features, identity, severity, event.payload?.cause);
  });

  const copiedLog = log.map(cloneEvent);
  const eventsApplied = indexOffset + copiedLog.length;
  const lastDay = copiedLog.at(-1)?.day ?? journal!.snapshot.throughDay;
  const eventDigest = buildingHistoryEventDigest(history);
  const signatureSource = canonicalJson({
    version: 1,
    buildingId: plan.buildingId,
    eventDigest,
    eventsApplied,
    status,
    renovatedBackstory,
    features,
    styleResolved,
  });
  const liveHistory: AppliedBuildingHistory = {
    lastDay,
    eventsApplied,
    status,
    renovatedBackstory,
    features,
    historySignature: fnv1a(signatureSource).toString(36),
  };

  return {
    ...plan,
    ...(styleResolved ? { styleResolved } : {}),
    eventLog: journal
      ? {
          version: 1,
          snapshot: cloneJournal(journal).snapshot,
          events: copiedLog,
        }
      : copiedLog,
    liveHistory,
  };
}

/**
 * Fold an already resolved plan into a version 1 journal with an empty tail.
 * The caller supplies the exact plan produced from the full history, avoiding
 * any second generator path that could drift from household or district input.
 */
export function snapshotBuildingHistory(
  resolvedPlan: BlueprintPlan,
  history: BuildingEventHistory | readonly BuildingEvent[],
): BuildingHistoryJournalV1 {
  const resolved = resolvedPlan.liveHistory;
  const count = buildingHistoryEventCount(history);
  if (!resolved || resolved.eventsApplied !== count || count < 1) {
    throw new Error(`snapshotBuildingHistory: plan does not match supplied history`);
  }
  const structuralEvents = structuralBuildingHistoryEvents(history)
    .filter((entry) => entry.eventIndex < count);
  const events = isBuildingHistoryJournal(history) ? history.events : history;
  // Re-snapshotting an empty or partial tail on the same day must retain ids
  // folded by the prior snapshot, or a second victim could duplicate the fire.
  const priorFireIds = isBuildingHistoryJournal(history)
    && history.snapshot.throughDay === resolved.lastDay
    ? history.snapshot.fireIncidentIdsOnThroughDay
    : [];
  const fireIncidentIdsOnThroughDay = [...new Set([
    ...priorFireIds,
    ...events
    .filter((event): event is Extract<BuildingEvent, { kind: 'fire-damage' }> =>
      event.day === resolved.lastDay && event.kind === 'fire-damage')
    .map((event) => event.payload.incidentId),
  ])].sort();
  const snapshot: BuildingHistorySnapshotV1 = {
    version: 1,
    throughDay: resolved.lastDay,
    eventDigest: buildingHistoryEventDigest(history),
    history: {
      ...resolved,
      features: cloneFeatures(resolved.features),
    },
    useStateSinceDay: buildingUseStateSince(history).sinceDay,
    ...(resolvedPlan.styleResolved
      ? { styleResolved: cloneStyle(resolvedPlan.styleResolved) }
      : {}),
    structuralEvents,
    fireIncidentIdsOnThroughDay,
  };
  return { version: 1, snapshot, events: [] };
}
