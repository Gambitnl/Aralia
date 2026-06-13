---
schema_version: 1
project: Design Preview
slug: design-preview
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: idle
last_updated: 2026-06-12
iteration: 8
confidence: medium
evidence: docs/projects/design-preview
gap_signal: "0 open gaps; lane steward map and split-proof notes added"
protocol: living project doc set
next_step: Maintain the lane steward map and await new preview requests or a re-route from the modularization audit.
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
completed_verification:
  - docs_consistency
last_proof: 2026-06-10
workflow_gaps_reviewed: 2026-06-09
compaction_status: needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Design Preview North Star

status: idle
Last updated: 2026-06-12
## Why This Project Exists

Design Preview is a standalone developer-facing UI surface for visual checks,
style comparisons, and glossary/spell content review outside the main gameplay
flow.

## Purpose and Scope

This project preserves implementation knowledge for a decoupled preview system
so future agents can continue work without re-deriving intent from scattered
code references. Scope is docs-only in this pass, with implementation read-only
by policy.

## Current State

- Design Preview is an active tool surface at `misc/design.html`.
- Runtime path: `misc/design.html -> src/design-preview.tsx -> src/components/DesignPreview/DesignPreviewPage.tsx`.
- The page exposes lane selection, style-variant switching, window-frame controls, and local codebase-visualizer actions.
- The project evidence path in `docs/projects/PROJECT_TRACKER.md` is `src/components/DesignPreview` with registry status `in-progress`.
- This pass refreshed the cold-start handoff so the next agent can resume from the doc set without re-deriving the workflow, and the manual launch/checklist proof now lives in `RUNBOOK.md`.
- The project now carries a source-backed lane steward and split-readiness map so future agents know which active preview lanes belong to which local systems and what proof is required before moving a large step file.

## File Map

| File | Role |
|---|---|
| `src/design-preview.tsx` | Standalone React mount for preview tool entry |
| `misc/design.html` | Standalone shell for design preview |
| `src/md-library-entry.tsx` | Standalone docs library mount that reuses DesignPreview components |
| `misc/md_library.html` | Docs library shell |
| `src/components/DesignPreview/DesignPreviewPage.tsx` | Main multi-lane preview router |
| `src/components/DesignPreview/VariantSwitcher.tsx` | Style variant dropdown with live-production marker |
| `src/components/DesignPreview/StyleVariants.tsx` | Shared style-layout primitives for variants |
| `src/components/DesignPreview/CreationComponents.tsx`, `src/components/DesignPreview/LegacyComponents.tsx` | Reusable preview primitives for creation/legacy UI patterns |
| `src/components/DesignPreview/steps/*` | Lane implementations for race, class, style, icons, 3D, components, tables, glossary, spell flow, and related preview surfaces |
| `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx` | Spell pipeline atlas preview surface, also referenced by `src/spell-pipeline-atlas.tsx` |
| `src/components/DesignPreview/steps/PreviewSpellGlossary.tsx` | Spell glossary preview with local glossary provider wrapper |
| `src/components/DesignPreview/steps/PreviewGlossaryRedirectSurfaces.tsx` | Glossary redirect surface gallery |
| `src/components/DesignPreview/steps/PreviewComponents.tsx` | Atomic UI inventory and usage showcase |

## Implemented State

- `DesignPreviewPage` currently declares and routes many lanes from one place, including `environment`, `spell_data_flow`, `tables`, `icons`, and `components`.
- At least 25 named steps are available via `currentStep`, spanning design, creation, gameplay, and system surfaces.
- The variant system is production-aware with selectable variants such as unified, legacy, split, modal, glossary, alchemy, combat, trade, and window, plus a per-step live marker map.
- Local visualizer integration is present with host, kill, and health functions against `localhost:3847` endpoints.
- Several preview surfaces intentionally rebind providers locally because the main app providers are not active in this standalone host.

## Integrations

