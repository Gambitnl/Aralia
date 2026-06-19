# Character Sheet Living Tracker

Status: active (G7 implemented 2026-06-19; remaining gaps open)
Last updated: 2026-06-19

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

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G7 | done | data-model | Codex | docs/projects/character-sheet/GAPS.md | codebase audit | Hardcoded food decay / expiration in `InventoryList.tsx` needed durable acquisition timing before it could be implemented safely | `src/types/items.ts` optional `acquiredAt`; `src/state/reducers/characterReducer.ts` stamps `ADD_ITEM` and merchant `BUY_ITEM`; `src/components/CharacterSheet/Overview/InventoryList.tsx` computes food expiration from `acquiredAt` + `shelfLife`; `src/components/CharacterSheet/__tests__/InventoryList.test.tsx`; `docs/projects/DECISION_BLITZ_2026-06-10.md` D16 | Perishable food now has a durable item-instance timestamp path and the inventory UI disables visibly expired food instead of using a hardcoded placeholder. | Implemented 2026-06-19 per D16 Option A within scoped acquisition paths; legacy unstamped items remain migration-safe and render as unknown/non-expired until stamped by an acquisition or future save-load migration. | Focused InventoryList render test passed: fresh food is edible; expired food shows `Expired` and disables `Eat`. |
| G8 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | docs/projects/character-sheet/GAPS.md | codebase audit | Character Sheet does not provide visual feedback (e.g. red text or a warning icon) when a character suffers a speed penalty from wearing Heavy Armor without meeting the Strength requirement. | `src/components/CharacterSheet/Overview/CharacterOverview.tsx`, `src/utils/character/characterUtils.ts` | Obscures mechanical penalties, leading to confusion about why speed values are lower than expected. | Add a warning indicator to the Speed field in `CharacterOverview` when an armor-based penalty is active. | Verify warning visibility for a low-STR character in Plate armor. |
| G9 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | docs/projects/character-sheet/GAPS.md | codebase audit | Equippable items without defined slots are incorrectly skipped or blocked in `InventoryList.tsx` | `src/components/CharacterSheet/Overview/InventoryList.tsx#L400-L407` | Valid equippable items that lack a slot property are treated as non-equippable/blocked rather than logging a warning. | Log a warning for equippable items without slots or handle them gracefully in the equip flow. | Test coverage or verification showing graceful handling of slotless equippable items. |
| G10 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | docs/projects/character-sheet/GAPS.md | codebase audit | Container assignments live in transient local React state instead of persistent global state | `src/components/CharacterSheet/Overview/InventoryList.tsx#L274-L296` | Item assignments to bags/containers are lost whenever the character sheet modal closes and remounts. | Migrate container assignments to the global `gameState` or store `containerId` changes in the item model via reducer actions. | Verify bag assignments persist after closing and reopening the character sheet modal. |

## Update Rules

- Keep statuses current when task coverage changes.
- Keep `T1` done unless a structural tracker rule changes.
- Keep unresolved technical findings in `GAPS.md` with evidence and proof checks.
