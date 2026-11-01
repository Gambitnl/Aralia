/** Physical source partition checks, including finite time extent and spin. */
import { describe, it, expect } from 'vitest';
import { ballisticInletMoments, type BallisticInlet } from '../flipSourceMoments';
const source:BallisticInlet={flowM3s:1.5,widthM:10,bottomM:77.3,depthM:.7,entranceY:76,sourceOn:0,sourceOff:4,depthCells:7,spanCells:40};
describe('finite waterfall material moments',()=>{
  it('stages water upstream at one time and retains its actual internal motion',()=>{
    const cs=ballisticInletMoments(source,1,.04,.25,25);
    expect(cs).toHaveLength(280);
    expect(cs.reduce((s,c)=>s+c.packet.volumeM3,0)).toBeCloseTo(.06,12);
    for(const c of cs){
      expect(c.packet.positionM[1]).toBeGreaterThan(76);
      expect(c.packet.positionM[1]).toBeLessThan(c.materialBounds.max[1]);
      expect(c.packet.affinePerSecond![1]).not.toBe(0);
      expect(Math.abs(c.packet.affinePerSecond![1])).toBeLessThan(1);
      expect(c.apicKineticJ).toBeLessThan(c.sourceKineticJ);
      const x=c.packet.positionM,v=c.packet.velocityMps,m=c.packet.volumeM3*1000;
      const spinZ=m*(c.B[1]-c.B[3]);
      expect(m*(x[0]*v[1]-x[1]*v[0])+spinZ).toBeCloseTo(c.angularMomentum[2],10);
    }
  });
  it('partitions the complete pulse without birth or shutdown smearing',()=>{
    const small={...source,spanCells:1};let volume=0;
    const dt=.04;
    for(let k=0;k<125;k++)volume+=ballisticInletMoments(small,k*dt,dt,.25,k).reduce((s,c)=>s+c.packet.volumeM3,0);
    expect(volume).toBeCloseTo(6,9);
    expect(ballisticInletMoments(source,0,dt,.25,0)).toHaveLength(0);
    expect(ballisticInletMoments(source,5,dt,.25,125)).toHaveLength(0);
  });
  it('integrates physical energy from finite age rather than a midpoint gradient',()=>{
    const cs=ballisticInletMoments(source,1,.04,.25,25);
    const u=1.5/7,g=9.81,dt=.04;
    // Average over a in [sqrt(2(y0-76)/g)-dt, sqrt(...)] and y0 in [77.3,78].
    const averageCrossing=(2/3)*Math.sqrt(2/g)*(2**1.5-1.3**1.5)/.7;
    const expected=.5*60*(u*u+g*g*(2*1.65/g-dt*averageCrossing+dt*dt/3));
    expect(cs.reduce((s,c)=>s+c.sourceKineticJ,0)).toBeCloseTo(expected,8);
  });
});