- App decoupling note in `src/App.tsx` confirms Design Preview is moved off main app routing.
- Build integration in `vite.config.ts` conditionally includes `misc/design.html` and companion local pages as multi-entry build inputs.
- Shared styling is loaded via `styles.css`, not a local per-page style bundle.
- Visualizer control and status checks are integrated in the preview header.
- Spell data flow is integrated with atlas tooling via a shared component source.

## Workflow And Ownership

- Current doc steward: Worker B.
- Lane ownership is now mapped by source-backed local system rather than by guesswork. The active router is covered below, while dormant helpers remain noted as such instead of being treated like live lanes.
- The manual launch/checklist runbook now lives in `RUNBOOK.md`, which closes G2 and gives the next agent a repeatable proof path.
- G3 is now resolved by the lane steward map below.
- G4 is now resolved by the split-readiness map below, which names the large preview step files and the proof needed before any move or modularization.
- Refresh `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` in the same pass when lane, variant, or launch behavior changes.

## Lane Steward And Split Readiness Map

The table below ties each active preview lane to the local system that should steward it and the proof expected before a large step file is moved, split, or modularized. The rows are intentionally source-backed: they point at the actual step files in `src/components/DesignPreview/steps/*` and at the current proof anchors that already exist.

| Preview lane family | Active step ids | Source-backed steward | Large-step split candidates | Required proof before move/split |
|---|---|---|---|---|
| Character creation pack | `race`, `class`, `background`, `stats`, `skills`, `features`, `mastery`, `feats`, `age`, `visuals`, `review` | `character-creator` with `racial-mechanics` for the race/visuals branch | `PreviewRace.tsx`, `PreviewClass.tsx`, `PreviewBackground.tsx`, `PreviewStats.tsx`, `PreviewSkills.tsx`, `PreviewClassFeatures.tsx`, `PreviewWeaponMastery.tsx`, `PreviewFeats.tsx`, `PreviewAge.tsx`, `PreviewVisuals.tsx`, `PreviewReview.tsx` | Capture a rendered `misc/design.html?step=<lane>` screenshot for the target lane and add a focused step test before any extraction. The creator pack already uses `CreationStepLayout`, `ChoiceCard`, `LegacyCard`, `StatCounter`, `RangeSlider`, and `SkillTile`, so visual parity matters more than file size alone. |
| Equipment / trade / dialogue | `equipment`, `trade`, `dialogue` | `character-sheet` for equipment, `trade-ui` for trade, and `dialogue` for the conversation lane | `PreviewEquipment.tsx`, `PreviewTrade.tsx`, `PreviewDialogue.tsx` | Capture screenshots that show the interactive slot toggles, buy/sell routing, or dialogue history before moving code. These lanes already embed local list/card layouts, so a move should prove the same interactions still render. |
| Combat suite | `combat`, `sandbox`, `scenarios` | `combat` | `PreviewCombat.tsx`, `PreviewCombatSandbox.tsx`, `PreviewCombatScenarios.tsx` | Require the combat scenario smoke path and a rendered preview screenshot. `PreviewCombatScenarios.tsx` wires real `useTurnManager` and `useAbilitySystem` hooks, so any split needs proof that the combat log, turn flow, and 2D/3D render modes still line up. |
| Environment / 3D / biome | `environment`, `biome`, `3d` | `environment` for the environmental labs, with `three-d-modal` for the 3D tree lab | `PreviewEnvironment.tsx`, `PreviewBiome.tsx`, `PreviewThreeDTest.tsx` | Require a rendered scene screenshot before any move. `PreviewEnvironment.tsx` currently has no direct `*.test.tsx` in the folder, so any extraction from that lane should add a targeted test or equivalent render proof instead of relying on the page wrapper alone. |
| Window frame shell | `frame` | `layout` | `PreviewWindowFrame.tsx` | Capture the open/close/reopen states of the frame shell. The proof should show the window chrome, not just the inner content, because the frame wrapper is the split boundary. |
| Image generation tool | `imagegen` | `gemini-service` / imagegen tooling | `PreviewImageGen.tsx` | Capture the browser-automation response log and the rendered output image before moving or modularizing the lane. The lane is a tool surface, not a gameplay system, so proof needs to show both request and result. |
| Shared UI library | `tables`, `icons`, `missing_icons`, `components` | `ui-primitives` with `glossary-ui` for the icon registry surfaces | `PreviewComponents.tsx`, `PreviewTables.tsx`, `PreviewIcons.tsx`, `PreviewMissingIcons.tsx` | The only current step-level unit test in this folder is `PreviewTables.test.tsx`. Before any split, require that test anchor plus a rendered preview screenshot for the target lane. `PreviewComponents.tsx` is the main large-file candidate here and should not be moved without visual proof. |
| Glossary / spell surfaces | `spell_glossary`, `redirect_surfaces`, `spell_data_flow` | `glossary-ui` with `spells` for the data-flow lane | `PreviewSpellGlossary.tsx`, `PreviewGlossaryRedirectSurfaces.tsx`, `PreviewSpellDataFlow.tsx` | Require a glossary-provider render check and a screenshot of the spell-gate or redirect-surface state that is being preserved. `PreviewSpellGlossary.tsx` intentionally wraps the real provider boundary, so a split must prove that boundary still behaves. |
| Race media | `race_images` | `racial-mechanics` with `character-creator` as the adjacent consumer | `PreviewRaceImages.tsx` | Require the slice-ledger screenshot and the duplicate/regen checklist before any move. This lane is an audit surface for race image state, not a generic image gallery. |

