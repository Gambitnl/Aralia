/** Surface combat reuses world encounter history for identity and attrition.
 * This module is deliberately independent of bestiary loading and rendering so
 * END_BATTLE and world regeneration can consume the same saved facts. Timed
 * conditions still need an explicit combat-clock to world-clock bridge. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 19:45:25
 * Dependents: components/Combat/InPlaceCombatScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/hooks/useInPlaceCombatTransition.ts, state/appState.ts, systems/combat/worldScenario/surfaceHostileEncounter.ts, systems/gameplay/lodging.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../../types/state';
import type { BattleMapData, CombatEnemySnapshotEntry, CombatPartySnapshotEntry, WorldforgeSurfaceHostileSource } from '../../../types/combat';
import type { GroundHostile } from '../../worldforge/bridge/groundChunkLoader';
import type { SurfaceHostileEncounterReceipt, WorldforgeEncounterReceipt } from './worldforgeEncounterReceipt';
import { GROUND_METERS_PER_CELL_FIP } from '../fightInPlace/inSceneMovement';
import { BATTLE_MAP_ELEVATION_METERS_PER_UNIT } from '../../../config/mapConfig';
import { feetFromMeters } from '../../worldforge/units';
import { atlasGroundPositionForAddress } from '../../worldforge/leaf3d/atlasGroundContinuity';

/** Shared physical admission distance for surface combat and ordinary rest. */
export const SURFACE_HOSTILE_CONTACT_RADIUS_M = 4;

/** Cell-local generated IDs may recur in another Local artifact. Scope them by
 * the existing saved Atlas address, or the exact legacy generation input. */
export function surfaceHostileSourceScope(state: Pick<GameState, 'worldSeed' | 'playerCell' | 'atlasGroundAddress' | 'entry3DAnchor'>, cellOverride?: number): string {
  const cell = cellOverride ?? state.playerCell?.cellId;
  const address = state.atlasGroundAddress;
  if (address && address.worldSeed === state.worldSeed && address.atlasCellId === cell) {
    const b = address.localBounds;
    return JSON.stringify(['atlas-local', address.regionSeedPath, address.localSeedPath, b.x, b.y, b.width, b.height]);
  }
  const entry = state.entry3DAnchor;
  return JSON.stringify(['cell-entry', cell, entry && entry.cellId === cell ? entry.centerPx ?? null : null]);
}

export const surfaceHostileCombatantId = (worldSeed: number, cellId: number, scope: string, entityId: string): string =>
  `worldforge-surface:${worldSeed}:${cellId}:${encodeURIComponent(scope)}:${entityId}`;

/** Keep sub-cell world offsets when the referee advances a creature by cells. */
export function surfaceCombatWorldPoint(map: BattleMapData, characterId: string, tile: {x: number; y: number}): {xM: number; zM: number} | undefined {
  const context = map.encounterContext;
  if (context?.kind !== 'surface-contact') return undefined;
  const party = context.partySources.find(p => p.characterId === characterId);
  const enemy = context.sourceEntities.find(e => e.combatantId === characterId)?.source;
  const initial = party?.position ?? enemy?.sourcePatchTile;
  const meters = party?.worldGroundMeters ?? enemy?.worldGroundMeters;
  if (!initial || !meters) return undefined;
  if (initial.x === tile.x && initial.y === tile.y) return {xM: meters.x, zM: meters.z};
  return {xM: meters.x + (tile.x-initial.x)*GROUND_METERS_PER_CELL_FIP,
    zM: meters.z + (tile.y-initial.y)*GROUND_METERS_PER_CELL_FIP};
}

