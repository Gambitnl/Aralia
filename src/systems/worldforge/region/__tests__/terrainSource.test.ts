/** Retained source profiles keep regional data and foundation history together.
 * These factory checks support the real ground/source replay; they do not prove
 * native loading, placement or a complete campaign recovery. */
import {describe,expect,it,vi} from 'vitest';
const sources=vi.hoisted(()=>({
  legacy:{seedPath:'wf:42/region',heightfield:{samples:[1,2]},townSites:[]},
  current:{seedPath:'wf:42/region',heightfield:{samples:[3,4]},townSites:[]},
}));
vi.mock('../generateRegionV1',()=>({generateRegion:vi.fn(()=>sources.legacy)}));
vi.mock('../generateRegion',()=>({generateRegion:vi.fn(()=>sources.current)}));
import {generateRegionFromSource,requireTerrainSourceRevision} from '../terrainSource';

describe('retained terrain source profiles',()=>{
  it.each([1,2] as const)('preserves existing source %i without changing its artifact',revision=>{
    const expected=revision===1?sources.legacy:sources.current;
    const before=JSON.stringify(expected);
    expect(generateRegionFromSource({} as never,1,'wf:42',{} as never,revision)).toBe(expected);
    expect(JSON.stringify(expected)).toBe(before);
  });
  it('keeps the new-world default on the existing current source',()=>{
    expect(generateRegionFromSource({} as never,1,'wf:42',{} as never)).toBe(sources.current);
  });
  it.each([3,4] as const)('retains source profile %i without changing its seed or regional geometry',revision=>{
    const expected=revision===3?sources.legacy:sources.current,before=JSON.stringify(expected);
    const result=generateRegionFromSource({} as never,1,'wf:42',{} as never,revision);
    expect(result).toEqual({...expected,terrainSourceRevision:revision});
    expect(result).not.toBe(expected);
    expect(JSON.stringify(expected)).toBe(before);
    expect(requireTerrainSourceRevision(revision)).toBe(revision);
  });
  it.each([0,99,NaN])('refuses an unsupported explicit source %s',revision=>{
    expect(()=>requireTerrainSourceRevision(revision)).toThrow('unsupported terrain');
  });
});
