/** Join validated profiles to complete relevant source cohorts and tactical crop.
 * Placement comes from source meters, never the generic battle spawn referee. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 18:48:07
 * Dependents: components/World3D/hooks/useInPlaceCombatTransition.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Monster, StartBattleMapEncounterPayload } from '../../../types';
import type { BattleMapData, BattleMapEncounterContext, WorldforgeSurfaceHostileSource } from '../../../types/combat';
import type { GroundHostile } from '../../worldforge/bridge/groundChunkLoader';
import type { SurfaceHostileEncounterReceipt, WorldforgeEncounterReceipt } from './worldforgeEncounterReceipt';
import { getMonster } from '../../../data/adapters/runtimeMonsterRegistry';
import { createEnemyFromMonster, parseChallengeRating } from '../../../utils/combat/createEnemyFromMonster';
import { declaredGroundHostileChallengeRating } from '../../worldforge/bridge/groundHostiles';
import { worldMetersToPatchTile } from '../fightInPlace/inSceneMovement';
import { latestSurfaceHostileOutcome, surfaceHostileCombatantId, sameSurfaceHostileGroup, SURFACE_HOSTILE_CONTACT_RADIUS_M } from './surfaceHostileContinuity';

export interface SurfacePartyAnchor {
  characterId: string;
  xM: number;
  zM: number;
  yM?: number;
}

/** All members of a contacted marker cohort participate. Other cohorts join
 * only when a body is already inside the existing four-meter contact radius.
 * A broad zone's independently scattered bodies are not one distant pack. */
export function selectSurfaceHostileParticipants(args: {
  hostile: GroundHostile; hostiles: readonly GroundHostile[];
  player: {xM: number; zM: number}; worldSeed: number; cellId: number; sourceScope: string;
  receipts: readonly WorldforgeEncounterReceipt[];
}): {status: 'ready'; hostiles: GroundHostile[]} | {status: 'source-gap'; detail: string} {
  const gap = (detail: string) => ({status: 'source-gap' as const, detail});
  const sameGroup = (a: GroundHostile['sourceGroup'], b: GroundHostile['sourceGroup']) =>
    !!a && !!b && sameSurfaceHostileGroup(a, b);
  const byId = new Map(args.hostiles.map(h => [h.id, h]));
  const contact = byId.get(args.hostile.id);
  if (!contact || byId.size !== args.hostiles.length || contact.monsterId !== args.hostile.monsterId
    || contact.xM !== args.hostile.xM || contact.zM !== args.hostile.zM) return gap('The contacted source body no longer matches this ground world.');
  const selected = new Set<string>();
  for (const body of args.hostiles) {
    if (body.id !== contact.id && Math.hypot(body.xM - args.player.xM, body.zM - args.player.zM) >= SURFACE_HOSTILE_CONTACT_RADIUS_M) continue;
    const group = body.sourceGroup;
    if (!group || !['marker', 'zone'].includes(group.kind) || !group.key?.trim()
      || !Array.isArray(group.memberIds) || !group.memberIds.includes(body.id)
      || group.memberIds.some(id => typeof id !== 'string' || !id.trim())
      || new Set(group.memberIds).size !== group.memberIds.length) return gap(body.name + ' has no complete source-group identity.');
    for (const id of group.memberIds) {
      const member = byId.get(id);
      if (member) {
        if (!sameGroup(group, member.sourceGroup)) return gap('The source group has conflicting membership.');
        selected.add(id);
      } else {
        // A saved death may remove a body from live presence. Absence alone is
        // never permission to reduce the original group's encounter strength.
        const saved = latestSurfaceHostileOutcome(args.receipts, args.worldSeed, args.cellId, args.sourceScope, id);
        if (!saved || saved.outcome.currentHP !== 0 || !sameGroup(group, saved.entity.source.sourceGroup))
          return gap('A source-group member is missing without an accepted defeated outcome.');
      }
    }
  }
  return {status: 'ready', hostiles: args.hostiles.filter(h => selected.has(h.id))};
}

