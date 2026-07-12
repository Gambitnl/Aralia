# Action Pane Living Tracker

Status: active
Last updated: 2026-07-11

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
| G1 | done | Route Long Rest modal confirmation through the complete gameplay action pipeline | Codex | 2026-07-11 | `GameModals`, `actionHandlers`, `handleResourceActions`; 48 focused tests; live 8-hour rest | Preserve modal choices and full overnight semantics together | Live clock/message proof plus focused integration matrix |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | integration | Codex | Long Rest modal/action wiring | Whole-game systems audit W02 | Modal confirmation reduced `LONG_REST` directly, bypassing the full handler and time advance. | Live source trace, 48 focused tests, and rendered confirmation | Free recovery without eight elapsed hours breaks the world clock and rest consequences. | Keep all confirmation producers on `processAction` and preserve racial choice payloads. | Live 10:40-to-18:40 advance and overnight messages remain covered. |

## Update Rules

- Update this tracker before starting any new Action Pane slice.
- Keep queue and gap rows current with evidence and a concrete next proof.
- Unresolved durable findings stay in docs/projects/action-pane/GAPS.md.
- Move gaps to local or global trackers only when ownership or scope changes.
