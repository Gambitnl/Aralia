---
schema_version: 1
gap_schema: project_gap_registry
project: Code Modularization Audit
slug: code-modularization-audit
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-12"
gap_count: 0
open_gap_count: 0
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/code-modularization-audit/NORTH_STAR.md
tracker: docs/projects/code-modularization-audit/TRACKER.md
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
# Code Modularization Audit Gap Registry

Status: active
Last updated: 2026-06-25

| ID | Status | Risk | Owner | Surface | Evidence | Why it matters | Next action | Next proof |
|---|---|---|---|---|---|---|---|---|
| CMA-G1 | routed | high | roadmap-maintenance | Roadmap visualizer and generator | `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx` (~3407 lines); `devtools/roadmap/scripts/roadmap-engine/generate.ts` (~2752 lines) | Roadmap is a discoverability surface; large files make node health and routing changes harder to review, and this project has review-gated routing constraints. | Route to roadmap-maintenance; no forward movement until roadmap gate clears. | `docs/projects/roadmap-maintenance/GAPS.md` owner review + `devtools/roadmap` owner notes. |
| CMA-G2 | narrowed | medium | glossary-ui | Spell gate checker details | `src/components/Glossary/spellGateChecker/spellGateBucketDetails.ts` (~3195 lines) | Spell/glossary gate logic is domain-dense; splitting without owner routing could lose audit intent. | Route to glossary-ui + structured spell execution for boundary ownership of mismatch contracts and test proof. | `src/components/Glossary/spellGateChecker/__tests__/SpellGateChecksPanel.test.tsx` + `src/hooks/__tests__/useSpellGateChecks.test.tsx`; route status in `docs/projects/glossary-ui/GAPS.md`. |
| CMA-G3 | narrowed | medium | design-preview | Design preview step components | `src/components/DesignPreview/steps/PreviewComponents.tsx` (~1536 lines); sibling preview steps over 900 lines | Design preview is UI-heavy and may benefit from smaller step modules, but visual verification is required before claims. | Route to Design Preview for step ownership and screenshot/test-led split path. | `src/components/DesignPreview/steps/__tests__/PreviewEnvironment.test.tsx`, `src/components/DesignPreview/steps/PreviewTables.test.tsx`, plus design-preview visual check list. |
| CMA-G4 | narrowed | high | providers, layout, combat | App/action orchestration | `src/App.tsx` (~1161 lines); `src/hooks/useAbilitySystem.ts` (~1068 lines); `src/hooks/combat/engine/useCombatEngine.ts` (~1007 lines) | Central orchestration files where split mistakes can change behavior broadly and impact multiple owner surfaces. | Keep as routing-only and hand off to owning project trackers before any implementation. | `src/App.tsx` dependency list; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.test.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts`. |
| CMA-G5 | narrowed | medium | battle-map | Battle map VFX | `src/components/BattleMap/vfx/VFXSystem.tsx` (~1083 lines) | Visual/terrain effects are hard to inspect in raw code and need render-aware proof for safe splits. | Route to Battle Map and maintain renderer boundaries + visibility helpers before modular movement. | `src/components/BattleMap/vfx/__tests__/VFXSystem.visibility.test.tsx`; route to `docs/projects/battle-map/GAPS.md` as stable render boundary follow-up. |
| CMA-G6 | narrowed | medium | submap | Submap painter dependency extraction | `src/components/Submap/painters/SubmapDoodadPainter.ts` (~817 lines) | Submap is likely a phase-out surface, but painter/gameplay dependencies may need preservation elsewhere. | Route to Submap for painter-path parity and legacy-path extraction gap. | `src/components/Submap/painters/` export map + `src/components/Submap/SubmapPane.README.md`; add submap owner test/contract follow-up. |
| CMA-G8 | routed | high | character-creator, character-sheet | Character/race creation cluster | `src/utils/character/characterUtils.ts` (~1472 lines); `src/data/races/racialTraits.ts` (~1139 lines); `src/components/CharacterCreator/Race/RaceDetailPane.tsx` (~949 lines) | Character creation is currently review-gated for navigation policy, but these files are large enough that future modularization needs a preserved trait/progression contract rather than a visual-only split. | Routed to character-creator G6 and character-sheet G5; review-only until character-creator gate clears. | `src/utils/character/__tests__/characterUtils.test.ts`; character-creator review decision; character-sheet consumer audit. |
| CMA-G9 | routed | medium | spells | Spell validation/type contract cluster | `src/systems/spells/validation/spellValidator.ts` (~909 lines); `src/systems/spells/validation/spellValidator.d.ts` (~1552 lines); `src/types/spells.ts` (~1075 lines); `src/types/spells.d.ts` (~707 lines) | Spell validation has generated and hand-authored type surfaces mixed with runtime validation. Splitting without generator/type ownership clarity can desync structured spell contracts. | Routed to spells G7 for validator/type ownership scoring before physical split. | `src/systems/spells/validation` tests and spell gate audit checks define the first proof boundary. |
| CMA-G10 | routed | high | saveload, party-ui | Central state/save/load contract cluster | `src/state/appState.ts` (~831 lines); `src/state/actionTypes.d.ts` (~1043 lines); `src/state/reducers/characterReducer.ts` (~840 lines); `src/services/saveLoadService.ts` (~806 lines) | These files sit on load, migration, reducers, and generated action typing. Modularization risk is behavioral, not just file size, because save compatibility and reducer defaults can shift silently. | Routed to saveload G6 and party-ui G6; require migration/load regression tests before any split. | `src/state/reducers/__tests__`, `src/state/migrations/__tests__`, save/load focused tests. |
| CMA-G11 | routed | medium | glossary-ui | Glossary rendering/registry cluster | `src/components/Glossary/spellGateChecker/SpellGateBucketSections.tsx` (~1071 lines); `src/components/Glossary/IconRegistry.tsx` (~1001 lines); `src/components/Glossary/SpellCardTemplate.tsx` (~644 lines) | Glossary UI has multiple large display/registry files in addition to CMA-G2; modularization should preserve icon registry coverage and spell-card rendering proof. | Routed to glossary-ui G5 with visual/test proof expectations. | Spell gate panel tests, icon registry coverage, and glossary UI smoke proof. |
| CMA-G12 | routed | medium | companions, dialogue, conversation-panel | Companion banter orchestration | `src/hooks/useCompanionBanter.ts` (~763 lines) | Banter logic crosses companion state, dialogue timing, and conversation presentation; a split can create duplicate conversation scheduling if ownership is unclear. | Routed to companions G8, dialogue DIAL-006, and conversation-panel CP-004 for boundary-first extraction. | Companion banter tests or conversation panel proof around timing and interruption behavior. |
| CMA-G13 | routed | medium | crafting, crafting-ui | Crafting/alchemy cluster | `src/systems/crafting/alchemyRecipes.ts` (~714 lines); `src/components/Crafting/AlchemyBenchPanel.tsx` (~674 lines) | Recipe corpus and bench UI are both large enough to hide validation and presentation concerns; future splits should distinguish data sharding from gameplay/UI behavior. | Routed to crafting G9 and crafting-ui G6 before implementation; avoid recipe deletion or corpus pruning. | Crafting recipe validation tests and alchemy bench UI proof. |
| CMA-G14 | routed | medium | three-d-modal | ThreeDModal scene/props cluster | `src/components/ThreeDModal/Scene3D.tsx` (~709 lines); `src/components/ThreeDModal/PropsLayer.tsx` (~755 lines) | The 3D modal scene is a single R3F-heavy assembly point; splitting needs render verification and prop-layout parity. | Route to three-d-modal for scene/props separation and keep visual proof before any split. | `src/components/ThreeDModal` render/screenshot proof and owner-local route acceptance. |
| CMA-G15 | routed | medium | battle-map | Battle map 3D actor/terrain cluster | `src/components/BattleMap/characters/CharacterActor.tsx` (~697 lines); `src/components/BattleMap/terrain/TerrainMesh.tsx` (~675 lines) | Combat-map visuals mix animation, selection decals, and terrain generation, so modularization needs frame/render parity. | Route to battle-map for actor/terrain ownership boundary review. | Battle-map parity coverage plus visual proof that actor and terrain rendering still align. |
| CMA-G16 | routed | medium | submap | Submap pane and painter cluster | `src/components/Submap/SubmapPane.tsx` (~679 lines); `src/components/Submap/painters/SubmapFeaturePainter.ts` (~667 lines); `src/components/Submap/painters/TextureAtlasManager.ts` (~586 lines) | The submap surface still carries legacy/orphan headers and several painter helpers; a split needs painter parity and atlas contract preservation. | Route to submap for legacy-path extraction and painter parity review. | `src/components/Submap/SubmapPane.README.md` / `DEPENDENCY_CONTRACT.md` plus submap owner tests or parity proof. |
| CMA-G17 | routed | high | layout | Global modal manager | `src/components/layout/GameModals.tsx` (~721 lines) | Central modal orchestration crosses many owners and lazy-load boundaries, making regressions easy to hide. | Route to layout for modal-manager decomposition and acceptance of a smaller owner-specific manager split. | Layout modal smoke proof plus open/close coverage for the extracted manager. |
| CMA-G18 | routed | high | combat | Combat execution and UI orchestration | `src/hooks/combat/useActionExecutor.ts` (~753 lines); `src/components/Combat/CombatView.tsx` (~619 lines); `src/components/Combat/EncounterModal.tsx` (~586 lines); `src/types/combat.ts` (~704 lines) | Combat core types, action execution, and combat UI are still co-located enough that behavior can drift if modularized without end-to-end combat proof. | Route to combat for a bounded split plan that preserves turn flow, log state, and encounter generation. | `src/hooks/combat/__tests__`, `src/components/Combat/__tests__`, and combat scenario replay/smoke proof. |
| CMA-G19 | routed | medium | scripts-audits | Spell audit and enrichment scripts | `scripts/generateSpellReferencedRulesEnrichment.ts` (~743 lines); `scripts/auditSpellSubClassesRoster.ts` (~671 lines); `scripts/archive/spell-canonical-retrieval/captureSpellCanonicalData.ts` (~658 lines) | The spell audit/tooling lane is accumulating multi-stage scripts; modularization should preserve the generator/harvest sequence and emitted artifacts. | Route to scripts-audits for stage boundaries and script ownership review. | Script dry-run or diff-check proof against the generated glossary or canonical outputs. |
| CMA-G20 | routed | medium | code-modularization-audit, owning type consumers | Type barrel dependency pressure | `src/types/index.ts`; `src/types/core.ts`; `src/types/items.ts`; `src/types/character.ts`; `src/types/combat.ts`; retired `docs/plans/refactors/ARCH_TYPES_REFACTOR.md` and `docs/plans/refactors/TYPES_REFACTOR_PLAN.md` | The old type-consolidation notes are stale because the type lane is already split into many domain files, but the remaining barrel/import-graph concern is still valid and should be scored from current imports before any physical movement. | Keep this as a routing/scoring signal: inspect current imports from `src/types/index.ts`, route risky consumers to their owning projects, and avoid broad type churn without focused compile/test proof. | Import-graph audit plus focused tests or type checks for whichever owner accepts a bounded type-boundary change. |

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Status Notes

- This project is a routing and evidence project, not a cleanup mandate.
- No systems may be deleted or rewritten just because a file is large.
- Candidates tied to review-gated projects should be documented but not assigned for forward implementation until the review gate clears.
- Review-gated scope identified in this pass: CMA-G1 (Roadmap Maintenance path routing) and CMA-G4 (App/Providers/Layout/Combat split-surface cluster) are marked narrowed/routed, not assigned.
- CMA-T4 complete 2026-06-08: owner-local gap rows now exist for CMA-G1 through CMA-G7 routes. High-risk App/providers/layout/combat scope is review-gated in owner docs, not assigned for forward code movement.
- CMA-T5 complete 2026-06-08: second-tranche candidates CMA-G8 through CMA-G13 were added from the next largest human-maintained source files. Character-creator-facing scope stays review-only while that project is gated; central state/save/load scope is high-risk route-only until migration/load proof is explicit.
- CMA-T6 complete 2026-06-08: second-tranche candidates CMA-G8 through CMA-G13 are now owner-routed. These are still split-planning signals, not permission for implementation.
- CMA-T7 complete 2026-06-08: next-tranche routes CMA-G14 through CMA-G19 cover the `three-d-modal`, `battle-map`, `submap`, `layout`, `combat`, and `scripts-audits` clusters. They remain routing-only until owners accept them.
- 2026-06-25 backlog-retirement pass: retired the old standalone type refactor notes after confirming `src/types/core.ts`, `items.ts`, `character.ts`, and many domain type files already exist. CMA-G20 preserves only the still-valid import-graph/barrel pressure as a current scoring signal.

## Next Assignment

Continue scoring new candidates only after owner projects have consumed these routes. Implementation should wait until an owning project has accepted the candidate, preserved behavior is explicit, and a focused test boundary exists.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
