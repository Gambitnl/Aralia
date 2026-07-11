/**
 * @file history/appliers.ts
 * @description Event dispatch + all decay-event appliers + their occupation /
 * tunnel / cycle-edge / reachability helpers — extracted VERBATIM from
 * simulateHistory.ts (packet W1-P6). Every applier returns the logged
 * `DungeonEvent` or `null` (no evidence → excluded), routing its concrete
 * mutations through the recorder so a cutoff replays exactly the right prefix.
 * Move-only: bodies are byte-identical, so each applier draws rng in the same
 * order. Exported for the main loop: `applyEvent` (dispatch), `assertReachable`,
 * and the `builderNoun`/`structureNoun` vocabulary; everything else stays
 * module-internal exactly as it was file-internal in the monolith.
 */

import type { SimCtx } from './context';
import {
  recAddEdge,
  recDoorState,
  recOccupation,
  recOverlay,
  recPlunder,
  recProp,
  recRemoveEdge,
  recWriteCell,
  roomCellsCached,
  roomCenterCell,
} from './recorder';
import { buildAdjacency, graphConnected, graphDepths, neighborsOf } from './graph';
import { gi, roomCx, roomCy, type IntactState, type Room } from '../buildIntact';
import {
  CellKind,
  OverlayKind,
  type BuilderArchetype,
  type DungeonEdge,
  type DungeonEvent,
  type EventKind,
} from '../types';
import { ARCHETYPES } from '../archetypes';

// ─── Event dispatch ──────────────────────────────────────────────────────────

interface PendingEvent {
  id: number;
  kind: EventKind;
  yearsAgo: number;
  isApex: boolean;
  /** Always true in the canonical pass — every event is fully applied (and its
   * concrete mutations recorded into `ctx.rec`). The `asOfYearsAgo` cutoff is not
   * gated HERE; it is realized afterward by restoring the snapshot and replaying
   * only the prefix's recorded deltas. Kept for call-site clarity. Returning null
   * from an applier means "this event left no evidence and is excluded from the
   * log" — a purely structural decision, so identical across every cutoff. */
  apply: boolean;
}

/**
 * Apply one event. Returns the logged `DungeonEvent`, or `null` when the applier
 * could not leave any real evidence (an evidence-less collapse/brick-off/flood) —
 * the caller then re-rolls a replacement kind or drops the slot (F5). The
 * exclusion decision is purely structural and so identical across `asOfYearsAgo`.
 */
export function applyEvent(ctx: SimCtx, p: PendingEvent): DungeonEvent | null {
  const base: DungeonEvent = {
    id: p.id,
    kind: p.kind,
    yearsAgo: p.yearsAgo,
    roomIds: [],
    summary: '',
  };
  switch (p.kind) {
    case 'seal': return applySeal(ctx, p, base);
    case 'collapse': return applyCollapse(ctx, p, base);
    case 'flood': return applyFlood(ctx, p, base);
    case 'tunnel': return applyTunnel(ctx, p, base);
    case 'brick-off': return applyBrickOff(ctx, p, base);
    case 'den': return applyDen(ctx, p, base);
    case 'awaken': return applyAwaken(ctx, p, base);
    case 'plunder': return applyPlunder(ctx, p, base);
    case 'fire': return applyFire(ctx, p, base);
    case 'reoccupy': return applyReoccupy(ctx, p, base);
    case 'bloom': return applyBloom(ctx, p, base);
    default: return base;
  }
}

// ─── Appliers ────────────────────────────────────────────────────────────────

function applySeal(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  // No grid change. Evidence: a snapped bar at the entrance room.
  const entrance = ctx.st.rooms[ctx.st.entranceId];
  const cell = roomCenterCell(ctx, entrance);
  recProp(ctx, { kind: 'snapped-bar', cell, eventRef: p.id, roomId: entrance.id });
  ev.roomIds = [entrance.id];
  ev.summary = `${ctx.builderName} sealed the ${ctx.structureNoun}`;
  return ev;
}

