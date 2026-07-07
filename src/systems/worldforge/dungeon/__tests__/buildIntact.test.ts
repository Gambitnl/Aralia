import { describe, it, expect } from 'vitest';
import { buildIntact, makeRng, type IntactState } from '../buildIntact';
import { streamPath, rootSeedPath, childSeedPath } from '../../seedPath';
import { ARCHETYPES } from '../archetypes';
import { CellKind, type BuilderArchetype } from '../types';
import { generateDungeon } from '../generateDungeon';

/** Tight bounding box over all non-void cells; aspect = longer / shorter side. */
function boundingAspect(st: IntactState): number {
  const { side, grid } = st;
  let minX = side, minY = side, maxX = 0, maxY = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === CellKind.Void) continue;
    const x = i % side;
    const y = (i / side) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return Math.max(w, h) / Math.min(w, h);
}

/**
 * Count DEAD-END corridor cells — the honest "no corridor terminates without a
 * room" invariant. A corridor cell (roomOf === -2) is a dead end when it serves
 * no doorway (no 4-neighbor is a room floor) AND is a leaf of the corridor graph
 * (≤ 1 corridor 4-neighbor). Zero of these means every corridor run ends at a
 * room, not in the void.
 */
function deadEndCorridorCells(st: IntactState): number {
  const { side, grid, roomOf } = st;
  const isCorridor = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= side || y >= side) return false;
    const k = y * side + x;
    return grid[k] === CellKind.Floor && roomOf[k] === -2;
  };
  const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  let count = 0;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (!isCorridor(x, y)) continue;
      let touchesRoom = false;
      let corridorNeighbors = 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= side || ny >= side) continue;
        if (roomOf[ny * side + nx] >= 0) touchesRoom = true;
        if (isCorridor(nx, ny)) corridorNeighbors++;
      }
      if (!touchesRoom && corridorNeighbors <= 1) count++;
    }
  }
  return count;
}

const rngFor = (seed: number, arch: string) =>
  makeRng(streamPath(childSeedPath(rootSeedPath(seed), 'dungeon'), `build:${arch}`));

/** The dedicated 'circulation' sub-stream the generator feeds addBuiltLoops. */
const circRngFor = (seed: number) =>
  makeRng(streamPath(childSeedPath(rootSeedPath(seed), 'dungeon'), 'circulation'));

/** Graph diameter proxy: longest shortest-path from the entrance (crit-path
 * upper bound). Counts rooms on the deepest entrance→room path. */
function critPathRooms(st: IntactState): number {
  const n = st.rooms.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of st.edges) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
  const dist = new Array<number>(n).fill(-1);
  const q = [st.entranceId];
  dist[st.entranceId] = 0;
  for (let h = 0; h < q.length; h++) {
    for (const v of adj[q[h]]) if (dist[v] === -1) { dist[v] = dist[q[h]] + 1; q.push(v); }
  }
  // criticalLength is a room COUNT along the path = maxDepth + 1.
  return Math.max(...dist.filter((d) => d >= 0)) + 1;
}

/**
 * Circulation classification (Remy critique #1: PRIMARY circulation must be
 * room-through-room, not a corridor conga line where every room is a leaf off a
 * hall). For each graph edge we measure the CORRIDOR-CELL length of the physical
 * connection between its two endpoint rooms: a BFS over floor that is free inside
 * either endpoint room and costs 1 per corridor cell (roomOf === -2) traversed.
 *
 *  - room-to-room door: an edge whose endpoints connect with ≤ 1 corridor cell
 *    (a shared-wall door). A room is "room-to-room" if it has ≥ 1 such edge.
 *  - corridor-only leaf: a degree-1 room whose single edge needs ≥ 2 corridor
 *    cells (it hangs off a hall, the pattern we are retiring).
 */
