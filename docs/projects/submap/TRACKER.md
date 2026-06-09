# Submap Living Tracker

Status: review-required
Last updated: 2026-06-09

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create initial living-project scaffold for Submap UI. | Worker B / Codex integration pass | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `src/components/Submap` | Keep this folder scoped to Submap UI. | Three protocol files exist under `docs/projects/submap/`. |
| T2 | done | Finish Submap cold-start docs with contract-aware state/integration map. | Codex | 2026-06-08 | `docs/projects/submap/NORTH_STAR.md`, `docs/projects/submap/DEPENDENCY_CONTRACT.md` | Keep the contract note aligned with the source surfaces. | `git diff --check` passed for the doc refresh. |
| T3 | active | Clarify and own the generated-map output and interaction contract between UI and travel pipeline. | future agent | 2026-06-09 | `docs/projects/submap/DEPENDENCY_CONTRACT.md`, `docs/projects/submap/AUDIT_OR_PROOF.md`, `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleObservation.ts`, `src/types/actions.ts` | Use the documented contract to run a focused quick-travel and inspect proof pass after renderer authority is decided. | Compare live quick-travel and inspect payloads against the handler assumptions and record the result. |
| T4 | blocked | Validate renderer path: DOM/SVG in `SubmapPane` vs painter classes. | human/product owner + future agent | 2026-06-08 | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/painters` | Decide single active render path or documented dual-path constraints before renderer replacement. | Renderer authority decision and parity checklist. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Codex | `docs/projects/submap/GAPS.md` | protocol refresh | Define Submap UI contract for generated map outputs. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useSubmapProceduralData.ts` | Keeps UI ownership distinct from generation internals. | Split into G2 and G3 with explicit scope. | G2 and G3 entries documented in `GAPS.md`. |
| G2 | waiting | adjacent_follow_up | future agent | `docs/projects/submap/GAPS.md` | contract extraction | Formalize and prove the quick-travel and inspect payload contract between Submap UI and action handler pipeline. | `docs/projects/submap/DEPENDENCY_CONTRACT.md`, `docs/projects/submap/AUDIT_OR_PROOF.md`, `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts`, `src/types/actions.ts`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleObservation.ts` | Prevents timing/encounter drift across map surfaces and preserves renderer-independent movement and inspection semantics. | Wait for the renderer-authority decision, then compare `destination`, `durationSeconds`, `orderedPath`, `stepDurationsSeconds`, `encounterChancePerStep`, `stepDelayMs`, and the inspect payload fields against handler assumptions. | Focused quick-travel and inspect repro or unit test after the decision. |
| G3 | blocked | blocked_human_decision | human/product owner + future agent | `docs/projects/submap/GAPS.md` | renderer review | Resolve whether painter classes are active or legacy before replacing DOM renderer behavior. | `src/components/Submap/painters`, `src/components/Submap/SubmapPane.tsx` | Avoids duplicate feature surfaces, hidden regressions, and loss of tile hit-testing/inspect/path overlay semantics. | Add explicit ownership decision: authoritative renderer and migration plan. | Renderer authority decision plus parity checklist. |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Route generation-internal gaps to `docs/projects/submap-generation/`.
