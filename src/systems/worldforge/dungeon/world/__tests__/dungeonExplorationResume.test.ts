import {describe, expect, it} from 'vitest';
import {generateDungeon} from '../../generateDungeon';
import {canonicalDungeonId} from '../dungeonIdentity';
import {buildDungeonLevelStack, dungeonLevelVisitReceipt} from '../dungeonLevels';
import {enterDungeonExpedition, recordDungeonProgress, retreatDungeonExpedition, normalizeDungeonExpeditionLedger} from '../dungeonLifecycle';
import {validateDungeonExplorationPosition} from '../dungeonExplorationResume';
import type {ActiveDungeonEntry} from '../../../../../components/World3D/dungeonEntryRuntime';

const seedPath='wf:42/cell:751/dungeon:m28';
const identity={seedPath,dungeonId:canonicalDungeonId(seedPath)};
const entry:ActiveDungeonEntry={identity, entranceKind:'ruin-door',
  plan:generateDungeon({seed:42,seedPath,params:{theme:'crypt'}}),
  returnContext:{worldSeed:42,cellId:751,tileX:25,tileY:16,xM:123.4,zM:432.1,yM:8.2}};
const levels=buildDungeonLevelStack(identity,entry.plan,42);
const position={depth:1,playerCell:levels[1].entryCell,entranceKind:entry.entranceKind,returnContext:entry.returnContext};
const reached=recordDungeonProgress(enterDungeonExpedition(identity),{
  levelVisits:{'level:1':dungeonLevelVisitReceipt(levels[1])},activeVisit:position,
});

describe('saved exploration footing',()=>{
  it('preserves the exact child position, return pose and visit count through JSON migration',()=>{
    const ledger=normalizeDungeonExpeditionLedger(JSON.parse(JSON.stringify({[identity.dungeonId]:reached})));
    expect(validateDungeonExplorationPosition(ledger[identity.dungeonId],entry)).toEqual(position);
    expect(ledger[identity.dungeonId].visitCount).toBe(1);
  });
  it('rejects unknown pages, wall/out-of-bounds cells and foreign worlds',()=>{
    for(const activeVisit of [{...position,depth:2},{...position,playerCell:{x:-1,y:0}},
      {...position,returnContext:{...position.returnContext,worldSeed:43}}]) {
      expect(validateDungeonExplorationPosition({...reached,progress:{...reached.progress,activeVisit}},entry)).toBeNull();
    }
  });
  it('retreat clears only current footing; a new entry never resumes the departed visit',()=>{
    const departed=retreatDungeonExpedition(reached);
    expect(departed.progress.activeVisit).toBeUndefined();
    expect(departed.progress.levelVisits).toEqual(reached.progress.levelVisits);
    expect(validateDungeonExplorationPosition(departed,entry)).toBeNull();
    expect(enterDungeonExpedition(identity,departed).progress.activeVisit).toBeUndefined();
  });
});
