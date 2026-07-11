/**
 * @file intact/repeats.ts
 * @description The repeat-unit placement loop — extracted VERBATIM from
 * buildIntact.ts (packet W1-P6). `placeRepeats` cycles the archetype's `repeat`
 * specs until the room count, with the per-archetype topology (mausoleum spine
 * wings, mine parallel drifts, fortress spread, waterworks bounded chains).
 * Move-only: the body is byte-identical, so every `rng` draw (chain depths, shape
 * cadence, drift axes) fires in the same order. Exported so the `buildIntact`
 * composition root can call it.
 */

import { SPINE_STRIDE, type IntactState, type Room, type SpineCell } from './primitives';
import type { Rng } from './rng';
import { gozzysBlend } from './sprawl';
import {
  attachRoom,
  attachRoomAtSpineCell,
  findByPurpose,
  findSpineOrigin,
  growSpine,
  resolveDir,
} from './attach';
import { ARCHETYPES, type RoomSpec } from '../archetypes';
import { type BuilderArchetype, type RoomPurpose } from '../types';

/**
 * Cycle `repeat` specs until the room count. Interpretation of the archetype
 * anchor tokens for REPEATS (the data can't express these; documented here):
 *  - mausoleum spine galleries: anchor to evenly spaced points along the spine,
 *    alternating the branch side each placement (processional symmetry). When
 *    the current spine is spent, the spine GROWS — first a second segment
 *    continuing the flow axis, else a perpendicular branch spine — so the
 *    processional keeps extending instead of the build bailing short.
 *  - mine veins: `anchor:'prev'` chains off the last vein, but flowDir
 *    alternates [1,0]/[0,1] so the chain steps diagonally down-right.
 *  - fortress `anchor:'prev'` = "any already-placed CORE room", picked by
 *    cycling an index so filler spreads across wings. When the core anchors
 *    saturate, already-placed REPEAT rooms fold into the anchor pool so wings
 *    grow OUTWARD (hub stays central) rather than the build bailing short.
 *  - waterworks repeats: maintenance-walk chains off prev; passage-rooms branch.
 */