function applyCollapse(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  // Collapse a connectivity-safe cycle corridor — a BUILT cross-cut or a dug
  // tunnel. Collapsing a cycle edge's corridor can never strand floor (the two
  // endpoints keep their tree paths). findCycleEdgeToRemove prefers an intact
  // tunnel, then any built loop whose removal keeps the graph connected.
  const target = findCycleEdgeToRemove(ctx);
  if (!target) {
    // No safe edge to bring down. Per the no-fallback directive a collapse that
    // can leave no rubble the map shows must NOT be logged — exclude it (the
    // caller re-rolls a replacement kind). Returning null is the honest signal.
    return null;
  }
  const tunnel = { edge: target.edge, cells: target.cells };
  const [a, b] = [tunnel.edge.a, tunnel.edge.b];
  const S = ctx.st.side;
  // Rubble spill cells: the surviving FLOOR cells 4-adjacent to the collapsed run
  // (the mouths where the caved-in passage met open floor). Computed BEFORE the
  // walls are stamped so the collapsed cells themselves are still floor here; a
  // Set de-dupes shared mouths. This honors the overlay-on-floor contract — the
  // rubble reads as spilled AT THE SEAL, matching the approved mock, instead of
  // being stamped on the impassable Wall cells the collapse creates.
  const collapsed = new Set(tunnel.cells);
  const spill = new Set<number>();
  for (const cell of tunnel.cells) {
    const x = cell % S;
    const y = (cell / S) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
      const nk = gi(nx, ny, S);
      if (collapsed.has(nk)) continue;
      if (ctx.st.grid[nk] === CellKind.Floor) spill.add(nk);
    }
  }
  // Rubble falls: walls + edge removal + the visible Rubble overlay on the spill,
  // all recorded so a cutoff BEFORE this collapse replays none of it (the passage
  // still stands).
  for (const cell of tunnel.cells) {
    recWriteCell(ctx, cell, CellKind.Wall, 0, -1);
  }
  // Guard: a carved corridor always meets floor at both mouths, so `spill` is
  // non-empty in practice; if it somehow is not, skip the overlay honestly rather
  // than stamp rubble on a wall.
  for (const cell of spill) recOverlay(ctx, cell, OverlayKind.Rubble);
  // Remove the loop edge from the graph (recorded).
  recRemoveEdge(ctx, tunnel.edge);
  // The corridor cells are now Wall, so corridorIntact/loopCorridorCells will
  // never re-pick this edge — no separate spent-bookkeeping needed.
  ev.roomIds = [a, b];
  ev.summary = `the passage between two chambers of the ${ctx.structureNoun} caved in`;
  return ev;
}

function applyFlood(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  const data = ARCHETYPES[ctx.archetype];
  const floodable = ctx.st.rooms.filter(
    (r) => data.floodable.includes(r.purpose) && r.id !== ctx.st.entranceId,
  );
  if (floodable.length === 0) {
    // No room can hold water — a flood here would stamp nothing. Exclude it (the
    // caller re-rolls) rather than narrate water the map never shows.
    return null;
  }
  const n = Math.min(floodable.length, ctx.rng.int(1, 2));
  const picked = pickDistinct(ctx, floodable, n);
  const ids: number[] = [];
  for (const r of picked) {
    for (const cell of roomCellsCached(ctx, r.id)) recOverlay(ctx, cell, OverlayKind.Water);
    ids.push(r.id);
  }
  ev.roomIds = ids;
  ev.summary = `flooding drowned the lower ${ctx.structureNoun}`;
  return ev;
}

