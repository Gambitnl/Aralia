# NORTH STAR: Item Categorization

## Objective
Properly categorize the currently flat 535 Equipment glossary entries into organized "item type groups" within the Aralia UI sidebar, matching the rulebooks' structure (e.g., Weapons, Armor, Adventuring Gear, Magic Items, etc.).

## Intended Outcome
When a user opens the "Equipment" section in the Glossary, they should see grouped sub-folders (like they do for Spells or Races) rather than a giant flat list of 500+ items.

## Current State
All PHB 2024 equipment is ingested as JSON files inside `public/data/glossary/entries/equipment/`. They have a `category` of "Equipment", and their item types (like `G` for Adventuring Gear) are currently parsed into the markdown body but are not leveraged for directory/sidebar grouping.

## Scope Boundaries
- **In Scope:** Updating the ingest script to tag/label items with their type, and updating the glossary indexer or chapter builder to nest them.
- **Out of Scope:** Touching items outside of the "Equipment" category (e.g., Feats, Rules).

## Resume Path
Check `TRACKER.md` for the current step, review `implementation_plan.md` for the exact technical path, and execute the next task.

## Operational Protocol (For Future Agents)
- **Ever-Widening Scope**: Treat the task as a discovery process. The goal is an ever-widening scope, not artificial shrinkage just to complete the task.
- **Track Gaps**: Discover gaps as you work, classify them, and add them to the `GAPS.md` tracker without letting discovery swallow the active task.
- **Preserve intent**: Preserve durable intent, decisions, and evidence. Keep raw process exhaust external or summarized.
- **UI Generation**: Use the Stitch MCP (and `/stitch-generate` workflow) to create and refine new UI components whenever visually possible.
