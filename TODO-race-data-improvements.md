# Race data follow-up ideas

- Consolidate iteration and lookup by deriving `ACTIVE_RACES` directly from `ALL_RACES_DATA` (or vice versa) to guarantee synchronization without manual copying.
- Add validation helpers that assert required fields (speed, abilities, feature lists) during aggregation so incomplete race definitions fail fast.
- Group related exports (e.g., ancestries, legacies, benefits) into typed bundles to reduce scattered imports in gameplay hooks.
- Extend duplicate-ID detection to cover subrace/lineage identifiers to prevent downstream selector collisions.
- Document the streamlined race addition workflow in `docs/guides/RACE_ADDITION_GUIDE.md` to reflect the curated list and immutability rules.
