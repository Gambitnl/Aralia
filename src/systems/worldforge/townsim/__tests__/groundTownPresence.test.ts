/** Accepted meters, rather than a whole Atlas cell or focus label, own town earshot. */
import {describe,expect,it,vi} from 'vitest';
import {FEET_PER_FMG_PIXEL} from '../../adapter/atlasArtifact';
import type {GameState} from '../../../../types/state';
import {burgIdForLocation,resolveTownForLocation} from '../chronicleForLocation';

vi.mock('../../bridge/legacySubmapBridge',()=>({
  getBridgeAtlas:()=>({pack:{cells:{burg:{42:1}},burgs:[null,{i:1,x:10,y:20,population:10}]}}),
  getWorldforgeLocalForCell:()=>({local:{bounds:{x:10*FEET_PER_FMG_PIXEL-1500,y:20*FEET_PER_FMG_PIXEL-1500,width:3000,height:3000}}}),
}));
const townX=10*FEET_PER_FMG_PIXEL,townY=20*FEET_PER_FMG_PIXEL;
const ground=(dx=0)=>({
  playerGroundPos:{tileX:42,tileY:0,xM:457.2,zM:457.2,yM:4},entry3DAnchor:null,
  atlasGroundAddress:{worldSeed:7,atlasCellId:42,localBounds:{x:townX-1500+dx,y:townY-1500,width:3000,height:3000},focus:{kind:'town',id:1}},
}) as unknown as Pick<GameState,'playerGroundPos'|'entry3DAnchor'|'atlasGroundAddress'>;
// The structural cast lets this regression run against the pre-repair API too.
const resolve=(g:ReturnType<typeof ground>)=>burgIdForLocation({worldSeed:7,cellId:42,ground:g} as Parameters<typeof burgIdForLocation>[0]);
describe('ground-aware town presence',()=>{
  it('does not project town people or news to a distant Local in the same cell',()=>expect(resolve(ground(10000))).toBeUndefined());
  it('retains town presence at accepted town feet independent of focus kind',()=>{
    const g=ground();g.atlasGroundAddress!.focus={kind:'local',id:'woodland',xFt:townX,yFt:townY};
    expect(resolve(g)).toBe(1);
  });
  it('uses current meters after walking outside the town envelope',()=>{
    const g=ground();g.playerGroundPos!.xM=850;
    expect(resolve(g)).toBeUndefined();
  });
  it.each(['foreign-world','foreign-cell','wrong-tile','no-body','non-finite'] as const)('refuses an unowned accepted position: %s',kind=>{
    const g=ground();
    if(kind==='foreign-world')g.atlasGroundAddress!.worldSeed=8;
    if(kind==='foreign-cell')g.atlasGroundAddress!.atlasCellId=43;
    if(kind==='wrong-tile')g.playerGroundPos!.tileX=43;
    if(kind==='no-body')g.playerGroundPos=null;
    if(kind==='non-finite')g.playerGroundPos!.xM=NaN;
    expect(resolve(g)).toBeUndefined();
  });
  it('preserves cell-level town lookup when no ground position exists',()=>expect(burgIdForLocation({worldSeed:7,cellId:42})).toBe(1));
  it('uses the same presence gate for tracked town news',()=>{
    expect(resolveTownForLocation({worldSeed:7,cellId:42,currentLocationId:'cell_42',townSim:{1:{burgId:1}},gameTime:new Date(),ground:ground(10000)} as unknown as Parameters<typeof resolveTownForLocation>[0])).toBeUndefined();
  });
});
