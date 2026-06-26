# Plan: 3D in-scene agent walking (R3F render integration)

**Status:** ready for a hands-on 3D iteration session (the only un-built rung of the agent-sim).
**Date:** 2026-06-25

> Backlog-retirement review, 2026-06-26: the core implementation named by this
> plan now exists in `src/components/World3D/GroundAgents.tsx`,
> `src/components/Worldforge/AgentSim3DPreview.tsx`, and
> `src/components/World3D/agentInstanceMatrices.ts`. This file is kept as
> implementation provenance, not as the active task owner. The remaining useful
> follow-up is rendered visual proof of the `?phase=agentsim3d` preview and/or
> live ground-mode agent layer, routed to `docs/projects/worldforge/GAPS.md`
> as `WF-G9`.

## Context — what is already built (this session)

The agent-sim data pipeline is complete, pure, and test-backed up to the mesh boundary:

| Rung | Artifact | Tests |
|------|----------|-------|
| Schedule | `roster/occupantSchedule.ts` `occupantLocationAt` | ✅ |
| 2D street motion | `roster/townSnapshot.ts` `townMotionSnapshotAt` | ✅ |
| 3D placement unified to schedule | `bridge/groundChunkLoader.ts` (uses `occupantLocationAt`, not the old `isAtWork`) | ✅ |
| Ground-meters motion | `bridge/groundAgentMotion.ts` `groundTownAgentsAt` | ✅ |
| `GroundWorld` exposes inputs | `townPlans: {burgId, plan}[]` + `boundsFeet: {x,y}` | ✅ end-to-end |
| Per-frame aggregator | `bridge/groundAgentMotion.ts` `allGroundAgentsAt(ground, clock)` → `GroundAgentMotion[]` | ✅ |

`GroundAgentMotion = { burgId, occupantId, name, xM, zM, moving, activity }` — `xM/zM` are **ground meters from the artifact NW origin** (same frame as `GroundWorld.occupants[].xM/zM` and `features`).

Today occupant figures are **baked static** inside building `interiorParts` at the `makeGroundWorld` bake hour (`World3DScene` renders them via `s.parts`). This plan replaces that with a live, moving layer.

## Goal

In WF ground mode, townsfolk visibly walk the streets between home and work as the game clock advances — driven by `allGroundAgentsAt`, consistent with the 2D `?phase=agentsim` preview.

## Coordinate frame — RESOLVED (from code, 2026-06-25)

No in-session guesswork needed. Every existing ground site (towns, buildings, occupant
markers, hostiles) is placed by `pseudoGrid(xM, zM)` in `groundChunkLoader.ts`:

```ts
function pseudoGrid(xM, zM) { return { x: xM / METERS_PER_CELL, y: zM / METERS_PER_CELL }; }
```

i.e. **ground-local meters ÷ `WORLD3D_CONFIG.METERS_PER_CELL` → grid-cell position**, which
the continent-scale chunk builders consume as true ground meters (the "unit trick"). So a
moving agent at `(agent.xM, agent.zM)` uses the **identical transform** the static occupant
figures already use — by construction it lands exactly where that occupant's baked figure /
nameplate is today. `GroundAgents` should reuse this mapping (export `pseudoGrid`, or inline
the same `÷ METERS_PER_CELL`), then feed through the same site→scene path (`worldToScene`).

- **Y / height:** sample `groundSurfaceY(ground, xM, zM)` (already exported) so figures stand on terrain.
- **Sanity check still worth doing in-session:** at a static hour, a `GroundAgents` figure for an
  occupant should coincide with that occupant's existing baked figure (same plot) — confirms the
  reuse is wired right before switching to live motion.

## Implementation steps

1. **Thread inputs to the scene.** Pass the live `GroundWorld` (already in `World3DWrapper` `groundRef`) and a `clock` (fractional hours from `scheduleClockFromGameTime(state.gameTime)`) into `World3DScene` as props. `World3DScene` is also used by `World3DDemo` — make both new props optional.

