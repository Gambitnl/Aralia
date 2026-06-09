# Action Pane Decisions

Status: active
Last updated: 2026-06-08

This file records stable decisions that affect the Action Pane contract surface.

## Decisions

| ID | Decision | Status | Evidence | Notes |
|---|---|---|---|---|
| D-01 | The visible ActionPane system-menu and quick-command contract is validated by focused integration tests rather than by deleting legacy action surfaces. | recorded | src/components/ActionPane/__tests__/ActionPane.test.tsx | Preserves current behavior while making the emitted-action contract explicit for future slices. |

## Open Decision Follow-Ups

| Item | Why it remains open | Next owner | Next proof |
|---|---|---|---|
| `isDevDummyActive` on ActionPane props | The prop still appears in the pane path and needs a stable owner-level decision. | Action Pane owner | Update G2/G2 docs after the prop contract is decided. |
| `APPROACH_TOWN` and `OBSERVE_TOWN` ownership | The pane emits these actions, but ownership may still move with a later scene-level decision. | Action Pane owner | Update G4 or the next town-surface tracker row. |
