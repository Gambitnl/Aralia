# Creatures System Audit Or Proof

Status: active
Last updated: 2026-06-08

## G5 Generator-Owned Corpus Proof

- `scripts/ingestMonsters.ts` reads the MM and XMM bestiary sources, merges them into a deduplicated monster map, and writes the generated corpus to `src/data/monsters.generated.ts`.
- `src/data/monsters.ts` is the runtime-facing re-export, so the checked-in monster surface stays pipeline-owned instead of being manually split into smaller static chunks.
- This is the safe boundary for G5: preserve the generated corpus intact and handle any future sharding policy in the monster ingestion pipeline, not by deleting or hand-partitioning creature data.

## Verification Notes

- Source review only for this iteration.
- Focused docs verification is expected to stay local to the creatures project docs and the generated-corpus boundary.
