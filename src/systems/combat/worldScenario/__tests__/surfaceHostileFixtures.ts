import type { BattleMapData, BattleMapTile, CombatEnemySnapshotEntry, CombatPartySnapshotEntry } from '../../../../types/combat';
import type { MonsterData } from '../../../../types/ui';
import { registerMonster } from '../../../../data/adapters/runtimeMonsterRegistry';
import { createMockCombatCharacter, createMockGameState, createMockPlayerCharacter } from '../../../../utils/core/factories';
import { prepareSurfaceHostileEncounter } from '../surfaceHostileEncounter';
import { surfaceHostileSourceScope } from '../surfaceHostileContinuity';
import {GamePhase} from '../../../../types';

/** Disposable contract fixture. It is not a generated-world gameplay receipt. */
export function surfaceFixture() {
  const bandit: MonsterData = {id: 'bandit', name: 'Bandit', maxHP: 11, armorClass: 12, abilities: [], tags: ['humanoid'],
    baseStats: {strength: 11, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10,
      baseInitiative: 1, speed: 30, cr: '1/8', senses: {darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0}}};
  registerMonster(bandit);
  const player = createMockPlayerCharacter({id: 'p', name: 'Test player', hp: 10, maxHp: 10});
  const state = createMockGameState({phase: GamePhase.COMBAT, worldSeed: 42, party: [player], gold: 35, playerCell: {cellId: 7, localeCoords: {x: 0, y: 0}},
    atlasGroundAddress: null, entry3DAnchor: null, worldforgeEncounterReceipts: [],
    playerGroundPos: {tileX: 7, tileY: 0, xM: 100.3, zM: 200.7, yM: 4.5}, gameTime: new Date('2026-01-01T12:00:00Z')});
  const tiles = new Map<string, BattleMapTile>();
  for(let y=0;y<11;y++)for(let x=0;x<11;x++)tiles.set(`${x}-${y}`,{id:`${x}-${y}`,coordinates:{x,y},terrain:'grass',elevation:15,
    movementCost:5,blocksLoS:false,blocksMovement:false,decoration:null,effects:[]});
  const map: BattleMapData = {dimensions: {width:11,height:11}, theme:'forest', seed:42, tiles,
    provenance:{kind:'worldforge',worldSeed:42,anchorCellId:7,anchorWorldMeters:{x:100.3,z:200.7},generationPath:['test source']}};
  const hostile = {id:'source-h', name:'Bandit', monsterId:'Bandit', xM:104.1,zM:201.2,
    sourceGroup:{kind:'marker' as const,key:'fixture-marker',memberIds:['source-h']}};
  const args = {hostile,profile:{id:'bandit',name:'Bandit',quantity:1,cr:'1/8',description:'fixture'},map,worldSeed:42,cellId:7,
    sourceScope:surfaceHostileSourceScope(state),gameTimeMs:state.gameTime.getTime(),party:[{characterId:'p',xM:100.3,zM:200.7,yM:4.5}],receipts:[]};
  const prepared = prepareSurfaceHostileEncounter(args);
  if(prepared.status!=='ready')throw new Error(prepared.detail);
  const actor = prepared.payload.combatants![0];
  state.extractedBattleMap = prepared.payload.extractedBattleMap!;
  state.worldforgeEncounterReceipts = [prepared.receipt];
  state.currentEnemies = [actor];
  const playerActor = createMockCombatCharacter({id:'p',team:'player'});
  const enemySnapshot: CombatEnemySnapshotEntry = {id:actor.id,currentHP:7,position:{x:8,y:6},worldSource:actor.worldSource};
  const partySnapshot: CombatPartySnapshotEntry = {id:'p',currentHP:7,position:{x:6,y:5}};
  return {state,args,prepared,actor,playerActor,enemySnapshot,partySnapshot};
}
