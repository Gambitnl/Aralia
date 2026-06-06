# Submap Living Tracker

Status: active
Last updated: 2026-06-05

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
| T2 | active | Finish Submap cold-start docs with contract-aware state/integration map. | Codex | 2026-05-31 | `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/handleMovement.ts` | Publish concrete gaps and next checks in `TRACKER.md` and `GAPS.md`. | Re-verify against source for evidence integrity and scope boundaries. |
| T3 | not_started | Clarify and own the generated-map output contract between UI and travel pipeline. | future agent | 2026-05-31 | `src/components/Submap`, `src/types/actions.ts`, `src/hooks/actions` | Define required fields for travel-safe tile metadata and movement timing assumptions. | Add acceptance checks before runtime changes. |
| T4 | not_started | Validate renderer path: DOM/SVG in `SubmapPane` vs painter classes. | future agent | 2026-05-31 | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/painters` | Decide single active render path or documented dual-path constraints. | Confirm no accidental drift in tile classes and path visibility. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Codex | `docs/projects/submap/GAPS.md` | protocol refresh | Define Submap UI contract for generated map outputs. | `src/components/Submap/useSubmapProceduralData.ts`, `src/components/Submap/useQuickTravel.ts` | Keeps UI ownership distinct from generation internals. | Split into G2 and G3 with explicit scope. | G2 and G3 entries documented in `GAPS.md`. |
| G2 | not_started | adjacent_follow_up | future agent | `docs/projects/submap/GAPS.md` | integration review | Define exact field/units contract for quick-travel dispatch payload from UI. | `src/components/Submap/useQuickTravel.ts`, `src/types/actions.ts`, `src/hooks/actions/handleMovement.ts` | Prevents timing/encounter drift across map surfaces. | Document required terrain metadata, tile validity rules, and action units. | Cross-check against production quick travel tests or manual repro. |
| G3 | not_started | adjacent_follow_up | future agent | `docs/projects/submap/GAPS.md` | renderer review | Resolve whether painter classes are active or legacy. | `src/components/Submap/painters`, `src/components/Submap/SubmapPane.tsx` | Avoids duplicate feature surfaces and hidden regressions. | Add explicit ownership decision: authoritative renderer and migration plan. | Confirm no missing visual behavior in DOM map render path. |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Route generation-internal gaps to `docs/projects/submap-generation/`.
