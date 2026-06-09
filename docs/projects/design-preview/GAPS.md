# Design Preview Gaps

Status: active
Last updated: 2026-06-08

Use this file for durable unresolved findings that genuinely belong to this
project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | adjacent_follow_up | Worker B | `docs/projects/design-preview/TRACKER.md` | Tracker refresh | Capture design workflow and owners | `docs/projects/PROJECT_TRACKER.md` | Ownership drift can hide who approves new lanes, variants, and glossary surfaces | Keep provisional steward notes in NORTH_STAR and add named owners when approved | Lane/variant steward note recorded in NORTH_STAR |
| G2 | closed | support_needed_now | Worker B | `docs/projects/design-preview/TRACKER.md` | Scan of preview controls | Add explicit launch and verification checks for Design Preview. Closed 2026-06-08 after the checklist was captured in `RUNBOOK.md` | `misc/design.html`, `src/components/DesignPreview/DesignPreviewPage.tsx`, `docs/projects/design-preview/NORTH_STAR.md`, `docs/projects/design-preview/RUNBOOK.md` | Manual visual surfaces can silently regress without a repeatable check surface | N/A; use `RUNBOOK.md` on the next manual pass | Checklist added in `RUNBOOK.md` and referenced from the handoff |
| G3 | not_started | adjacent_follow_up | Worker B | `docs/projects/design-preview/NORTH_STAR.md` | Step and lane audit | Decide if all Design Preview steps should have stable local owners | `src/components/DesignPreview/DesignPreviewPage.tsx` | Some lanes are specialized and can be owned by different domain owners, but this is not currently documented | Add a per-lane steward map for handoff safety | Steward mapping exists in a project doc or linked task slice |
| G4 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G3 | Code modularization audit routing | `PreviewComponents.tsx` and sibling preview steps are large enough to need step-owner and visual-proof routing before any split. | `src/components/DesignPreview/steps/PreviewComponents.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G3 | Design preview is a visual verification surface; modular movement without screenshots/tests can silently break preview lanes. | Add a split checklist that names lane owners, existing step tests, and required visual checks before moving preview components. | `PreviewEnvironment`/`PreviewTables` tests plus a rendered preview check are named in the implementation handoff. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md`.
- If the current project should not own a gap, move it out explicitly.
- Do not mark a gap done without completion evidence linked or summarized.
