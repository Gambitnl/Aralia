/**
 * Keep a companion at the place where the game actually placed or left them.
 * Travel calls this before replacing its transient encounter list. The 3D cast
 * can later attach its actual world coordinates to the same record. Neither a
 * relationship nor an old promise is evidence that someone is near the player.
 * This is durable placement, not yet an independent travel or daily schedule.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 08:31:23
 * Dependents: components/World3D/PartyGroundActors.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/partyGroundTrail.ts, state/appState.ts, state/reducers/companionReducer.ts, state/reducers/gameEntryReducer.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { Companion } from '@/types/companions';
import { layoutCast, type SceneCastMember } from '@/systems/entities3d/sceneCastUtils';
import type { PlayerCharacter } from '@/types/character';
import type { EntityRecipe } from '@/systems/entities3d/types';
import { recipeFromRichNpc } from '@/systems/entities3d/recipeFromCharacter';

export type CompanionPosition = { xM: number; yM: number; zM: number };

export interface PartyCompanionPresence {
  character: PlayerCharacter;
  position: CompanionPosition;
  recipe?: EntityRecipe;
  trail?: CompanionPosition[];
  canFollow: boolean;
}

/** Membership never invents placement. Only retained feet in this world/cell
 * can render; an old missing route needs a real nearby reunion to resume. */
export function partyCompanionPresence(state: GameState): PartyCompanionPresence[] {
  return state.party.slice(1).flatMap(character => {
    const person = state.companions[character.id], where = person?.whereabouts;
    if (!person?.inParty || where?.worldSeed !== state.worldSeed || where.locationId !== state.currentLocationId
      || !where.position || !validCompanionPosition(where.position)) return [];
    const saved = person.following;
    const trail = saved?.worldSeed === state.worldSeed && saved.locationId === state.currentLocationId
      && Array.isArray(saved.trail) && saved.trail.length <= 512 && saved.trail.every(validCompanionPosition) ? saved.trail : undefined;
    const leader = state.playerGroundPos;
    const nearby = !!leader && validCompanionPosition(leader)
      && Math.hypot(leader.xM - where.position.xM, leader.yM - where.position.yM, leader.zM - where.position.zM) <= 3;
    const npc = state.generatedNpcs[character.id];
    return [{ character, position: where.position, recipe: npc ? recipeFromRichNpc(npc, person.identity.race) : undefined,
      trail, canFollow: !!trail || nearby }];
  });
}

export function isLocalCompanion(state: GameState, companion: Companion, locationId: string): boolean {
  return companion.inParty !== true && !state.party.some(member => member.id === companion.id)
    && companion.whereabouts?.worldSeed === state.worldSeed
    && companion.whereabouts.locationId === locationId;
}

/** Record only actual local encounter members. Missing old saves stay missing. */
export function retainCompanionWhereabouts(state: GameState, ids = state.currentLocationActiveDynamicNpcIds): Record<string, Companion> {
  let companions = state.companions;
  if (!Number.isFinite(state.worldSeed) || !state.currentLocationId) return companions;
  for (const id of ids ?? []) {
    const companion = companions[id];
    if (!companion || !state.generatedNpcs[id] || companion.inParty === true || state.party.some(member => member.id === id)) continue;
    // An encounter list is not authority to move an already placed person.
    if (companion.whereabouts) continue;
    companions = { ...companions, [id]: { ...companion, whereabouts: {
      worldSeed: state.worldSeed!, locationId: state.currentLocationId,
      observedAt: state.gameTime.getTime(), source: 'encounter',
    } } };
  }
  return companions;
}

/** Return to their source place; never bring retained people to another cell. */
export function companionsAtDestination(state: GameState, companions: Record<string, Companion>, locationId: string, candidates: string[] | null): string[] | null {
  const ids = (candidates ?? []).filter(id => {
    const companion = companions[id];
    if (!companion) return true;
    if (companion.inParty || state.party.some(member => member.id === id)) return false;
    return !companion.whereabouts || isLocalCompanion(state, companion, locationId);
  });
  for (const companion of Object.values(companions)) {
    if (state.generatedNpcs[companion.id] && isLocalCompanion(state, companion, locationId)) ids.push(companion.id);
  }
  const unique = Array.from(new Set(ids));
  return unique.length ? unique : candidates === null ? null : [];
}