2. **`<GroundAgents>` component** (new, in `components/World3D/`) — now a THIN shell; both heavy pieces are built + tested:
   - `useFrame` reads the current clock (prop or a ref updated from game time). Throttle to ~2–4 Hz (agents move slowly; no 60fps recompute).
   - Call **`groundAgentScenePositions(ground, clock)`** (`bridge/groundAgentMotion.ts`, tested) → `GroundAgentSceneNode[]` (pseudo-grid `gridX/gridY` + sampled `surfaceY` + `moving/activity/name`). The whole per-frame data computation.
   - Pass the nodes + `sceneOrigin` to **`syncAgentInstanceMatrices(meshRef.current, nodes, sceneOrigin)`** (`components/World3D/agentInstanceMatrices.ts`, tested: translation = `worldToScene(gridX·MPC)`, terrain-lift, count-cap, needsUpdate). This is the error-prone matrix writing — done.
   - So the component itself only has to: allocate an `<instancedMesh args={[geom, mat, MAX_AGENTS]}>` (capsule, or `bodyPlanToOccupantBody` proportions), hold a ref, and call the two functions in `useFrame`. The ONLY unverified-until-in-scene bits are the R3F shell wiring (ref timing, mount) and the coordinate-frame assumption (sanity-check below).
   - Optional: tint/scale by `activity` (e.g. dim when `sleeping`), and only show `moving` agents outdoors (indoor ones stay as baked interior parts to avoid double-rendering — OR stop baking static figures and render ALL via this layer; decide in-session by what looks right).

2b. **Architectural choice for the mesh layer (decide in-session).** Static sites render
   inside per-chunk groups: `SitePieces` places each at `[s.localX, s.surfaceY, s.localZ]`
   within a `<group position={chunkScenePos(cx,cy,origin)}>`, where `localX/localZ` are
   produced by the chunk sampler's pseudo-grid unit trick (`pos·METERS_PER_CELL − chunkOrigin`).
   Two ways to render MOVING agents:
   - **(A) Separate per-frame layer** (recommended): one `<group>` at the scene origin; for each
     `GroundAgentSceneNode`, position = `worldToScene(gridX·METERS_PER_CELL, gridY·METERS_PER_CELL, sceneOrigin)`
     then `+ surfaceY` on Y. This bypasses the chunk system entirely (agents aren't chunk-static),
     which is correct since they move. Verify the `gridX·METERS_PER_CELL → worldToScene` path puts a
     test agent on its building (the sanity check above) — this is the one thing to eyeball first.
   - **(B) Dynamic sites**: re-emit agents through the sampler each clock tick. Fights the per-chunk
     cache; avoid.

3. **De-dup with baked figures.** Either (a) keep interior `parts` figures for indoor occupants and render only `moving` ones here, or (b) drop baked figures and render everyone here. (b) is cleaner long-term but changes interior part composition — start with (a) for a smaller diff.

4. **Nameplates.** The activity nameplates already exist (`GroundOccupantSite` → close-range labels). If figures move, the marker positions should follow — fold nameplate positions into the same per-frame source eventually.

## Verification (visual — this is why it's a hands-on session)

- Headless capture rig: `.agent/3d-visual-quality/captures/shoot.mjs` with `POSE` (see memory `battlemap3d-camera-pose-hook` / `preview-screenshot-3d-capture`). Boot ground mode via `?wf_ground=1&wf_town=1&wf_seed=42` (memory `worldforge-burg-3d-town-handoff`).
- Capture at two clocks (e.g. 03:00 vs 07:30) — expect agents clustered in buildings at night, strung along streets mid-commute, matching the 2D `?phase=agentsim` readout (which is already verified: 03:15 → 0 walking, 07:15 → 14 walking).
- Confirm figures stand ON the ground (surface-Y correct) and AT plausible positions (coordinate frame correct).

## Risks / notes

- **No fallback** (Remy directive): if the coordinate mapping is wrong, fix it — don't add a guessy offset.
- Perf: InstancedMesh + throttled recompute; don't rebuild the street graph per frame (`buildStreetGraph` is the slow part — memoize per `ground`/`townPlans`, or precompute graphs once when the ground world loads).
- The 2 pre-existing `groundChunkLoader.test.ts` failures (no workers in the test roster — `generateTownPlan` emits no market/workshop plots for the fixture) are unrelated but worth fixing first so worker commutes are actually exercised (background task `task_8a143b5d`).

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/plans/2026-06-25-3d-agent-walking-integration.md","sha256WithoutMarker":"ccb97a288831bd5c6e2e4770efc6d64c3d91e99051997df81e76de5f550306ef","markedAtUtc":"2026-06-25T22:37:27.395Z"} -->
