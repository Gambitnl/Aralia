# UI Features Gaps

Status: active  
Last updated: 2026-06-26

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Alchemist | `docs/projects/crafting-ui/GAPS.md` G8 | `docs/tasks/ui-features` scan | Salvage UI entry point is now routed to Crafting UI, but implementation is still pending. | `docs/projects/crafting-ui/GAPS.md` G8; `src/components/CharacterSheet/Overview/InventoryList.tsx`; `src/systems/crafting/salvageSystem.ts` | Missing implementation target blocks UI continuation of a backed system feature | Continue in Crafting UI G8; do not reopen the retired standalone task note. | Crafting UI G8 has component/rendered proof for salvage action, confirmation, execution, and result feedback. |
| G2 | active | support_needed_now | Economy UI docs owner | `docs/projects/economy-ui/TRACKER.md` | `docs/projects/economy-ui` scan + docs scan | Economy modal wiring is split across modal host, reducer flags, and callbacks with uncertain ownership | `docs/projects/economy-ui/NORTH_STAR.md`; `docs/projects/economy-ui/TRACKER.md`; `src/components/layout/GameModals.tsx`; `src/components/Economy/*` | User-visible economy routes can stay partially unreachable or become inconsistent if ownership is not clarified | Update owning gap row in `docs/projects/economy-ui/GAPS.md` or equivalent before implementation | Concrete mount + action-routing proof for `LedgerBook`, `CourierPouch`, `InvestmentBoard` |
| G3 | active | adjacent_follow_up | Worker D | `docs/projects/ui-primitives/TRACKER.md` | `docs/projects/ui-primitives` scan | Input and layering contracts are still mixed (`WindowFrame`/custom overlays, direct styles vs shared constants) | `docs/projects/ui-primitives/NORTH_STAR.md`; `src/components/layout/GameModals.tsx`; `src/styles/zIndex.ts` | Weak shared-primitives contracts increase inconsistency across new UI initiatives | Add explicit contract note to `docs/projects/ui-primitives/GAPS.md` and link to cross-project owner before broad UI expansion | Verify shared style/input conventions before any new initiative touches the modal layer |
| G4 | done | adjacent_follow_up | Worker D | `NORTH_STAR.md` Owner Map | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/ui-features` scan | Registry row for UI Features did not include the full initiative owner map requested for this package | `docs/projects/PROJECT_TRACKER.md` row `UI Features`; `NORTH_STAR.md` Owner Map; owning project gap/tracker rows | Cross-thread continuity is weaker if owner intent is spread across trackers without mapping | Closed 2026-06-25: added a concise owner map in `NORTH_STAR.md` with one owner-bearing row and next proof/check per active initiative. | Resume path references one owner-bearing row for each active initiative. |

## Classification Reference

- `in_scope_now`: cannot proceed safely without this gap being closed.
- `support_needed_now`: needed for stable continuation and execution.
- `adjacent_follow_up`: real but not required for this docs-only continuity slice.
- `blocked_human_decision`: owner/operator choice is required.
- `blocked_external_state`: external dependency is blocking the project.

## Import Rules

- Route cross-project or unrelated findings to `docs/projects/GLOBAL_GAPS.md`.
- Keep implementation behavior assumptions in code-owned project trackers; keep this folder for continuity and handoff.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/ui-features/GAPS.md","sha256WithoutMarker":"0fb1a69bc3d68711a8122d3f6ac17b7180af6829030e62c523b833c4b384578f","markedAtUtc":"2026-06-25T22:29:38.628Z"} -->
