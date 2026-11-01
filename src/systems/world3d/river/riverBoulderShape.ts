/**
 * Main-channel rocks share the same triangles between drawing and collision.
 * This reproduces the existing granite cuts, not a replacement rock style.
 * Vertical queries intersect those triangles; no ellipsoid or height atlas is
 * substituted. Original-channel rocks keep their existing separate behavior.
 * The worker can use this module without importing THREE or a renderer.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 05:38:16
 * Dependents: systems/world3d/river/riverReach.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface BoulderShapeInput {
  x: number; y: number; z: number; rx: number; ry: number; rz: number;
  rot: number; seed: number;
}
export interface BoulderMeshShape {
  positions: Float32Array; indices: Uint16Array;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  heightAt(x: number, z: number): number;
  /** Actual waterline, or projected silhouette when wholly submerged. */
  contactAt(level: number, dx: number, dz: number): {
    upstream: [number, number]; downstream: [number, number];
    left: [number, number]; right: [number, number]; radius: number;
  };
}
type V = [number, number, number];
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Same triangular lattice and position-only merge as THREE's detail 2/3 ico. */
function template(detail: number): { positions: Float32Array; indices: Uint16Array } {
  const t = (1 + Math.sqrt(5)) / 2;
  const v: V[] = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
  const faces = [0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];
  const positions: number[] = [], indices: number[] = [], seen = new Map<string, number>();
  const push = (p: V) => {
    const inv = 1 / Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
    const q = p.map(c => Math.fround(c * inv));
    const key = q.map(c => ~~(c * 10000 + 0.5)).join(',');
    let index = seen.get(key);
    if (index === undefined) { index = positions.length / 3; seen.set(key, index); positions.push(...q); }
    indices.push(index);
  };
  const cols = detail + 1;
  for (let f = 0; f < faces.length; f += 3) {
    const a = v[faces[f]], b = v[faces[f + 1]], c = v[faces[f + 2]], rows: V[][] = [];
    for (let i = 0; i <= cols; i++) {
      const aj = lerp(a, c, i / cols), bj = lerp(b, c, i / cols);
      rows[i] = [];
      for (let j = 0; j <= cols - i; j++) rows[i][j] = i === cols ? aj : lerp(aj, bj, j / (cols - i));
    }
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2 * (cols - i) - 1; j++) {
      const k = Math.floor(j / 2);
      push(rows[i][k + 1]);
      if (j % 2 === 0) { push(rows[i + 1][k]); push(rows[i][k]); }
      else { push(rows[i + 1][k + 1]); push(rows[i + 1][k]); }
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}
const bases = [template(2), template(3)];

/** Inject the reach's unchanged noise functions to avoid a circular import. */
export function createBoulderShapeCache(random: (seed: number) => () => number,
  noise: (x: number, z: number, seed: number) => number): (b: BoulderShapeInput) => BoulderMeshShape {
  // Bound retained world meshes, including rocks moved repeatedly by the editor.
  const cache = new Map<string, BoulderMeshShape>();
  return b => {
    const key = [b.seed,b.rx,b.ry,b.rz,b.rot,b.x,b.y,b.z].join('/');
    const old = cache.get(key);
    if (old) { cache.delete(key); cache.set(key, old); return old; }
    const base = bases[Math.max(b.rx, b.rz) >= 0.8 ? 1 : 0];
    const positions = new Float32Array(base.positions.length), indices = base.indices;
    const rr = random(b.seed ^ 0x2c1b), cuts: Array<[number,number,number,number]> = [];
    const nCuts = 4 + Math.floor(rr() * 4), flatTop = ((b.seed >>> 3) % 5) === 0 ? 0.55 : 1;
    for (let c = 0; c < nCuts; c++) {
      const th = rr() * Math.PI * 2, ph = Math.acos(rr() * 1.6 - 0.6);
      cuts.push([Math.sin(ph) * Math.cos(th),Math.cos(ph),Math.sin(ph) * Math.sin(th),0.45 + 0.35 * rr()]);
    }
    const bounds = { minX: Infinity,maxX: -Infinity,minY: Infinity,maxY: -Infinity,minZ: Infinity,maxZ: -Infinity };
    for (let k = 0; k < positions.length; k += 3) {
      let x = base.positions[k], y = base.positions[k + 1], z = base.positions[k + 2];
      for (const [cx,cy,cz,cd] of cuts) {
        const dp = x * cx + y * cy + z * cz;
        if (dp > cd) { const back = (dp - cd) * 0.92; x -= cx * back; y -= cy * back; z -= cz * back; }
      }
      const bump = 1 + 0.14 * noise(x * 1.4 + b.seed % 97,z * 1.4 + y * 1.2,b.seed & 0xffff)
        + 0.05 * noise(x * 4.5 + y * 2.5,z * 4.5,(b.seed >> 3) & 0xffff);
      const lx = x * b.rx * bump, lz = z * b.rz * bump;
      let ly = y * b.ry * bump;
      if (ly < 0) ly *= 0.6;
      else if (ly > b.ry * flatTop) ly = b.ry * flatTop + (ly - b.ry * flatTop) * 0.15;
      positions[k] = b.x + (lx * Math.cos(b.rot) - lz * Math.sin(b.rot));
      positions[k + 1] = b.y + ly;
      positions[k + 2] = b.z + (lx * Math.sin(b.rot) + lz * Math.cos(b.rot));
      bounds.minX = Math.min(bounds.minX,positions[k]); bounds.maxX = Math.max(bounds.maxX,positions[k]);
      bounds.minY = Math.min(bounds.minY,positions[k+1]); bounds.maxY = Math.max(bounds.maxY,positions[k+1]);
      bounds.minZ = Math.min(bounds.minZ,positions[k+2]); bounds.maxZ = Math.max(bounds.maxZ,positions[k+2]);
    }
    const size = 8, bins: number[][] = Array.from({length: size * size}, () => []);
    const binX = (x: number) => Math.max(0,Math.min(size-1,Math.floor((x-bounds.minX)/(bounds.maxX-bounds.minX)*size)));
    const binZ = (z: number) => Math.max(0,Math.min(size-1,Math.floor((z-bounds.minZ)/(bounds.maxZ-bounds.minZ)*size)));
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t]*3, c = indices[t+1]*3, d = indices[t+2]*3;
      for (let j = binZ(Math.min(positions[a+2],positions[c+2],positions[d+2])); j <= binZ(Math.max(positions[a+2],positions[c+2],positions[d+2])); j++)
        for (let i = binX(Math.min(positions[a],positions[c],positions[d])); i <= binX(Math.max(positions[a],positions[c],positions[d])); i++) bins[j*size+i].push(t);
    }
    const shape: BoulderMeshShape = { positions, indices, bounds,
      heightAt(x,z) {
        if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return -Infinity;
        let top = -Infinity;
        for (const t of bins[binZ(z)*size+binX(x)]) {
          const a = indices[t]*3, c = indices[t+1]*3, d = indices[t+2]*3;
          const ax = positions[a], az = positions[a+2], cx = positions[c]-ax, cz = positions[c+2]-az, dx = positions[d]-ax, dz = positions[d+2]-az;
          const det = cx*dz-dx*cz;
          if (Math.abs(det) < 1e-14) continue;
          const u = ((x-ax)*dz-dx*(z-az))/det, v = (cx*(z-az)-(x-ax)*cz)/det;
          if (u >= -1e-9 && v >= -1e-9 && u+v <= 1+1e-9) top = Math.max(top,positions[a+1]+u*(positions[c+1]-positions[a+1])+v*(positions[d+1]-positions[a+1]));
        }
        return top;
      },
      contactAt(level,dx,dz) {
        const points: Array<[number,number]> = [];
        for (let t = 0; t < indices.length; t += 3) for (let e = 0; e < 3; e++) {
          const a = indices[t+e]*3, c = indices[t+(e+1)%3]*3, ya = positions[a+1], yc = positions[c+1];
          if ((ya <= level && yc > level) || (yc <= level && ya > level)) {
            const f = (level-ya)/(yc-ya); points.push([positions[a]+(positions[c]-positions[a])*f,positions[a+2]+(positions[c+2]-positions[a+2])*f]);
          }
        }
        if (!points.length) for (let i = 0; i < positions.length; i += 3) points.push([positions[i],positions[i+2]]);
        const support = (x: number,z: number): [number,number] => points.reduce((best,p) => p[0]*x+p[1]*z > best[0]*x+best[1]*z ? p : best);
        return { upstream: support(-dx,-dz),downstream: support(dx,dz),left: support(-dz,dx),right: support(dz,-dx),
          radius: Math.max(...points.map(p => Math.hypot(p[0]-b.x,p[1]-b.z))) };
      }
    };
    cache.set(key,shape);
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
    return shape;
  };
}
