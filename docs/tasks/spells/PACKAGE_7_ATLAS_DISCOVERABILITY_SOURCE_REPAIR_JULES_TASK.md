# Package 7 - Atlas Discoverability And Source Repair

Status: drafted for future clean-base Jules handoff; not dispatched from the
current dirty main checkout.

## Goal

Make the Spell Pipeline Atlas usable again as a trustworthy checkpoint for
Spell Phase 1 progress. The Atlas must be discoverable from the existing
standalone page, backed by the live source component, and clean under the Atlas
bucket audit before later spell packages rely on it as proof.

This package repairs `G48`. Earlier Package 3 and Package 4 receipts recorded
that Atlas proof could not be claimed because the checking worktree appeared to
be missing `misc/spell_pipeline_atlas.html` and
`src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`.

Current evidence shows a split between local-only state and GitHub-synced state:

- the dirty main checkout has local ignored Atlas files, so
  `node scripts/auditAtlasBuckets.mjs` can run there;
- a clean-base worktree from tracked Git history is missing
  `misc/spell_pipeline_atlas.html`, `src/spell-pipeline-atlas.tsx`, and
  `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`;
- the same clean-base worktree also proves that these paths are currently
  hidden by `.gitignore` rules rather than available to Jules from GitHub.

The local ignored Atlas copy still reports one low finding:

```text
[LOW] (orphan): dead EXECUTION constant: CASTING_TIME_EXECUTION (declared but not in EXECUTION_BY_BUCKET)
```

The repair should make the Atlas source of truth available from GitHub, close
the source/audit mismatch, and leave a repeatable proof path for the next spell
package.

## Allowed Write Scope

Jules may edit only these files unless the PR explains a narrowly necessary
addition:

- `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`
- `src/spell-pipeline-atlas.tsx`
- `scripts/auditAtlasBuckets.mjs`
- `misc/spell_pipeline_atlas.html`
- `misc/dev_hub.html`
- `.gitignore`
- `docs/tasks/spells/PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md`
- `docs/tasks/spells/PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_PROMPT.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- `docs/tasks/spells/PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md`

## Out Of Scope

Do not edit:

- spell JSON data
- PHB glossary/rules migration files
- BattleMap implementation files
- character creator or character sheet UI
- combat simulator runtime mechanics
- Symphony runtime state, `.jules` state, generated manifests, feedback drafts,
  dashboard caches, or raw receipts
- broad lint/type cleanup unrelated to the Atlas repair

Do not change the Atlas model direction by flattening historical bucket context
just to remove a warning. If the older `CASTING_TIME_EXECUTION` constant still
contains useful historical information, either rename it to an explicit
archival helper that the audit intentionally ignores or move its useful note
into the live canonical-first map. If it is genuinely obsolete, remove it with a
short comment or tracker note explaining why the canonical-first map is the
source of truth.

## Required Implementation

1. Make the Atlas entrypoint and source available in a clean GitHub checkout.
   This may require unignoring and committing a minimal Atlas surface, moving
   the Atlas to an already tracked source location, or replacing the ignored
   local-only dependency with a tracked implementation. Preserve the existing
   Atlas intent rather than replacing it with a placeholder.
2. Make `node scripts/auditAtlasBuckets.mjs` report no findings, or make the
   audit intentionally ignore explicitly archival Atlas constants with a clear
   rule that cannot hide live bucket drift.
3. Fix stale discoverability comments or links that point to the removed
   `src/components/SpellPipelineAtlas/SpellPipelineAtlasPage.tsx` path if that
   path is no longer real. The current standalone entrypoint is
   `src/spell-pipeline-atlas.tsx`, which imports `PreviewSpellDataFlow`.
4. Update Package 3 and Package 4 Atlas checkpoint receipts only enough to state
   that the old missing-source diagnosis has been superseded by this repair.
   Keep their historical failure notes intact; add a correction note rather than
   pretending the earlier checkout had working Atlas proof.
5. Update `SPELL_PHASE_1_TASK_TRACKER.md` so `G48` reflects the current repair
   result, not the stale missing-file-only diagnosis.

## Acceptance Criteria

- `node scripts/auditAtlasBuckets.mjs` exits successfully with no findings.
- A clean GitHub checkout contains the Atlas entrypoint and the source needed by
  the audit script; the proof must not depend on ignored local files from the
  operator's main checkout.
- `misc/spell_pipeline_atlas.html` still points at a real source entrypoint.
- Any Atlas source path named in comments or docs exists, or the text clearly
  says it is historical.
- Package 3 and Package 4 receipts still preserve what happened at the time,
  but now point future agents to the Package 7 repair.
- No Symphony runtime/source/local-state artifacts are committed.

## Verification Commands

Run from the repository root:

```powershell
node scripts\auditAtlasBuckets.mjs
git diff --check -- .gitignore src\spell-pipeline-atlas.tsx src\components\DesignPreview\steps\PreviewSpellDataFlow.tsx scripts\auditAtlasBuckets.mjs misc\spell_pipeline_atlas.html misc\dev_hub.html docs\tasks\spells\PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md docs\tasks\spells\PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_PROMPT.md docs\tasks\spells\SPELL_PHASE_1_TASK_TRACKER.md docs\tasks\spells\PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md docs\tasks\spells\PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md
```

If the package changes exported TypeScript symbols or shared source boundaries,
run the Aralia-required dependency sync for the changed path as directed by
`AGENTS.md`.

## Foreman Notes

This packet is safe to commit as durable Aralia-facing task context. It should
not be launched from the current dirty main checkout while unrelated PHB
glossary/rules migration and BattleMap/glossary source edits are mixed into the
working tree. Dispatch from a clean base or after the local-change boundary is
resolved.
