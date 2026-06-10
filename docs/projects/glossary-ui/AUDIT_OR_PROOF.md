# AUDIT OR PROOF: Glossary UI
Last updated: 2026-06-09

## Rebuild Verification

**What was checked:** the named glossary rebuild command and the generated
bundle output.

**Command run:** `npm run glossary:rebuild`

**Observed result:** the command completed successfully, regenerated
`public/data/glossary/index/main.json`, and rewrote
`public/data/glossary_bundle.json` through the full ingest -> index -> bundle
path.

**Hashes and timestamps:**
- Pre-run bundle hash:
  `45879CF0FC4D5BBD357F2988D086674FC7A0C982BD7F9909B866C94CD6298F03`
- Post-run bundle hash:
  `F26D484B09D42A38A875550F7F1828AC03A81D386780D6CEB85B32286AF6ADE9`
- Pre-run `main.json` `lastGenerated`:
  `2026-06-08T16:55:49.564Z`
- Post-run `main.json` `lastGenerated`:
  `2026-06-08T23:42:24.367Z`

**Proof to keep:** the bundle file is the runtime source for
`src/context/GlossaryContext.tsx`, so a successful rebuild of that file is the
relevant durable proof for this iteration.

**Notes:** the rebuild is deterministic on a clean rerun; if the inputs do not
change, the bundle content should stay stable while the timestamp in
`main.json` advances.

## Umbrella Build Verification

**What was checked:** the broader data build entry point that now delegates into
the glossary rebuild.

**Command run:** `npm run build:data`

**Observed result:** the command completed successfully, regenerated the item
registry, and then ran the full glossary rebuild chain without errors.

**Why this matters:** `build:data` is the broader entry point used by the
project build, so its delegation to `npm run glossary:rebuild` needed a fresh
end-to-end proof after the script change.

## Item Metadata Contract Review

**What was checked:** the source-backed item metadata fields that flow from
ingest into glossary entries and then into the glossary stat block.

**Surfaces reviewed:** `scripts/ingestPhbGlossary.ts`,
`scripts/generateItemRegistry.ts`, `src/types/ui.ts`,
`src/components/Glossary/GlossaryItemStatBlock.tsx`, and
`src/components/Glossary/GlossaryEntryTemplate.tsx`.

**Observed contract:** the glossary stat block renders the current generated
fields `type`, `rarity`, `tier`, `reqAttune`, `cost`, `weight`, `damage`,
`properties`, and `ac`. The render layer hides the `None` rarity sentinel,
treats cost as gp, and tolerates missing fields as absence instead of failure.

**Why this matters:** the glossary UI can now point to a concrete source-backed
contract instead of only a code comment. That makes the current display shape
auditable even though the ownership decision for future schema additions is
still pending.

**Open question:** whether future metadata additions should stay glossary-local
display data or move into a shared typed contract with the item registry.

## Local Review Rerun

Reviewed and re-ran on 2026-06-09 in the main Codex session:

- `npm run glossary:rebuild` passed.
- `npm run build:data` passed.
- `public/data/glossary_bundle.json` hash after both reruns:
  `F26D484B09D42A38A875550F7F1828AC03A81D386780D6CEB85B32286AF6ADE9`
- `public/data/spells_bundle.json` hash after both reruns:
  `D29B9894D618BA12D91A2D3B424F351FD9E98AE7C6154AFD7848CFCFA34E15E7`
- `public/data/glossary/index/main.json` `lastGenerated` after the final
  rerun: `2026-06-08T23:50:41.504Z`.

The bundle hash stayed stable across the review reruns; only the generated
index timestamp advanced.
