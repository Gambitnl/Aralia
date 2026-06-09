---
schema_version: 1
project: 3D Combat Map
slug: 3d-combat-map
category: Feature/UI Projects
main_category: Game & Simulation
subcategory: Combat & Encounters
status: active
last_updated: 2026-06-08
confidence: medium
evidence: docs/projects/3d-combat-map
gap_signal: "5 open gaps (G1/G2 closed; NC1 done. Open: G3 pop-out proof, G4 slope proof, G5 style policy, G6 shader warning, G7 NC2 blocked by World3D save fixture)"
protocol: living project doc set
next_step: Unblock NC2 (G7 — capture a 2D-exploration save fixture or add a dev hook to reach a battle-map encounter, then run nc2-combatview.mjs), or run the G4 terrain raycast browser proof.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - docs_consistency
  - scoped_tests
completed_verification:
  - docs_consistency
  - browser_visual_smoke
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: no
---

# 3D Combat Map North Star

Status: active
Last updated: 2026-06-08

## Purpose

Create a durable cold-start handoff for the combat 3D map renderer used in tactical combat.
The project is responsible for 3D map parity and production quality, while preserving existing combat mechanics and existing 2D behavior.

## Scope and Boundaries

In scope:
- BattleMap3D rendering for combat in `CombatView`.
- 3D renderer parity with the live 2D combat flow.
- Engine constraints, baseline performance targets, and MVP quality boundaries.
- Cross-surface integration with `BattleMap.tsx`, `CombatView.tsx`, and hook-based combat logic.

Out of scope:
- `World3D` world-scale exploration work.
- `ThreeDModal` exploration modal work.
- Combat rule changes, action economy changes, or spell logic.

## Files and Systems Map

- `src/components/BattleMap/BattleMap3D.tsx` (live R3F root)
- `src/components/BattleMap/terrain/*` (terrain, water, vegetation, decals)
- `src/components/BattleMap/camera/CameraController.tsx`
- `src/components/BattleMap/characters/CharacterActor.tsx`
- `src/components/BattleMap/vfx/*` (combat VFX and ambient world cues)
- `src/services/battleMapGenerator.ts` and `src/config/mapConfig.ts` (dimensions + deterministic generation)
- `src/components/BattleMap/BattleMap.tsx` and `src/components/BattleMap/BattleMapDemo.tsx` (2D and demo parity surfaces)
- `src/components/Combat/CombatView.tsx` (toggle host and pop-out container)

## Implemented State

- R3F combat map is live and integrated behind the 2D/3D mode switch in `CombatView`.
- Battle maps support five biomes: forest, cave, dungeon, desert, swamp.
- Deterministic map generation exists for 40x30 maps through `BattleMapGenerator`.
- The 3D subtree is substantially implemented:
  - terrain mesh, grid overlay, grass layer, water, trees/obstacles layer, VFX and particle layer, character actors, lights.
- Engine references already define the stack: three.js WebGL (`three`), `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`.

## Dashboard Card Schema

Project: 3D Combat Map
Slug: 3d-combat-map
Category: Feature/UI Projects
Status: active
Last updated: 2026-06-08
Confidence: medium
Evidence: docs/projects/3d-combat-map
Gap signal: 5 open gaps (G2/NC1 closed; G3 pop-out proof, G4 slope proof, G5 style policy, G6 shader warning, G7 blocker remain)
Protocol: living project doc set
Next step: Run the G4 terrain raycast browser proof, or run NC2 pop-out lifecycle proof.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency, scoped_tests, browser_visual_smoke
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-07
Agent comments:
Required docs: NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md
Optional docs: tasks/, architecture notes, migration notes
Compaction status: not_needed

## Engine Constraints and MVP Boundary

- MVP is a parity and quality gate, not a rules rewrite: 3D should be the visual front-end swap for combat while hooks keep logic.
- Target quality remains 60 fps on GTX 1060+ class desktop hardware.
- Current engine constraints in use:
  - Browser + three.js rendering via `<Canvas>`.
  - Post effects are optional by budget; SSAO remains excluded from this codepath after the 2026-06-08 NC1 browser proof confirmed the replacement stack was free of repeated SSAO/NormalPass/WebGL blit errors.
  - Deterministic generator input for fairness and reproducibility.
- MVP boundary for this project:
  - Implement all required 3D combat-map quality outcomes only within combat flow.
  - Keep 2D/3D behavior parity for movement, targeting, AoE, turn flow, and combat messages.
  - Do not merge unrelated 3D pathways.

## MVP Acceptance Criteria

The next implementation slice can treat the MVP boundary as stable when:

- `BattleMap3D` stays inside combat flow and does not absorb exploration-path behavior.
- 2D and 3D modes preserve movement, targeting, AoE, turn flow, and combat messages.
- `CombatView` pop-out and return preserve the active render mode and lifecycle state.
- The renderer stays inside the 60 fps target on GTX 1060+ class desktop hardware for the documented combat map size.
- Any enabled post-processing path is explicit about its budget and stability tradeoffs.

Not required for MVP:

- `World3D` exploration, chunk streaming, or world-scale traversal behavior.
- `ThreeDModal` travel and modal-exploration behavior.
- Combat rule changes, action economy changes, or spell logic changes.
- Shared renderer standardization across the combat, exploration, and modal 3D surfaces.

## Relationships to Nearby 3D Systems

- `battle-map`/`BattleMap3D` is the only combat renderer in this project.
- `World3D` is a separate pathway for exploration/map streaming and uses `WORLD3D_DEMO`/world chunks.
- `ThreeDModal` is an exploration modal with independent movement and travel callbacks, and is not the combat renderer.
- This project should preserve clear contracts so future renderer reuse does not mix combat movement/state flow with exploration flow.

## Open Questions

1. Should SSAO and post-processing usage remain required in MVP, or be made optional by render mode profile? (Resolved in code and proof: SSAO + `enableNormalPass` were removed for WebGL2 stability, ContactShadows now provides ground darkening, and NC1 passed in the browser on 2026-06-08 without repeated `GL_INVALID_OPERATION`, `glBlitFramebuffer`, `SSAO`, or `NormalPass` errors.)
2. Should `CombatView` pop-out 3D mode include stronger external sync for render mode and lifecycle state?
3. How strict should the 60 fps requirement be in the coldest test hardware profile before relaxing effects?

## Resume Path

1. Read this file.
2. Read `docs/projects/3d-combat-map/TRACKER.md` (Next-Check List NC1/NC2).
3. Read `docs/projects/3d-combat-map/GAPS.md`.
4. Read `docs/projects/3d-combat-map/AUDIT_OR_PROOF.md` for the durable NC1/NC2 step definitions and proof log.
5. Continue with the G4 browser slope-click proof, or execute NC2 to close out the pop-out concern.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
