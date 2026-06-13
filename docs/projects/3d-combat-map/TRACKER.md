# 3D Combat Map Living Tracker

Status: active
Last updated: 2026-06-11

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|

Current resume path: T4 is done, NC1 is complete (G2 closed, independently reproduced 2026-06-08), G4 has a live browser slope-click proof (closed 2026-06-09), G6 is closed after a focused terrain-shader console sweep, and NC2 is complete (G3/G7 closed 2026-06-11). The reachable `?dev_combat=1` fixture entered CombatView, mounted inline and pop-out `BattleMap3D`, preserved `renderMode=3d`, turn order, and inspected token across return, and logged zero forbidden WebGL/postprocessing errors. Next open work: run the G11 targeting-decal saved-PNG proof from `HANDOFF.md`, then continue G12 elevation contrast or a bounded G9/G10 tactical readability proof slice. Pick the highest-value in-scope item first.

## Next-Check List For Future Slices

These are the standing acceptance checks the next implementation slice should run
before claiming combat-3D visual/parity work is done. They are deliberately small,
evidence-backed, and mapped to open gaps. Full step-by-step definitions and the
pass/fail bars live in `AUDIT_OR_PROOF.md`.

| Check ID | Type | What it proves | Primary surface | Guards | Pass bar |
|---|---|---|---|---|---|
| NC1 | visual smoke | 3D combat scene renders cleanly with no repeated WebGL/postprocessing console errors | `src/components/BattleMap/BattleMap3D.tsx` (Canvas + Bloom/Vignette + ContactShadows) | G2 | Completed 2026-06-08: browser Battle Map Demo 3D view mounted a 766x1068 canvas and logged no repeated `GL_INVALID_OPERATION` / `glBlitFramebuffer` / SSAO / NormalPass errors. |
| NC2 | integration | Render-mode and combat lifecycle survive a pop-out round trip | `src/components/Combat/CombatView.tsx` (`renderMode` state + inline/pop-out toggles + pop-out container) | G3 | Completed 2026-06-11: `?dev_combat=1` + Continue Journey reached CombatView; inline 3D and pop-out 3D canvases mounted; return preserved `renderMode=3d`, turn order, and inspected token `Satum`; 2D/3D toggle still worked afterward; zero captured console errors. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G5 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Project boundary review | `World3D` and `ThreeDModal` follow their own renderer stacks; shared style standards are undefined. | `docs/projects/world3d/NORTH_STAR.md`, `docs/projects/three-d-modal/NORTH_STAR.md`, `src/components/BattleMap/BattleMap3D.tsx` | Risk of drift in color, lighting, and interaction expectation. | Add a short policy note in this project before extending shared renderer assets. | Add one decision row in both projects if shared standards are adopted. |
| G9 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | AAA-lite visual readability research triage (2026-06-10) | Character silhouette pop at tactical zoom still lacks a source-backed implementation/proof choice between selective postprocess outline and material-level rim light. | `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/characters/CharacterActor.tsx`; external research brief triaged 2026-06-10 | Unselected characters can blend into terrain/fog/foliage at 15-35 world units. | Prototype the smallest reversible actor-pop profile, starting with material-level rim/Fresnel before any selective Outline pass. | Tactical-zoom screenshots across representative biomes plus console sweep with no repeated WebGL/postprocessing errors. |
| G10 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | AAA-lite visual readability research triage (2026-06-10) | Status and defeat state readability in 3D needs a tactical-distance proof pass before adding more effects. | `src/components/BattleMap/CharacterToken.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/components/BattleMap/characters/CharacterActor.tsx`; `docs/projects/combat/GAPS.md` G14/G20 | The 3D view can hide why a unit is disabled, dying, stable, dangerous, or dead even when combat rules are correct. | Audit existing 3D status labels, defense badges, and death animation; add only one compact layer if rendered proof fails. | Rendered 3D proof with at least one buff/debuff and one downed/dead character, plus 2D/3D parity note. |
| G11 | open | adjacent_follow_up | future_worker | `.agent/3d-visual-quality/TRACKER.md` | Bounded gap sweep import (2026-06-11) | 3D targeting decals have implementation/live-eye-test evidence, but durable saved PNG proof is still owed for the living project. | `.agent/3d-visual-quality/TRACKER.md` rows 257-258; `src/components/BattleMap/TargetingDecals.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `docs/projects/3d-combat-map/HANDOFF.md` | Targeting readability is central to actually playing in 3D; without a durable capture, future agents cannot tell whether the live-eye-test state still holds. | Re-run the capture rig through `?dev_combat=1`, select Satum -> Acid Splash or equivalent targeting mode, and save before/after 3D screenshots. | Saved before/after PNGs show 3D targeting decals in-canvas; console sweep has no repeated WebGL/postprocessing errors. |
| G12 | open | adjacent_follow_up | future_worker | `.agent/3d-visual-quality/GAPS.md` | Bounded gap sweep import (2026-06-11) | Battle-map generator elevations are too gentle for slope-rock and high-ground readability to show consistently at tactical zoom. | `.agent/3d-visual-quality/GAPS.md` gap 28; `.agent/3d-visual-quality/TRACKER.md` task 65; `src/services/battleMapGenerator.ts`; `src/components/BattleMap/terrain/TerrainMesh.tsx` | Terrain shader work can be correct while playable maps still look too flat, keeping high-ground cues and slope drama only partially visible. | Prototype a generator-side elevation contrast slice while preserving deterministic map generation and existing biome contracts. | Pose-matched tactical screenshots before/after at seed 424242 show stronger readable slopes without breaking forest/desert/cave traversal; focused generator/terrain tests pass. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