function circulationShares(st: IntactState): { r2r: number; corridorLeaf: number } {
  const { side: S, grid, roomOf, rooms, edges } = st;
  const n = rooms.length;
  const cells: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < roomOf.length; i++) { const r = roomOf[i]; if (r >= 0) cells[r].push(i); }
  const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const isFloor = (k: number): boolean => grid[k] === CellKind.Floor;

  const edgeCorLen = (a: number, b: number): number => {
    if (!cells[a].length || !cells[b].length) return Infinity;
    const goal = new Set(cells[b]);
    const dist = new Map<number, number>();
    const q: number[] = [];
    for (const s of cells[a]) { dist.set(s, 0); q.push(s); }
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      const d = dist.get(c)!;
      if (goal.has(c)) return d;
      const x = c % S;
      const y = (c / S) | 0;
      for (const [dx, dy] of N4) {
        const nk = (y + dy) * S + (x + dx);
        if (dist.has(nk) || !isFloor(nk)) continue;
        const owner = roomOf[nk];
        if (owner === a || owner === b || owner === -2) { dist.set(nk, owner === -2 ? d + 1 : d); q.push(nk); }
      }
    }
    return Infinity;
  };

  const roomToRoom = new Set<number>();
  const deg = new Array<number>(n).fill(0);
  const edgeVia: Array<{ a: number; b: number; corLen: number }> = [];
  for (const e of edges) {
    deg[e.a]++; deg[e.b]++;
    const corLen = edgeCorLen(e.a, e.b);
    edgeVia.push({ a: e.a, b: e.b, corLen });
    if (corLen <= 1) { roomToRoom.add(e.a); roomToRoom.add(e.b); }
  }
  let corridorLeaf = 0;
  for (let r = 0; r < n; r++) {
    if (deg[r] !== 1) continue;
    const e = edgeVia.find((ev) => ev.a === r || ev.b === r);
    if (e && e.corLen >= 2) corridorLeaf++;
  }
  return { r2r: roomToRoom.size / n, corridorLeaf: corridorLeaf / n };
}

/** Total carved corridor cells (roomOf === -2 floor). */
function corridorCellCount(st: IntactState): number {
  let n = 0;
  for (let i = 0; i < st.grid.length; i++) {
    if (st.grid[i] === CellKind.Floor && st.roomOf[i] === -2) n++;
  }
  return n;
}

/**
 * Mean corridor-cell length of NON-shared-wall edges — an edge whose physical
 * connection runs through ≥ 1 corridor cell. Reuses circulationShares' BFS cost
 * model (1 per corridor cell). Shared-wall doors (0 corridor cells) are excluded
 * so this measures the length of the runs that actually exist.
 */
function meanCorridorEdgeLen(st: IntactState): number {
  const { side: S, grid, roomOf, rooms, edges } = st;
  const n = rooms.length;
  const cells: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < roomOf.length; i++) { const r = roomOf[i]; if (r >= 0) cells[r].push(i); }
  const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const isFloor = (k: number): boolean => grid[k] === CellKind.Floor;
  const edgeCorLen = (a: number, b: number): number => {
    if (!cells[a].length || !cells[b].length) return Infinity;
    const goal = new Set(cells[b]);
    const dist = new Map<number, number>();
    const q: number[] = [];
    for (const s of cells[a]) { dist.set(s, 0); q.push(s); }
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      const d = dist.get(c)!;
      if (goal.has(c)) return d;
      const x = c % S;
      const y = (c / S) | 0;
      for (const [dx, dy] of N4) {
        const nk = (y + dy) * S + (x + dx);
        if (dist.has(nk) || !isFloor(nk)) continue;
        const owner = roomOf[nk];
        if (owner === a || owner === b || owner === -2) { dist.set(nk, owner === -2 ? d + 1 : d); q.push(nk); }
      }
    }
    return Infinity;
  };
  let sum = 0;
  let count = 0;
  for (const e of edges) {
    const l = edgeCorLen(e.a, e.b);
    if (l !== Infinity && l >= 1) { sum += l; count++; }
  }
  return count === 0 ? 0 : sum / count;
}

const ARCHS = Object.keys(ARCHETYPES) as BuilderArchetype[];