function applyTunnel(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  // Two rooms ≥ 3 graph hops apart, NEITHER the entrance. Carve a rough 1-wide
  // corridor through void between their nearest wall cells (a void BFS with the
  // builder's no-touch guard — so a tunnel adds a real back-way loop without
  // fusing rooms into a blob). Rooms that are FAR in the graph but NEAR in space
  // make the best loops, so order candidate pairs by spatial proximity: the
  // first geometrically-buildable pair wins, which is both stable and reliable.
  const st = ctx.st;
  const adj = buildAdjacency(st.rooms.length, st.edges);
  const depth = graphDepths(st.rooms.length, st.entranceId, adj);
  const candidates = st.rooms.filter((r) => r.id !== st.entranceId && Number.isFinite(depth[r.id]));

  // Build the eligible pairs (≥ 3 graph hops apart), sorted nearest-first in
  // space. Deterministic: the pair list order is a pure function of the (seed-
  // fixed) geometry, so the tunnel a given seed digs never depends on draw luck.
  const pairs: Array<{ a: Room; b: Room; d2: number }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    const hopA = graphDepths(st.rooms.length, a.id, adj);
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      const hop = hopA[b.id];
      if (!Number.isFinite(hop) || hop < 3) continue;
      const dx = roomCx(a) - roomCx(b);
      const dy = roomCy(a) - roomCy(b);
      pairs.push({ a, b, d2: dx * dx + dy * dy });
    }
  }
  pairs.sort((p1, p2) => p1.d2 - p2.d2 || (p1.a.id - p2.a.id) || (p1.b.id - p2.b.id));

  let tried = 0;
  for (const { a, b } of pairs) {
    if (tried >= 12) break; // brief's 12-attempt geometry budget
    tried++;
    const carved = carveTunnel(ctx, a, b);
    if (carved) {
      // dug:true marks this cycle edge as a HAND-CUT robber tunnel (vs a clean
      // BUILT cross-cut, which leaves `dug` unset) — the drawer's rough wobble
      // treatment keys on `dug`.
      const edge: DungeonEdge = { a: a.id, b: b.id, isLoop: true, isCritical: false, dug: true };
      recAddEdge(ctx, edge);
      ctx.tunnels.push({ edge, cells: carved });
      // Evidence: spoil heaps at each tunnel MOUTH — the first carved cell hugging
      // `a` (carved[0], the oldest endpoint) and the last hugging `b`
      // (carved[last]). Both carry the digging event's ref, so a successful tunnel
      // is self-evidencing (F4), and both ride the same crop/remap path as every
      // other evidence prop. Guard the degenerate 1-cell carve (both mouths same
      // cell) so we never stack two props on one cell.
      recProp(ctx, { kind: 'tunnel-mouth', cell: carved[0], eventRef: p.id, roomId: a.id });
      const bMouth = carved[carved.length - 1];
      if (bMouth !== carved[0]) {
        recProp(ctx, { kind: 'tunnel-mouth', cell: bMouth, eventRef: p.id, roomId: b.id });
      }
      ev.roomIds = [a.id, b.id];
      ev.summary = `grave robbers tunneled a back way into the ${ctx.structureNoun}`;
      return ev;
    }
  }
  // Rejected after the geometry budget — no clean path. This is NOT a phantom:
  // the failed dig leaves real evidence (a tool-scarred wall + pick-scar prop),
  // so it stays in the log, marked `failed` so lore branches to the "tried and
  // gave up" family without sniffing the summary string (F5).
  const scarRoom = deepestRoom(ctx);
  if (!scarRoom) {
    // No deep room to scar — genuinely nothing to show. Exclude honestly.
    return null;
  }
  recProp(ctx, {
    kind: 'pick-scars', cell: roomCenterCell(ctx, scarRoom), eventRef: p.id, roomId: scarRoom.id,
  });
  ev.roomIds = [scarRoom.id];
  ev.failed = true;
  ev.summary = `robbers gouged at the walls of the ${ctx.structureNoun} but found no way through`;
  return ev;
}

function applyBrickOff(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  // Wall up a door on a CYCLE (removing its graph edge keeps the graph
  // connected). A cycle always exists — a BUILT cross-cut or a dug tunnel — so
  // findCycleEdgeToRemove returns a built loop as readily as a robber tunnel.
  const st = ctx.st;
  const target = findCycleEdgeToRemove(ctx);
  if (!target) {
    // No back way to wall up — a brick-off here leaves no bricked door for the
    // map to show. Exclude it (the caller re-rolls) rather than emit a phantom.
    return null;
  }
  const tunnel = { edge: target.edge, cells: target.cells };
  // findCycleEdgeToRemove already verified removal keeps the graph connected.
  // Brick the tunnel's mid cell (the "door" of the back way): impassable wall.
  const mid = tunnel.cells[tunnel.cells.length >> 1];
  // The rest of the corridor stays floor but is now a dead-end stub touching the
  // wall — remove those stub cells too so no floor is stranded off the graph. All
  // writes recorded so a cutoff BEFORE this brick-off replays none of them (the
  // back way is still open, mid still floor).
  recWriteCell(ctx, mid, CellKind.Wall, 0, -1);
  for (const cell of tunnel.cells) {
    if (cell === mid) continue;
    recWriteCell(ctx, cell, CellKind.Wall, 0, -1);
  }
  // The bricked door state is the visible evidence.
  recDoorState(ctx, mid, 'bricked', p.id);
  // Remove the loop edge; the back way is closed (recorded).
  recRemoveEdge(ctx, tunnel.edge);
  tunnel.cells = [];
  // With probability 0.5, mark ONE other door of the same wing 'secret'
  // (the forgotten back way). Use an entrance-side door of one endpoint room.
  // The draw happens in the canonical pass; its stamp is recorded (replayed only
  // if this event is in the prefix).
  const secretRoll = ctx.rng.chance(0.5);
  if (secretRoll) {
    const secretCell = roomCenterCell(ctx, st.rooms[tunnel.edge.a]);
    if (!ctx.doorStates.has(secretCell)) {
      recDoorState(ctx, secretCell, 'secret', p.id);
    }
  }
  ev.roomIds = [tunnel.edge.a, tunnel.edge.b];
  ev.summary = `masons bricked off the robbers' back way into the ${ctx.structureNoun}`;
  return ev;
}

