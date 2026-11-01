/** Physical and interpolation receipts for prescribed falling ribbons.
 * Rendered shape and motion remain a separate parent-owned visual gate. */
import { describe, expect, it } from 'vitest';
import { DataUtils } from 'three';
import { waterfallLiquidSection } from '@/components/World3D/water/riverWaterfallView';
import { WATERFALL_ATLAS, WaterfallDensityAtlas, waterfallAtlasOccupancy, waterfallAtlasEdgeMean } from '../waterfallDensityAtlas';

function physicalCheck(atlas: WaterfallDensityAtlas, q: number, speed: number, age: number, time: number, width = 10) {
  const section = waterfallLiquidSection(q, width, speed, age, time), mean = waterfallAtlasEdgeMean(section);
  let integral = 0, maximum = 0;
  // This independent denser grid checks the reconstructed half-float field,
  // not the normalizer's internal weighted sum or just texel-center values.
  const edge = Math.min((1 - section.coherence) * .4, (1 - section.fraction) * .5);
  const nx = edge > 0 && edge < .01 ? 768 : 192, ny = nx / 2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) * 2 / nx - 1, y = (j + 0.5) * 2 / ny - 1;
    const density = section.fraction * waterfallAtlasOccupancy(section, x, y) * atlas.sample(x, y, age) / mean;
    integral += density * section.width * section.thickness / (nx * ny); maximum = Math.max(maximum, density);
  }
  return { massRatio: integral / section.area, maximum };
}

