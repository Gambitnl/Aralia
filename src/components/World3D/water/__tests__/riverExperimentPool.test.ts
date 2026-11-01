/** Proves source gating and storage-driven outflow before this small native
 * pool is exposed in the study area. These controls exercise the real solver.
 */
import {describe,it,expect} from 'vitest';
import {RiverExperimentPool} from '../riverExperimentPool';
describe('selected shallow-water experiment pool',()=>{
  it('advances ten physical seconds, conserves source water and clears the actual sill',()=>{
    const pool=new RiverExperimentPool(),began=performance.now();let mappingMs=0;
    while(pool.solver.time<10&&!pool.failure){pool.tick();const start=performance.now();const map=pool.map();mappingMs+=performance.now()-start;expect(map.grid.nx*map.grid.nz).toBe(384);}
    const wallMs=performance.now()-began,r=pool.receipt();
    expect(pool.failure).toBeNull();expect(r.physicalSeconds).toBeGreaterThanOrEqual(10);
    expect(Math.abs(r.volumeClosure)).toBeLessThan(1e-8);expect(r.outVolume).toBeGreaterThan(0);
    expect(wallMs).toBeLessThan(10000);
    console.info('Native experiment pool preflight',JSON.stringify({wallMs,mappingMs,...r}));
  });
  it('source off preserves admitted state while water continues and resume only adds new admission',()=>{
    const pool=new RiverExperimentPool();while(pool.solver.time<8)pool.tick();
    const before=pool.solver.saveState(),admitted=pool.solver.inVolume,out=pool.solver.outVolume;
    pool.setSource(false);expect(pool.solver.saveState()).toEqual(before);
    for(let k=0;k<20;k++)pool.tick();
    expect(pool.solver.time).toBeGreaterThan(before.time);expect(pool.solver.inVolume).toBe(admitted);expect(pool.solver.outVolume).toBeGreaterThan(out);
    expect(pool.solver.volume()).toBeGreaterThan(0);expect(Math.abs(pool.receipt().volumeClosure)).toBeLessThan(1e-8);
    const retained=pool.solver.saveState();pool.setSource(true);expect(pool.solver.saveState()).toEqual(retained);pool.tick();expect(pool.solver.inVolume).toBeGreaterThan(admitted);
    pool.dispose();const stopped=pool.solver.time;pool.tick();expect(pool.solver.time).toBe(stopped);
  });
});