function applyDen(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  const rooms = pickOccupationRooms(ctx, p.isApex, ctx.rng.int(1, 3));
  for (const r of rooms) {
    recProp(ctx, { kind: 'nest', cell: roomCenterCell(ctx, r), eventRef: p.id, roomId: r.id });
  }
  recOccupation(ctx, { roomIds: rooms.map((r) => r.id), actorKey: ctx.actors.den, eventRef: p.id, isApex: p.isApex });
  ev.roomIds = rooms.map((r) => r.id);
  ev.actorKey = ctx.actors.den;
  ev.summary = `${labelActor(ctx.actors.den)} denned in the deep ${ctx.structureNoun}`;
  return ev;
}

function applyAwaken(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  // All burial-gallery/ossuary rooms (mausoleum) or 2 deep rooms otherwise.
  const graves = ctx.st.rooms.filter(
    (r) => (r.purpose === 'burial-gallery' || r.purpose === 'ossuary') && r.id !== ctx.st.entranceId,
  );
  const rooms = graves.length > 0 ? graves : pickOccupationRooms(ctx, p.isApex, 2);
  for (const r of rooms) {
    recProp(ctx, { kind: 'disturbed-lid', cell: roomCenterCell(ctx, r), eventRef: p.id, roomId: r.id });
  }
  recOccupation(ctx, { roomIds: rooms.map((r) => r.id), actorKey: ctx.actors.undead, eventRef: p.id, isApex: p.isApex });
  ev.roomIds = rooms.map((r) => r.id);
  ev.actorKey = ctx.actors.undead;
  ev.summary = `the ${labelActor(ctx.actors.undead)} of the ${ctx.structureNoun} woke`;
  return ev;
}

function applyPlunder(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  const vault = ctx.st.rooms.find(
    (r) => (r.purpose === 'treasury' || r.purpose === 'cistern' || r.purpose === 'armory') && r.id !== ctx.st.entranceId,
  ) ?? deepestRoom(ctx);
  if (vault) {
    recPlunder(ctx, vault.id);
    const cell = roomCenterCell(ctx, vault);
    recProp(ctx, { kind: 'pried-vault', cell, eventRef: p.id, roomId: vault.id });
    // A trail of dropped coins from the vault toward the entrance.
    for (const c of coinTrail(ctx, vault)) {
      recProp(ctx, { kind: 'dropped-coins', cell: c, eventRef: p.id, roomId: vault.id });
    }
    ev.roomIds = [vault.id];
  }
  ev.summary = `robbers pried open the vaults of the ${ctx.structureNoun}`;
  return ev;
}

function applyFire(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  // 1–2 rooms near the entrance.
  const adj = buildAdjacency(ctx.st.rooms.length, ctx.st.edges);
  const depth = graphDepths(ctx.st.rooms.length, ctx.st.entranceId, adj);
  const near = ctx.st.rooms
    .filter((r) => r.id !== ctx.st.entranceId && Number.isFinite(depth[r.id]))
    .sort((a, b) => depth[a.id] - depth[b.id])
    .slice(0, 4);
  if (near.length === 0) {
    // Nothing to scorch — exclude rather than narrate a fire that left no soot.
    return null;
  }
  const n = Math.min(near.length, ctx.rng.int(1, 2));
  const picked = pickDistinct(ctx, near, n);
  const ids: number[] = [];
  for (const r of picked) {
    for (const cell of roomCellsCached(ctx, r.id)) recOverlay(ctx, cell, OverlayKind.Scorch);
    ids.push(r.id);
  }
  ev.roomIds = ids;
  ev.summary = `fire gutted the near halls of the ${ctx.structureNoun}`;
  return ev;
}

