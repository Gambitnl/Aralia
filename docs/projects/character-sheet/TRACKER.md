# Character Sheet Living Tracker

Status: active (G7 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-10

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
| G7 | active | blocked_human_decision | gpt-5.4-mini high / MCP-subagent | docs/projects/character-sheet/GAPS.md | codebase audit | Hardcoded food decay / expiration in `InventoryList.tsx` needs a lifecycle decision before it can be implemented safely | `src/components/CharacterSheet/Overview/InventoryList.tsx#L408-L481`, `src/types/items.ts`, `src/types/provenance.ts`, `src/data/item_templates/index.ts`; `docs/projects/DECISION_BLITZ_2026-06-10.md` D16 | The `isExpired` flag is a hardcoded placeholder, but `Item` only exposes `perishable` and descriptive `shelfLife`; there is no durable `acquiredAt` field or wired inventory timestamp to compute freshness from. | Decided 2026-06-10 (Remy, D16, Option A): add durable `acquiredAt` timestamp semantics, backfill/migrate inventory data, then implement food expiration from that source with a focused render test. | `acquiredAt` model/migration lands plus an InventoryList render test for fresh and expired food. |
| G8 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | docs/projects/character-sheet/GAPS.md | codebase audit | Character Sheet does not provide visual feedback (e.g. red text or a warning icon) when a character suffers a speed penalty from wearing Heavy Armor without meeting the Strength requirement. | `src/components/CharacterSheet/Overview/CharacterOverview.tsx`, `src/utils/character/characterUtils.ts` | Obscures mechanical penalties, leading to confusion about why speed values are lower than expected. | Add a warning indicator to the Speed field in `CharacterOverview` when an armor-based penalty is active. | Verify warning visibility for a low-STR character in Plate armor. |
| G9 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | docs/projects/character-sheet/GAPS.md | codebase audit | Equippable items without defined slots are incorrectly skipped or blocked in `InventoryList.tsx` | `src/components/CharacterSheet/Overview/InventoryList.tsx#L400-L407` | Valid equippable items that lack a slot property are treated as non-equippable/blocked rather than logging a warning. | Log a warning for equippable items without slots or handle them gracefully in the equip flow. | Test coverage or verification showing graceful handling of slotless equippable items. |
| G10 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | docs/projects/character-sheet/GAPS.md | codebase audit | Container assignments live in transient local React state instead of persistent global state | `src/components/CharacterSheet/Overview/InventoryList.tsx#L274-L296` | Item assignments to bags/containers are lost whenever the character sheet modal closes and remounts. | Migrate container assignments to the global `gameState` or store `containerId` changes in the item model via reducer actions. | Verify bag assignments persist after closing and reopening the character sheet modal. |

## Update Rules

- Keep statuses current when task coverage changes.
- Keep `T1` done unless a structural tracker rule changes.
- Keep unresolved technical findings in `GAPS.md` with evidence and proof checks.
