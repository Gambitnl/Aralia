# Submap Gap Registry

Status: review-required
Last updated: 2026-06-09

Use this file for durable unresolved findings that genuinely belong to Submap
UI and component ownership. Route generation-internal gaps to
`docs/projects/submap-generation/GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Codex | `docs/projects/submap/TRACKER.md` | protocol refresh | UI contract for generated output was implicit and required formalization. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useSubmapProceduralData.ts` | Prevents UI from inventing assumptions about generated tile semantics. | Split into G2 and G3 with explicit payload/render ownership questions. | Confirm G2 and G3 tracked in `TRACKER.md`. |
| G2 | waiting | adjacent_follow_up | future agent | `docs/projects/submap/TRACKER.md` | contract extraction | Formalize and prove the quick-travel and inspect payload contract between Submap UI and action handler pipeline. | `docs/projects/submap/DEPENDENCY_CONTRACT.md`, `docs/projects/submap/AUDIT_OR_PROOF.md`, `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts`, `src/types/actions.ts`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleObservation.ts` | Avoids regressions in path duration, encounter timing, step delay behavior, and renderer-independent movement/inspection semantics. | Wait for the renderer-authority decision, then compare `destination`, `durationSeconds`, `orderedPath`, `stepDurationsSeconds`, `encounterChancePerStep`, `stepDelayMs`, and the inspect payload fields against handler assumptions. | Focused quick-travel and inspect repro or unit test after the decision. |
| G3 | blocked | blocked_human_decision | human/product owner + future agent | `docs/projects/submap/TRACKER.md` | renderer review | Determine authoritative renderer path for submap visuals before replacing the DOM renderer. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/painters` | Reduces risk of duplicated rendering behavior, maintenance drift, and loss of tile hit-testing/inspect/quick-travel preview semantics. | Document decision: active renderer, compatibility constraints, renderer-agnostic interaction adapter if needed, and migration plan. | Validate map and path rendering parity against screenshots, playtest, or focused interaction tests. |
| G4 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G6 | Code modularization audit routing | `SubmapDoodadPainter.ts` is a large painter-path surface that should be treated as dependency-extraction work, not cleanup. | `src/components/Submap/painters/SubmapDoodadPainter.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G6 | Submap painter logic may preserve visual/gameplay assumptions needed after DOM renderer phase-out. | Extract painter dependencies and parity expectations into the renderer-decision handoff before code movement. | Contract notes identify painter exports, doodad categories, and DOM quick-travel/inspect parity expectations. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md`.
- Route generation-internal items to `docs/projects/submap-generation/GAPS.md`.
