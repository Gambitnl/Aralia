# types UI North Star

Status: active  
Last updated: 2026-05-31

## Why this exists

Registry evidence shows a types UI area, but the runtime surface is small and not documented for continuity. This file is the cold-start anchor for that area.

## Purpose and outcome

Preserve the current type export truth and handoff context for future work on shared UI and component-facing types.

## Current state

- Registry reference: `docs/projects/PROJECT_TRACKER.md` row for `types UI`.
- Component export entrypoint: `src/components/types/index.ts` is a shim:
  - `export * from '../../types';`
- Canonical type barrel: `src/types/index.ts` re-exports `./ui` and domain modules.
- Shared UI type declarations are in `src/types/ui.ts` (with declaration output in `src/types/ui.d.ts`).
- No dedicated component-prop registry implementation exists under `src/components/types` beyond the shim.

## Active task slice

| Field | Value |
|---|---|
| Task | Capture a concise current-state map for types UI and remaining gaps |
| Scope | `docs/projects/types-ui/` only |
| Allowed boundaries | Docs-only update of NORTH_STAR, TRACKER, GAPS |
| Acceptance criteria | Files describe: purpose, file map, integrations, gaps, and next checks |
| Stop condition | Handoff docs are aligned and self-contained for a cold start |

## File map

- `src/components/types/index.ts`: compatibility shim for legacy `../types` imports in components.
- `src/types/index.ts`: full export barrel used by the shim and most type consumers.
- `src/types/ui.ts`: shared UI and visual/type contracts (e.g. `Glossary*`, `Notification`, `UIToggleAction`).
- `docs/projects/types-ui/NORTH_STAR.md`: this cold-start context.
- `docs/projects/types-ui/TRACKER.md`: task queue and status.
- `docs/projects/types-ui/GAPS.md`: durable unresolved findings.

## Integrations and dependencies

- Type imports in components frequently use `../../types` or `../types`; these resolve through the shim path in legacy directories.
- UI-facing types are consumed by many component docs and components but are centrally exported from `src/types/index.ts`.

## Gaps and uncertainties

1. The project has no explicit component-level type registry under `src/components/types`; decide if this should be added or remain intentional.
2. Confirm whether `src/types/ui.ts` and `src/types/ui.d.ts` are expected to be strictly equivalent for long-lived component usage.
3. `.agent/workflows/USER.local.md` was not found in this workspace during this pass.

## Resume path

1. Read this file.
2. Read `docs/projects/types-ui/TRACKER.md`.
3. Read `docs/projects/types-ui/GAPS.md`.
4. Continue from the active follow-up in `TRACKER.md`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
