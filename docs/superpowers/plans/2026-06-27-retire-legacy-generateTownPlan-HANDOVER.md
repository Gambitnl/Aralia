# Handover: Retire legacy `generateTownPlan.ts` + fix the 2D/3D business-binding bug

## Status: DONE — landed, tested, visually verified. Left in the tree (2am snapshot commits).

## What this task was
Follow-up #5 of the Worldforge canonical-town program: "retire the now-unused
`town/generateTownPlan.ts` rect generator." The premise was WRONG — the file was **not
unused**, and the mislabel hid a live bug. Retiring it properly *was* the fix. This work
deletes the old generator, migrates every importer to the canonical/townEngine path, and
fixes a plot-ID mismatch that left 3D town shops unbound.

## The bug it fixed (the important part)
A name collision hid it: `generateTownPlan` is exported by BOTH the retired
`town/generateTownPlan.ts` (rect/organic-street) AND the live `town/townEngine.ts`
(Voronoi wards). Nine files imported the old one, including a LIVE path:

- `World3DWrapper.tsx` pre-registers town businesses/NPCs on Enter-3D, keyed
  `biz_burg_<id>_plot_<plotId>` / `npc_burg_<id>_plot_<plotId>`, using plot IDs from the
  **old** generator.
- The renderer, `groundChunkLoader.groundTowns` (canonical Option-B path), looks those up
  by **canonical** plot IDs (`groundChunkLoader.ts:585,640`).
- Different generators → different plot-ID spaces → registered shops/keepers mostly never
  bound to the rendered buildings.

## Read these first (in order)
- Memory: `C:\Users\Gambit\.claude\projects\F--Repos-Aralia\memory\worldforge-canonical-town.md`
  — now records this retire + the bug (bullet "`town/generateTownPlan.ts` RETIRED 2026-06-27").
- This program's prior handover context + `docs/…/velvet-giggling-creek.md` (Option B plan).
- Project directives in `MEMORY.md`: no-fallback, no-estimates, visual-inspection-rule,
  no-branches/worktrees.

## The fix — single shared plot-ID source
`groundChunkLoader.ts` now exports `canonicalArtifactTownForSite(worldSeed, site)`:
`getBridgeAtlas` → `getCanonicalTownPlan` → `transformTownPlan` (scale by population,
place at the burg envelope) → `toArtifactPlan`. **Both** `groundTowns` (geometry + roster)
and `World3DWrapper` (business/NPC registration) call it, so plot IDs match by construction.

## Files changed
- `src/systems/worldforge/bridge/groundChunkLoader.ts` — NEW exported
  `canonicalArtifactTownForSite`; `groundTowns` refactored to use it (removed the inline
  duplicate + the now-unused `townAtlas` local). Added imports `RegionTownSite`,
  `type AdaptedTownPlan`.
- `src/components/World3D/World3DWrapper.tsx` — dropped the old-generator import; the
  business/NPC loop now calls `loaderMod.canonicalArtifactTownForSite(wfSeed, t).plan`.
- NEW `src/systems/worldforge/town/demoTownPlan.ts` — `buildDemoTownPlan(worldSeed, opts?)`:
  synthetic Voronoi cell → `townEngine` → `voronoiTownToArtifactPlan` (NO atlas needed).
  Returns `{ plan, footprint, bounds }`. `DEMO_BURG_ID = 9001`.
- `src/components/Worldforge/AgentSimPreview.tsx` — uses `buildDemoTownPlan`; **removed the
  demo/voronoi town-source toggle** (both were converging on voronoi).
- `src/components/Worldforge/AgentSim3DPreview.tsx` — uses `buildDemoTownPlan` (bounds-based
  framing instead of the old synthetic envelope).
- `src/components/debug/AgentSimDevOverlay.tsx` — uses `buildDemoTownPlan` + imported
  `DEMO_BURG_ID`.
- `src/systems/worldforge/__integration__/pipeline.test.ts` — local `townPlanForSite` helper
  (townEngine+toArtifactPlan via the site envelope footprint). **Goldens re-frozen:**
  `plotCount 15 → 216`, `addedInteriorRoomCount 7 → 1`. The brittle exact-float `firstPlot`
  footprint golden was relaxed to stable fields (the byte-for-byte round-trip is asserted
  separately). `burgId 264` + `townFeatureCount 1395` unchanged.
- `src/systems/worldforge/roster/__tests__/generateTownRoster.test.ts` — `generatedPlan()`
  repointed to townEngine+toArtifactPlan (behavioral assertions only; no golden re-freeze).
- `src/systems/worldforge/bridge/__tests__/groundChunkLoader.test.ts` — NEW regression test
  "binds businesses registered against canonicalArtifactTownForSite plot IDs".
- **DELETED:** `town/generateTownPlan.ts`, `town/__tests__/generateTownPlan.test.ts` (+snapshot),
  root `test-town-plan.ts`, `scripts/worldforge/renderTownProof.ts`.

## Key decisions (don't re-litigate)
1. Live identity paths (World3DWrapper + groundTowns) MUST share ONE generator via
   `canonicalArtifactTownForSite` — that's what fixes the bug.
2. Demo previews CAN'T use `getCanonicalTownPlan` (their synthetic burg `9001` has no atlas
   backing), so they use `townEngine` directly through `buildDemoTownPlan`. Two adapters
   coexist by design: `toArtifactPlan` (canonical/live) and `voronoiTownToArtifactPlan`
   (demo) — both emit the same artifact shape.
3. Relaxed the pipeline exact-float footprint golden rather than pin new brittle floats;
   the real persistence contract (`restoredReplay === originalReplay`) is still asserted.

## Verification (re-run before changing anything)
- `npx vitest run src/systems/worldforge/town src/systems/worldforge/bridge src/systems/world3d src/components/Worldforge src/components/__tests__/MapPane.test.tsx src/systems/worldforge/roster/__tests__/generateTownRoster.test.ts` → **385 green**.
- `npx tsc --noEmit` — zero NEW errors in touched files. (Pre-existing, unrelated:
  `World3DWrapper.tsx:38,678` `_stubService` implicit-any — untouched by this diff; and the
  wider project's known pre-existing TS errors in `src/commands`, `BattleMap` tests, etc.)
- Visual (visual-inspection rule): `npx tsx .agent/scratch/townIdentityProof.mjs` →
  `town-identity-proof.png` shows 2D canonical ≡ 3D-transformed input (burg "Agrannoce":
  same wall ring / wards / streets / civic; orange 3D plot quads align).

## Deferred follow-ups (still open on the canonical-town program)
1. Literal 3D dock/bridge/gatehouse MESH geometry — the loader still renders these civic
   roles as generic boxes / a continuous wall ring (`townPlanAdapter.roleForCivic` returns
   null for dock/bridge; walls render as one ribbon). Needs real geometry like
   `world3d/wallGeometry.ts`.
2. Roster/household identity between 2D `generateHousehold` and 3D `generateTownRoster`
   (who-lives-where parity; this program only unified town shape + business binding).

## Guardrails
- Any town change must keep 2D↔3D identity — re-run `townIdentityProof.mjs` and eyeball it.
- If you touch the live plot-ID path, keep World3DWrapper and groundTowns on the SAME
  `canonicalArtifactTownForSite` — the regression test in `groundChunkLoader.test.ts` guards
  this.
- Work in master only (no branches/worktrees). Don't commit unless asked.
