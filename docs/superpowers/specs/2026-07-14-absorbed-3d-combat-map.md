# Absorbed: 3D combat map (docs/projects/3d-combat-map)

Status: active reference — absorbed into planmap topic `combat-map-reskin` on 2026-07-15.
The living-project folder was deleted (git history is the archive). This doc keeps the
prose future agents still need: the code map, the verification rig, the standing
decisions, and the G14 production-bloom review brief.

## What this lane is

The 3D tactical combat renderer (`BattleMap3D`, React Three Fiber) used inside
`CombatView` behind the 2D/3D toggle. The lane owns 3D parity with the live 2D combat
flow and production quality — never combat rules, action economy, or spell logic.
Target: 60 fps on GTX 1060-class hardware at the documented map size. Visual fallback
substitutes never count as proof (a placeholder, alternate 2D render, or hidden error
boundary is a FAILED visual proof — decision D10, 2026-06-10).

Reachable two ways:
- In game: `?dev_combat=1` auto-starts a deterministic goblin/orc fixture once a save is
  loaded (click "Continue Journey" first), then the `3D` toggle on the battle-map header.
- Demo harness: `BattleMapDemo.tsx` (component showcase, used by the capture rig).

## Code map (all under `src/components/BattleMap/`)

- `BattleMap3D.tsx` — scene root: Canvas, camera, lighting, fog, terrain stack,
  characters, VFX, postprocessing. Read its layer order first.
- `terrain/` — TerrainMesh (heightfield + `makeTerrainHeightSampler`), GridOverlay,
  GrassLayer, WaterSystem, DecorationProps, EzTreeLayer, GroundScatter, DistantTerrain,
  GroundMist.
- `characters/` — CharacterActor (humanoid/beast/dragon/ooze/aberration body plans,
  team colors, HP pips, turn beacon), `useFresnelRim.ts`.
- `vfx/` — VFXSystem (spell zones, damage numbers, AoE preview), LivingWorld (ambient
  particles/weather).
- `TargetingDecals.tsx` — instanced tile decals projecting `validTargetSet` /
  `teleportDestinationSet` onto terrain in targeting mode.
- Combat state: `src/hooks/useAbilitySystem.ts`, `src/hooks/combat/*`. Tile keys
  `"x-y"`; tile = 1.0 world unit; world Y from the terrain height sampler.
- Generator: `src/services/battleMapGenerator.ts` + `src/config/mapConfig.ts`
  (deterministic 40x30 maps, five biomes: forest, cave, dungeon, desert, swamp).

## Verification rig

- `.agent/3d-visual-quality/captures/shoot.mjs` — headless Playwright capture;
  `storageState.json` (same dir) carries the autosave; serve on port 5174 to match its
  origin. `POSE="x,y,z"` drives `window.__bm3dCam`.
- Screenshot calls can hang on heavy WebGL frames — retry loop required.
- Per-biome A/B at SEED 424242 is the established proof pattern; judge at tactical zoom
  (~15-20 units), not close-ups. Crop native-res before judging fine detail.
- Record the renderer profile (hardware GL vs SwiftShader/SwANGLE) with every capture;
  do not depend on silent SwiftShader fallback.
- Enemy AI turns may stall headless — use the turn-order "click to skip here" buttons.
- Quality goal doc: `.agent/GOAL-3d-visual-quality.md`; dated task log + gap list in
  `.agent/3d-visual-quality/TRACKER.md` and `.agent/3d-visual-quality/GAPS.md`.

## Standing decisions

- D10 (2026-06-10): no visual-fallback substitutes in renderer proof — failures must
  surface as failures with diagnostics captured.
- D9 (2026-06-10): from the external AAA-lite readability report, only actor-readability
  gaps were imported (silhouette pop G9, status/defeat readability G10). SSAO/N8AO stays
  OUT — the unstable SSAO/NormalPass path was deliberately removed (NC1 proof
  2026-06-08); ContactShadows provides ground darkening. Slope rock, wet banks, macro
  terrain noise, grass wind, idle phases, and biome lighting already exist in source —
  do not reopen them from generic reports without a fresh visual failure.

## G14 review brief: production bloom dependency alignment (DECISION REQUIRED)

`npm run build` fails inside `three/examples/jsm/tsl/display/BloomNode.js` because it
imports `PostProcessingUtils`, which the installed `three.module.js` does not export
(found 2026-07-10). The app cannot ship a production build until one option is chosen:

- Option A: align and pin a compatible `three` / `@react-three/fiber` / `drei` /
  `postprocessing` set, then prove combat plus nearby 3D surfaces (best preserves bloom).
- Option B: make Bloom optional for production; keep Vignette/ContactShadows as the
  explicit stable fallback and park the bloom codepath behind a capability profile.
- Option C: a narrowly scoped compatibility shim for the missing export, with
  dependency-version guards and focused bundler tests (creates a maintenance surface).

Decision owner: Remy + 3D/dependency maintainers. Proof after decision: green
production build, rendered `?dev_combat=1` proof, console sweep, and regression checks
on any shared World3D/ThreeDModal dependency impact.

## Proof history (backdated into the planmap topic)

- NC1 visual smoke passed 2026-06-08 (clean console, no repeated GL_INVALID_OPERATION /
  glBlitFramebuffer / SSAO / NormalPass errors).
- NC2 pop-out lifecycle passed 2026-06-11 (`renderMode=3d`, turn order, and inspected
  token survive the pop-out round trip); `?dev_combat=1` fixture landed the same day.
- TargetingDecals implemented + live-eye verified 2026-06-11; durable before/after PNG
  proof still owed (gap G11).
