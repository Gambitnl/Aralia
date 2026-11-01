/** These checks protect water history and exchange accounting. They cannot
 * accept the waterfall's appearance or validate the experimental closures.
 */
import { describe, expect, it } from 'vitest';
import { WaterfallThinDynamics, thinMomentumExchange, thinPlateMomentumExchange, ThinAirField, type ThinSnapshot } from '../waterfallThinDynamics';
const inlet = { q: .15, width: 1, depth: .12, speed: 1.25, turbulence: .12 };
describe('persistent thin waterfall dynamics', () => {
  it('normal plate loading acts only normal to the plate when skin drag is disabled', () => {
    const result = thinPlateMomentumExchange([0, 0, 0], [1, -40, 0], 2, 1, 1, [1, 0, 0], .01, 0);
    expect(result.water[0]).toBeGreaterThan(0); expect(result.water[1]).toBe(0);
    expect(result.air[1]).toBe(-40);
    for (let k = 0; k < 3; k++) expect(2 * result.water[k] + result.air[k]).toBeCloseTo([1, -40, 0][k], 12);
  });
  it('ignores redundant source events without creating numerical seams', () => {
    const a = new WaterfallThinDynamics({ mode: 'fixed-air', across: 4 }), b = new WaterfallThinDynamics({ mode: 'fixed-air', across: 4 });
    a.recordSource(0, inlet); b.recordSource(0, inlet); b.recordSource(.033, { ...inlet });
    a.advanceTo(.1); b.advanceTo(.1); expect(a.snapshot()).toEqual(b.snapshot());
  });
  it.each([0, 6])('handles a manual source event exactly at the current boundary (q=%s)', q => {
    const source = { q: 3, width: 7, depth: .2, speed: 5, turbulence: 0 };
    const s = new WaterfallThinDynamics({ mode: 'fixed-air', across: 4 });
    s.recordSource(0, source); s.advanceTo(.1);
    const old = s.snapshot().patches.map(p => [p.id, p.volume]);
    s.recordSource(.1, { ...source, q }); s.recordSource(.1, { ...source, q });
    s.advanceTo(.105);
    expect(s.receipt().failure).toBeNull();
    expect(s.snapshot().patches.map(p => [p.id, p.volume])).toEqual(old);
    expect(s.snapshot().patches.every(p => p.volume > 0)).toBe(true);
    expect(s.receipt().budgetError).toBeCloseTo(0, 12);
  });
  it.each([0, 10])('preserves completed interval momentum across future speed=%s', speed => {
    const source = { q: 3, width: 7, depth: .2, speed: 5, turbulence: 0 };
    const s = new WaterfallThinDynamics({ mode: 'fixed-air', across: 4 });
    s.recordSource(0, source); s.recordSource(.025, { ...source, speed }); s.advanceTo(.025);
    const snapshot = s.snapshot(), vertices = new Map(snapshot.vertices.map(v => [v.id, v]));
    const px = snapshot.patches.reduce((sum, p) => sum + p.volume * 1000 / 3 * p.vertices.reduce((x, id) => x + vertices.get(id)!.velocity[0], 0), 0);
    expect(px).toBeCloseTo(3 * .025 * 1000 * 5, 10);
    expect(s.receipt().emittedVolume).toBeCloseTo(.075, 12);
  });
  it('applies a replaced already-processed boundary event to future launches only', () => {
    const source = { q: 3, width: 7, depth: .2, speed: 5, turbulence: 0 };
    const s = new WaterfallThinDynamics({ mode: 'fixed-air', across: 4 });
    s.recordSource(0, source); s.recordSource(.025, { ...source, q: 6 }); s.advanceTo(.025);
    const old = s.snapshot().patches.map(p => p.vertices);
    s.recordSource(.025, { ...source, q: 6, speed: 10 });
    expect(s.snapshot().patches.map(p => p.vertices)).toEqual(old);
    const carried = new Set(old.flat());
    expect(s.snapshot().vertices.filter(v => !carried.has(v.id)).every(v => v.velocity[0] === 10)).toBe(true);
    s.advanceTo(.05); expect(s.receipt().failure).toBeNull();
  });
  it('advects a local air perturbation even below half-cell displacement', () => {
    const air = new ThinAirField(1, [1, 0, 0], 70);
    air.set([.5, 20.5, .5], [1, 0, .2]);
    expect(air.cellAt([1.5, 20.5, .5])[2]).toBe(0);
    air.step(.01);
    expect(air.cellAt([1.5, 20.5, .5])[2]).toBeGreaterThan(0);
  });
  it('surface-energy forces preserve horizontal momentum after shutdown', () => {
    const simulation = new WaterfallThinDynamics({ mode: 'fixed-air', across: 5 });
    simulation.recordSource(0, inlet); simulation.recordSource(.1, { ...inlet, q: 0 }); simulation.advanceTo(.11);
    const momentum = (snapshot: ThinSnapshot) => {
      const vertices = new Map(snapshot.vertices.map(v => [v.id, v]));
      return snapshot.patches.reduce((total, p) => total + p.volume * 1000 / 3 * p.vertices.reduce((sum, id) => sum + vertices.get(id)!.velocity[0], 0), 0);
    };
    const before = momentum(simulation.snapshot()); simulation.advanceTo(.3);
    expect(momentum(simulation.snapshot())).toBeCloseTo(before, 10);
    expect(simulation.receipt().maximumCapillaryCourant).toBeLessThan(1);
  });
  it('retains volume through shutdown and one-time landing', () => {
    const simulation = new WaterfallThinDynamics({ mode: 'fixed-air', across: 4, dt: .01, emissionStep: .03 });
    simulation.recordSource(0, inlet); simulation.recordSource(.137, { ...inlet, q: 0 });
    simulation.advanceTo(.3);
    expect(simulation.receipt().emittedVolume).toBeCloseTo(.137 * inlet.q, 12);
    expect(simulation.receipt().airborneVolume).toBeGreaterThan(0);
    simulation.advanceTo(6);
    const receipt = simulation.receipt();
    expect(receipt.budgetError).toBeCloseTo(0, 12);
    expect(receipt.airborneVolume).toBe(0);
    expect(receipt.landedVolume).toBeCloseTo(.137 * inlet.q, 12);
    simulation.advanceTo(7);
    expect(simulation.receipt().landedVolume).toBe(receipt.landedVolume);
    expect(receipt.landedMomentum[1]).toBeLessThan(0);
  });
  it('has stable equal and opposite drag exchange at arbitrarily strong coupling', () => {
    const result = thinMomentumExchange([2, -40, 3], [.2, 1, -2], 100, .001, 1e12, .01);
    for (let k = 0; k < 3; k++) {
      const before = [2, -40, 3][k] * 100 + [.2, 1, -2][k] * .001;
      expect(result.water[k] * 100 + result.air[k] * .001).toBeCloseTo(before, 10);
      expect(result.water[k]).toBeCloseTo(result.air[k], 10);
    }
  });
  it('changes future water only and captures a pulse shorter than birth cadence', () => {
    const a = new WaterfallThinDynamics({ mode: 'fixed-air', across: 4, dt: .005 });
    a.recordSource(0, inlet); a.advanceTo(.1);
    const before = a.snapshot().vertices;
    a.recordSource(.107, { ...inlet, q: 1.2, speed: 10 });
    a.recordSource(.113, { ...inlet, q: 0 });
    expect(a.snapshot().vertices).toEqual(before);
    a.advanceTo(.2);
    expect(a.receipt().emittedVolume).toBeCloseTo(.107 * .15 + .006 * 1.2, 12);
    expect(() => a.recordSource(.05, inlet)).toThrow(/past/);
  });
  it('is independent of rendering cadence and snapshots cannot alter liquid', () => {
    const direct = new WaterfallThinDynamics({ across: 4, mode: 'fixed-air' });
    const framed = new WaterfallThinDynamics({ across: 4, mode: 'fixed-air' });
    for (const s of [direct, framed]) { s.recordSource(0, inlet); s.recordSource(.3, { ...inlet, q: 0 }); }
    direct.advanceTo(.6);
    for (let i = 1; i <= 36; i++) framed.advanceTo(i / 60);
    const copied = framed.snapshot(); copied.vertices[0].position[0] = 1e8;
    expect(framed.snapshot()).toEqual(direct.snapshot());
  });
  it('reports capacity failure while retaining all released water', () => {
    const s = new WaterfallThinDynamics({ across: 4, maximumFeatures: 1 }); s.recordSource(0, inlet);
    expect(() => s.advanceTo(.1)).toThrow(/capacity/);
    expect(s.receipt().failure).toMatch(/capacity/);
    expect(s.receipt().budgetError).toBeCloseTo(0, 12);
  });
  it('records opposite momentum in two-way mode and none in fixed-air mode', () => {
    const coupled = new WaterfallThinDynamics({ across: 4, mode: 'two-way' });
    const fixed = new WaterfallThinDynamics({ across: 4, mode: 'fixed-air' });
    for (const s of [coupled, fixed]) { s.recordSource(0, inlet); s.advanceTo(.2); }
    const r = coupled.receipt();
    expect(Math.hypot(...r.exchangeWaterMomentum)).toBeGreaterThan(0);
    for (let k = 0; k < 3; k++) expect(r.exchangeWaterMomentum[k] + r.exchangeAirMomentum[k]).toBeCloseTo(0, 12);
    expect(fixed.receipt().exchangeWaterMomentum).toEqual([0, 0, 0]);
    expect(coupled.snapshot().air.length).toBeGreaterThan(0);
  });
});

