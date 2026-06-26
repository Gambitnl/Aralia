# Package 7 Jules Prompt - Atlas Discoverability And Source Repair

You are working in the Aralia repository on Spell Phase 1 Package 7.

Read first:

- `AGENTS.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md`
- `docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md`
- `docs/tasks/spells/PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- `docs/tasks/spells/PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md`

Task:

Repair the Spell Pipeline Atlas checkpoint so future Spell Phase 1 packages can
honestly use it as proof. Historical evidence showed a split between the
operator's local ignored Atlas files and a clean GitHub checkout:

- the operator's earlier local checkout had ignored Atlas files, so
  `node scripts/auditAtlasBuckets.mjs` can run there;
- a clean-base worktree from tracked Git history is missing
  `misc/spell_pipeline_atlas.html`, `src/spell-pipeline-atlas.tsx`, and
  `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`;
- the missing source is currently caused by `.gitignore` boundaries, so Jules
  cannot rely on those local-only files unless this package makes the right
  Atlas surface durable.

The earlier local dirty-checkout blocker has been resolved. Work from current
clean `master`; do not treat the old dirty-main note as permission to include
unrelated local migration, BattleMap, glossary, Symphony runtime, or `.jules`
state.

The ignored local copy also reports one low finding:

```text
[LOW] (orphan): dead EXECUTION constant: CASTING_TIME_EXECUTION (declared but not in EXECUTION_BY_BUCKET)
```

Important Package 7 plan gate:

- Do not recreate the Atlas with empty `BUCKET_META`.
- Do not recreate the Atlas with empty `EXECUTION_BY_BUCKET`.
- Do not add dummy archive variables just to quiet the audit.
- Do not make `node scripts\auditAtlasBuckets.mjs` pass by making the Atlas
  vacuous.

If the original ignored local source is not available in your checkout, use
`PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md` to reconstruct a minimal but honest
tracked Atlas with meaningful bucket registration.

Keep the work narrow:

- Make the Atlas entrypoint and source available from tracked GitHub history,
  either by unignoring and committing a minimal Atlas surface, moving it to a
  tracked location, or replacing the ignored local-only dependency with a
  tracked implementation.
- Fix the Atlas audit/source mismatch.
- Fix stale Atlas discoverability comments or docs that name source paths that
  no longer exist.
- Update the Package 3 and Package 4 Atlas receipts with correction notes that
  preserve the historical blocker while pointing future agents to this repair.
- Update `G48` in the tracker after the repair is proven.

Allowed write scope:

- `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`
- `src/spell-pipeline-atlas.tsx`
- `scripts/auditAtlasBuckets.mjs`
- `misc/spell_pipeline_atlas.html`
- `misc/dev_hub.html`
- `.gitignore`
- `docs/tasks/spells/PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md`
- `docs/tasks/spells/PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_PROMPT.md`
- `docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- `docs/tasks/spells/PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md`

Out of scope:

- spell JSON data
- PHB glossary/rules migration files
- BattleMap implementation files
- character creator or character sheet UI
- combat simulator runtime mechanics
- Symphony runtime state, `.jules` state, generated manifests, feedback drafts,
  dashboard caches, or raw receipts
- broad lint/type cleanup

Verification:

```powershell
node scripts\auditAtlasBuckets.mjs
git diff --check -- .gitignore src\spell-pipeline-atlas.tsx src\components\DesignPreview\steps\PreviewSpellDataFlow.tsx scripts\auditAtlasBuckets.mjs misc\spell_pipeline_atlas.html misc\dev_hub.html docs\tasks\spells\PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md docs\tasks\spells\PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_PROMPT.md docs\tasks\spells\PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md docs\tasks\spells\SPELL_PHASE_1_TASK_TRACKER.md docs\tasks\spells\PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md docs\tasks\spells\PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md
```

Return a PR that contains only the bounded Atlas repair and documentation notes.
Do not include Symphony runtime/source/local-state artifacts.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_PROMPT.md","sha256WithoutMarker":"4beca42b224bd08b2537fdf95c05917eb69fedd23b589ac9ff90f2e239e08a21","markedAtUtc":"2026-06-25T22:29:38.365Z"} -->
