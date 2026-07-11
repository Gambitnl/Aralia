---
schema_version: 1
gap_schema: project_gap_registry
project: 3D Combat Map
slug: 3d-combat-map
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-07-10"
gap_count: 7
open_gap_count: 7
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 1
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/3d-combat-map/NORTH_STAR.md
tracker: docs/projects/3d-combat-map/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# 3D Combat Map Gap Registry

Status: active
Last updated: 2026-07-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

Research triage note, 2026-06-10:
An external AAA-lite visual-readability report was reviewed against current Aralia source. Only gaps that remain useful and project-owned are added below. The report's SSAO/N8AO recommendation is not imported because this project already removed the unstable SSAO/NormalPass path and replaced its ground-darkening role with ContactShadows. Terrain slope rock, wet banks, macro terrain noise, grass wind, per-character idle phases, biome lighting, and several 3D actor badges already exist in source and should not be reopened from the generic report without a fresh visual failure.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G5 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Relationship scan | No joint visual standard document exists across `BattleMap3D`, `World3D`, and `ThreeDModal`. | `docs/projects/world3d/NORTH_STAR.md`, `docs/projects/three-d-modal/NORTH_STAR.md`, `src/components/BattleMap/BattleMap3D.tsx` | Future style drift can confuse users when shifting between combat and exploration 3D surfaces. | Add a short policy note if shared standards are adopted; otherwise keep explicit boundaries. | Add link/decision in next project update only. |
| G9 | open | adjacent_follow_up | future_worker | `src/components/BattleMap/characters/CharacterActor.tsx` | AAA-lite visual readability research triage (2026-06-10) | Character silhouette pop at tactical zoom still lacks a source-backed implementation/proof choice between selective postprocess outline and material-level rim light. Existing actor cues cover team colors, nameplates, selection/turn rings, and defense badges, but no durable proof shows unselected characters stay readable across all five biomes at 15-35 world units. | `src/components/BattleMap/BattleMap3D.tsx` (Bloom/Vignette + ContactShadows, no SSAO), `src/components/BattleMap/characters/CharacterActor.tsx` (team colors, rings, nameplate, actor geometry), external research brief triaged 2026-06-10 | Tactical selection and target recognition can fail when humanoids blend into noisy terrain, fog, or foliage. The useful part of the report is the readability goal; the specific recipe must be proven against Aralia's current postprocessing stack and SwiftShader/browser screenshot constraints. | Prototype the smallest reversible actor-pop profile: first test material-level Fresnel/rim on CharacterActor materials; only test selective `Outline` if it does not reintroduce selection-layer, transparency, or postprocessing instability. Keep SSAO/N8AO out of this slice. | Visual screenshot proof at tactical zoom for at least forest/desert/cave, plus console sweep with no repeated WebGL/postprocessing errors; unit/component proof should confirm the actor-pop prop does not disturb existing defense badge and selection-ring parity. |
| G10 | open | adjacent_follow_up | future_worker | `src/components/BattleMap/characters/CharacterActor.tsx` + `src/components/BattleMap/vfx/VFXSystem.tsx` | AAA-lite visual readability research triage (2026-06-10) | Status and defeat state readability in 3D needs a tactical-distance proof pass before adding more effects. Existing source has 2D token status badges, 3D actor defense badges, VFX-attached status labels, death-save panels, and CharacterActor animation states, but no project acceptance proof says conditions, unconscious/dead state, and death-save urgency are legible in the 3D canvas at about 20 world units. | `src/components/BattleMap/CharacterToken.tsx`, `src/components/BattleMap/CombatCharacterInspector.tsx`, `src/components/BattleMap/InitiativeTracker.tsx`, `src/components/BattleMap/vfx/VFXSystem.tsx`, `src/components/BattleMap/characters/CharacterActor.tsx`, `docs/projects/combat/GAPS.md` G14/G20 | Combat rules can be correct while the 3D view hides the reason a unit is dangerous, disabled, stable, dying, or dead. The useful research guidance is to prefer compact billboard/status/tint/prone/desaturation cues over noisy particles. | Audit existing 3D status labels, defense badges, and death animation in a live encounter. If they fail at tactical zoom, add one compact layer only: billboard condition stack, shader tint pulse, procedural prone/desaturation, or short dissolve/fade-to-ground marker. Avoid orbiting particle clutter unless visual proof shows icons/tints fail. | Rendered proof in 3D mode with at least one buff/debuff and one downed/dead character; 2D/3D parity notes show the same tactical facts remain visible when switching render modes. |
| G11 | open | adjacent_follow_up | future_worker | `.agent/3d-visual-quality/TRACKER.md` | Bounded gap sweep import (2026-06-11) | 3D targeting decals have implementation/live-eye-test evidence, but durable saved PNG proof is still owed for the living project. The side tracker says `TargetingDecals.tsx` now paints valid target and teleport tile sets onto terrain, but screenshot capture timed out on the heavy 3D frame and the before/after image proof remains missing. | `.agent/3d-visual-quality/TRACKER.md` rows 257-258; `src/components/BattleMap/TargetingDecals.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `docs/projects/3d-combat-map/HANDOFF.md` | Targeting readability is central to actually playing in 3D; without a durable capture, future agents cannot tell whether the live-eye-test state still holds after renderer or targeting changes. | Re-run the capture rig through `?dev_combat=1`, select Satum -> Acid Splash or equivalent targeting mode, and save before/after 3D screenshots. Keep this proof scoped to battle-map targeting, not Worldforge. | Saved before/after PNGs show 3D targeting decals in the canvas; console sweep has no repeated WebGL/postprocessing errors; tracker records the artifact paths. |
| G12 | open | adjacent_follow_up | future_worker | `.agent/3d-visual-quality/GAPS.md` | Bounded gap sweep import (2026-06-11) | Battle-map generator elevations are too gentle for slope-rock and high-ground readability to show consistently at tactical zoom. The slope-rock shader exists, but `.agent` visual-quality gap #28 says the current generator's smoothed elevation range rarely creates steep enough faces for the effect to read. | `.agent/3d-visual-quality/GAPS.md` gap 28; `.agent/3d-visual-quality/TRACKER.md` task 65; `src/services/battleMapGenerator.ts`; `src/components/BattleMap/terrain/TerrainMesh.tsx` | Terrain shader work can be correct while the playable maps still look too flat, keeping tactical high-ground cues and slope drama only partially visible. | Prototype a generator-side elevation contrast slice, such as wider elevation range or deliberate ridge/bluff features, while preserving deterministic map generation and existing biome contracts. | Pose-matched tactical screenshots before/after at seed 424242 show stronger readable slopes without breaking forest/desert/cave traversal; focused generator/terrain tests pass. |
| G13 | open | adjacent_follow_up | Codex | `docs/BACKLOG.md` migration 2026-06-25 | Combat overlays for range shapes, ruler logic, and movement enforcement still need 3D tactical proof. | `docs/BACKLOG.md`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/TargetingDecals.tsx` | 3D combat can be visually impressive but unplayable if the range, ruler, and movement legality cues do not match rules. | Define one 3D overlay/ruler enforcement slice that reuses existing targeting/movement state rather than inventing a parallel rule path. | Rendered 3D proof plus focused tests showing range shape, measured ruler distance, and illegal movement feedback match the 2D/rules path. |
| G14 | review-required | blocked_human_decision | Human/project owner / 3D maintainers | Production bundling and BattleMap3D post-processing | repository-wide build sweep 2026-07-10 | The production build cannot bundle Bloom because the installed Three package does not export `PostProcessingUtils` expected by its bundled `BloomNode.js`; choose dependency alignment, an explicit optional fallback, or a maintained compatibility shim. | `package.json`; `vite.config.ts`; `src/components/BattleMap/BattleMap3D.tsx`; `docs/projects/3d-combat-map/NORTH_STAR.md` Required Review Brief; `npm run build` failure | The application cannot ship while the dependency set is incompatible, but silently removing bloom would discard intended presentation and a local shim would create new maintenance ownership. | Choose Option A, B, or C in the Required Review Brief before changing the rendering dependency architecture. | Successful production build plus rendered `?dev_combat=1` proof, console sweep, and nearby 3D-surface regression checks appropriate to the chosen option. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Directly blocks or reduces confidence in this project's core goal. |
| `support_needed_now` | Not core implementation, but it blocks confidence in the main MVP path. |
| `adjacent_follow_up` | Useful, related, but not required for current 3D-combat MVP completion. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.

## G7 fixture and NC2 proof closed (2026-06-11)

The reachable-combat fixture queued by the Decision Blitz is implemented:
`?dev_combat=1` (dev-tools gated, `App.tsx`) auto-starts a deterministic
bestiary encounter (3 goblins + 2 orcs) once the autosave reaches PLAYING â€”
headless proof reached `phase=combat` with CombatView rendering the party vs
enemies (`.agent/campaign-kickoff/combat-fixture-check.mjs`,
`combat-fixture.png`). NC2/G3 pop-out lifecycle proof then passed through the
updated capture rig: drive `?dev_combat=1` + Continue Journey in
`.agent/3d-visual-quality/captures/nc2-combatview.mjs`.


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