export function latestSurfaceHostileOutcome(receipts: readonly WorldforgeEncounterReceipt[], worldSeed: number, cellId: number, scope: string, entityId: string) {
  let latest: {entity: SurfaceHostileEncounterReceipt['entities'][number]; outcome: NonNullable<SurfaceHostileEncounterReceipt['resolution']>['entities'][number]} | undefined;
  for (const receipt of receipts) {
    if (receipt.kind !== 'surface-hostile-contact' || receipt.worldSeed !== worldSeed || receipt.sourceCellId !== cellId || receipt.sourceScope !== scope || !receipt.resolution) continue;
    const entity = receipt.entities.find(e => e.source.entityId === entityId);
    const outcome = receipt.resolution.entities.find(e => e.entityId === entityId);
    if (!!entity !== !!outcome) throw new Error('Surface history lost a source outcome identity.');
    if (entity && outcome) latest = {entity, outcome};
  }
  return latest;
}

/** Replay outcomes after deterministic generation, without moving or respawning
 * unrelated creatures. Defeated bodies remain recorded in history; this removes
 * hostile presence, without inventing corpse meshes, healing or replacement. */
export function projectSurfaceHostileOutcomes(hostiles: GroundHostile[], receipts: readonly WorldforgeEncounterReceipt[], worldSeed: number, cellId: number, scope: string): GroundHostile[] {
  let changed = false;
  const projected = hostiles.flatMap(hostile => {
    const saved = latestSurfaceHostileOutcome(receipts, worldSeed, cellId, scope, hostile.id);
    if (!saved) return [hostile];
    if (saved.entity.source.monsterId !== hostile.monsterId
      || (saved.entity.source.sourceGroup && !sameSurfaceHostileGroup(saved.entity.source.sourceGroup, hostile.sourceGroup))
      || !Number.isFinite(saved.outcome.currentHP)
      || saved.outcome.currentHP < 0 || !Number.isFinite(saved.entity.maxHP) || saved.entity.maxHP <= 0 || saved.outcome.currentHP > saved.entity.maxHP
      || !Number.isFinite(saved.outcome.position.xM) || !Number.isFinite(saved.outcome.position.zM)) {
      throw new Error(`Saved surface creature ${hostile.id} no longer matches its source.`);
    }
    if (saved.outcome.currentHP === 0) { changed = true; return []; }
    if (saved.outcome.position.xM === hostile.xM && saved.outcome.position.zM === hostile.zM) return [hostile];
    changed = true;
    return [{...hostile, xM: saved.outcome.position.xM, zM: saved.outcome.position.zM}];
  });
  return changed ? projected : hostiles;
}

/** Group provenance is part of identity, not a reason to rebalance a fight. */
export function sameSurfaceHostileGroup(a: GroundHostile['sourceGroup'], b: GroundHostile['sourceGroup']): boolean {
  return a?.kind === b?.kind && a?.key === b?.key && JSON.stringify(a?.memberIds) === JSON.stringify(b?.memberIds);
}

export function sameSurfaceSource(a: WorldforgeSurfaceHostileSource, b: WorldforgeSurfaceHostileSource): boolean {
  return a.encounterReceiptId === b.encounterReceiptId && a.sourceScope === b.sourceScope && a.entityId === b.entityId && a.monsterId === b.monsterId
    && a.worldSeed === b.worldSeed && a.sourceCellId === b.sourceCellId
    && a.worldGroundMeters.x === b.worldGroundMeters.x && a.worldGroundMeters.z === b.worldGroundMeters.z
    && a.sourcePatchTile.x === b.sourcePatchTile.x && a.sourcePatchTile.y === b.sourcePatchTile.y
    && sameSurfaceHostileGroup(a.sourceGroup, b.sourceGroup);
}

export type SurfaceOutcomeResult = {status: 'ready'; patch: Partial<GameState>} | {status: 'duplicate'} | {status: 'source-gap'; detail: string};

/** Reconcile before the root reducer clears the exact tactical map or grants
 * rewards. A missing/mixed source roster is not an earned victory. */