export function prepareSurfaceHostileEncounter(args: {
  hostile: GroundHostile;
  profile: Monster;
  /** Entire projected live roster, not a caller-selected weaker subset. */
  hostiles?: readonly GroundHostile[];
  profiles?: readonly {entityId: string; monster: Monster}[];
  map: BattleMapData;
  worldSeed: number;
  cellId: number;
  sourceScope: string;
  gameTimeMs: number;
  party: SurfacePartyAnchor[];
  receipts: readonly WorldforgeEncounterReceipt[];
}): {status: 'ready'; payload: StartBattleMapEncounterPayload; receipt: SurfaceHostileEncounterReceipt} | {status: 'source-gap'; detail: string} {
  const {hostile, map, worldSeed, cellId, sourceScope, gameTimeMs, party, receipts} = args;
  const gap = (detail: string) => ({status: 'source-gap' as const, detail});
  if (!Number.isFinite(gameTimeMs) || !Number.isFinite(worldSeed) || !Number.isInteger(cellId) || !sourceScope
    || map.provenance?.kind !== 'worldforge' || map.provenance.worldSeed !== worldSeed || map.provenance.anchorCellId !== cellId) return gap('The surface encounter has no exact source world, cell or terrain provenance.');
  const leader = party[0];
  const anchor = map.provenance.anchorWorldMeters;
  if (!leader || anchor.x !== leader.xM || anchor.z !== leader.zM || new Set(party.map(p => p.characterId)).size !== party.length) return gap('The actual party positions do not match this source crop.');
  const selected = selectSurfaceHostileParticipants({hostile, hostiles: args.hostiles ?? [hostile], player: leader,
    worldSeed, cellId, sourceScope, receipts});
  if (selected.status !== 'ready') return selected;
  const profiles = new Map(args.profiles?.map(p => [p.entityId, p.monster]));
  profiles.set(hostile.id, args.profile);
  const members: Array<{hostile: GroundHostile; profile: Monster}> = [];
  for (const body of selected.hostiles) {
    const profile = profiles.get(body.id), data = getMonster(body.monsterId);
    const declared = declaredGroundHostileChallengeRating(body);
    if (!body.id?.trim() || !body.name?.trim() || !profile || profile.quantity !== 1 || !data || data.id !== profile.id || profile.name !== body.name
      || parseChallengeRating(profile.cr) !== parseChallengeRating(String(data.baseStats.cr))
      || (declared !== undefined && parseChallengeRating(declared) !== parseChallengeRating(profile.cr))) return gap(body.name + ' lost its validated bestiary identity or challenge profile.');
    members.push({hostile: body, profile});
  }
  const occupied = new Set((map.worldOccupants ?? []).map(p => p.position.x + '-' + p.position.y));
  const patchAnchor = {playerXM: anchor.x, playerZM: anchor.z};
  const exactTile = (x: number, z: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const position = worldMetersToPatchTile(map, patchAnchor, x, z);
    if (!position) return null;
    const key = position.x + '-' + position.y;
    const tile = map.tiles.get(key);
    if (!tile || tile.blocksMovement || occupied.has(key)) return null;
    occupied.add(key); return position;
  };
  const partySources: Extract<BattleMapEncounterContext, {kind: 'surface-contact'}>['partySources'] = [];
  for (const member of party) {
    const position = exactTile(member.xM, member.zM);
    if (!member.characterId || !position || (member.yM !== undefined && !Number.isFinite(member.yM))) return gap('An actual party body has no distinct legal source square; no substitute placement was chosen.');
    partySources.push({characterId: member.characterId, position, worldGroundMeters: {x: member.xM, z: member.zM},
      ...(member.yM !== undefined ? {groundYM: member.yM} : {})});
  }
  const ordinal = receipts.filter(r => r.kind === 'surface-hostile-contact' && r.worldSeed === worldSeed && r.sourceCellId === cellId && r.sourceScope === sourceScope).length;
  const receiptId = surfaceHostileCombatantId(worldSeed, cellId, sourceScope, hostile.id) + ':contact:' + ordinal;
  const entities: SurfaceHostileEncounterReceipt['entities'] = [];
  const combatants: NonNullable<StartBattleMapEncounterPayload['combatants']> = [];
  for (const [index, member] of members.entries()) {
    const body = member.hostile;
    const position = exactTile(body.xM, body.zM);
    if (!position) return gap(body.name + ' has no distinct legal square in this crop; no member was omitted or moved.');
    const saved = latestSurfaceHostileOutcome(receipts, worldSeed, cellId, sourceScope, body.id);
    if (saved && (saved.entity.source.monsterId !== body.monsterId || saved.outcome.currentHP <= 0
      || (saved.entity.source.sourceGroup && !sameSurfaceHostileGroup(saved.entity.source.sourceGroup, body.sourceGroup)))) return gap('This source creature is defeated or no longer matches its saved identity.');
    if (saved && (saved.outcome.position.xM !== body.xM || saved.outcome.position.zM !== body.zM)) return gap('The source world has not replayed this creature\'s saved position.');
    const actor = createEnemyFromMonster(member.profile, index);
    if (saved && (saved.outcome.currentHP > actor.maxHP || !Number.isFinite(saved.outcome.currentHP))) return gap('Saved source health no longer matches the creature profile.');
    const combatantId = surfaceHostileCombatantId(worldSeed, cellId, sourceScope, body.id);
    const source: WorldforgeSurfaceHostileSource = {kind: 'worldforge-surface-hostile', encounterReceiptId: receiptId,
      worldSeed, sourceCellId: cellId, sourceScope, entityId: body.id, monsterId: body.monsterId,
      sourceGroup: structuredClone(body.sourceGroup), worldGroundMeters: {x: body.xM, z: body.zM}, sourcePatchTile: {...position}};
    const combatant = {...actor, id: combatantId, name: body.name, position: {...position}, worldSource: source,
      currentHP: saved?.outcome.currentHP ?? actor.currentHP,
      ...(saved?.outcome.spellSlots ? {spellSlots: structuredClone(saved.outcome.spellSlots)} : {}),
      ...(saved?.outcome.limitedUses ? {limitedUses: structuredClone(saved.outcome.limitedUses)} : {})};
    combatants.push(combatant);
    entities.push({combatantId, name: body.name, source: structuredClone(source), maxHP: combatant.maxHP, currentHP: combatant.currentHP,
      ...(combatant.spellSlots ? {spellSlots: structuredClone(combatant.spellSlots)} : {}),
      ...(combatant.limitedUses ? {limitedUses: structuredClone(combatant.limitedUses)} : {})});
  }
  const receipt: SurfaceHostileEncounterReceipt = {id: receiptId, kind: 'surface-hostile-contact', worldSeed, sourceCellId: cellId,
    sourceScope, triggeredAtGameTimeMs: gameTimeMs, playerGroundMeters: {...anchor}, partySources: structuredClone(partySources), entities};
  return {status: 'ready', receipt, payload: {monsters: members.map(m => m.profile), combatants,
    extractedBattleMap: {...map, encounterContext: {kind: 'surface-contact', source: 'worldforge-surface-hostiles', sourceScope,
      sourceReceiptId: receiptId, sourceWorldCellId: cellId, anchorTile: {...partySources[0].position}, partySources,
      sourceEntities: entities.map(e => ({combatantId: e.combatantId, source: structuredClone(e.source)}))}}}};
}