## Dormant Helper Note

`PreviewMdLibrary.tsx` is a large file, but it is not imported by `DesignPreviewPage.tsx` right now. Treat it as a dormant helper rather than an active lane. If a future pass re-routes it into the active preview page, document the docs-registry proof path first and then decide whether the file deserves a split.

## Active Task

None. All tracked tasks (T1, T2, T3) are complete. See `GAPS.md` for follow-up work such as assigning stable local owners (G3).

## Scope Boundaries

In scope:
- Purpose, scope, file map, current implementation state, integrations, gaps, next checks, and resume path.
- Maintaining project continuity and preventing accidental scope shrink.

Adjacent but not in scope:
- Runtime edits in `src/components/DesignPreview/*`.
- Implementation decisions on style taxonomy, QA policy, or production rollout.

Out of scope:
- Editing `docs/projects/PROJECT_TRACKER.md` or non-doc runtime files.

## What Must Not Be Lost

- The standalone nature and full entrypoint chain.
- The set of lane-level preview surfaces and the style variant workflow.
- The intent that Design Preview is used for visual inspection and design-system alignment, not only for runtime feature behavior.
- The unresolved gap around workflow ownership in the registry row.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next action |
|---|---|---|---|---|

G2 is closed in `GAPS.md` and documented in `RUNBOOK.md`. G4 remains in
`GAPS.md` only because it is owned by the adjacent code-modularization audit,
not this project slice.

## Global Gap Imports