describe('whole-section waterfall density atlas', () => {
  it('conserves the folded material sheet across section and snapshot interpolation', () => {
    let error = 0, maximum = 0;
    const costs: unknown[] = [];
    for (const [q, width, speed] of [[.15, 10, .15 / 7], [.5, 6, .059523809523809534], [12, 10, 12 / 7], [50, 10, 50 / 7]]) {
      const atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(q, width, speed, age, 0), 'folds');
      atlas.update(20); const initialFillMs = atlas.lastUpdateMs;
      for (const time of [20, 20.047]) {
        atlas.update(time);
        for (const age of [0, .009, .027, .079, .167, .333, .717, 1.739, 2.517, 3.647]) {
          const r = physicalCheck(atlas, q, speed, age, time, width);
          error = Math.max(error, Math.abs(r.massRatio - 1)); maximum = Math.max(maximum, r.maximum);
          expect(r.massRatio, `folds Q${q} age${age} t${time}`).toBeCloseTo(1, 2);
          expect(r.maximum).toBeLessThanOrEqual(1.001);
        }
      }
      const ticks = [];
      for (let k = 2; k < 5; k++) { atlas.update(20 + k * atlas.config.interval); ticks.push(atlas.lastUpdateMs); }
      for (let k = 0; k <= 160; k++) {
        const age = k / 160 * .8, s = atlas.section(age); let maximumFactor = 0;
        for (let j = 0; j < 24; j++) for (let i = 0; i < 48; i++) maximumFactor = Math.max(maximumFactor, atlas.sample((i + .5) / 24 - 1, (j + .5) / 12 - 1, age));
        expect(maximumFactor * s.fraction / waterfallAtlasEdgeMean(s), `fold crest Q${q} age${age}`).toBeLessThanOrEqual(1.0001);
      }
      expect(atlas.section(atlas.maximumFallbackAge).coherence).toBeGreaterThan(.9);
      expect(atlas.textureBytes).toBe(1184256);
      costs.push({ q, width, speed, constructorMs: atlas.initializationMs, initialTwoSnapshotsMs: initialFillMs, steadySnapshotMs: ticks, expansions: atlas.supportExpansions, fallbackMaxAge: atlas.maximumFallbackAge });
    }
    console.log('folded material sheet receipt', JSON.stringify({ error, maximum, costs }));
  });
  it('keeps finite packets conservative through intermediate ages and times', () => {
    let error = 0, maxPhi = 0;
    const costs: unknown[] = [];
    for (const q of [.15, 12, 50]) {
      const atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(q, 10, q / 7, age, 0), 'packets');
      for (const time of [20.031, 20.163]) {
        atlas.update(time);
        for (const age of [0, .018, .053, .123, .263, .475, .913, 1.733, 2.517, 3.647]) {
          const result = physicalCheck(atlas, q, q / 7, age, time);
          error = Math.max(error, Math.abs(result.massRatio - 1)); maxPhi = Math.max(maxPhi, result.maximum);
          expect(result.massRatio, `packet Q${q} age${age} t${time}`).toBeCloseTo(1, 2);
          expect(result.maximum).toBeLessThanOrEqual(1.001);
        }
      }
      for (let k = 0; k <= 160; k++) {
        const age = k / 160 * .8, s = atlas.section(age); let maximum = 0;
        for (let j = 0; j < 24; j++) for (let i = 0; i < 48; i++) maximum = Math.max(maximum, atlas.sample((i + .5) / 24 - 1, (j + .5) / 12 - 1, age));
        expect(maximum * s.fraction / waterfallAtlasEdgeMean(s), `packet crest Q${q} age${age}`).toBeLessThanOrEqual(1.0001);
      }
      const ticks = [];
      for (let k = 1; k <= 5; k++) { atlas.update(21 + k * atlas.config.interval); ticks.push(atlas.lastUpdateMs); }
      expect(atlas.maximumFallbackAge).toBe(0);
      let compactAge = 0;
      while (compactAge < 4.5 && atlas.section(compactAge).coherence > .02) compactAge += .001;
      costs.push({ q, initializationMs: atlas.initializationMs, skippedTimeTwoSnapshotMs: ticks[0], steadySnapshotMs: ticks.slice(1), bytes: atlas.textureBytes, expansions: atlas.supportExpansions, fallbacks: atlas.fullSectionFallbacks, maximumFallbackAge: atlas.maximumFallbackAge, compactAge });
    }
    console.log('packet mass/phi/cost receipt', JSON.stringify({ error, maxPhi, costs }));
  });

  it('removes downstream support and advects its finite emission labels continuously', () => {
    const atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(12, 10, 12 / 7, age, 0), 'packets');
    atlas.update(20);
    const age = 2.5;
    const before = Array.from({ length: 48 * 24 }, (_, k) => atlas.sample((k % 48 + .5) / 24 - 1, (Math.floor(k / 48) + .5) / 12 - 1, age));
    expect(before.filter(v => v === 0).length).toBeGreaterThan(before.length * .2);
    atlas.update(20.5);
    const after = before.map((_, k) => atlas.sample((k % 48 + .5) / 24 - 1, (Math.floor(k / 48) + .5) / 12 - 1, age));
    expect(before.filter((v, k) => v > .1 && after[k] === 0).length).toBeGreaterThan(20);
    expect(before.filter((v, k) => v === 0 && after[k] > .1).length).toBeGreaterThan(20);
    atlas.update(20.0625 - 1e-7); const left = atlas.sample(.12, -.2, age);
    atlas.update(20.0625 + 1e-7); const right = atlas.sample(.12, -.2, age);
    expect(Math.abs(left - right)).toBeLessThan(.001);
    expect(atlas.config.ages).toBe(129); expect(atlas.textureBytes).toBe(594432);
    const nx = 48, ny = 24, nz = atlas.config.ages;
    const at = (x: number, y: number, z: number) => DataUtils.fromHalfFloat(atlas.first[(z * ny + y) * nx + x]);
    const x = 11.3, y = 7.6, z = 79.2;
    let interpolated = 0;
    atlas.update(20);
    // Snapshot boundary selects first exactly; this is the GPU's centered
    // texture coordinate convention, with the candidate's different depth.
    interpolated = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
      interpolated += at(11 + dx, 7 + dy, 79 + dz) * (dx ? .3 : .7) * (dy ? .6 : .4) * (dz ? .2 : .8);
    expect(atlas.sample((x + .5) * 2 / nx - 1, (y + .5) * 2 / ny - 1, z * atlas.config.maxAge / (nz - 1))).toBeCloseTo(interpolated, 10);
    // Matching emission labels retain the same packet support away from the
    // coherent crest. Age-dependent section normalization can change amplitude.
    atlas.update(20); const support0 = before.map((_, k) => atlas.sample((k % 48 + .5) / 24 - 1, (Math.floor(k / 48) + .5) / 12 - 1, 2.5) === 0);
    atlas.update(20.5); const support1 = before.map((_, k) => atlas.sample((k % 48 + .5) / 24 - 1, (Math.floor(k / 48) + .5) / 12 - 1, 3) === 0);
    expect(support0.filter((v, k) => v === support1[k]).length / support0.length).toBeGreaterThan(.9);
    const defaultAtlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(12, 10, 12 / 7, age, 0));
    const legacy = new WaterfallDensityAtlas(age => waterfallLiquidSection(12, 10, 12 / 7, age, 0), 'legacy');
    defaultAtlas.update(20); legacy.update(20);
    expect(defaultAtlas.first).toEqual(legacy.first); expect(defaultAtlas.second).toEqual(legacy.second);
  });

  it('forms connected sheet volumes rather than isolated voxel particles', () => {
    const atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(12, 10, 12 / 7, age, 0), 'packets');
    atlas.update(20);
    // Inspect only developed downstream rows, so the coherent full crest
    // cannot artificially join every component for this topology check.
    const nx = 48, ny = 24, start = 50, nz = atlas.config.ages - start;
    const occupied = new Uint8Array(nx * ny * nz); let total = 0;
    for (let k = 0; k < occupied.length; k++) {
      occupied[k] = Number(DataUtils.fromHalfFloat(atlas.first[start * nx * ny + k]) > .01);
      total += occupied[k];
    }
    let permanentColumns = 0;
    for (let xy = 0; xy < nx * ny; xy++) {
      let permanent = true;
      for (let z = 0; z < nz; z++) if (occupied[z * nx * ny + xy] === 0) { permanent = false; break; }
      if (permanent) permanentColumns++;
    }
    expect(permanentColumns).toBe(0);
    const sizes: number[] = [], extents: number[] = [];
    for (let root = 0; root < occupied.length; root++) if (occupied[root]) {
      const stack = [root]; occupied[root] = 0; let size = 0, lo = nz, hi = 0;
      while (stack.length) {
        const k = stack.pop()!, x = k % nx, y = Math.floor(k / nx) % ny, z = Math.floor(k / (nx * ny));
        size++; lo = Math.min(lo, z); hi = Math.max(hi, z);
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy, zz = z + dz;
          if (xx < 0 || xx >= nx || yy < 0 || yy >= ny || zz < 0 || zz >= nz) continue;
          const next = (zz * ny + yy) * nx + xx;
          if (occupied[next]) { occupied[next] = 0; stack.push(next); }
        }
      }
      sizes.push(size); extents.push(hi - lo + 1);
    }
    const tiny = sizes.filter(size => size < 20).reduce((a, b) => a + b, 0);
    expect(tiny / total).toBeLessThan(.01);
    expect(Math.max(...sizes) / total).toBeGreaterThan(.8);
    expect(Math.max(...extents)).toBeGreaterThan(20);
    console.log('packet connected-support receipt', JSON.stringify({ total, components: sizes.length, largest: Math.max(...sizes), tiny, extents, permanentColumns }));
  });

  it('keeps folded support connected while its projected positions change', () => {
    const atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(12, 10, 12 / 7, age, 0), 'folds');
    atlas.update(20);
    const nx = 48, ny = 24, start = Math.ceil(1.8 / atlas.config.maxAge * (atlas.config.ages - 1)), nz = atlas.config.ages - start;
    const mask = new Uint8Array(nx * ny * nz); let total = 0, permanent = 0;
    for (let k = 0; k < mask.length; k++) { mask[k] = Number(DataUtils.fromHalfFloat(atlas.first[start * nx * ny + k]) > .01); total += mask[k]; }
    for (let xy = 0; xy < nx * ny; xy++) {
      let present = true;
      for (let z = 0; z < nz; z++) if (!mask[z * nx * ny + xy]) { present = false; break; }
      if (present) permanent++;
    }
    const sizes: number[] = [];
    for (let root = 0; root < mask.length; root++) if (mask[root]) {
      const stack = [root]; mask[root] = 0; let size = 0;
      while (stack.length) {
        const k = stack.pop()!, x = k % nx, y = Math.floor(k / nx) % ny, z = Math.floor(k / (nx * ny)); size++;
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy, zz = z + dz;
          if (xx < 0 || xx >= nx || yy < 0 || yy >= ny || zz < 0 || zz >= nz) continue;
          const next = (zz * ny + yy) * nx + xx;
          if (mask[next]) { mask[next] = 0; stack.push(next); }
        }
      }
      sizes.push(size);
    }
    expect(permanent).toBe(0);
    expect(Math.max(...sizes) / total).toBeGreaterThan(.95);
    expect(sizes.filter(n => n < 20).reduce((a, b) => a + b, 0) / total).toBeLessThan(.01);
    atlas.update(20.03125 - 1e-7); const before = atlas.sample(.21, -.32, 2.3);
    atlas.update(20.03125 + 1e-7); const after = atlas.sample(.21, -.32, 2.3);
    expect(Math.abs(after - before)).toBeLessThan(.005);
    console.log('fold connected-support receipt', JSON.stringify({ total, components: sizes.length, largest: Math.max(...sizes), permanent }));
  });
  it('preserves Q/v and phi≤1 across flow, age and snapshot interpolation', () => {
    let worstMassError = 0;
    for (const q of [0.15, 2, 12, 50]) {
      const speed = q / 7, atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(q, 10, speed, age, 0));
      for (const time of [0.02, 20.061]) {
        atlas.update(time);
        for (const age of [0, 0.035, 0.07, 0.105, 0.175, 0.28, 0.457, 0.75, 1.5, 2.53, 3.65]) {
          const result = physicalCheck(atlas, q, speed, age, time);
          worstMassError = Math.max(worstMassError, Math.abs(result.massRatio - 1));
          expect(result.massRatio, `Q${q}, age${age}, t${time}`).toBeCloseTo(1, 2);
          expect(result.maximum, `local liquid Q${q}, age${age}`).toBeLessThanOrEqual(1.001);
        }
      }
      // Densely sample the nonlinear crest transition. Checking the maximum
      // reconstructed factor WITHOUT taper gives a conservative bound for
      // every occupied position and all spatial interpolation within a slice.
      for(let k=0;k<=160;k++) {
        const age=k/160*.8,s=waterfallLiquidSection(q,10,speed,age,20.061);let maximum=0;
        for(let j=0;j<WATERFALL_ATLAS.y;j++)for(let i=0;i<WATERFALL_ATLAS.x;i++)
          maximum=Math.max(maximum,atlas.sample((i+.5)*2/WATERFALL_ATLAS.x-1,(j+.5)*2/WATERFALL_ATLAS.y-1,age));
        expect(maximum*s.fraction/waterfallAtlasEdgeMean(s),`crest bound Q${q}, age${age}`).toBeLessThanOrEqual(1.0001);
      }
      const a=waterfallLiquidSection(q,10,speed,1.73,0), b=waterfallLiquidSection(q,10,speed,1.73,23.4);
      expect(a.canonicalRing).toEqual(b.canonicalRing); expect(a.fraction).toBe(b.fraction);
    }
    console.log('maximum independently integrated mass error',worstMassError);
  });

  it('matches independent texture interpolation and maintains temporal continuity', () => {
    const atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(12, 10, 12 / 7, age, 0));
    atlas.update(20.061);
    const nx=WATERFALL_ATLAS.x, ny=WATERFALL_ATLAS.y, nz=WATERFALL_ATLAS.ages;
    const x=(11.3+.5)*2/nx-1, y=(7.6+.5)*2/ny-1, age=29.2*WATERFALL_ATLAS.maxAge/(nz-1);
    const independent=(data:Uint16Array)=> {
      let value=0;
      for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)
        value+=DataUtils.fromHalfFloat(data[((29+dz)*ny+7+dy)*nx+11+dx])*(dx?.3:.7)*(dy?.6:.4)*(dz?.2:.8);
      return value;
    };
    expect(atlas.sample(x,y,age)).toBeCloseTo(independent(atlas.first)*(1-atlas.blend)+independent(atlas.second)*atlas.blend,10);
    atlas.update(20.125-1e-7); const before=atlas.sample(.21,-.32,2.3);
    atlas.update(20.125+1e-7); const after=atlas.sample(.21,-.32,2.3);
    expect(Math.abs(after-before)).toBeLessThan(.0001);
    const version=atlas.version; expect(atlas.update(20.14)).toBe(false); expect(atlas.version).toBe(version);
    expect(atlas.textureBytes).toBe(299520);
    const steady=[];
    for(let k=2;k<8;k++){atlas.update(20+k*.125);steady.push(atlas.lastUpdateMs);}
    console.log('atlas constructor ms',atlas.initializationMs,'steady one-snapshot ms',steady);
  });

  it('allows the center column to vary and has materially empty transverse paths', () => {
    const atlas=new WaterfallDensityAtlas(age=>waterfallLiquidSection(12,10,12/7,age,0));
    const column=(time:number,x:number)=> {
      atlas.update(time); const age=2.5, s=waterfallLiquidSection(12,10,12/7,age,time);let liquid=0;
      for(let j=0;j<192;j++){const y=(j+.5)*2/192-1;liquid+=s.fraction*waterfallAtlasOccupancy(s,x,y)*atlas.sample(x,y,age)/waterfallAtlasEdgeMean(s)*s.thickness/192;}
      return liquid;
    };
    const center=[19.5,20,20.5,21].map(t=>column(t,0));
    expect(Math.max(...center)/Math.min(...center)).toBeGreaterThan(1.5);
    const paths=Array.from({length:21},(_,i)=>column(20,(i-10)*.08));
    expect(Math.min(...paths.slice(2,-2))*500).toBeLessThan(1);
    console.log('atlas center liquid columns (m)',center,'tau range',Math.min(...paths)*500,Math.max(...paths)*500,'snapshot ms',atlas.lastUpdateMs);
  });
});


