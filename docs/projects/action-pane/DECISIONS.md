# Action Pane Decisions

Status: active
Last updated: 2026-06-10

This file records stable decisions that affect the Action Pane contract surface.

## Decisions

| ID | Decision | Status | Evidence | Notes |
|---|---|---|---|---|
| D-01 | The visible ActionPane system-menu and quick-command contract is validated by focused integration tests rather than by deleting legacy action surfaces. | recorded | src/components/ActionPane/__tests__/ActionPane.test.tsx | Preserves current behavior while making the emitted-action contract explicit for future slices. |
| D-02 | `isDevDummyActive` does not belong on the ActionPane contract and is removed from the ActionPane render path. | recorded | src/components/ActionPane/index.tsx, src/components/ActionPane/SystemMenu.tsx, src/components/layout/GameLayout.tsx, src/App.tsx | Keeps the ActionPane boundary narrower without changing the developer-entry flow owned by the menu surfaces. |
| D-03 | Move actions should arrive with string `targetId` values from `useActionGeneration`, and `ActionButton` should pass them through without rewriting them. | recorded | src/components/ActionPane/useActionGeneration.ts, src/components/ActionPane/ActionButton.tsx, src/components/ActionPane/__tests__/ActionPane.test.tsx | Removes the defensive click-time rewrite and makes upstream contract drift visible at the source. |
| D-04 | APPROACH_TOWN and OBSERVE_TOWN actions do not block Action Pane work. We keep their ownership under the exploration/movement action handlers since they are triggered in PLAYING phase from the world map. | recorded | src/components/ActionPane/useActionGeneration.ts, src/hooks/actions/handleMovement.ts | Settled the cross-project ownership question for G4. |

## Open Decision Follow-Ups

| Item | Why it remains open | Next owner | Next proof |
|---|---|---|---|
| none | none | none | none |
