/**
 * @file buildIntact.ts
 * @description Purpose-driven INTACT layout generator — the heart of the
 * history-first dungeon rewrite. Pure data, zero THREE imports, deterministic.
 *
 * Where the old `grow()` grew rooms by random attachment (the "blob" look Remy
 * rejected), `buildIntact()` runs a BUILDER PROGRAM: it places the archetype's
 * `core` rooms once, each at the direction its RoomSpec asks for relative to the
 * plan's flow axis, then repeats `repeat` units until the room count. The result
 * reads as something a mason built for a purpose, not something that accreted.
 *
 * The four programs each produce one of the approved circulation shapes
 * (mocks .agent/scratch/dungeon-layout-mocks.html):
 *   - mausoleum : processional symmetry — stair→antechamber→chapel on one axis,
 *                 a SPINE corridor behind, burial galleries alternating off it.
 *   - mine      : diagonal vein descent — flowDir alternates [1,0]/[0,1] so the
 *                 gallery chain steps down-and-right; the sump lands deepest.
 *   - fortress  : gatehouse funnel → great-hall hub → service wings; repeat
 *                 passage-rooms hang off already-placed CORE rooms (spread).
 *   - waterworks: channel skeleton — 3-wide channel runs, cisterns at the ends,
 *                 everything meeting at the junction; channels/cisterns start wet.
 *
 * SUBSTRATE OWNERSHIP: the shared grid/room/mask primitives (`Rng`, `makeRng`,
 * `Room`, `gi`, `DIRS`, mask helpers, `stampRoom`, `roomCx`/`roomCy`) live HERE
 * and `generateDungeon.ts` imports them back, so nothing is duplicated.
 *
 * MODULE LAYOUT (packet W1-P6): this file is now a thin composition root. The
 * substrate and growth machinery were split, move-only (byte-identical bodies, so
 * the seeded call order is unchanged), into ./intact/*:
 *   - ./intact/rng          : the `Rng` wrapper + `makeRng`.
 *   - ./intact/primitives   : room/mask/grid substrate, spine tuning, stamp helpers.
 *   - ./intact/sprawl       : sprawl interpolation + Gozzys blend.
 *   - ./intact/attach       : direction resolution, directed attach, spine growth.
 *   - ./intact/circulation  : built loops (DEFECT A) + dead-end trim.
 *   - ./intact/repeats      : the repeat-unit placement loop.
 * All of those substrate names are RE-EXPORTED below so `./buildIntact` keeps its
 * original public surface (generateDungeon.ts / simulateHistory.ts / lore.ts / the
 * tests all import them from here).
 *
 * Determinism: every draw comes from the `Rng` wrapper over a seed path; the
 * wrapper's `int()` is INCLUSIVE (guarding SeededRandom.nextInt being max-
 * exclusive). Same path ⇒ byte-identical grid.
 */

import { ARCHETYPES, type RoomSpec } from './archetypes';
import { type BuilderArchetype, type RoomPurpose } from './types';
import { type Rng } from './intact/rng';
import {
  addRoomWater,
  bakeMask,
  DIRS,
  roomCx,
  roomCy,
  SPINE_SEGMENT_CELLS,
  SPINE_STRIDE,
  stampRoom,
  type IntactState,
  type Room,
  type SpineCell,
} from './intact/primitives';
import {
  attachRoom,
  attachRoomAtSpineCell,
  attachSpine,
  findByPurpose,
  findSpineOrigin,
  resolveDir,
} from './intact/attach';
import { placeRepeats } from './intact/repeats';
import { addBuiltLoops, trimDanglingCorridors } from './intact/circulation';

// ─── Public substrate re-exports ─────────────────────────────────────────────
// The shared grid/room/mask substrate now lives in ./intact/*, but is re-exported
// HERE so `./buildIntact` keeps its original public surface unchanged — nothing is
// duplicated between the builder and the assembly path.
export { makeRng } from './intact/rng';
export type { Rng } from './intact/rng';
export {
  inMask,
  compoundMask,
  bakeMask,
  roomCx,
  roomCy,
  DIRS,
  SPINE_STRIDE,
  SPINE_PAIRS_PER_SEGMENT,
  SPINE_SEGMENT_CELLS,
  SPINE_LANE_GAP,
  gi,
  stampRoom,
  addRoomWater,
} from './intact/primitives';
export type { Room, GridSurface, IntactState, SpineCell } from './intact/primitives';
export { attachRoom, attachSpine } from './intact/attach';
export { addBuiltLoops, trimDanglingCorridors } from './intact/circulation';

// ─── The builder ─────────────────────────────────────────────────────────────