function applyReoccupy(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  const hub = ctx.st.rooms.find(
    (r) => (r.purpose === 'chapel' || r.purpose === 'junction' || r.purpose === 'great-hall') && r.id !== ctx.st.entranceId,
  ) ?? deepestRoom(ctx);
  const rooms = hub ? [hub] : [];
  const faction = ctx.actors.faction;
  for (const r of rooms) {
    recProp(ctx, { kind: 'crates', cell: roomCenterCell(ctx, r), eventRef: p.id, roomId: r.id });
    recProp(ctx, { kind: 'candles', cell: roomCenterCell(ctx, r), eventRef: p.id, roomId: r.id });
  }
  recOccupation(ctx, { roomIds: rooms.map((r) => r.id), actorKey: faction, eventRef: p.id, isApex: p.isApex });
  ev.roomIds = rooms.map((r) => r.id);
  ev.actorKey = faction;
  ev.summary = `${labelActor(faction)} moved into the abandoned ${ctx.structureNoun}`;
  return ev;
}

function applyBloom(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  // Bloom flood-fills from one room outward rng.int(2,4) rooms along edges.
  const st = ctx.st;
  const adj = buildAdjacency(st.rooms.length, st.edges);
  const seedRoom = deepestRoom(ctx) ?? st.rooms[st.rooms.length - 1];
  const reach = ctx.rng.int(2, 4);
  // BFS outward from seedRoom up to `reach` rooms.
  const seen = new Set<number>([seedRoom.id]);
  const q: Array<{ id: number; d: number }> = [{ id: seedRoom.id, d: 0 }];
  const bloomed: number[] = [];
  for (let h = 0; h < q.length; h++) {
    const { id, d } = q[h];
    bloomed.push(id);
    if (d >= reach) continue;
    for (const n of adj[id]) {
      if (!seen.has(n)) {
        seen.add(n);
        q.push({ id: n, d: d + 1 });
      }
    }
  }
  for (const rid of bloomed) {
    for (const cell of roomCellsCached(ctx, rid)) recOverlay(ctx, cell, OverlayKind.Bloom);
  }
  recProp(ctx, { kind: 'spore-shelf', cell: roomCenterCell(ctx, seedRoom), eventRef: p.id, roomId: seedRoom.id });
  recOccupation(ctx, { roomIds: [seedRoom.id], actorKey: 'myconid_ring', eventRef: p.id, isApex: p.isApex });
  ev.roomIds = bloomed;
  ev.actorKey = 'myconid_ring';
  ev.summary = `a fungal bloom overtook the ${ctx.structureNoun}`;
  return ev;
}

// ─── Occupation room selection (apex-aware) ──────────────────────────────────

/**
 * Pick 1–`max` connected rooms preferring deep, non-entrance rooms. For the
 * APEX occupation, prefer rooms at ≥ 60% of max graph depth and NEVER a room
 * adjacent to the entrance — this protects the boss-depth and boss-not-adjacent
 * acceptance invariants Task 6 relies on.
 */