Check the global gap tracker before expanding cross-project:
[docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md)

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none imported | no | none | Checked for Design Preview scope; no cross-project gap was claimed |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Docs refresh | Cold-start schema and ownership notes are now explicit | `docs/projects/design-preview/NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, `COLD_START_AGENT_PROMPT.md` |
| Manual checklist runbook | Repeatable launch, lane, variant, and visualizer checks now have a durable home | `docs/projects/design-preview/RUNBOOK.md` |
| Audit summary | Docs-only closure of the checklist gap is recorded durably | `docs/projects/design-preview/AUDIT_OR_PROOF.md` |
| Standalone entry point | Tool is decoupled from app routing | `misc/design.html`, `src/design-preview.tsx` |
| Step router and styles | Multi-surface preview logic is implemented | `src/components/DesignPreview/DesignPreviewPage.tsx` |
| Variant metadata and live state | Style comparison workflow is present | `src/components/DesignPreview/VariantSwitcher.tsx`, `src/components/DesignPreview/StyleVariants.tsx` |
| Component inventory surface | UI primitive catalog is in place | `src/components/DesignPreview/steps/PreviewComponents.tsx` |
| Registry evidence | Living scope alignment exists | `docs/projects/PROJECT_TRACKER.md` |

## Supporting Files

| File | Purpose |
|---|---|
| [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) | Registry anchor for long-term discoverability |
| [docs/projects/design-preview/TRACKER.md](docs/projects/design-preview/TRACKER.md) | Active tasks and queue control |
| [docs/projects/design-preview/GAPS.md](docs/projects/design-preview/GAPS.md) | Durable unresolved findings |
| [docs/projects/design-preview/DECISIONS.md](docs/projects/design-preview/DECISIONS.md) | Durable lane ownership and split-proof decisions |
| [docs/projects/design-preview/RUNBOOK.md](docs/projects/design-preview/RUNBOOK.md) | Manual launch and smoke checklist for future proof passes |
| [docs/projects/design-preview/AUDIT_OR_PROOF.md](docs/projects/design-preview/AUDIT_OR_PROOF.md) | Durable proof summaries for docs-only and visual passes |
| [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) | Cross-project routing for out-of-scope gaps |

## Next Checks

- Confirm preview launches from `/misc/design.html` in a local dev server.
- Confirm Markdown docs preview launches from `/misc/md_library.html`.
- Confirm core lanes render by changing step (`step`) query and by clicking header lanes.
- Confirm style switcher updates variant and live marker indicators.
- Confirm visualizer control buttons can open, report, and stop localhost visualizer endpoints.
- Capture one screenshot target per major lane when a visual pass is requested.

## Open Questions

- None for the active router. The current lane families are source-backed, and the only dormant large helper is explicitly called out above.

## Resume Path For A Cold Agent

This project is decoupled. The following is the self-contained workflow for a cold-start agent. You do not need to read the shared `ITERATION_AGENT_WORKFLOW.md` if you follow this:

1. **Read Core Context:** Read this file (`NORTH_STAR.md`), `TRACKER.md`, and `GAPS.md`.
2. **Review Schema:** Check `docs/projects/PROJECT_CARD_SCHEMA.md` to ensure dashboard frontmatter is accurate.
3. **Select Work:** Execute the highest-value active task in `TRACKER.md`.
4. **Implementation Boundaries:** Stick to the `docs/projects/design-preview/` folder unless runtime changes are explicitly requested in the task.
5. **Verification:** Use `RUNBOOK.md` for the manual checklist if visual changes were made. Run `git diff --check` for docs-only changes. Document proof in `AUDIT_OR_PROOF.md`.
6. **Bounded Gap Sweep:** Check the active task surface and files touched. Record any new gaps in `GAPS.md`. Route workflow-level gaps to `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` and global product gaps to `docs/projects/GLOBAL_GAPS.md`.
7. **Closeout:** 
   - Update frontmatter in `NORTH_STAR.md`.
   - Update `TRACKER.md` (task status, next actions).
   - Update `GAPS.md` (status of gaps).
   - Update `COLD_START_AGENT_PROMPT.md` with the new handoff and increment the Iteration Agent Ledger.
   - End with a structured final report as required by the iteration protocol.

## Required Review Brief

Title: Design Preview idle after steward map closure
Question: Should Design Preview receive another forward iteration now?
Issue: The project reports 0 open gaps and the lane steward/split-proof notes are already added.
Current behavior: The project should wait for new preview requests or a modularization-audit route.
Why blocked: No current source-backed preview gap is open.
Option A: Keep idle and preserve the lane steward map.
Option B: Reopen active when a new preview lane, split, or visual proof request is routed here.
Evidence: NORTH_STAR.md gap_signal and next_step; GAPS.md G1-G4 closed.
Decision owner: Design Preview owner or modularization audit owner
Proof after decision: A new tracker/gap row names the preview lane and required visual check.
