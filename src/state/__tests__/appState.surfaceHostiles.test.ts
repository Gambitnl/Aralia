import {describe,it,expect} from 'vitest';
import {appReducer} from '../appState';
import {surfaceFixture} from '../../systems/combat/worldScenario/__tests__/surfaceHostileFixtures';
import {createBattleEndActions} from '../../utils/combat/battleEndActions';
import {GamePhase} from '../../types';

describe('surface outcomes before combat teardown',()=>{
  it('keeps a refused source outcome from being bypassed by the following Game Over action',()=>{
    const f=surfaceFixture();
    const actions=createBattleEndActions('defeat',undefined,[f.partySnapshot],[{...f.enemySnapshot,worldSource:undefined}]);
    const result=actions.reduce(appReducer,f.state);
    expect(result.phase).toBe(GamePhase.COMBAT);
    expect(result.extractedBattleMap).toBe(f.state.extractedBattleMap);
    expect(result.battlefieldSourceGap?.code).toBe('surface-outcome-source-mismatch');
    expect(result.gold).toBe(35);
  });
  it('commits actual enemy HP and return positions before clearing the source map',()=>{
    const f=surfaceFixture();
    const state=appReducer(f.state,{type:'END_BATTLE',payload:{finalEnemyState:[f.enemySnapshot],finalPartyState:[f.partySnapshot]}});
    const receipt=state.worldforgeEncounterReceipts!.find(r=>r.id===f.prepared.receipt.id);
    expect(receipt?.kind==='surface-hostile-contact'&&receipt.resolution?.entities[0].currentHP).toBe(7);
    expect(state.extractedBattleMap).toBeNull();
    expect(state.playerGroundPos?.xM).toBe(100.3+1.524);
    expect(state.party[0].hp).toBe(7);
    expect(state.gold).toBe(35);
  });
  it('does not pay a repeated source victory twice',()=>{
    const f=surfaceFixture();const enemies=[{...f.enemySnapshot,currentHP:0}];
    const action={type:'END_BATTLE' as const,payload:{rewards:{gold:3,xp:25,items:[]},finalEnemyState:enemies,finalPartyState:[f.partySnapshot]}};
    const once=appReducer(f.state,action);const twice=appReducer(once,action);
    expect(twice).toBe(once);expect(twice.gold).toBe(38);
  });
});