export function reconcileSurfaceHostileOutcome(state: GameState, enemies: CombatEnemySnapshotEntry[] | undefined,
  party: CombatPartySnapshotEntry[] | undefined, result: 'victory' | 'defeat' | 'flee' | 'ended', hasRewards: boolean): SurfaceOutcomeResult {
  const snapshots = enemies ?? [];
  const surface = snapshots.filter(e => e.worldSource?.kind === 'worldforge-surface-hostile');
  const map = state.extractedBattleMap;
  const context = map?.encounterContext;
  if (context?.kind !== 'surface-contact' && surface.length === 0) return {status: 'ready', patch: {}};
  const gap = (detail: string): SurfaceOutcomeResult => ({status: 'source-gap', detail});
  const receipts = state.worldforgeEncounterReceipts ?? [];
  if (!map || context?.kind !== 'surface-contact') {
    // An already-consumed source outcome cannot grant its rewards twice.
    const ids = new Set(surface.map(e => e.worldSource?.kind === 'worldforge-surface-hostile' ? e.worldSource.encounterReceiptId : ''));
    const prior = ids.size === 1 ? receipts.find(r => r.id === [...ids][0] && r.kind === 'surface-hostile-contact') : undefined;
    if (prior?.kind === 'surface-hostile-contact' && prior.resolution && surface.length === snapshots.length
      && prior.entities.length === surface.length && surface.every(s => {
        const entity = prior.entities.find(e => e.combatantId === s.id);
        const outcome = prior.resolution!.entities.find(e => e.entityId === entity?.source.entityId);
        return entity && s.worldSource?.kind === 'worldforge-surface-hostile' && sameSurfaceSource(entity.source, s.worldSource) && outcome?.currentHP === s.currentHP;
      })) return {status: 'duplicate'};
    return gap('Surface combat ended without its source tactical map.');
  }
  const index = receipts.findIndex(r => r.id === context.sourceReceiptId);
  const receipt = receipts[index];
  if (receipt?.kind !== 'surface-hostile-contact' || map.provenance?.kind !== 'worldforge'
    || receipt.worldSeed !== state.worldSeed || receipt.sourceCellId !== state.playerCell?.cellId
    || receipt.sourceScope !== surfaceHostileSourceScope(state) || context.sourceScope !== receipt.sourceScope
    || receipt.worldSeed !== map.provenance.worldSeed || receipt.sourceCellId !== map.provenance.anchorCellId
    || receipt.playerGroundMeters.x !== map.provenance.anchorWorldMeters.x || receipt.playerGroundMeters.z !== map.provenance.anchorWorldMeters.z) {
    return gap('Surface combat lost or changed its source receipt, world, cell or anchor.');
  }
  if (context.sourceEntities.length !== receipt.entities.length || context.sourceEntities.some(e => {
    const saved = receipt.entities.find(s => s.combatantId === e.combatantId);
    return !saved || !sameSurfaceSource(saved.source, e.source);
  }) || JSON.stringify(context.partySources) !== JSON.stringify(receipt.partySources)) return gap('Surface deployment no longer matches its saved source roster.');
  if (receipt.resolution) return {status: 'duplicate'};
  if (snapshots.length !== receipt.entities.length || surface.length !== snapshots.length
    || new Set(snapshots.map(s => s.id)).size !== snapshots.length) return gap('Surface combat ended with a missing, repeated or mixed enemy roster.');
  // Extra allied tokens do not become persistent party members. Preserve the
  // original party's exact source bodies without blocking allied summons.
  if (!party || party.filter(p => context.partySources.some(s => s.characterId === p.id)).length !== context.partySources.length
    || context.partySources.length !== state.party.length
    || new Set(party.map(p => p.id)).size !== party.length) return gap('Surface combat lost its final party positions.');
  if (result === 'defeat' && party.some(p => state.party.some(member => member.id === p.id) && p.currentHP > 0)) return gap('Surface defeat contradicts a conscious party member.');
  const validTile = (p: {x: number; y: number}) => Number.isInteger(p.x) && Number.isInteger(p.y) && map.tiles.has(`${p.x}-${p.y}`);
  const outcomes: NonNullable<SurfaceHostileEncounterReceipt['resolution']>['entities'] = [];
  for (const snapshot of snapshots) {
    const source = snapshot.worldSource;
    const entity = receipt.entities.find(e => e.combatantId === snapshot.id);
    if (!entity || source?.kind !== 'worldforge-surface-hostile' || !sameSurfaceSource(source, entity.source)
      || !validTile(snapshot.position) || !Number.isFinite(snapshot.currentHP) || snapshot.currentHP < 0 || snapshot.currentHP > entity.maxHP) {
      return gap('A final surface enemy no longer matches its source identity, position or health.');
    }
    const position = surfaceCombatWorldPoint(map, snapshot.id, snapshot.position);
    if (!position) return gap('A final surface enemy has no source projection.');
    const spellSlots = snapshot.spellSlots ?? entity.spellSlots;
    const limitedUses = snapshot.limitedUses ?? entity.limitedUses;
    outcomes.push({entityId: source.entityId, currentHP: snapshot.currentHP, position,
      ...(spellSlots ? {spellSlots: structuredClone(spellSlots)} : {}),
      ...(limitedUses ? {limitedUses: structuredClone(limitedUses)} : {})});
  }
  if ((result === 'victory' || hasRewards) && (result !== 'victory' || outcomes.some(e => e.currentHP > 0))) return gap('Surface victory rewards contradict the final enemy health.');
  const companions = {...state.companions};
  let playerGroundPos = state.playerGroundPos;
  for (const [i, member] of state.party.entries()) {
    const snapshot = party.find(p => p.id === member.id);
    const anchor = context.partySources.find(p => p.characterId === member.id);
    if (!snapshot || !anchor || !snapshot.position || !validTile(snapshot.position) || !Number.isFinite(snapshot.currentHP) || snapshot.currentHP < 0) return gap('A final party member no longer matches its source position or health.');
    const point = surfaceCombatWorldPoint(map, member.id, snapshot.position);
    if (!point) return gap('A final party member has no source projection.');
    const unchanged = snapshot.position.x === anchor.position.x && snapshot.position.y === anchor.position.y;
    const yM = unchanged && anchor.groundYM !== undefined ? anchor.groundYM
      : map.tiles.get(`${snapshot.position.x}-${snapshot.position.y}`)!.elevation * BATTLE_MAP_ELEVATION_METERS_PER_UNIT;
    if (!Number.isFinite(yM)) return gap('A final party position has no source terrain height.');
    const position = {...point, yM};
    if (i === 0) playerGroundPos = {tileX: receipt.sourceCellId, tileY: 0, ...position};
    else {
      const companion = companions[member.id];
      if (!companion?.inParty || companion.whereabouts?.worldSeed !== receipt.worldSeed || companion.whereabouts.locationId !== state.currentLocationId) {
        return gap('A party companion lost its source-world whereabouts.');
      }
      companions[member.id] = {...companion, whereabouts: {...companion.whereabouts, position, observedAt: state.gameTime.getTime()}, following: undefined};
    }
  }
  if (!playerGroundPos) return gap('Surface combat has no player return point.');
  const address = state.atlasGroundAddress;
  const usesAtlas = address?.worldSeed === receipt.worldSeed && address.atlasCellId === receipt.sourceCellId;
  const atlasPosition = usesAtlas ? atlasGroundPositionForAddress(address!, playerGroundPos.xM, playerGroundPos.zM) : null;
  if (usesAtlas && !atlasPosition) return gap('The party left its source Local without a world-address transition.');
  const updated = receipts.slice();
  updated[index] = {...receipt, resolution: {result, resolvedAtGameTimeMs: state.gameTime.getTime(), entities: outcomes}};
  return {status: 'ready', patch: {worldforgeEncounterReceipts: updated, playerGroundPos, companions,
    ...(atlasPosition ? {atlasGroundPosition: atlasPosition} : {}),
    playerCell: {...state.playerCell!, localeCoords: {x: feetFromMeters(playerGroundPos.xM), y: feetFromMeters(playerGroundPos.zM)}}}};
}
