# Design Preview North Star

Status: active
Last updated: 2026-06-05

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
- This pass refreshed the cold-start handoff so the next agent can resume from the doc set without re-deriving the workflow.

## Dashboard Card Schema

Project: Design Preview
Slug: design-preview
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/design-preview
Gap signal: 3 open gaps
Protocol: living project doc set
Next step: Keep lane-owner notes current and add the manual launch/checklist pass.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

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
- Lane and variant owners are still provisional; do not assume they are settled until a later pass writes them down in `GAPS.md` or a linked task slice.
- Refresh `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` in the same pass when lane, variant, or launch behavior changes.

## Active Task

| Field | Value |
|---|---|
| Task | Capture design workflow and owners in a durable place |
| Acceptance criteria | NORTH_STAR, TRACKER, and GAPS describe the workflow, provisional owners, gaps, and next checks |
| Allowed boundaries | `docs/projects/design-preview/*.md` only |
| Verification | `docs_consistency` against `docs/projects/PROJECT_CARD_SCHEMA.md` and current gap rows |
| Owner | Worker B |
| Stop condition | Task stays active until the workflow and owner notes are clear enough for a cold-start resume without the shared workflow open |

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
| G1 | adjacent_follow_up | Worker B | `docs/projects/PROJECT_TRACKER.md` | Keep provisional steward notes visible until a named lane owner map is approved |
| G2 | support_needed_now | Worker B | `misc/design.html`, `src/components/DesignPreview/DesignPreviewPage.tsx` | Add explicit check commands for open/load, step navigation, and one snapshot target per major lane |
| G3 | adjacent_follow_up | Worker B | `src/components/DesignPreview/DesignPreviewPage.tsx` | Add per-lane steward notes in a project doc or linked task slice |

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
| [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) | Cross-project routing for out-of-scope gaps |

## Next Checks

- Confirm preview launches from `/misc/design.html` in a local dev server.
- Confirm Markdown docs preview launches from `/misc/md_library.html`.
- Confirm core lanes render by changing step (`step`) query and by clicking header lanes.
- Confirm visualizer control buttons can open, report, and stop localhost visualizer endpoints.
- Confirm style switcher updates variant and live marker indicators.

## Open Questions

- Which lane owners are authoritative versus provisional?
- Which smoke checks are mandatory for a cold-start handoff?
- Should the live marker map be owned by a named steward or by the tracker row?

## Resume Path For A Cold Agent

1. Read this file.
2. Read [TRACKER.md](docs/projects/design-preview/TRACKER.md).
3. Read [GAPS.md](docs/projects/design-preview/GAPS.md).
4. Review the `Dashboard Card Schema` and the current gap rows against `docs/projects/PROJECT_CARD_SCHEMA.md`.
5. Continue with `T2` in tracker unless the owner map is settled, then move to `T3`.