/**
 * Deterministic purpose-driven layout. Places the archetype's `core` rooms
 * once (deduplicated by purpose — the verbatim Task-3 test asserts exactly one
 * room per distinct core purpose), builds the archetype's spine/channels, then
 * cycles `repeat` specs until the room count. Returns null if < 70% of the
 * target rooms placed.
 */
export function buildIntact(
  rng: Rng,
  archetype: BuilderArchetype,
  roomCount: number,
  /** Loop-door density control (0..1). At 0 the builder still opens ≥1 cross-cut
   * (the "never a pure tree" anti-goal). Default keeps legacy 2-arg callers a
   * pure tree — the generator always passes the real value + `circRng`. */
  loopChance = 0,
  /** Dedicated sub-stream for the circulation pass, so adding built-loop draws
   * never perturbs the build stream's determinism. */
  circRng?: Rng,
  /** Layout dial (0 tight .. 1 sprawl). Legacy 2/3-arg callers default to 0
   * (fully tight — identical to the pre-sprawl builder). */
  sprawl = 0,
): IntactState | null {
  const data = ARCHETYPES[archetype];
  const sprawlClamped = Math.max(0, Math.min(1, sprawl));
  // The spine/vein programs grow mostly along ONE axis, so they need a working
  // grid taller than a room-count-square would give. Size generously — the grid
  // is cropped to the used extent afterward, so slack costs only transient RAM.
  // The binding constraint for the mausoleum is spine LENGTH (galleries hang off
  // one processional spine), so it scales with roomCount more steeply than the
  // spread archetypes; growing `side` here is the sanctioned lever (the
  // 8-neighborhood no-touch guard stays untouched).
  // Sprawl opens negative space and lengthens corridors, so the working grid
  // must grow with it (rooms float farther apart). The area factor scales with
  // sprawl; side is its sqrt, so the grid stays near-square. The mausoleum's
  // base factor is already very generous (its spine needs LENGTH), so it gets a
  // gentler sprawl bump than the spread archetypes — otherwise its huge grid
  // makes the O(side²) history/loop passes blow the perf budget at full sprawl.
  // ROOM-SIZE ×2 (Remy 2026-07-07): rooms now hold ≈2× the floor cells, so the
  // per-room area budget here is roughly DOUBLED (1600→3200 mausoleum, 640→1280
  // others) and the floors raised (160→200, 140→180). Undersizing the grid would
  // make the bigger rooms fail the no-touch placement and drop out (or the whole
  // build return null at 60 rooms); growing `side` is the sanctioned lever and the
  // grid is cropped to the used extent afterward, so the slack is transient RAM.
  const side = archetype === 'mausoleum'
    ? Math.max(200, Math.ceil(Math.sqrt(roomCount * 3200 * (1 + 0.15 * sprawlClamped))))
    : Math.max(180, Math.ceil(Math.sqrt(roomCount * 1280 * (1 + 0.8 * sprawlClamped))));

  const flowByArch: Record<BuilderArchetype, readonly [number, number]> = {
    mausoleum: [0, -1],
    mine: [1, 0], // alternates with [0,1] during the vein chase
    fortress: [0, -1],
    waterworks: [1, 0],
  };

  const st: IntactState = {
    side,
    grid: new Uint8Array(side * side),
    corridor: new Uint8Array(side * side),
    roomOf: new Int16Array(side * side).fill(-1),
    rooms: [],
    edges: [],
    entranceId: 0,
    flowDir: flowByArch[archetype],
    builtWater: new Set<number>(),
    sprawl: sprawlClamped,
  };

  // ── Entrance: the first core spec. The whole plan extends along +flowDir, so
  //    seat the entrance OPPOSITE the flow (≈35% off-center) to leave room for
  //    the processional/vein/channel to run without hitting the grid rim. Its
  //    outward face is the cosmetic "map edge" (real edge is set after crop).
  const entrySpec = data.core[0];
  const ew = rng.int(entrySpec.w[0], entrySpec.w[1]);
  const eh = rng.int(entrySpec.h[0], entrySpec.h[1]);
  const eShape = entrySpec.shape;
  const eMask = bakeMask(rng, eShape, ew, eh);
  const [flx, fly] = st.flowDir;
  // Seat the entrance well toward the TRAILING rim so the processional/vein has
  // most of the grid to run into. The mausoleum's single long spine benefits
  // most from a near-rim seat (≈42% back gives the spine ~85% of the height).
  const back = Math.floor(side * (archetype === 'mausoleum' ? 0.42 : 0.33));
  // Mine steps down-AND-right (flowDir alternates [1,0]/[0,1]); seat it in the
  // top-left so both axes have room. Others back off along their single axis.
  const backX = archetype === 'mine' ? back : flx * back;
  const backY = archetype === 'mine' ? back : fly * back;
  const entrance: Room = {
    id: 0,
    x0: ((side - ew) >> 1) - backX,
    y0: ((side - eh) >> 1) - backY,
    w: ew, h: eh, shape: eShape, mask: eMask,
    type: 'entrance', purpose: entrySpec.purpose, depth: 0, difficulty: 0, degree: 0, area: 0,
  };
  stampRoom(st, entrance);
  st.rooms.push(entrance);
  st.entranceId = 0;

  // ── Place the remaining CORE rooms in array order (the mine's sump is LAST in
  //    `core`, so array order lands it deepest, per the archetype comment).
  //
  //    A core spec MAY repeat a purpose (waterworks lists 'cistern' twice — two
  //    real cisterns anchor the channel ends, exactly as the mock shows). Every
  //    core spec instance keeps its DECLARED purpose; we do NOT relabel the
  //    second one. Downstream flood-by-purpose and story logic depend on both
  //    cisterns carrying the 'cistern' purpose, so the count of a repeated core
  //    purpose equals the number of specs that declare it.
  const spineCells: SpineCell[] = [];

  // Only the mausoleum carves a spine (behind the chapel) that galleries hang off.
  // Waterworks channels are the connectors to the cisterns/outfall, marked wet at
  // attach time (below) — no free-standing channel stub to trim away.
  const carveSpineAfter: RoomPurpose | null = archetype === 'mausoleum' ? 'chapel' : null;

  for (let ci = 1; ci < data.core.length; ci++) {
    const spec = data.core[ci];

    // Resolve the anchor room.
    let anchor: Room | undefined;
    if (spec.anchor === 'prev') {
      anchor = st.rooms[st.rooms.length - 1];
    } else if (spec.anchor === 'entry') {
      anchor = entrance;
    } else if (spec.anchor === 'spine') {
      anchor = undefined; // resolved against spine cells below
    } else {
      anchor = findByPurpose(st, spec.anchor);
    }

    // Each core spec keeps its declared purpose — including a repeated one (the
    // waterworks second 'cistern'). The two cisterns are separated physically by
    // their opposite anchor directions (left vs right off the junction).
    const placedSpec: RoomSpec = spec;
    let placed: Room | null = null;

    if (spec.anchor === 'spine' && spineCells.length > 0) {
      // Cap the spine's FAR end (ossuary). Hang off the last spine cell along
      // the flow axis so the ossuary sits at the processional terminus.
      const end = spineCells[spineCells.length - 1];
      const [fx, fy] = st.flowDir;
      placed = attachRoomAtSpineCell(
        st, rng, end.x, end.y, fx, fy, placedSpec, spec.purpose, findSpineOrigin(st),
      );
      // Fallback: if the terminus is boxed in, chain it off the last room.
      if (!placed) {
        placed = attachRoom(st, rng, st.rooms[st.rooms.length - 1], placedSpec, resolveDir(st, rng, spec.dir));
      }
    } else {
      if (!anchor) anchor = st.rooms[st.rooms.length - 1];
      const dir = resolveDir(st, rng, spec.dir);
      // Waterworks channels: the junction→cistern and junction→outfall connectors
      // ARE the channels from the mock (figure 5) — capture their corridor cells so
      // they start wet. For cisterns, also flood the whole basin floor. Both
      // cisterns thus read as water-filled basins fed by a visible channel, and the
      // outfall runs wet to its grate, instead of everything sitting dry.
      const wantChannel =
        archetype === 'waterworks' && (spec.purpose === 'cistern' || spec.purpose === 'outfall');
      const floodBasin = spec.purpose === 'cistern';
      const channelCells: number[] | undefined = wantChannel ? [] : undefined;
      placed = attachRoom(st, rng, anchor, placedSpec, dir, channelCells);
      if (placed && wantChannel) {
        for (const k of channelCells!) st.builtWater.add(k);
        if (floodBasin) addRoomWater(st, placed);
      }
    }

    // Core rooms MUST land (their purpose is part of the plan's contract). If
    // the designated anchor+direction is boxed in — e.g. the waterworks outfall
    // wanting the junction's 'back' face when the ladder chain already occupies
    // it — retry against every already-placed room in every direction before
    // giving up. Purpose stays; only the attach point degrades.
    //
    // Two guards keep the fallback from breaking the plan's structure:
    //  1) NEVER fall back onto the ENTRANCE (room 0). Attaching a core room to
    //     the entrance would push its degree above 1 and break the
    //     entrance-degree-1 invariant (this is exactly the waterworks outfall
    //     bug: it used to land on the ladder-shaft).
    //  2) Start the candidate scan from the intended anchor's NEIGHBORHOOD
    //     (nearest placed rooms first) rather than index 0, so a boxed core room
    //     re-seats close to where the plan wanted it, not next to the gate.
    if (!placed) {
      const anchorRoom = anchor ?? st.rooms[st.rooms.length - 1];
      const acx = roomCx(anchorRoom);
      const acy = roomCy(anchorRoom);
      const candidates = st.rooms
        .filter((r) => r.id !== st.entranceId && r.id !== anchorRoom.id)
        .sort((a, b) => {
          const da = (roomCx(a) - acx) ** 2 + (roomCy(a) - acy) ** 2;
          const db = (roomCx(b) - acx) ** 2 + (roomCy(b) - acy) ** 2;
          return da - db;
        });
      // Prefer the intended anchor itself first (its non-requested faces), then
      // its nearest neighbors — but the entrance is excluded throughout.
      const scan = anchorRoom.id === st.entranceId ? candidates : [anchorRoom, ...candidates];
      const wantChannel =
        archetype === 'waterworks' && (spec.purpose === 'cistern' || spec.purpose === 'outfall');
      const floodBasin = spec.purpose === 'cistern';
      outer: for (const cand of scan) {
        for (const d of DIRS) {
          const channelCells: number[] | undefined = wantChannel ? [] : undefined;
          placed = attachRoom(st, rng, cand, placedSpec, d, channelCells);
          if (placed) {
            if (wantChannel) {
              for (const k of channelCells!) st.builtWater.add(k);
              if (floodBasin) addRoomWater(st, placed);
            }
            break outer;
          }
        }
      }
    }

    // After the pivot core room is placed, carve the mausoleum spine. (Waterworks
    // no longer carves a free-standing channel stub here: that stub hung no room,
    // so trimDanglingCorridors peeled it back to nothing and the map read DRY. The
    // real channels are now the junction→cistern and junction→outfall connectors,
    // captured and marked wet where those rooms attach — they serve doorways, so
    // they survive the trim and render as visible wet channels, per mock figure 5.)
    if (spineCells.length === 0 && carveSpineAfter && placed?.purpose === carveSpineAfter) {
      // Room-through-room wings (chains of galleries) hang off spine anchors spaced
      // SPINE_STRIDE apart. Each wing yields a head + a short chain, so the trunk
      // needs roughly (roomCount / avg-wing-size) anchors. Carve an initial trunk
      // long enough to seat them all, so the processional reads as one clean axis
      // (growSpine only folds a corner if this hits the grid rim). Capped to keep
      // the bounding box near-square (the aspect < 2.2 invariant).
      // Assume ~3.4 rooms per wing (head + a 2-4 chain). Keep the trunk SHORT so
      // the bounding box stays near-square: the perpendicular wings supply width,
      // and if the trunk runs out of anchors growSpine folds a lane to add more.
      const wantAnchors = Math.ceil(roomCount / 3.4);
      const spineLen = Math.min(
        st.side - 8,
        Math.max(SPINE_SEGMENT_CELLS, 4 + wantAnchors * SPINE_STRIDE),
      );
      const carved = attachSpine(st, placed, spineLen, st.flowDir);
      spineCells.push(...carved);
    }
  }

  // ── Repeat units until roomCount. Galleries hang off the spine (alternating
  //    sides); mine veins chase the flow (alternating axis); fortress passage-
  //    rooms cycle over placed CORE rooms so filler SPREADS, not chains.
  const corePurposes = new Set<RoomPurpose>(data.core.map((s) => s.purpose));
  placeRepeats(st, rng, archetype, data.core.length, roomCount, spineCells, corePurposes);

  // ── BUILT circulation (DEFECT A): the intact structure would otherwise be a
  //    pure tree — a corridor conga line where cycles only appear when a decay
  //    event digs a tunnel. Builders built loops: open extra doors between
  //    DIFFERENT rooms separated by a 1-2 cell wall gap, per archetype. These are
  //    cycle edges (isLoop:true) but NOT dug — they render as clean built doors.
  addBuiltLoops(st, circRng ?? rng, archetype, loopChance);

  // Trim any corridor/spine/channel run that terminates in the void — a "corridor
  // to nowhere" (DEFECT 2 & 3). A grown spine wing whose galleries all failed to
  // place, or a channel stub past its last served cell, leaves carved corridor
  // cells serving no doorway; prune them so no corridor ends without a room.
  trimDanglingCorridors(st);

  if (st.rooms.length < Math.floor(roomCount * 0.7)) return null;
  return st;
}
