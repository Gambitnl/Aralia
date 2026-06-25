# Compass Pane Living Tracker

Status: active
Last updated: 2026-06-24

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
| T3 | done | Resolve navigation-affordance gap from registry | Amazon Q MCP subagent | 2026-06-19 | `src/components/CompassPane/index.tsx` lines 148-187; `src/components/Submap/SubmapPane.tsx` line 513; `src/components/layout/GameLayout.tsx` | Validated affordance rules: World map toggle always visible; submap/3D toggles hidden in submap context to avoid redundancy | Scoped test verification passed; behavior documented in NORTH_STAR.md |
| T4 | done | Resolve G3 UI pre-check semantics | Kilo / kilo/kilo-auto/free | 2026-06-18 | `src/components/CompassPane/__tests__/CompassPane.test.tsx`; `src/hooks/actions/handleMovement.ts`; `docs/projects/compass-pane/NORTH_STAR.md` | Documented and tested UI pre-check contract: global disabled state, current-location world bounds, and adjacent world biome passability are UI pre-checks; submap terrain remains handler-owned | `npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx` passed with 6 tests |
| T5 | done | Resolve G4 documentation continuity | Qoder CLI | 2026-06-20 | `src/components/CompassPane/README.md`; `src/components/CompassPane/index.tsx`; `docs/projects/compass-pane/NORTH_STAR.md` | Verified README already synced to current source: file name, all 9 props, pass-time modal, submap context, toggle rules, and imports all match; updated G4 status to resolved; added G5 (isSubmapContext test gap) and G6 (stale JSDoc) | README prop-by-prop diff against `CompassPaneProps` interface confirms zero mismatches |
| T6 | done | Resolve G5 context-aware toggle regression coverage | Codex application agent | 2026-06-24 | `src/components/CompassPane/index.tsx`; `src/components/CompassPane/__tests__/CompassPane.test.tsx`; `docs/projects/compass-pane/GAPS.md` | Restored the main-context submap toggle, kept submap/3D toggles hidden when `isSubmapContext=true`, and added regression tests for both contexts plus submap toggle dispatch | `npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx` passed with 8 tests |

## Update Rules

- Update this tracker before feature-scoped work starts.
- Keep active, waiting, or blocked rows current with owner, evidence, next action, and proof point.
- Keep unresolved durable gaps in `docs/projects/compass-pane/GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G3 | resolved | support_needed_now | Kilo / kilo/kilo-auto/free | `src/hooks/actions/handleMovement.ts` and action router | State-handler scan | Confirm UI pre-check semantics match handler movement semantics on boundaries and map transitions | `src/components/CompassPane/index.tsx`; `src/hooks/actions/handleMovement.ts`; `src/components/CompassPane/__tests__/CompassPane.test.tsx` | UI pre-checks now mirror handler-owned source fields for world-boundary checks and have regression coverage for edge and impassable world transitions; submap terrain remains handler-owned | Rule table and regression tests document that CompassPane pre-checks global disabled state, world bounds, and world biome passability, while in-bounds submap moves and submap impassable terrain remain handler responsibility | Scoped CompassPane tests cover currentLocation-based boundary checks and impassable adjacent world tiles |
| G4 | resolved | support_needed_now | Qoder CLI | Docs scan | Documentation continuity | `src/components/CompassPane/README.md` still describes the component as `CompassPane.tsx`, carries older prop/type wording, and omits the pass-time modal, submap context, and reducer toggle coupling details | `src/components/CompassPane/README.md`; `src/components/CompassPane/index.tsx`; `docs/projects/compass-pane/NORTH_STAR.md` | Mismatched docs can send future work down the wrong path and weaken cold-start accuracy | README verified synced to current source: file name, all 9 props, pass-time modal, submap context, toggle rules, and imports all match | README diff against source confirms zero mismatches |
| G5 | resolved | test_coverage | Codex application agent | `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Context-toggle regression pass | Context-aware toggle visibility now has regression coverage: main exploration shows world map, submap, and 3D toggles; submap context keeps world map visible and hides submap/3D toggles | `src/components/CompassPane/index.tsx`; `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Toggle visibility rules are now locked to tests, and the missing main-context submap toggle was restored without changing handler contracts | Closed for the scoped G5 slice; reopen only if Compass Pane context visibility rules change | `npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx` passed with 8 tests on 2026-06-24 |
| G6 | resolved | adjacent_follow_up | Qoder CLI | `src/components/CompassPane/index.tsx` | Documentation continuity pass | Source file JSDoc header (`@file CompassPane.tsx`) stale: no mention of `PassTimeModal`, `isSubmapContext`, or pass-time modal | `src/components/CompassPane/index.tsx` lines 2-9 | Stale header misleads cold-start agents about component surface | JSDoc updated to `@file index.tsx` with PassTimeModal and `isSubmapContext` documented | JSDoc matches current exports and props |