function pickOccupationRooms(ctx: SimCtx, isApex: boolean, max: number): Room[] {
  const st = ctx.st;
  const adj = buildAdjacency(st.rooms.length, st.edges);
  const depth = graphDepths(st.rooms.length, st.entranceId, adj);
  const entranceNbrs = neighborsOf(st.entranceId, adj);
  const maxDepth = Math.max(0, ...st.rooms.map((r) => (Number.isFinite(depth[r.id]) ? depth[r.id] : 0)));

  let eligible = st.rooms.filter(
    (r) => r.id !== st.entranceId && Number.isFinite(depth[r.id]) && !entranceNbrs.has(r.id),
  );
  if (isApex) {
    const deep = eligible.filter((r) => depth[r.id] >= 0.6 * maxDepth);
    if (deep.length > 0) eligible = deep;
  }
  if (eligible.length === 0) {
    // Fall back to any non-entrance room (a tiny graph with no deep rooms).
    eligible = st.rooms.filter((r) => r.id !== st.entranceId && Number.isFinite(depth[r.id]));
  }
  if (eligible.length === 0) return [st.rooms[st.rooms.length - 1]];

  // Deepest-first ordering, then take a connected cluster of up to `max`.
  eligible.sort((a, b) => depth[b.id] - depth[a.id]);
  const seed = isApex ? eligible[0] : ctx.rng.pick(eligible);
  const cluster: Room[] = [seed];
  const inCluster = new Set<number>([seed.id]);
  // Grow the cluster over graph neighbors that are themselves eligible.
  const eligibleIds = new Set(eligible.map((r) => r.id));
  let frontier = [seed.id];
  while (cluster.length < max && frontier.length > 0) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const n of adj[id]) {
        if (cluster.length >= max) break;
        if (!inCluster.has(n) && eligibleIds.has(n)) {
          inCluster.add(n);
          cluster.push(st.rooms[n]);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return cluster;
}

function deepestRoom(ctx: SimCtx): Room | undefined {
  const st = ctx.st;
  const adj = buildAdjacency(st.rooms.length, st.edges);
  const depth = graphDepths(st.rooms.length, st.entranceId, adj);
  let best: Room | undefined;
  let bestD = -1;
  for (const r of st.rooms) {
    if (r.id === st.entranceId) continue;
    if (Number.isFinite(depth[r.id]) && depth[r.id] > bestD) {
      bestD = depth[r.id];
      best = r;
    }
  }
  return best;
}

// ─── Tunnel carving ──────────────────────────────────────────────────────────

/**
 * Carve a rough 1-wide corridor through VOID between rooms `a` and `b`.
 *
 * The carve is a breadth-first search over VOID cells, from the ring of void
 * cells hugging `a` to the ring hugging `b`. A cell is walkable by the search
 * only if its whole 8-neighborhood is either void or part of the emerging path
 * — the SAME no-touch guarantee `attachRoom` enforces, so a tunnel never fuses
 * a third room into a blob. The endpoints are special-cased: the search may
 * SEED from a void cell orthogonally adjacent to `a`'s floor and may FINISH on a
 * void cell orthogonally adjacent to `b`'s floor, so the corridor actually meets
 * both rooms. Returns the carved cell indices oldest-endpoint-first, or null if
 * no clean channel exists. Endpoints are guaranteed non-entrance by the caller.
 *
 * Deterministic: the BFS explores neighbors in a fixed order and returns the
 * first (shortest) clean path, so the same geometry always yields the same
 * tunnel — no rng is consumed here.
 */
function carveTunnel(ctx: SimCtx, a: Room, b: Room): number[] | null {
  const st = ctx.st;
  const S = st.side;
  const N = st.grid.length;

  // Seeds: void cells orthogonally adjacent to a's floor (the tunnel mouths).
  const seeds = adjacentVoidCells(st, a.id);
  const goals = adjacentVoidCells(st, b.id);
  if (seeds.length === 0 || goals.length === 0) return null;
  const goalSet = new Set(goals);

  // A cell is path-walkable if it is void and its 8-neighborhood touches no
  // FOREIGN floor (floor of a room other than a/b). Cells hugging a or b are
  // allowed to touch that room only (they are the mouths).
  const walkable = (k: number): boolean => {
    if (st.grid[k] !== CellKind.Void) return false;
    const x = k % S;
    const y = (k / S) | 0;
    if (x < 2 || y < 2 || x >= S - 2 || y >= S - 2) return false;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nk = gi(x + ox, y + oy, S);
        if (st.grid[nk] !== CellKind.Floor) continue;
        const owner = st.roomOf[nk];
        // Touching a's or b's own floor is only allowed at that room's mouth
        // ring; elsewhere any floor neighbor disqualifies the cell.
        if (owner !== a.id && owner !== b.id) return false;
      }
    }
    return true;
  };

  // BFS. Seeds must themselves be walkable (mouth cells touch only a's floor).
  const prev = new Int32Array(N).fill(-2); // -2 = unvisited, -1 = a seed root
  const q: number[] = [];
  for (const s of seeds) {
    if (!walkable(s)) continue;
    prev[s] = -1;
    q.push(s);
  }
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const c = q[h];
    if (goalSet.has(c)) { hit = c; break; }
    const x = c % S;
    const y = (c / S) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nk = gi(x + dx, y + dy, S);
      if (prev[nk] !== -2) continue;
      if (!walkable(nk)) continue;
      prev[nk] = c;
      q.push(nk);
      if (goalSet.has(nk)) { hit = nk; break; }
    }
  }
  if (hit < 0) return null;

  // Reconstruct the path (goal → seed), then commit oldest-endpoint (a) first.
  const rev: number[] = [];
  for (let c = hit; c !== -1; c = prev[c]) rev.push(c);
  const cells = rev.reverse();
  // Record each carve write so a cutoff BEFORE this dig replays no corridor.
  for (const k of cells) recWriteCell(ctx, k, CellKind.Floor, 1, -2);
  return cells;
}

