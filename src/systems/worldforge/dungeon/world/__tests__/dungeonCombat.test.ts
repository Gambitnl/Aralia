import {describe, expect, it} from 'vitest';
import {generateDungeon} from '../../generateDungeon';
import {canonicalDungeonId} from '../dungeonIdentity';
import {dungeonEncounterEventId, dungeonSpawnCell, moveDungeonPlayer} from '../dungeonGameplay';
import {projectDungeonEncounter, prepareDungeonCombat} from '../dungeonCombat';
import {enterDungeonExpedition} from '../dungeonLifecycle';
import * as SaveLoadService from '../../../../../services/saveLoadService';
import {generateWorldBattleSetup} from '../../../../../hooks/useBattleMapGeneration';
import {createMockGameState, createMockPlayerCharacter} from '../../../../../utils/core/factories';
import {appReducer} from '../../../../../state/appState';
import {createBattleEndActions} from '../../../../../utils/combat/battleEndActions';
import {GamePhase} from '../../../../../types/core';
import {ITEMS} from '../../../../../data/items';

const seedPath = 'wf:42/cell:751/dungeon:m28';
const identity = {seedPath, dungeonId: canonicalDungeonId(seedPath)};
const plan = generateDungeon({seed: 42, seedPath, params: {theme: 'crypt'}});
const spawn = plan.spawns[0], enemy = dungeonSpawnCell(plan, spawn);
const adjacent = (['north', 'east', 'south', 'west'] as const).map(d => moveDungeonPlayer(plan, enemy, d)).find(c => c.x !== enemy.x || c.y !== enemy.y)!;
const eventId = dungeonEncounterEventId(identity, spawn.roomId, enemy);
const input = {rootIdentity: identity, levelIdentity: identity, depth: 0, entranceKind: 'ruin-door' as const,
  playerCell: adjacent, encounterId: eventId, partyCount: 1, clearedEncounterIds: [],
  returnContext: {worldSeed: 42, cellId: 751, tileX: 751, tileY: 0, xM: 10, zM: 20, yM: 2}};

describe('source dungeon combat', () => {
  it('preserves source floor/doors and exact actor deployment without arena generation', () => {
    const map = projectDungeonEncounter(plan, input);
    const source = map.dungeonEncounter!;
    for (const tile of map.tiles.values()) {
      const x = tile.coordinates.x + source.cropOrigin.x, y = tile.coordinates.y + source.cropOrigin.y;
      const door = plan.doors.find(d => d.cell.x === x && d.cell.y === y);
      expect(tile.blocksMovement).toBe(plan.grid[y * plan.W + x] !== 1 || Boolean(door && door.state !== 'open'));
    }
    expect(source.partySpawns[0]).toEqual({x: adjacent.x - source.cropOrigin.x, y: adjacent.y - source.cropOrigin.y});
    expect(source.enemySpawn).toEqual({x: enemy.x - source.cropOrigin.x, y: enemy.y - source.cropOrigin.y});
    expect(map.provenance?.locationLabel).toBe(plan.name);
    expect(() => projectDungeonEncounter(plan, {...input, playerCell: {x: 0, y: 0}})).toThrow();
    expect(() => projectDungeonEncounter(plan, {...input, clearedEncounterIds: [eventId]})).toThrow();
  });

  it('loads a real bestiary actor, settles a real source outcome once, and preserves loot and footing', async () => {
    const map = projectDungeonEncounter(plan, input);
    const payload = await prepareDungeonCombat(map);
    const actor = payload.combatants![0];
    expect(actor.id).toBe(eventId);
    expect(actor.abilities.some(a => a.id !== 'basic_attack')).toBe(true);
    const pc = createMockPlayerCharacter({id: 'hero', hp: 12, maxHp: 12, xp: 0});
    let state = createMockGameState({phase: GamePhase.PLAYING, worldSeed: 42, playerCell: {cellId: 751, localeCoords: null}, gold: 10, inventory: [], party: [pc],
      dungeonExpeditions: {[identity.dungeonId]: enterDungeonExpedition(identity)}});
    state = appReducer(state, {type: 'START_BATTLE_MAP_ENCOUNTER', payload: {startBattleMapEncounterData: payload}});
    const deployed = generateWorldBattleSetup(map, 1, [{...actor, id: 'hero', team: 'player'}, actor]);
    expect(deployed.positionedCharacters.find(c => c.id === actor.id)?.position).toEqual(map.dungeonEncounter!.enemySpawn);
    const actions = createBattleEndActions('victory', {gold: 3, xp: 25, items: [ITEMS.healing_potion]},
      [{id: 'hero', currentHP: 7, position: map.dungeonEncounter!.partySpawns[0]}],
      [{id: actor.id, currentHP: 0, position: map.dungeonEncounter!.enemySpawn}], eventId);
    for (const action of actions) state = appReducer(state, action);
    expect(state.gold).toBe(13);
    expect(state.party[0].hp).toBe(7);
    expect(state.inventory).toHaveLength(1);
    expect(state.inventory[0].id).not.toBe(ITEMS.healing_potion.id);
    expect(state.dungeonExpeditions![identity.dungeonId].progress.clearedEncounterIds).toContain(eventId);
    expect(state.dungeonCombatReturn?.playerCell).toEqual(adjacent);
    expect(state.dungeonCombatReturn?.returnContext).toEqual(input.returnContext);
    const settled = state;
    state = appReducer(state, actions.find(a => a.type === 'END_BATTLE')!);
    expect(state).toBe(settled);
    const saved = JSON.parse(JSON.stringify(state));
    expect(saved.dungeonCombatReturn.playerCell).toEqual(adjacent);
    expect(saved.inventory).toHaveLength(1);
  }, 30000);

  it('refuses an unearned victory and lets a retreat retain attrition without clearing or rewarding', async () => {
    const map = projectDungeonEncounter(plan, input), payload = await prepareDungeonCombat(map);
    const actor = payload.combatants![0];
    let state = createMockGameState({phase: GamePhase.COMBAT, worldSeed: 42, playerCell: {cellId: 751, localeCoords: null}, currentEnemies: [actor], extractedBattleMap: map,
      party: [createMockPlayerCharacter({id: 'hero', hp: 12, maxHp: 12})], gold: 10, inventory: [],
      dungeonExpeditions: {[identity.dungeonId]: enterDungeonExpedition(identity)}});
    const falseWin = createBattleEndActions('victory', {gold: 3, xp: 25, items: []}, [],
      [{id: actor.id, currentHP: 1, position: map.dungeonEncounter!.enemySpawn}], eventId).at(-1)!;
    expect(appReducer(state, falseWin)).toBe(state);
    for (const action of createBattleEndActions('flee', undefined, [{id: 'hero', currentHP: 4}],
      [{id: actor.id, currentHP: 3, position: map.dungeonEncounter!.enemySpawn}], eventId)) state = appReducer(state, action);
    expect(state.party[0].hp).toBe(4);
    expect(state.gold).toBe(10);
    expect(state.inventory).toHaveLength(0);
    expect(state.dungeonExpeditions![identity.dungeonId].progress.clearedEncounterIds).toEqual([]);
    expect(state.dungeonCombatReturn?.enemyHP).toBe(3);
    // Leaving the whole dungeon must not heal the same creature on revisit.
    state = appReducer(state, {type: 'DUNGEON_RETREATED', payload: {dungeonId: identity.dungeonId}});
    expect(state.dungeonCombatReturn).toBeNull();
    const saved = await SaveLoadService.saveGame(state, 'combat-retreat-proof');
    expect(saved.success).toBe(true);
    const loaded = await SaveLoadService.loadGame('combat-retreat-proof');
    expect(loaded.success).toBe(true);
    state = {...state, ...loaded.data};
    state = appReducer(state, {type: 'DUNGEON_ENTERED', payload: {identity}});
    expect(state.dungeonExpeditions![identity.dungeonId].progress).toMatchObject({encounterHitPoints: {[eventId]: 3}});
    const resumed = await prepareDungeonCombat(map, state.dungeonExpeditions![identity.dungeonId].progress.encounterHitPoints?.[eventId]);
    expect(resumed.combatants![0].currentHP).toBe(3);
    expect(resumed.combatants![0].maxHP).toBe(actor.maxHP);
    expect(resumed.combatants![0].id).toBe(actor.id);
    expect(state.party[0].hp).toBe(4);
    expect(state.gold).toBe(10);
    expect(state.dungeonExpeditions![identity.dungeonId].progress.clearedEncounterIds).toEqual([]);
  }, 30000);
});