export function placeRepeats(
  st: IntactState,
  rng: Rng,
  archetype: BuilderArchetype,
  coreLen: number,
  roomCount: number,
  spineCells: SpineCell[],
  corePurposes: Set<RoomPurpose>,
): void {
  const data = ARCHETYPES[archetype];
  if (data.repeat.length === 0) return;

  // Core rooms available as fortress-style spread anchors (skip the entrance so
  // filler doesn't all pile at the gate).
  const coreRooms = st.rooms.slice(1, coreLen);
  // Fortress spread anchors — starts as the core wings; grows to include placed
  // REPEAT rooms once the core saturates (see the fortress branch below).
  const spreadAnchors: Room[] = [...coreRooms];
  let coreCursor = 0;
  let spineCursor = 1;
  let side: 1 | -1 = 1; // alternating gallery side
  // Guards against spinning forever when the spine can no longer be extended
  // (grid fully boxed); after this many consecutive failed extensions we stop.
  let spineExtendFails = 0;

  // DEFECT A2 (chain topology): the mine forks into 2-3 PARALLEL drifts off the
  // hoist rather than stringing every gallery in one drift (which made the crit
  // path ≈ room count). Each drift chains 1/2-1/3 of the galleries and runs
  // roughly parallel toward down-flow, so the diagonal-descent look survives and
  // cross-cuts later connect neighboring drifts. driftHeads[i] is the last room
  // placed on drift i; a round-robin cursor spreads galleries across drifts.
  const hoist = findByPurpose(st, 'hoist');
  const nDrifts = roomCount >= 36 ? 3 : 2;
  const driftHeads: Room[] = [];
  if (hoist) for (let d = 0; d < nDrifts; d++) driftHeads.push(hoist);
  // Every drift steps down-AND-right (its axis alternates [1,0]/[0,1] per step),
  // so ALL drifts run the same diagonal descent and stay roughly PARALLEL — the
  // lateral offset between them comes from the different door positions on the
  // hoist wall. Parallel drifts sit within a cell or two of each other, which is
  // exactly the gap addBuiltLoops needs to open cross-cuts between them. (An
  // earlier version gave each drift a DIFFERENT fixed axis, which made them
  // diverge — no cross-cut geometry, so the mine could end a pure tree.)
  const driftFlip: boolean[] = new Array(nDrifts).fill(false);
  let driftCursor = 0;
  // Waterworks bounded-chain state (DEFECT A2): several short maintenance-walk
  // branches off the core hubs rather than one long conga.
  let waterChainLen = 0;
  let waterChainHead: Room | null = null;
  // Fortress: how many placed repeats have been folded into the spread pool as an
  // outward ring (bounded to keep wings from chaining arbitrarily deep).
  let foldedRing = 0;
  // Mid-depth timbered store-room + compound-chamber cadence (DEFECT B shape
  // variety): every Nth gallery becomes a rectilinear timbered room, every Mth a
  // compound chamber — spread across the depth range, not clustered.
  let galleryOrdinal = 0;
  // GOZZYS BLEND (all sprawl levels): a running ordinal drives an occasional
  // oversized hall (14-18), tiny closet (3-4), and octagon/diamond focal room —
  // strong size contrast + focal shapes, at low weight so they read as accents.
  let blendOrdinal = 0;

  const maxTries = roomCount * 40;
  let specIx = 0;
  for (let tries = 0; tries < maxTries && st.rooms.length < roomCount; tries++) {
    const spec = data.repeat[specIx % data.repeat.length];
    specIx++;

    // A repeat that reuses a CORE purpose is re-purposed generic so it never
    // inflates a core purpose's count (the test asserts EXPECTED instances per
    // purpose, and a core purpose's expected count comes only from `core`).
    // Repeat-native purposes (burial-gallery, vein-gallery, passage-room) may
    // recur freely — that's the whole point of the repeat program.
    let effectivePurpose = spec.purpose;
    if (corePurposes.has(spec.purpose)) effectivePurpose = 'passage-room';
    let placedSpec: RoomSpec = { ...spec, purpose: effectivePurpose };
    placedSpec = gozzysBlend(placedSpec, blendOrdinal++);

    if (archetype === 'mausoleum' && spec.anchor === 'spine' && spineCells.length > 0) {
      // Galleries branch off the spine at a fixed stride, alternating side each
      // placement so they hang off both flanks (processional symmetry). The
      // stride (≈ a gallery's own height) keeps adjacent galleries from
      // colliding; a pair (both sides) advances the anchor down the spine.
      const n = spineCells.length;
      const anchorIx = 2 + spineCursor * SPINE_STRIDE;
      if (anchorIx >= n - 1) {
        // Trunk spent — GROW the skeleton by BRANCHING a perpendicular wing off
        // the far end (alternating left/right), so the footprint spreads two-
        // dimensionally like catacomb wings instead of running off as one worm
        // (DEFECT 1). growSpine caps each straight run at SPINE_SEGMENT_CELLS and
        // prefers a perpendicular turn; galleries then hang off the new wing.
        const grew = growSpine(st, spineCells);
        if (grew) { spineExtendFails = 0; continue; }
        spineExtendFails++;
        if (spineExtendFails >= 2) break; // truly boxed — honest shortfall
        continue;
      }
      const at = spineCells[anchorIx];
      // Perpendicular to THIS cell's LOCAL segment direction (a bent spine hangs
      // its galleries off the correct flanks of each wing).
      const [ldx, ldy] = at.dir;
      const perp: readonly [number, number] =
        Math.abs(ldx) > Math.abs(ldy) ? [0, side] : [side, 0];
      side = (side === 1 ? -1 : 1);
      spineCursor++;
      const spineOriginId = findSpineOrigin(st);
      // ROOM-THROUGH-ROOM WINGS (Remy critique #1): a wing is a CHAIN of galleries.
      // The first gallery hangs off the spine anchor; then 1-3 more galleries chain
      // DIRECTLY off the previous gallery through a shared-wall door (corridor
      // [0,1]), so the player walks the spine briefly, then moves gallery → gallery
      // → gallery with no hall between. The chain runs deeper along the same
      // perpendicular flank (away from the spine), giving each wing a spine-normal
      // spread. A 2-4 cell void gap between wings falls out naturally from the
      // SPINE_STRIDE spacing, so the silhouette is notched, not a solid slab.
      // The wing HEAD attaches with a short set-back connector (2-3 cells), NOT a
      // shared-wall door: this lifts the gallery box OFF the spine so its side wall
      // does not run parallel-adjacent to the spine corridor. Without the set-back,
      // a LEFT-flank and a RIGHT-flank gallery at nearby strides can sandwich a run
      // of spine cells so that stretch is flanked ONLY by that gallery pair — which
      // a later collapse/brick-off would mistake for a redundant loop and wall,
      // cutting the spine and stranding the deep rooms (ossuary/wings) beyond it.
      // The set-back keeps every spine cell touching the spine's own room, not a
      // gallery pair. The room-through-room CHAIN (below) still butts gallery to
      // gallery through shared-wall doors — only the spine attach is set back.
      const headSpec: RoomSpec = { ...placedSpec, corridor: [2, 3] };
      const head = attachRoomAtSpineCell(
        st, rng, at.x, at.y, perp[0], perp[1], headSpec, effectivePurpose, spineOriginId,
      );
      if (head) {
        // Chain depth 2-4 further galleries off the wing head. Deterministic draw
        // from the build stream; capped so a wing does not run the room budget dry.
        // Deeper chains widen each wing perpendicular to the trunk, which balances
        // the bounding box against the trunk length (aspect < 2.2 invariant).
        const chainDepth = rng.int(2, 4);
        let link = head;
        for (let c = 0; c < chainDepth && st.rooms.length < roomCount; c++) {
          // Continue the wing outward (same perpendicular flank), falling back to
          // the flow axis if boxed — attachRoom's orderedDirs handles the retry.
          const next = attachRoom(st, rng, link, placedSpec, perp);
          if (!next) break;
          link = next;
        }
      }
      continue;
    }

    if (archetype === 'mine') {
      // Multi-drift vein chase (DEFECT A2). Round-robin over the drift heads so
      // galleries spread across 2-3 parallel drifts forking off the hoist; each
      // drift steps down-flow along its own axis. This shortens the critical path
      // (galleries no longer form one long chain) and gives ≥ nDrifts leaf tips.
      const di = driftCursor % driftHeads.length;
      driftCursor++;
      // Per-drift alternating axis → diagonal down-right descent, parallel across
      // drifts (so cross-cuts between neighboring drifts have a 1-2 cell gap).
      const axis: readonly [number, number] = driftFlip[di] ? [0, 1] : [1, 0];
      driftFlip[di] = !driftFlip[di];
      st.flowDir = axis;

      // DEFECT B shape variety: mostly organic ellipse galleries, but an
      // occasional rectilinear timbered store-room (mid-depth) and an occasional
      // compound chamber, so the workings read varied, not an egg carton.
      const ord = galleryOrdinal++;
      const isTimbered = ord >= 3 && ord % 5 === 2; // rectilinear tool-store-like
      const isCompound = ord >= 2 && ord % 4 === 0; // irregular compound chamber
      const shapedSpec: RoomSpec = isTimbered
        ? { ...placedSpec, shape: 'rect', w: [4, 6], h: [4, 6] }
        : isCompound
          ? { ...placedSpec, shape: 'compound' }
          : placedSpec;

      const anchor = driftHeads[di] ?? st.rooms[st.rooms.length - 1];
      let placed = attachRoom(st, rng, anchor, shapedSpec, axis);
      // If this drift head is boxed in, try the OTHER down-flow axis off the same
      // head before re-anchoring elsewhere (keeps the drift going straight-ish).
      if (!placed) {
        const alt = axis[0] === 1 ? ([0, 1] as const) : ([1, 0] as const);
        placed = attachRoom(st, rng, anchor, shapedSpec, alt);
      }
      // Still boxed: BRANCH off an earlier vein room (deepest-first) so a new fork
      // chases the ore instead of stalling. Preserves the diagonal descent.
      if (!placed) {
        for (let bi = st.rooms.length - 1; bi >= 1 && !placed; bi--) {
          for (const d of ([[1, 0], [0, 1]] as const)) {
            placed = attachRoom(st, rng, st.rooms[bi], shapedSpec, d);
            if (placed) break;
          }
        }
      }
      // Advance this drift's head to the newly placed gallery so the drift chains.
      if (placed) driftHeads[di] = placed;
      continue;
    }

    if (archetype === 'fortress') {
      // Spread filler over already-placed rooms (cycle the cursor). The pool
      // starts as the core wings; once we have cycled a full lap without room to
      // spare, placed REPEAT rooms join the pool so wings grow OUTWARD from the
      // hub. The hub (great-hall) stays central because filler never re-anchors
      // on the gatehouse/entrance — spreadAnchors excludes room 0 by construction
      // (coreRooms = slice(1, coreLen)) and appended repeats are outer wings.
      const pool = spreadAnchors.length > 0 ? spreadAnchors : [st.rooms[st.rooms.length - 1]];
      const anchor = pool[coreCursor % pool.length];
      coreCursor++;
      const dir = resolveDir(st, rng, spec.dir);
      const placed = attachRoom(st, rng, anchor, placedSpec, dir);
      // Fold this wing room back into the anchor pool only ONCE the core anchors
      // are saturated, and only for the FIRST outward ring (DEFECT A2): folding
      // every placed repeat let wings chain arbitrarily deep, pushing the critical
      // path over the room count. Keeping the pool = core rooms + one outward ring
      // holds the hub central and the diameter short; built loops shortcut the
      // rest. `foldedRing` bounds the appended ring to the core-anchor count.
      if (
        placed &&
        coreCursor >= coreRooms.length &&
        foldedRing < coreRooms.length * 2 &&
        spreadAnchors.length < roomCount
      ) {
        spreadAnchors.push(placed);
        foldedRing++;
      }
      continue;
    }

    // waterworks & fallback (DEFECT A2): the maintenance walks used to chain off
    // 'prev' in ONE long line, so the critical path ran ≈ room count. Instead run
    // SEVERAL short branches off the core hubs (junction/cisterns/outfall): keep a
    // bounded local chain, then re-seat on the next core anchor. This turns the
    // undercity into a hub with radiating walks rather than a single worm, so the
    // entrance→deepest path stays well under the room count.
    const CHAIN_CAP = 3; // walks per branch before re-seating on a core hub
    let anchor: Room;
    if (spec.anchor === 'prev' && waterChainLen < CHAIN_CAP && waterChainHead) {
      anchor = waterChainHead;
      waterChainLen++;
    } else {
      anchor = coreRooms.length > 0
        ? coreRooms[coreCursor++ % coreRooms.length]
        : st.rooms[st.rooms.length - 1];
      waterChainLen = 0;
    }
    const dir = resolveDir(st, rng, spec.dir);
    const placed = attachRoom(st, rng, anchor, placedSpec, dir);
    if (placed) waterChainHead = placed;
  }
}
