# UI Features Tracker

Status: active  
Last updated: 2026-06-26

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
| T1 | done | Document this folder as a continuity surface for UI initiatives | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/ui-features/NORTH_STAR.md` | Keep tracker as the short handoff point only | README-style continuity is present |
| T2 | done | Refresh feature-to-folder initiative mapping and cross-project boundary notes | Worker D | 2026-06-25 | `NORTH_STAR.md` Owner Map; `docs/superpowers/specs/2026-07-14-absorbed-crafting-ui.md`; `docs/superpowers/specs/2026-07-14-absorbed-economy-ui.md`; `docs/superpowers/specs/2026-07-14-absorbed-glossary-ui.md`; `docs/projects/party-ui/*`; `docs/projects/ui-primitives/*` | Preserve the owner map and update it when owning project rows change. | Owner map names one owner-bearing row and next proof/check per active initiative. |
| T3 | active | Formalize salvage and backlog ownership drift in gaps | Worker D | 2026-06-26 | `docs/superpowers/specs/2026-07-14-absorbed-crafting-ui.md` G8; `src/components/CharacterSheet/Overview/InventoryList.tsx` | Preserve owner/path uncertainty in owned project gaps now that stale standalone task notes are retired | Confirm owner signal is not mis-modeled as completed work |
| T4 | active | Route adjacent follow-ups to owning project trackers | Worker D | 2026-05-31 | `docs/superpowers/specs/2026-07-14-absorbed-crafting-ui.md`; `docs/superpowers/specs/2026-07-14-absorbed-economy-ui.md`; `docs/superpowers/specs/2026-07-14-absorbed-glossary-ui.md` | Cross-link each project owner decision path | Validate routing path in each owned tracker before widening scope |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Alchemist | `docs/superpowers/specs/2026-07-14-absorbed-crafting-ui.md` G8 | `docs/tasks/ui-features` scan | Salvage entry path is routed to Crafting UI, but implementation is still pending. | `docs/superpowers/specs/2026-07-14-absorbed-crafting-ui.md` G8; `src/components/CharacterSheet/Overview/InventoryList.tsx`; `src/systems/crafting/salvageSystem.ts` | Without a concrete target path and ownership handoff, salvage UI work can drift from live inventory surfaces | Continue in Crafting UI G8; do not reopen the retired standalone task note. | Crafting UI G8 records the next code-touch target and proof boundary. |
| G2 | active | support_needed_now | Economy UI docs owner | `docs/superpowers/specs/2026-07-14-absorbed-economy-ui.md` | `docs/tasks/ui-features` scan | Economy modal mount and callback flow is incomplete compared to reducer state | `docs/superpowers/specs/2026-07-14-absorbed-economy-ui.md`; `docs/superpowers/specs/2026-07-14-absorbed-economy-ui.md`; `src/components/Economy/*` | Missing action-to-modal wiring blocks user-facing economy continuity | Add explicit owner approval or scoped follow-up in `docs/superpowers/specs/2026-07-14-absorbed-economy-ui.md` | Confirmation proof in next tracker row and modal mount check |
| G3 | active | adjacent_follow_up | Worker D | `docs/superpowers/specs/2026-07-14-absorbed-crafting-ui.md` | `docs/tasks/ui-features` scan | Current crafting UI documents use mixed owner/placeholder labels across trackers | `docs/superpowers/specs/2026-07-14-absorbed-crafting-ui.md`; `docs/superpowers/specs/2026-07-14-absorbed-crafting-ui.md`; `NORTH_STAR.md` Owner Map | Ambiguous owners increase restart risk across adjacent UI initiatives | Add a concise ownership handoff note in owning trackers when scope expands | No owner drift remains unrecorded before implementation |

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/ui-features/TRACKER.md","sha256WithoutMarker":"31f4fa50d6ffe01e1e779dacbd4f774f060c14244109d29842b9ec518a64777e","markedAtUtc":"2026-06-25T22:29:38.629Z"} -->
