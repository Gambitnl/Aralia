# Crafting System Living Tracker

Status: active
Last updated: 2026-06-09

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

## Gap Log

The detailed gap registry lives in `docs/projects/crafting/GAPS.md`. This tracker keeps the structural split and the newest TODO-backed follow-ups visible without duplicating the whole registry.

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G5 | blocked | support_needed_now | Worker A | `src/systems/crafting/RefiningSystem.ts`, `src/systems/crafting/EnchantingSystem.ts` | Source walk | Refining/Enchanting have TODO notes for UI and selection/feedback flows, but the current crafting UI export surface does not assign them a panel or tab owner. | `src/systems/crafting/RefiningSystem.ts`, `src/systems/crafting/EnchantingSystem.ts`, `src/components/Crafting/index.ts` | Partial systems exist but are not discoverable through core crafting UX, so feature breadth exceeds the current panel ownership map. | Require a product/architecture decision on whether refining/enchanting lives in a dedicated panel, an existing crafting tab, or remains system-only for now. | Record the placement decision in TRACKER before wiring any UI. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