describe('opt-in pressure-coupled live water', () => {
  it('rejects unsupported material-region mapping before any water is released', () => {
    expect(() => new WaterfallThinDynamics({mode:'projected-air',projectedAir:{coupling:'material-regions'}})).toThrow(/area and region mapping/);
  });
  const create = () => new WaterfallThinDynamics({mode:'projected-air',crest:4,pool:0,dt:.01,across:2,emissionStep:.02,airCell:1,
    projectedAir:{origin:[-2,-2,-2],cells:[8,8,4],cellSize:1,tolerance:1e-8}});
  const source={q:.3,width:1,depth:.3,speed:1,turbulence:0,top:4};
  it('preserves source volume and opposite interface impulses while solving pressure', () => {
    const s=create();s.recordSource(0,source);s.recordSource(.06,{...source,q:0});s.advanceTo(.12);
    const r=s.receipt();expect(r.emittedVolume).toBeCloseTo(.018,12);expect(r.budgetError).toBeCloseTo(0,12);
    expect(r.airborneVolume).toBeGreaterThan(0);expect(r.projectedAir?.converged).toBe(true);
    expect(r.projectedAir!.maximumDivergence).toBeLessThan(1e-6);expect(r.projectedAir!.maximumInterfaceError).toBeLessThan(1e-6);
    for(let c=0;c<3;c++)expect(r.exchangeWaterMomentum[c]+r.exchangeAirMomentum[c]).toBeCloseTo(0,9);
    expect(r.projectedAir!.projectionLoss).toBeGreaterThanOrEqual(0);expect(r.projectedAir!.energyIdentityError).toBeCloseTo(0,9);
  });
  it('advances the same liquid and air state at different rendered cadences', () => {
    const a=create(),b=create();for(const s of [a,b]){s.recordSource(0,source);s.recordSource(.06,{...source,q:0});}
    a.advanceTo(.12);for(const t of [.04,.08,.12])b.advanceTo(t);
    const one=a.snapshot(),two=b.snapshot();expect(one.vertices).toEqual(two.vertices);expect(one.patches).toEqual(two.patches);expect(one.air).toEqual(two.air);
  });
  it('rolls back liquid and advected air when a point leaves the supported grid', () => {
    const s=create();s.recordSource(0,source);s.advanceTo(.08);const before=s.snapshot();
    // Force a true support failure after there is carried liquid and nonuniform
    // air. This tests failure atomicity, not a new way to steer product water.
    s.options.projectedAir = {...s.options.projectedAir};
    const projection=(s as unknown as {projection:{origin:[number,number,number]}}).projection;
    projection.origin[0]=100;
    expect(()=>s.advanceTo(.09)).toThrow(/outside air domain/);
    projection.origin[0]=-2;
    const after=s.snapshot();expect(after.vertices).toEqual(before.vertices);expect(after.air).toEqual(before.air);
    expect(after.receipt.time).toBe(before.receipt.time);expect(after.receipt.budgetError).toBeCloseTo(0,12);
  });
});
