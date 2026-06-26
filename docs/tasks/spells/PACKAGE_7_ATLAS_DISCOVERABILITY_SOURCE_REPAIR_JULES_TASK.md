# Package 7 - Atlas Discoverability And Source Repair

Status: completed by bounded local fallback after two Symphony/Jules attempts
failed to produce an acceptable tracked Atlas repair.

## Goal

Make the Spell Pipeline Atlas usable again as a trustworthy checkpoint for
Spell Phase 1 progress. The Atlas must be discoverable from the existing
standalone page, backed by the live source component, and clean under the Atlas
bucket audit before later spell packages rely on it as proof.

This package repairs `G48`. Earlier Package 3 and Package 4 receipts recorded
that Atlas proof could not be claimed because the checking worktree appeared to
be missing `misc/spell_pipeline_atlas.html` and
`src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`.

Historical evidence showed a split between local-only state and GitHub-synced
state:

- the operator's earlier local checkout had ignored Atlas files, so
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

The repair makes the Atlas source of truth available from GitHub, closes the
source/audit mismatch, and leaves a repeatable proof path for the next spell
package.

After the first Jules launch, Jules could not see the ignored local Atlas files
and proposed recreating the Atlas with empty `BUCKET_META`,
empty `EXECUTION_BY_BUCKET`, and a dummy archive variable. That plan is not an
acceptable Package 7 repair. Use
`PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md` as the durable summary of the ignored
local Atlas shape that Jules must preserve or honestly reconstruct.

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
- `docs/tasks/spells/PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md`
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

Do not create a quiet-but-empty Atlas. Empty `BUCKET_META`, empty
`EXECUTION_BY_BUCKET`, dummy archive variables, or audit changes that pass only
because there are no registered buckets are package failures.

## Required Implementation

1. Make the Atlas entrypoint and source available in a clean GitHub checkout.
   This may require unignoring and committing a minimal Atlas surface, moving
   the Atlas to an already tracked source location, or replacing the ignored
   local-only dependency with a tracked implementation. Preserve the existing
   Atlas intent rather than replacing it with a placeholder. If the ignored
   local files are unavailable in Jules, reconstruct the non-vacuous bucket
   shape described in `PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md`.
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
- The clean checkout has meaningful Atlas bucket registration; `BUCKET_META`
  and `EXECUTION_BY_BUCKET` must not be empty.
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
git diff --check -- .gitignore src\spell-pipeline-atlas.tsx src\components\DesignPreview\steps\PreviewSpellDataFlow.tsx scripts\auditAtlasBuckets.mjs misc\spell_pipeline_atlas.html misc\dev_hub.html docs\tasks\spells\PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md docs\tasks\spells\PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_PROMPT.md docs\tasks\spells\PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md docs\tasks\spells\SPELL_PHASE_1_TASK_TRACKER.md docs\tasks\spells\PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md docs\tasks\spells\PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md
```

If the package changes exported TypeScript symbols or shared source boundaries,
run the Aralia-required dependency sync for the changed path as directed by
`AGENTS.md`.

## Completion Notes

Codex used a local fallback only after the Jules-first path had a fair attempt:

- the first Jules session proposed an empty-map Atlas plan and was paused;
- the replacement Jules PR #1009 restored the rough entrypoint direction but
  kept process/helper artifacts, placeholder-heavy bucket metadata, premature
  `G48` resolution, and a conflicting branch;
- after explicit `@jules` repair feedback, visible Jules state reported that
  Jules was unable to complete the task.

The accepted repair stayed inside this package boundary: it restored
`misc/spell_pipeline_atlas.html`, `src/spell-pipeline-atlas.tsx`, and
`src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`; unignored only
those Atlas paths; preserved the 15-bucket map; and did not commit raw
Symphony/Jules runtime state.

Verification recorded for the repair:

```powershell
node scripts\auditAtlasBuckets.mjs
npx tsc --noEmit --pretty false
```

`node scripts\auditAtlasBuckets.mjs` reports 15 buckets in `BUCKET_META`, 15
buckets registered in `EXECUTION_BY_BUCKET`, and no findings.

## Foreman Notes

This packet is safe to keep as durable Aralia-facing task context. The previous
local-change boundary was resolved before dispatch. Keep Symphony
runtime/source/local-state artifacts out of Aralia; only preserve the bounded
Atlas repair and the concise package-facing documentation updates listed above.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md","sha256WithoutMarker":"cdb5f13eb7cbd6b45b25b1942a53f076f65b1b3e723bbd19739a4e77b3016bf4","markedAtUtc":"2026-06-25T22:29:38.364Z"} -->