describe('source restart density regression', () => {
  const q = 1.5, speed = q / 7;
  const wet = (age: number) => waterfallLiquidSection(q, 10, speed, age, 0);
  const dry = (age: number) => waterfallLiquidSection(0, 10, 0, age, 0);
  const expectFinite = (atlas: WaterfallDensityAtlas) => {
    for (const texture of [atlas.first, atlas.second]) {
      expect(Array.from(texture).every(bits => Number.isFinite(DataUtils.fromHalfFloat(bits)))).toBe(true);
    }
  };

  it('keeps an initially dry ordinary and transient atlas exactly empty', () => {
    for (const atlas of [new WaterfallDensityAtlas(dry), new WaterfallDensityAtlas(dry, 'legacy', { sectionAtTime: dry })]) {
      atlas.update(0);
      expectFinite(atlas);
      expect(atlas.first.every(bits => bits === 0)).toBe(true);
      expect(atlas.second.every(bits => bits === 0)).toBe(true);
    }
  });

  it('rejects invalid positive geometry without poisoning a later valid atlas', () => {
    for (const thickness of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
      const invalid = () => ({ ...wet(3), thickness });
      expect(() => new WaterfallDensityAtlas(invalid)).toThrow();
      const atlas = new WaterfallDensityAtlas(wet, 'legacy', { sectionAtTime: invalid });
      expect(() => atlas.update(14)).toThrow();
      expect(atlas.version).toBe(0);
      expect(atlas.first.every(bits => bits === 0)).toBe(true);
      expect(atlas.second.every(bits => bits === 0)).toBe(true);
    }
    const valid = new WaterfallDensityAtlas(wet, 'legacy', { sectionAtTime: wet });
    valid.update(14); expectFinite(valid);
    const failsSecond = new WaterfallDensityAtlas(wet, 'legacy', {
      sectionAtTime: (age, time) => time > 14.125 ? { ...wet(age), thickness: 0 } : wet(age),
    });
    failsSecond.update(13.5);
    const first = failsSecond.first, second = failsSecond.second;
    const firstBytes = first.slice(), secondBytes = second.slice();
    const version = failsSecond.version, blend = failsSecond.blend;
    expect(first.some(bits => bits !== 0)).toBe(true);
    expect(second.some(bits => bits !== 0)).toBe(true);
    // First fill preflights through 14.125; only the second sees 14.25.
    expect(() => failsSecond.update(14)).toThrow();
    expect(failsSecond.first).toBe(first); expect(failsSecond.second).toBe(second);
    expect(first).toEqual(firstBytes); expect(second).toEqual(secondBytes);
    expect(failsSecond.version).toBe(version); expect(failsSecond.blend).toBe(blend);
  });
  it('preserves finite wet-dry-wet rows and a second atlas sharing the cache', () => {
    // The young wet front has not yet populated the mature 0/400 cache key.
    // Dry downstream rows must never seed that same key with invalid geometry.
    const sectionAtTime = (age: number, time: number) => {
      const emission = time - age;
      return emission >= 0 && (emission < 1 || emission >= 8) ? wet(age) : dry(age);
    };
    const atlas = new WaterfallDensityAtlas(wet, 'legacy', { sectionAtTime });
    atlas.update(.25);
    expectFinite(atlas);
    for (const age of [0, .1, atlas.config.maxAge]) expect(Number.isFinite(atlas.sample(0, 0, age))).toBe(true);
    const dryStart = Math.ceil(.375 / atlas.config.maxAge * (atlas.config.ages - 1));
    const rowSize = atlas.config.x * atlas.config.y;
    for (const texture of [atlas.first, atlas.second]) expect(texture.subarray(dryStart * rowSize).every(bits => bits === 0)).toBe(true);
    atlas.update(6);
    expectFinite(atlas);
    expect(atlas.first.every(bits => bits === 0)).toBe(true);
    expect(atlas.second.every(bits => bits === 0)).toBe(true);
    atlas.update(14);
    expectFinite(atlas);
    const second = new WaterfallDensityAtlas(wet, 'legacy', { sectionAtTime });
    second.update(14);
    expectFinite(second);
    // Retain the existing independent reconstructed-field mass/phi limits.
    expect(atlas.first).toEqual(second.first); expect(atlas.second).toEqual(second.second);
    for (const candidate of [atlas, second]) for (const age of [.175, 1.5, 2.53, 3.65]) {
      const result = physicalCheck(candidate, q, speed, age, 14);
      expect(result.massRatio).toBeCloseTo(1, 2);
      expect(result.maximum).toBeLessThanOrEqual(1.001);
    }
  });
});
