# GOAL: 3D Combat Map — Visual Phase 3 (rev 2)

Goal: clear the remaining PARTIAL rows in `.agent/GOAL-3d-visual-quality.md`.
Rev 1 of this doc listed 7 packets built on stale premises — tasks 72–83 had
already closed most of them (status icons, death capture, targeting, AoE, rim
light, dead trees, fireflies, tactical spawns, terrain bluffs). Rev 2 is
verified against the GOAL doc as of 2026-07-18. Five packets remain.

Owner: Remy. Orchestrator: `orch-vis3d` (Agora). Rev 2: 2026-07-18.

## Rules (all packets)

1. Verify your rows are still open before coding — this campaign's docs move daily.
2. Onboard to Agora: `AGORA_AGENT_ID=<handle> node tools/agora/client.mjs onboard <handle>`. Claim your task, lock your files, back off on 409.
3. Read the top of `.agent/3d-visual-quality/TRACKER.md` (verification pipeline) and your GOAL rows.
4. Seed-pinned before/after: `SEED=424242 POSE="30,55,40" node .agent/3d-visual-quality/captures/shoot.mjs <label> <biomes>` (dev server on port 5174). Judge fine detail from native-res crops.
5. Verify: scoped vitest suites green + tsc clean on touched files.
6. Close out: TRACKER row + progress entry, GOAL rows with dated honest grades, GAPS for parked finds. Release locks; mark the Agora task done with proof.
7. Work in the main checkout on master — no branches or worktrees.

## Packets

### Q1 — Postprocessing: SSAO, grade, key light (GOAL #51, #53, #60, #57 residual; GAPS #1)
Fix SSAO on three ^0.170 + @react-three/postprocessing ^3.0.4 (or swap to N8AO),
then use working bloom/grade to make the frame read composited. Daylight motes
(#57 residual) need bloom to read — verify they light up once it works.
Key-light drama (#51) rides along. Dark biomes must not wash out (gap #21 is the
related overview edge case — fix it here if cheap).
Files: `src/components/BattleMap/BattleMap3D.tsx` (PostProcessingStack, SceneLighting).

### Q2 — Damage numbers at tactical zoom (GOAL #16)
Capture damage numbers in flight at 30u (the TARGETING/dev rigs in shoot.mjs can
trigger combat); enlarge/slow/outline them only if the capture proves they fail.
Files: damage-number component under `src/components/BattleMap/**` (locate first).

### Q3 — Forest density + boulders (GOAL #39, #46)
Clearings and thickets instead of uniform forest (density field in the tree
placement or generator — coordinate the generator file via Agora lock), and
boulders that read as stone formations, not lumpy dodecahedra (multi-lobe
clusters, flat-bottom settle, strata tint).
Files: `src/components/BattleMap/terrain/EzTreeLayer.tsx`, `DecorationProps.tsx`,
maybe `src/services/battleMapGenerator.ts`.

### Q4 — Terrain close-up + readability (GOAL #26, #29, #30)
Close-up texture detail (micro-normal or detail-noise octave), a clearer
walkable-vs-blocked read for wall/rock tiles (edge treatment or contrast), and
stronger material variety moments. All three live in the same shader.
Files: `src/components/BattleMap/terrain/TerrainMesh.tsx`.

### Q5 — Map utilization (GOAL #65)
Make battles use more of the 40×30 field: mid-field objectives/landmarks,
approach-phase spawn distance tuning, or shrinking scenic margins. This is part
design call — propose with captures before big changes.
Files: `src/hooks/useBattleMapGeneration.ts`, `src/services/battleMapGenerator.ts`
(Agora lock — Q3 may hold it).

## Parked (not packets)

- Gap #22: intermittent max-update-depth on slow mounts — needs isolation, non-visual.
- Gap #24: race reads subtly under team armor — art call for Remy.
- #4/#5/#9/#10 residuals — optional polish, revisit after Q1–Q5.

## Final gate

Remy plays it live. A non-developer should say "that looks like a 3D game."