/** Void cells orthogonally adjacent to any floor cell of room `roomId`. */
function adjacentVoidCells(st: IntactState, roomId: number): number[] {
  const S = st.side;
  const out = new Set<number>();
  for (let i = 0; i < st.roomOf.length; i++) {
    if (st.roomOf[i] !== roomId) continue;
    const x = i % S;
    const y = (i / S) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 2 || ny < 2 || nx >= S - 2 || ny >= S - 2) continue;
      const nk = gi(nx, ny, S);
      if (st.grid[nk] === CellKind.Void) out.add(nk);
    }
  }
  return [...out].sort((p, r) => p - r);
}

// ─── Small utilities ─────────────────────────────────────────────────────────

function corridorIntact(ctx: SimCtx, cells: number[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => ctx.st.grid[c] === CellKind.Floor);
}

/**
 * The corridor cells that realize a loop edge on the grid — the run of corridor
 * cells (roomOf -2) that connects ONLY the edge's two endpoint rooms. Found by a
 * BFS over corridor cells hugging room `a` toward a cell hugging room `b`, where
 * a cell is walkable only if every room-floor 4-neighbor belongs to a or b (so a
 * built cross-cut / dug tunnel is isolated from unrelated corridors). Returns the
 * cells or null if no clean corridor route exists (e.g. already bricked/collapsed).
 */
function loopCorridorCells(ctx: SimCtx, a: number, b: number, corridorCells: number[]): number[] | null {
  const st = ctx.st;
  const S = st.side;
  const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const roomsTouched = (cell: number): Set<number> => {
    const x = cell % S;
    const y = (cell / S) | 0;
    const s = new Set<number>();
    for (const [dx, dy] of N4) {
      const nk = gi(x + dx, y + dy, S);
      const owner = st.roomOf[nk];
      if (st.grid[nk] === CellKind.Floor && owner >= 0) s.add(owner);
    }
    return s;
  };
  const passable = (cell: number): boolean => {
    if (st.grid[cell] !== CellKind.Floor || st.roomOf[cell] !== -2) return false;
    for (const id of roomsTouched(cell)) if (id !== a && id !== b) return false;
    return true;
  };
  const prev = new Int32Array(st.grid.length).fill(-2);
  const q: number[] = [];
  // Seed only from the precomputed corridor cells (avoids a full-grid scan).
  for (const i of corridorCells) {
    if (!passable(i)) continue;
    if (roomsTouched(i).has(a)) { prev[i] = -1; q.push(i); }
  }
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const c = q[h];
    if (roomsTouched(c).has(b)) { hit = c; break; }
    const x = c % S;
    const y = (c / S) | 0;
    for (const [dx, dy] of N4) {
      const nk = gi(x + dx, y + dy, S);
      if (prev[nk] !== -2 || !passable(nk)) continue;
      prev[nk] = c;
      q.push(nk);
      if (roomsTouched(nk).has(b)) { hit = nk; break; }
    }
  }
  if (hit < 0) return null;
  const cells: number[] = [];
  for (let c = hit; c !== -1; c = prev[c]) cells.push(c);
  return cells.reverse();
}

/**
 * Find a cycle edge whose corridor an event may bring down / wall up, together
 * with its intact corridor cells. Prefers a still-intact DUG tunnel (bookkept in
 * `ctx.tunnels`), then falls back to any BUILT loop edge (isLoop, not a tunnel)
 * whose corridor is intact and whose removal keeps the graph connected. Extending
 * collapse/brick-off to built cross-cuts (removal is connectivity-safe on ANY
 * cycle edge) makes those events more common and more interesting.
 */
