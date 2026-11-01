// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GroundWorld } from '../../bridge/groundChunkLoader';
import { freezePropWindowSource, readPropWindowSource, resolvePropGenerationRevision } from '../propGenerationSource';
import type { PropInstance } from '../propSchema';

const ground=()=>({cols:3,rows:3,heights:Array(9).fill(0),boundsFeet:{x:80,y:120},extentMetersX:10,extentMetersZ:10} as unknown as GroundWorld);
const prop:PropInstance={defId:'woodpile',xM:3,zM:4,rotationRad:0,variation:{scale:1,variant:0},renderRecipe:'props-v1',renderScale:1,renderRadiusM:.9,
  surface:{groundYM:0,sinkM:0,tiltRad:0,tiltAxis:[1,0]}};
const report={considered:1,kept:1,moved:0,declined:[]};
describe('retained prop window source and explicit campaign revision',()=>{
  it('keeps missing revisions legacy and refuses unsupported future recipes',()=>{
    expect(resolvePropGenerationRevision(undefined)).toBe(1);expect(resolvePropGenerationRevision(1)).toBe(1);
    expect(resolvePropGenerationRevision(2)).toBe(2);
    for(const value of [null,0,3,'2',NaN])expect(()=>resolvePropGenerationRevision(value)).toThrow('Unsupported prop generation revision');
  });
  it('round-trips exact original property and returns copies rather than editable source arrays',()=>{
    const g=ground(),source=freezePropWindowSource(g,42,7,[prop],report),before=JSON.stringify(source);
    const loaded=JSON.parse(before),copy=readPropWindowSource(g,42,7,loaded);
    expect(copy).toEqual([prop]);copy[0].xM=900;
    expect(JSON.stringify(source)).toBe(before);expect(JSON.stringify(loaded)).toBe(before);
  });
  it('preserves original placements when later building information differs',()=>{
    const g=ground(),source=freezePropWindowSource(g,42,7,[prop],report);
    const later={...g,buildings:[{id:'later-plan'}]} as GroundWorld;
    expect(readPropWindowSource(later,42,7,source)).toEqual([prop]);
  });
  it('refuses world, address, terrain and property drift without regenerating',()=>{
    const g=ground(),source=freezePropWindowSource(g,42,7,[prop],report);
    expect(()=>readPropWindowSource(g,43,7,source)).toThrow('source changed');
    expect(()=>readPropWindowSource(g,42,8,source)).toThrow('source changed');
    expect(()=>readPropWindowSource({...g,boundsFeet:{x:81,y:120}},42,7,source)).toThrow('source changed');
    const changed={...g,heights:[...g.heights]};changed.heights[0]=1;
    expect(()=>readPropWindowSource(changed,42,7,source)).toThrow('source changed');
    const corrupt=structuredClone(source);corrupt.props[0].xM++;
    expect(()=>readPropWindowSource(g,42,7,corrupt)).toThrow('Invalid saved');
  });
  it('refuses malformed placement accounting before accepting a source',()=>{
    for(const invalid of [{...report,moved:2},{...report,considered:-1},{...report,declined:null},
      {...report,moved:0.5},{...report,considered:2,declined:[{sourceId:'missing',defId:'crate'}]}]){
      expect(()=>freezePropWindowSource(ground(),42,7,[prop],invalid as typeof report)).toThrow('Invalid saved');
    }
  });
  it('refuses duplicate identity rather than choosing one established object',()=>{
    expect(()=>freezePropWindowSource(ground(),42,7,[prop,prop],{...report,considered:2,kept:2})).toThrow('Duplicate saved prop identity');
  });
});



describe('saved placement affiliation',()=>{
  it('retains the serving source through JSON reload without granting rights',()=>{
    const affiliated={...prop,affiliation:{kind:'building' as const,id:'wf-plot-2-3'}};
    const source=freezePropWindowSource(ground(),42,7,[affiliated],report);
    const loaded=readPropWindowSource(ground(),42,7,JSON.parse(JSON.stringify(source)));
    expect(loaded[0].affiliation).toEqual(affiliated.affiliation);
    expect(Object.keys(loaded[0]).some(key=>/owner|permission|access/i.test(key))).toBe(false);
  });
  it('refuses malformed affiliations rather than making them unassigned',()=>{
    for(const affiliation of [{kind:'building',id:''},{kind:'invented',id:'x'},{kind:'court',id:'x',xM:1,zM:2,radiusM:-1}]){
      expect(()=>freezePropWindowSource(ground(),42,7,[{...prop,affiliation} as PropInstance],report)).toThrow('Invalid saved prop affiliation');
    }
  });
});




describe('retained unfulfilled placement intent',()=>{
  it('retains which household or workplace a declined first candidate serves',()=>{
    const declined={sourceId:'prop:woodpile:100:200:0',defId:'woodpile',reason:'no-clear-supported-affiliated-site',
      affiliation:{kind:'building' as const,id:'wf-plot-2-3'}};
    const source=freezePropWindowSource(ground(),42,7,[prop],{...report,considered:2,declined:[declined]});
    const loaded=JSON.parse(JSON.stringify(source));
    expect(readPropWindowSource(ground(),42,7,loaded)).toEqual([prop]);
    expect(loaded.report.declined[0]).toEqual(declined);
  });
});