describe('buildIntact', () => {
  it('places every core purpose its declared number of times, entrance first', () => {
    for (const arch of ARCHS) {
      const st = buildIntact(rngFor(42, arch), arch, 24);
      expect(st).not.toBeNull();
      // A core spec MAY repeat a purpose (waterworks lists 'cistern' twice — two
      // real cisterns, exactly as the approved mock). Each core instance keeps
      // its declared purpose, so the count of a core purpose equals the number of
      // core specs that declare it. Group the core array by purpose and assert
      // equality (not blanket "exactly one").
      const expected = new Map<string, number>();
      for (const spec of ARCHETYPES[arch].core) {
        expected.set(spec.purpose, (expected.get(spec.purpose) ?? 0) + 1);
      }
      for (const [purpose, count] of expected) {
        expect(st!.rooms.filter((r) => r.purpose === purpose).length).toBe(count);
      }
      expect(st!.rooms[st!.entranceId].purpose).toBe(ARCHETYPES[arch].core[0].purpose);
    }
  });
  it('builds two real cisterns for the waterworks (mock parity, no relabel)', () => {
    const st = buildIntact(rngFor(42, 'waterworks'), 'waterworks', 24)!;
    expect(st.rooms.filter((r) => r.purpose === 'cistern').length).toBe(2);
  });
  it('starts BOTH cisterns and ≥1 channel corridor cell wet (mock 5 water identity)', () => {
    // The waterworks archetype's identity is WATER: two water-filled cisterns fed
    // by visible channels (approved mock figure 5). buildIntact must seed
    // st.builtWater with every cistern basin floor AND the connector corridor
    // cells (the channels) — the sim later stamps these unconditionally as Water.
    // A prior composition fix left the cisterns dry and trimmed the channel stub
    // away, so the sheet rendered with ZERO water. Pin the built-wet baseline over
    // the standard seed set so that regression cannot come back silently.
    for (const seed of [1, 7, 42, 1337]) {
      const st = buildIntact(rngFor(seed, 'waterworks'), 'waterworks', 44)!;
      const cisterns = st.rooms.filter((r) => r.purpose === 'cistern');
      expect(cisterns.length, `seed ${seed} cistern count`).toBe(2);
      // Every cistern has at least most of its basin floor in builtWater.
      for (const c of cisterns) {
        let basinFloor = 0;
        let basinWet = 0;
        for (let j = 0; j < c.h; j++) {
          for (let i = 0; i < c.w; i++) {
            if (c.mask[j * c.w + i] !== 1) continue;
            basinFloor++;
            const k = (c.y0 + j) * st.side + (c.x0 + i);
            if (st.builtWater.has(k)) basinWet++;
          }
        }
        expect(basinFloor, `seed ${seed} cistern ${c.id} floor`).toBeGreaterThan(0);
        expect(basinWet, `seed ${seed} cistern ${c.id} wet`).toBe(basinFloor);
      }
      // At least one WET CHANNEL cell: a built-wet cell that is a corridor
      // (roomOf === -2), not a room floor — the connector the water runs along.
      let wetChannel = 0;
      for (const k of st.builtWater) if (st.roomOf[k] === -2) wetChannel++;
      expect(wetChannel, `seed ${seed} wet channel cells`).toBeGreaterThan(0);
    }
  });
  it('keeps the entrance at graph degree exactly 1 (no core fallback onto it)', () => {
    for (const arch of ARCHS) {
      const st = buildIntact(rngFor(42, arch), arch, 44)!;
      const deg = st.edges.filter((e) => e.a === st.entranceId || e.b === st.entranceId).length;
      expect(deg).toBe(1);
    }
  });
  it('builds at the production/acceptance room counts (44, 60) for every archetype', () => {
    for (const arch of ARCHS) {
      for (const count of [44, 60]) {
        const st = buildIntact(rngFor(42, arch), arch, count);
        expect(st, `${arch} @ ${count}`).not.toBeNull();
        expect(st!.rooms.length).toBeGreaterThanOrEqual(Math.floor(count * 0.7));
        // DEFECT A: the intact structure is a tree PLUS built circulation loops
        // (isLoop edges) — never a pure tree. edges === rooms-1 + builtLoops,
        // builtLoops ≥ 1. All isLoop edges at this stage are BUILT (dug is set
        // only later by the tunnel event), so counting isLoop counts built loops.
        const builtLoops = st!.edges.filter((e) => e.isLoop).length;
        expect(builtLoops, `${arch} @ ${count} built loops`).toBeGreaterThanOrEqual(1);
        expect(st!.edges.length).toBe(st!.rooms.length - 1 + builtLoops);
      }
    }
  });
  it('reaches the requested room count within tolerance and stays a connected tree+loops graph', () => {
    for (const arch of ARCHS) {
      const st = buildIntact(rngFor(7, arch), arch, 24)!;
      expect(st.rooms.length).toBeGreaterThanOrEqual(Math.floor(24 * 0.7));
      // Tree skeleton + built circulation loops (DEFECT A): edges === rooms-1 +
      // builtLoops, with builtLoops ≥ 1 (never a pure tree, even at loopChance 0).
      const builtLoops = st.edges.filter((e) => e.isLoop).length;
      expect(builtLoops, `${arch} built loops`).toBeGreaterThanOrEqual(1);
      expect(st.edges.length).toBe(st.rooms.length - 1 + builtLoops);
    }
  });
  it('lays the mausoleum out as a compact winged block, not a 1-D worm (aspect < 2.2 @ 44)', () => {
    // DEFECT 1 regression: the old single-spine layout ran off as an endless
    // chain (aspect well over 2:1). The boustrophedon lane growth keeps the
    // bounding box near-square. Checked across the standard seed set so a single
    // lucky seed can't hide a regression.
    for (const seed of [1, 7, 42, 1337, 99999]) {
      const st = buildIntact(rngFor(seed, 'mausoleum'), 'mausoleum', 44)!;
      expect(st, `mausoleum seed ${seed}`).not.toBeNull();
      expect(boundingAspect(st), `mausoleum aspect seed ${seed}`).toBeLessThan(2.2);
    }
  });
  it('leaves NO dead-end corridor to nowhere in any archetype (DEFECT 2 & 3)', () => {
    // Every carved corridor/spine/channel run must terminate at a room (doorway)
    // or a junction — never floating in the void. The post-placement trim peels
    // back any unserved run; assert none survive across the full sweep.
    for (const arch of ARCHS) {
      for (const count of [24, 44, 60]) {
        for (const seed of [1, 7, 42, 1337, 99999]) {
          const st = buildIntact(rngFor(seed, arch), arch, count);
          if (!st) continue; // an honest shortfall is allowed; a dangling run is not
          expect(deadEndCorridorCells(st), `${arch} @${count} seed ${seed}`).toBe(0);
        }
      }
    }
  });
  it('opens ≥1 BUILT loop at loopChance 0.25 for every archetype and seed (DEFECT A)', () => {
    // Built circulation: the intact structure is never a pure tree. At the default
    // density every archetype must open at least one built cross-cut (isLoop edge,
    // dug unset) over the standard seed set.
    for (const arch of ARCHS) {
      for (const seed of [1, 7, 42, 1337]) {
        const st = buildIntact(rngFor(seed, arch), arch, 42, 0.25, circRngFor(seed))!;
        expect(st, `${arch} seed ${seed}`).not.toBeNull();
        const loops = st.edges.filter((e) => e.isLoop && !e.dug);
        expect(loops.length, `${arch} seed ${seed} built loops`).toBeGreaterThanOrEqual(1);
        // A built loop is a CYCLE edge: both endpoints are already tree-connected,
        // and NEITHER may be the entrance (entrance stays degree 1).
        for (const e of loops) {
          expect(e.a, `${arch} seed ${seed} loop touches entrance`).not.toBe(st.entranceId);
          expect(e.b, `${arch} seed ${seed} loop touches entrance`).not.toBe(st.entranceId);
        }
      }
    }
  });
  it('keeps the critical path ≤ 0.7 × rooms at 42 rooms (DEFECT A2 — no conga line)', () => {
    // The mine used to string every gallery in one drift so crit path ≈ room
    // count. Branched drifts + hub/wing topology keep the entrance→deepest path
    // well under the room count for every archetype.
    for (const arch of ARCHS) {
      for (const seed of [1, 7, 42, 1337]) {
        const st = buildIntact(rngFor(seed, arch), arch, 42, 0.25, circRngFor(seed))!;
        const ratio = critPathRooms(st) / st.rooms.length;
        expect(ratio, `${arch} seed ${seed} crit-path ratio ${ratio.toFixed(2)}`).toBeLessThanOrEqual(0.7);
      }
    }
  });
  it('gives the mine ≥4 leaf rooms — branched drifts, not one chain (DEFECT A2)', () => {
    for (const seed of [1, 7, 42, 1337]) {
      const st = buildIntact(rngFor(seed, 'mine'), 'mine', 42, 0.25, circRngFor(seed))!;
      const n = st.rooms.length;
      const deg = new Array<number>(n).fill(0);
      for (const e of st.edges) { deg[e.a]++; deg[e.b]++; }
      const leaves = deg.filter((d) => d === 1).length;
      expect(leaves, `mine seed ${seed} leaves`).toBeGreaterThanOrEqual(4);
    }
  });
  it('varies mine gallery sizes across distinct size classes (DEFECT B — no egg carton)', () => {
    // The vein-galleries must span a wide area band (small pockets through large
    // chambers), not roll from one narrow ellipse size. Bucket gallery floor areas
    // into small/medium/large classes and require at least two classes present.
    for (const seed of [1, 7, 42, 1337]) {
      const st = buildIntact(rngFor(seed, 'mine'), 'mine', 42, 0.25, circRngFor(seed))!;
      const galleries = st.rooms.filter((r) => r.purpose === 'vein-gallery');
      expect(galleries.length, `seed ${seed} galleries`).toBeGreaterThan(3);
      const classes = new Set<string>();
      for (const g of galleries) {
        const a = g.area;
        classes.add(a <= 45 ? 'small' : a <= 90 ? 'medium' : 'large');
      }
      expect(classes.size, `seed ${seed} distinct size classes {${[...classes].join(',')}}`)
        .toBeGreaterThanOrEqual(2);
    }
  });
  it('makes PRIMARY circulation room-through-room at sprawl 0 (tight pole)', () => {
    // Remy critique #1: the player must move THROUGH rooms, not walk a hall poking
    // into leaf rooms. These are the TIGHT-POLE metrics — asserted at sprawl 0
    // explicitly (pinned, not relying on the default) so the sprawl dial can move
    // circulation the other way without this regressing. For every archetype at 42
    // rooms across the standard seed set: ≥ 45% of rooms have at least one room-to-
    // room door (shared-wall, ≤ 1 corridor cell), and ≤ 40% of rooms are corridor-
    // only leaves. The mausoleum was the worst offender (galleries hung off the
    // spine); it now builds chained gallery WINGS entered room → room → room.
    for (const arch of ARCHS) {
      for (const seed of [1, 7, 42, 1337]) {
        const st = buildIntact(rngFor(seed, arch), arch, 42, 0.25, circRngFor(seed), 0)!;
        const { r2r, corridorLeaf } = circulationShares(st);
        expect(r2r, `${arch} seed ${seed} room-to-room share ${(r2r * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(0.45);
        expect(corridorLeaf, `${arch} seed ${seed} corridor-leaf share ${(corridorLeaf * 100).toFixed(0)}%`).toBeLessThanOrEqual(0.40);
      }
    }
  });
  it('is deterministic', () => {
    for (const arch of ARCHS) {
      const a = buildIntact(rngFor(1337, arch), arch, 20)!;
      const b = buildIntact(rngFor(1337, arch), arch, 20)!;
      expect(Buffer.from(a.grid).equals(Buffer.from(b.grid))).toBe(true);
    }
  });

  it('SPRAWL 1.0: long corridor runs, ≥2× the corridor cells, invariants hold', () => {
    // The sprawl pole (Gozzys reference): rooms float apart, connected by LONG
    // corridor runs. Across 4 archetypes × the standard seed set at 42 rooms:
    //  - mean corridor length per non-shared-wall edge ≥ 4 cells (long runs),
    //  - total corridor cells ≥ 2× the sprawl-0 count (rooms are farther apart),
    //  - every standing invariant still holds (connected, entrance degree 1,
    //    ≥ 1 built loop, crit ≤ 0.7 × rooms, no dead-end corridors).
    for (const arch of ARCHS) {
      for (const seed of [1, 7, 42]) {
        const tight = buildIntact(rngFor(seed, arch), arch, 42, 0.25, circRngFor(seed), 0)!;
        const sprawl = buildIntact(rngFor(seed, arch), arch, 42, 0.25, circRngFor(seed), 1)!;
        expect(sprawl, `${arch} seed ${seed} sprawl built`).not.toBeNull();

        const meanLen = meanCorridorEdgeLen(sprawl);
        expect(meanLen, `${arch} seed ${seed} mean corridor edge length ${meanLen.toFixed(1)}`)
          .toBeGreaterThanOrEqual(4);

        const tightCells = corridorCellCount(tight);
        const sprawlCells = corridorCellCount(sprawl);
        expect(sprawlCells, `${arch} seed ${seed} corridor cells sprawl ${sprawlCells} vs tight ${tightCells}`)
          .toBeGreaterThanOrEqual(tightCells * 2);

        // Entrance degree exactly 1.
        const entDeg = sprawl.edges.filter((e) => e.a === sprawl.entranceId || e.b === sprawl.entranceId).length;
        expect(entDeg, `${arch} seed ${seed} entrance degree`).toBe(1);

        // At least one built loop (never a pure tree).
        const loops = sprawl.edges.filter((e) => e.isLoop);
        expect(loops.length, `${arch} seed ${seed} built loops`).toBeGreaterThanOrEqual(1);

        // Room graph connected (BFS from entrance reaches every room).
        const n = sprawl.rooms.length;
        const adj: number[][] = Array.from({ length: n }, () => []);
        for (const e of sprawl.edges) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
        const dist = new Array<number>(n).fill(-1);
        const q = [sprawl.entranceId];
        dist[sprawl.entranceId] = 0;
        for (let h = 0; h < q.length; h++) {
          for (const v of adj[q[h]]) if (dist[v] === -1) { dist[v] = dist[q[h]] + 1; q.push(v); }
        }
        expect(dist.filter((d) => d >= 0).length, `${arch} seed ${seed} connected`).toBe(n);

        // Critical path ≤ 0.7 × rooms.
        const ratio = critPathRooms(sprawl) / n;
        expect(ratio, `${arch} seed ${seed} crit-path ratio ${ratio.toFixed(2)}`).toBeLessThanOrEqual(0.7);

        // No dead-end corridors.
        expect(deadEndCorridorCells(sprawl), `${arch} seed ${seed} dead ends`).toBe(0);
      }
    }
  });

  it('SPRAWL: full generateDungeon pipeline is 100% reachable at sprawl 1', () => {
    // The end-to-end guard: after history/crop/rasterize the sprawled plan must
    // still flood-fill every floor cell from the entrance (generateDungeon throws
    // honestly otherwise, so a returned plan already passed — assert it directly).
    const themes = ['crypt', 'cavern', 'frost', 'sewer'] as const;
    for (const theme of themes) {
      for (const seed of [1, 7, 42]) {
        const plan = generateDungeon({ seed, params: { roomCount: 42, sprawl: 1, theme } });
        const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
        const { W, H, grid } = plan;
        let start = -1;
        for (let i = 0; i < grid.length && start < 0; i++) if (grid[i] === CellKind.Floor) start = i;
        const seen = new Uint8Array(grid.length);
        const q = [start];
        seen[start] = 1;
        for (let h = 0; h < q.length; h++) {
          const c = q[h];
          const x = c % W;
          const y = (c / W) | 0;
          for (const [dx, dy] of N4) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const nk = ny * W + nx;
            if (!seen[nk] && grid[nk] === CellKind.Floor) { seen[nk] = 1; q.push(nk); }
          }
        }
        let floor = 0;
        let reached = 0;
        for (let i = 0; i < grid.length; i++) if (grid[i] === CellKind.Floor) { floor++; if (seen[i]) reached++; }
        expect(reached, `${theme} seed ${seed} reachable ${reached}/${floor}`).toBe(floor);
      }
    }
  });

  it('SPRAWL is deterministic: same seed + explicit sprawl ⇒ identical grid', () => {
    for (const arch of ARCHS) {
      for (const s of [0, 0.5, 1] as const) {
        const a = buildIntact(rngFor(2024, arch), arch, 30, 0.25, circRngFor(2024), s)!;
        const b = buildIntact(rngFor(2024, arch), arch, 30, 0.25, circRngFor(2024), s)!;
        expect(Buffer.from(a.grid).equals(Buffer.from(b.grid)), `${arch} sprawl ${s}`).toBe(true);
      }
    }
  });

  it('the seeded sprawl default does not perturb other seed streams', () => {
    // The default draw comes from its own 'sprawl' stream. Pinning params.sprawl
    // to the SAME value the default would have produced must yield a byte-identical
    // plan as leaving it unpinned — proving the default's draw is isolated (it does
    // not consume from build/circulation/history/etc.). We read the resolved
    // default from stats, then pin it and compare full grids.
    for (const theme of ['crypt', 'cavern', 'frost', 'sewer'] as const) {
      const auto = generateDungeon({ seed: 555, params: { roomCount: 30, theme } });
      const pinned = generateDungeon({ seed: 555, params: { roomCount: 30, theme, sprawl: auto.stats.sprawl } });
      expect(Buffer.from(auto.grid).equals(Buffer.from(pinned.grid)), `${theme} grid parity`).toBe(true);
      expect(auto.stats.sprawl, `${theme} resolved sprawl reported`).toBeGreaterThanOrEqual(0);
    }
  });
});