function findCycleEdgeToRemove(ctx: SimCtx): { edge: DungeonEdge; cells: number[] } | null {
  const st = ctx.st;
  // 1) An intact dug tunnel (cheapest — cells already known).
  const tunnel = ctx.tunnels.find((t) => t.edge.isLoop && corridorIntact(ctx, t.cells));
  if (tunnel) return { edge: tunnel.edge, cells: tunnel.cells };
  // 2) A BUILT loop edge. Its corridor cells are discovered ONCE (cached on ctx)
  //    — built-loop cells don't move; an event that removes one turns its cells
  //    to Wall, which the corridorIntact grid check then filters out.
  if (ctx.builtLoops === null) {
    ctx.builtLoops = [];
    const tunnelEdges = new Set(ctx.tunnels.map((t) => t.edge));
    const loopEdges = st.edges.filter((e) => e.isLoop && !tunnelEdges.has(e));
    if (loopEdges.length > 0) {
      const corridorCells: number[] = [];
      for (let i = 0; i < st.roomOf.length; i++) {
        if (st.roomOf[i] === -2 && st.grid[i] === CellKind.Floor) corridorCells.push(i);
      }
      for (const e of loopEdges) {
        const cells = loopCorridorCells(ctx, e.a, e.b, corridorCells);
        if (cells && cells.length > 0) ctx.builtLoops.push({ edge: e, cells });
      }
    }
  }
  for (const bl of ctx.builtLoops) {
    if (!corridorIntact(ctx, bl.cells)) continue; // already collapsed/bricked
    const remaining = st.edges.filter((x) => x !== bl.edge);
    if (!graphConnected(st.rooms.length, st.entranceId, remaining)) continue;
    return { edge: bl.edge, cells: bl.cells };
  }
  return null;
}

/** Pick `n` distinct rooms from `pool` using the rng (order-stable). */
function pickDistinct(ctx: SimCtx, pool: Room[], n: number): Room[] {
  if (pool.length <= n) return pool.slice();
  const chosen: Room[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (chosen.length < n && guard < n * 8) {
    const r = ctx.rng.pick(pool);
    if (!used.has(r.id)) {
      used.add(r.id);
      chosen.push(r);
    }
    guard++;
  }
  return chosen;
}

/** A short trail of cells from a vault toward the entrance (dropped coins). */
function coinTrail(ctx: SimCtx, vault: Room): number[] {
  const st = ctx.st;
  const entrance = st.rooms[st.entranceId];
  let x = roomCx(vault);
  let y = roomCy(vault);
  const ex = roomCx(entrance);
  const ey = roomCy(entrance);
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    x += Math.sign(ex - x);
    y += Math.sign(ey - y);
    const k = gi(x, y, st.side);
    if (st.grid[k] === CellKind.Floor) out.push(k);
  }
  return out;
}

function labelActor(key: string): string {
  return key.replace(/_/g, ' ');
}

export function builderNoun(archetype: BuilderArchetype): string {
  switch (archetype) {
    case 'mausoleum': return 'the family';
    case 'mine': return 'the mining company';
    case 'fortress': return 'the garrison';
    case 'waterworks': return 'the town';
  }
}

export function structureNoun(archetype: BuilderArchetype): string {
  switch (archetype) {
    case 'mausoleum': return 'mausoleum';
    case 'mine': return 'workings';
    case 'fortress': return 'hold';
    case 'waterworks': return 'undercity';
  }
}

// ─── Reachability assertion ──────────────────────────────────────────────────

/** Throw if any Floor cell is unreachable from the entrance-room center. */
export function assertReachable(st: IntactState): void {
  const S = st.side;
  const e = st.rooms[st.entranceId];
  const start = gi(roomCx(e), roomCy(e), S);
  // The center may fall on a mask hole; seed from a real floor cell of the room.
  let seedCell = start;
  if (st.grid[seedCell] !== CellKind.Floor) {
    for (let i = 0; i < st.roomOf.length; i++) {
      if (st.roomOf[i] === e.id && st.grid[i] === CellKind.Floor) { seedCell = i; break; }
    }
  }
  const seen = new Uint8Array(st.grid.length);
  const q = [seedCell];
  seen[seedCell] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const d of [-1, 1, -S, S]) {
      const n = c + d;
      if (n >= 0 && n < st.grid.length && !seen[n] && st.grid[n] === CellKind.Floor) {
        seen[n] = 1;
        q.push(n);
      }
    }
  }
  for (let i = 0; i < st.grid.length; i++) {
    if (st.grid[i] === CellKind.Floor && !seen[i]) {
      throw new Error(`simulateHistory: floor cell ${i} stranded after events`);
    }
  }
}