describe('visible source engagement before an attack', () => {
  const sightPlan = {...plan, W: 12, H: 9, grid: new Uint8Array(108).fill(1), doors: [], props: [],
    spawns: [{...spawn, x: 7.5 * plan.cellFt, y: 4.5 * plan.cellFt}]};
  const target = {x: 7, y: 4};
  const id = dungeonEncounterEventId(identity, spawn.roomId, target);
  const request = {...input, playerCell: {x: 4, y: 4}, encounterId: id, carriedBrightRadiusFt: 20};
  it('starts from the accepted visible square without moving either combatant or granting damage', () => {
    const map = projectDungeonEncounter(sightPlan, request);
    expect(map.dungeonEncounter!.playerCell).toEqual(request.playerCell);
    expect(map.dungeonEncounter!.partySpawns[0]).toEqual(request.playerCell);
    expect(map.dungeonEncounter!.enemySpawn).toEqual(target);
    expect(sightPlan.spawns[0]).toEqual({...spawn, x: 7.5 * plan.cellFt, y: 4.5 * plan.cellFt});
    expect(map.dungeonEncounter!.combatantId).toBe(id);
  });
  it('refuses an unlit or wall-obscured creature despite a reachable route around it', () => {
    expect(() => projectDungeonEncounter(sightPlan, {...request, carriedBrightRadiusFt: 0})).toThrow(/visible/i);
    const grid = sightPlan.grid.slice(); grid[4 * sightPlan.W + 6] = 0;
    expect(() => projectDungeonEncounter({...sightPlan, grid}, request)).toThrow(/visible/i);
  });
  it('keeps closed source doors opaque and impassable in the tactical crop', () => {
    const door = {...plan.doors[0], cell: {x: 5, y: 2}, state: 'door' as const};
    const map = projectDungeonEncounter({...sightPlan, doors: [door]}, request);
    expect(map.tiles.get('5-2')).toMatchObject({blocksLoS: true, blocksMovement: true});
    expect(() => projectDungeonEncounter({...sightPlan, doors: [{...door, cell: {x: 6, y: 4}}]}, request)).toThrow(/visible/i);
  });
});
