# UI Features North Star

Status: active  
Last updated: 2026-06-26

## Why This Project Exists

This folder is the cold-start handoff for UI-feature continuity.
It keeps intent, implementation surface boundaries, and unresolved questions
accessible for future work without reopening broad discovery.

## Scope

In this pass:
- Keep docs-only continuity for UI initiatives that already have partial or full implementation evidence.
- Maintain cross-project pointers so ownership and state are preserved.
- Route durable gaps to this folder while leaving cross-project concerns in the owning project trackers.

Out of scope:
- Source edits and behavior changes.
- New feature implementation planning beyond documented continuation needs.

## Direct Initiative References

| Initiative | Supporting docs | Current state |
|---|---|---|
| crafting-ui | `docs/projects/crafting-ui/NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` | Implemented UI with cross-system contract follow-ups |
| economy-ui | `docs/projects/economy-ui/NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` | Mounted flow exists; modal entry/ownership gaps remain |
| glossary-ui | `docs/projects/glossary-ui/NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` | Implemented glossary surfaces and build path evidence |
| party-ui | `docs/projects/party-ui/NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` | Implemented overlay and edit flows; companion membership rules incomplete |
| ui-primitives | `docs/projects/ui-primitives/NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` | Shared primitive set exists; ownership contracts are still light |
| salvage-ui | `docs/projects/crafting-ui/GAPS.md` G8 | UI request is live, routed to Crafting UI, and pending integration |

## Project Tracker Alignment

- This folder is linked from the `UI Features` row in
  `docs/projects/PROJECT_TRACKER.md`.
- Cross-project unresolved items should stay in `docs/projects/GLOBAL_GAPS.md` only when outside this folder's scope.

## Feature Owners / Ownership Signals

- The retired `TASK_SALVAGE_UI.md` listed `System Owner: Alchemist`; current salvage UI ownership is routed through Crafting UI G8.
- The retired `docs/tasks/CRAFTING_UI_TODO.md` assigned `Forge` or `Merchant`; current crafting follow-ups live in `docs/projects/crafting-ui/GAPS.md`.
- UI project trackers in `docs/projects/*-ui` mostly use role placeholders
  such as `Economy UI docs owner` or `Worker` values, not hard stewardship IDs.
- This folder records ownership drift as a continuity gap when a concrete owner is required.

## Owner Map

| Initiative | Owner-bearing row | Current owner signal | Next proof/check |
|---|---|---|---|
| salvage-ui | `docs/projects/crafting-ui/GAPS.md` G8 | Alchemist / Crafting UI owner | Salvage action, confirmation, execution, and result feedback proof in Crafting UI. |
| economy-ui | `docs/projects/economy-ui/GAPS.md` G4/G6/G8 | Economy UI docs owner | Non-debug player entry point, Escape close parity, or transaction-routing proof in Economy UI. |
| glossary-ui | `docs/projects/glossary-ui/GAPS.md` G7/G8 | Worker / Codex by row | Schema-guard or spell-detail glossary-linking proof in Glossary UI. |
| party-ui | `docs/projects/party-ui/TRACKER.md` and `GAPS.md` | Party UI owner rows | Resume only from active party-owned tracker/gap rows. |
| ui-primitives | `docs/projects/ui-primitives/TRACKER.md` and `GAPS.md` | UI primitives owner rows | Shared style/input/layering convention proof before broad modal expansion. |

## Integrations to Preserve

- Shared modal/render host: `src/components/layout/GameModals.tsx`, `src/App.tsx`.
- Cross-surface UI families in use:
  - `src/components/Crafting/*`, `src/components/CharacterSheet/*`, and `src/components/Combat/CombatView.tsx` for crafting/salvage/harvest flows.
  - `src/components/Trade/*`, `src/components/Economy/*`, and `src/state/reducers/economyReducer.ts`.
  - `src/components/Glossary/*` and glossary bundle scripts for data-driven term views.
  - `src/components/Party/*` for overlay/editor interactions.
  - `src/components/ui/*` and `src/styles/*` for shared controls and visual primitives.

## Next Checks

1. Read this file, then `TRACKER.md`, then `GAPS.md`.
2. Confirm active follow-up decisions exist for each initiative in their owning tracker.
3. If ownership is ambiguous, add the gap here with a concrete next proof check and evidence path.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/ui-features/NORTH_STAR.md","sha256WithoutMarker":"6eb7bae16acec5fd4182c692118c41e79af1f7b2f4163cd707eef4c22dc87857","markedAtUtc":"2026-06-25T22:29:38.627Z"} -->