export function validCompanionPosition(position: { xM: number; yM?: number; zM: number }): position is CompanionPosition {
  return [position.xM, position.yM, position.zM].every(Number.isFinite);
}

/** A physical separation occurs at the party's current place, not the old home. */
export function separatedCompanion(state: GameState, companion: Companion, source: 'dismissed' | 'deserted'): Companion {
  if (!Number.isFinite(state.worldSeed)) return { ...companion, inParty: false, whereabouts: undefined };
  const point = companion.whereabouts?.worldSeed === state.worldSeed
    && companion.whereabouts.locationId === state.currentLocationId && companion.whereabouts.position
    && validCompanionPosition(companion.whereabouts.position) ? companion.whereabouts.position : state.playerGroundPos;
  return { ...companion, inParty: false, whereabouts: {
    worldSeed: state.worldSeed!, locationId: state.currentLocationId,
    observedAt: state.gameTime.getTime(), source,
    ...(point && validCompanionPosition(point) ? { position: { xM: point.xM, yM: point.yM, zM: point.zM } } : {}),
  } };
}

/** Translate retained world points into this render origin. New people keep the
 * existing X/Z layout but sample their own ground height before their first
 * render/checkpoint. A numeric height retains the legacy non-ground caller
 * contract. Neither form can replace a finite companion checkpoint. */
export function placeCompanionCast(state: GameState, cast: SceneCastMember[], origin: readonly [number, number, number], surface: number | ((xM: number, zM: number) => number), activityPositions?:Readonly<Record<string,CompanionPosition>>) {
  const checkpoints: Array<{ companionId: string; worldSeed: number; locationId: string; position: CompanionPosition }> = [];
  const projected = cast.filter(member => {
    const companion = state.companions[member.id];
    return !companion || (!companion.inParty && !state.party.some(person => person.id === member.id)
      && (!companion.whereabouts || isLocalCompanion(state, companion, state.currentLocationId)));
  }).map(member => {
    const companion = state.companions[member.id];
    const point = companion?.whereabouts?.position;
    if (!companion || !point || !isLocalCompanion(state, companion, state.currentLocationId) || !validCompanionPosition(point)) return member;
    return { ...member, position: [point.xM - origin[0], point.yM, point.zM - origin[2]] as [number, number, number] };
  });
  const firstPositions = new Map<string, [number, number, number]>();
  const unavailable = new Set<string>();
  for (const member of layoutCast(projected.filter(person => !person.isPlayer && !person.position))) {
    const companion = state.companions[member.id];
    if (member.position) continue;
    const fixed=activityPositions?.[member.id];
    if(companion?.whereabouts?.source==='world-activity'&&!fixed){unavailable.add(member.id);continue;}
    const xM = fixed?.xM ?? origin[0] + member.pos[0], zM = fixed?.zM ?? origin[2] + member.pos[2];
    const yM = fixed?.yM ?? (typeof surface === 'function' ? surface(xM, zM) : surface);
    if (!Number.isFinite(yM)) { unavailable.add(member.id); continue; }
    firstPositions.set(member.id, [xM-origin[0], yM, zM-origin[2]]);
    if (!companion || companion.whereabouts?.position || !Number.isFinite(state.worldSeed)
      || !state.currentLocationActiveDynamicNpcIds?.includes(member.id)) continue;
    const position = { xM, yM, zM };
    if (validCompanionPosition(position)) checkpoints.push({ companionId: member.id, worldSeed: state.worldSeed!, locationId: state.currentLocationId, position });
  }
  return { cast: projected.filter(member => !unavailable.has(member.id)).map(member => firstPositions.has(member.id)
    ? {...member, position: firstPositions.get(member.id)!} : member), checkpoints };
}
