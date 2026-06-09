# Crafting UI Decisions

Status: active
Last updated: 2026-06-09

## Decision Log

### D-001: Shared Crafter Adapter Boundary

Date: 2026-06-09

Decision: Treat `src/components/Crafting/crafterAdapter.ts` as the Crafting UI
boundary for resolving the acting crafter from live party state.

Rationale:

- Gathering and creature harvest should not reintroduce local mock crafter
  derivation when source already has a shared adapter.
- Gathering can prefer the selected character from the open character sheet.
- Creature harvest remains anchored to the party lead until CombatView exposes a
  separate selector.

Follow-up: If combat needs a non-lead harvester, add an explicit selection prop
and proof rather than bypassing the adapter.
