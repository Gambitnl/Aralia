/** Project the current generated floor into the existing tactical combat owner. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 21:53:13
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {CellKind, type Cell, type DungeonPlan} from '../types';
import {canonicalDungeonId, type DungeonIdentity} from './dungeonIdentity';
import {dungeonEncounterEventId, dungeonPathBetweenCells, dungeonSpawnCell, moveDungeonPlayer} from './dungeonGameplay';
import {revealedDungeonCellKeys, dungeonCellKey} from './dungeonMap';
import type {DungeonCombatContext} from '../../../../types/dungeonCombat';
import type {BattleMapData, BattleMapTile} from '../../../../types/combat';
import type {StartBattleMapEncounterPayload} from '../../../../types/actions';

export function projectDungeonEncounter(plan: DungeonPlan, input: {
  rootIdentity: DungeonIdentity; levelIdentity: DungeonIdentity; depth: number;
  entranceKind: DungeonCombatContext['entranceKind'];
  playerCell: Cell; encounterId: string; partyCount: number; clearedEncounterIds: readonly string[];
  returnContext: DungeonCombatContext['returnContext'];
  /** Live owned light; packed torches and remembered map cells grant no sight. */
  carriedBrightRadiusFt?: number;
}): BattleMapData {
  if (input.rootIdentity.dungeonId !== canonicalDungeonId(input.rootIdentity.seedPath)
    || input.levelIdentity.dungeonId !== canonicalDungeonId(input.levelIdentity.seedPath)
    || !input.rootIdentity.seedPath.startsWith(`wf:${input.returnContext.worldSeed >>> 0}/`)
    || !(input.levelIdentity.seedPath === input.rootIdentity.seedPath || input.levelIdentity.seedPath.startsWith(`${input.rootIdentity.seedPath}/`))) {
    throw new Error('Dungeon encounter identity does not belong to this world and level.');
  }
  if (input.partyCount < 1 || input.clearedEncounterIds.includes(input.encounterId)) throw new Error('This dungeon encounter is not available.');
  const spawn = plan.spawns.find(s => dungeonEncounterEventId(input.levelIdentity, s.roomId, dungeonSpawnCell(plan, s)) === input.encounterId);
  if (!spawn) throw new Error('The encounter does not belong to this generated floor.');
  const enemy = dungeonSpawnCell(plan, spawn);
  const route = dungeonPathBetweenCells(plan, input.playerCell, enemy);
  // Engagement starts normal initiative from accepted footing; it grants no
  // attack. The same current light/occlusion rule that reveals the source floor
  // admits the creature. Reach and line of sight for each action remain combat's.
  if (route.length < 2 || !revealedDungeonCellKeys(plan, input.playerCell, input.carriedBrightRadiusFt ?? 0).includes(dungeonCellKey(enemy))) {
    throw new Error('The creature must be currently visible from your square before engaging it.');
  }
  const width = Math.min(40, plan.W), height = Math.min(30, plan.H);
  const ox = Math.max(0, Math.min(plan.W - width, input.playerCell.x - Math.floor(width / 2)));
  const oy = Math.max(0, Math.min(plan.H - height, input.playerCell.y - Math.floor(height / 2)));
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = x + ox, sy = y + oy;
    const door = plan.doors.find(d => d.cell.x === sx && d.cell.y === sy);
    const solid = plan.grid[sy * plan.W + sx] !== CellKind.Floor || Boolean(door && door.state !== 'open');
    tiles.set(`${x}-${y}`, {id: `${x}-${y}`, coordinates: {x, y},
      terrain: solid ? 'wall' : 'floor', elevation: 0, movementCost: 1,
      blocksLoS: solid, blocksMovement: solid, decoration: null, effects: []});
  }
  // Seat the leader on the accepted source square, then gather companions only
  // through connected source floor. Neither team gets a generic arena spawn.
  const queue = [input.playerCell], seen = new Set<string>(), partySpawns: Cell[] = [];
  for (let i = 0; i < queue.length && partySpawns.length < input.partyCount; i++) {
    const cell = queue[i], key = `${cell.x},${cell.y}`;
    if (seen.has(key) || (cell.x === enemy.x && cell.y === enemy.y)) continue;
    seen.add(key);
    const tile = tiles.get(`${cell.x - ox}-${cell.y - oy}`);
    if (!tile || tile.blocksMovement) continue;
    partySpawns.push({...tile.coordinates});
    for (const direction of ['north', 'east', 'south', 'west'] as const) queue.push(moveDungeonPlayer(plan, cell, direction));
  }
  if (partySpawns.length !== input.partyCount) throw new Error('The source floor has no legal deployment for the whole party.');
  const {partyCount: _partyCount, clearedEncounterIds: _cleared, carriedBrightRadiusFt: _light, ...receipt} = input;
  const context: DungeonCombatContext = {...receipt, combatantId: input.encounterId,
    monsterKey: spawn.monsterKey, cropOrigin: {x: ox, y: oy}, partySpawns,
    enemySpawn: {x: enemy.x - ox, y: enemy.y - oy}};
  return {dimensions: {width, height}, tiles, theme: 'dungeon', seed: plan.seed,
    dungeonEncounter: context,
    provenance: {kind: 'worldforge', worldSeed: input.returnContext.worldSeed,
      anchorCellId: input.returnContext.cellId, anchorWorldMeters: {x: input.returnContext.xM, z: input.returnContext.zM},
      locationLabel: plan.name, generationPath: ['World', plan.name, `Floor ${input.depth + 1}`, 'Tactical crop']}};
}

/** Load the exact bestiary entry before using the shared combat adapter; never accept its generic fallback. */
export async function prepareDungeonCombat(map: BattleMapData, enemyHP?: number): Promise<StartBattleMapEncounterPayload> {
  const source = map.dungeonEncounter;
  if (!source) throw new Error('Dungeon combat requires its source receipt.');
  const [{loadMonstersData}, {registerMonster}, {createEnemyFromMonster}] = await Promise.all([
    import('../../../../data/monsters'), import('../../../../data/adapters/runtimeMonsterRegistry'),
    import('../../../../utils/combat/createEnemyFromMonster'),
  ]);
  const data = (await loadMonstersData())[source.monsterKey];
  if (!data) throw new Error(`Missing bestiary entry: ${source.monsterKey}`);
  registerMonster(data);
  const monster = {id: data.id, name: data.name, quantity: 1, cr: String(data.baseStats.cr), description: data.name};
  const actor = createEnemyFromMonster(monster, 0);
  actor.id = source.combatantId;
  actor.name = data.name;
  if (enemyHP !== undefined) actor.currentHP = Math.max(1, Math.min(actor.maxHP, enemyHP));
  return {monsters: [monster], combatants: [actor], extractedBattleMap: map};
}
