# Brief: occupants walk between stations (Agora 7b7c68f4, drafted 2026-07-14)

The p40 board task had no body; this brief makes it dispatchable. Investigated
by subagent, verified references below.

## Current state (the snap)

- Bake is pure and deterministic: `interior/occupancy.ts:239` builds
  `stationsByHour`; `bridge/buildingOccupancy.ts:130-159` resolves stations to
  plan feet (furnishing center, else room anchor; levels include -1). The render
  packet `BuildingOccupantRender` (`world3d/types.ts:41-53`) carries ONLY
  `stationsByHour` — no rooms/doors/walls.
- The snap lives in the render layer: `World3D/InteriorOccupants.tsx:129-142`
  indexes `stationsByHour[h]` at an INTEGER hour and writes the position
  directly. `InteriorHourContext.tsx:47-62` quantizes the fractional clock to
  ints — that quantization is the whole bug.
- Contrast: `GroundAgents.tsx:90-92` (street commuters) reads the fractional
  clock per frame and interpolates. Same clock, different handling.
- Keep the camera gate: only nearest ≤10 bodies mesh (18/24 m hysteresis).

## Reuse decision (one mover)

Reuse `roster/agentPath.ts` `positionAlongPath(path,t):149-164` (pure polyline
lerp, no street coupling) and mirror the prev→cur commute-window pattern from
`roster/townSnapshot.ts:101-133`. For door-aware routing, mirror the street
dijkstra over the door graph — do not import it (street-coupled). Do not touch
combat `utils/pathfinding.ts` (battle-grid coupled).

## Slices

- S0: feed InteriorOccupants the fractional clock (like GroundAgents).
- S1 (smallest visible): new pure `World3D/occupantMotion.ts` — straight-line
  lerp prev→cur within a level using the existing packet, no re-bake; yaw from
  motion; cross-room still snaps.
- S2: door-aware within a floor — dijkstra over `BlueprintFloor.doors` (the
  `wireDoors` spanning tree); needs door/room geometry baked into the packet.
- S3: stairs / cross-level incl. basements via `plan.stairs`.

## Files

New `World3D/occupantMotion.ts` (+ S2: `interior/interiorPath.ts`); touch
`InteriorOccupants.tsx`, `World3DScene.tsx:961`, and for S2 `world3d/types.ts`
+ `bridge/buildingOccupancy.ts` + the packet bake in `bridge/interiorParts.ts`
(~:1023).

## Tests + proof

Vitest: `occupantMotion.test.ts` (mid-window strictly between stations,
endpoints exact, deterministic); extend `InteriorOccupants.test.tsx` (currently
asserts the snap); S2 `interiorPath.test.ts`. Proof rig: extend
`.agent/scratch/shoot-living-interiors.mjs` — scrub `__wfAgentClock` to a
transition (e.g. 17.7) and screenshot a figure mid-walk between stations.

## Open questions for Remy (block S1 scope, not S0)

1. Walk window: fixed half-hour fraction (streets' pattern) or constant m/s
   speed? A house is small — real speed finishes in seconds.
2. S2 packet: bake the door graph (fatter, flexible) or resolved per-transition
   waypoint polylines (leaner)?
3. Unobserved bodies show their pure interpolated in-transit spot when the
   camera arrives (no catch-up), same as street agents — assumed yes.
4. Walk gait (reuse crowd bake) or glide the current figure? Affects S1 scope.
5. Walkers glide through furniture/each other (streets do the same) —
   acceptable at this scale?
