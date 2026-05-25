# Package 7 - Stale PR Fallback Decision

Status: decision packet for the Package 7 foreman after PR #1009 stopped
moving after repair feedback.

## Why This Exists

Package 7 is still the active Spell Phase 1 implementation boundary. It repairs
the Spell Pipeline Atlas source/discoverability gap tracked as `G48`.

Jules opened PR #1009 from replacement session `15919037371248424671`, but the
PR is not ready to merge. Codex posted bounded repair feedback, then an explicit
`@jules` nudge. As of the latest dashboard/GitHub check, the PR still has the
same head commit:

```text
9849a49c19c01a30b415e0ec49b78bb5f5ed15f3
```

The visible dashboard later labeled the handoff as `Scout/Core review`, but the
underlying PR did not change after the repair request. That dashboard label is
not merge readiness.

This file records the fallback boundary so a future agent does not silently
choose between waiting, closing the PR, starting a replacement Jules attempt, or
repairing locally without a clear decision.

## Current Evidence

- Live replacement handoff: `handoff-1779674517015-2ix4kq`.
- Live replacement Jules session: `15919037371248424671`.
- Live GitHub PR: <https://github.com/Gambitnl/Aralia/pull/1009>.
- PR #1009 still contains Package 7 blockers recorded in `G72`:
  - process/helper artifacts: `README.jules-report.md`, `update_gitignore.cjs`;
  - `G48` marked resolved too early;
  - placeholder-heavy Atlas metadata with `TBD`, blanket `done`, repeated
    `init_stub`, and `0 spells`;
  - entrypoint shape not restored exactly from
    `PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md`;
  - `PreviewSpellDataFlow` is not yet a useful discoverability surface.
- Core GitHub checks were green; Gemini review failed from daily quota
  exhaustion. That quota failure is workflow noise, not a Package 7 code
  finding.

## Valid Next Decisions

### Option A - Keep Waiting Briefly

Use this only if there is recent evidence that Jules is actively working, such
as a visible Jules state change, a new reaction/comment, or a recently updated
PR timestamp.

Do not keep choosing this option just because no one made another decision.

### Option B - Send One Final Bounded Jules Prompt

Use this only if the visible Jules session exposes a real message path. The
message should be short and should not widen the scope:

```text
Please push the Package 7 repair commit requested on PR #1009, or state that
you cannot repair this PR. The required repair is to remove process/helper
artifacts, keep G48 honestly pending until the Atlas is non-vacuous, replace
placeholder Atlas metadata with honest bucket metadata or explicit stub/unknown
labels, restore the entrypoint shape from PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md,
and make PreviewSpellDataFlow a useful discoverability table/list.
```

Do not send duplicate GitHub comments unless the previous comment is no longer
visible to Jules or the PR head changed after the previous comment.

### Option C - File Or Abandon PR #1009

Use this if PR #1009 remains unchanged after the explicit `@jules` nudge and no
visible Jules state indicates repair work is in progress.

If this option is chosen:

- close or mark PR #1009 as stale/unaccepted;
- update `SPELL_PHASE_1_TASK_TRACKER.md` so `P7`, `G48`, `G72`, and `G73`
  describe the filed PR honestly;
- do not erase the useful review history;
- preserve the reason: the PR restored useful entrypoint direction, but did not
  repair the placeholder Atlas or process artifacts after feedback.

### Option D - Start A Replacement Package 7 Repair Path

Use this after Option C, or if the operator explicitly asks for a fresh attempt.

The replacement path may be either:

- a new, narrower Jules handoff that starts from current `master` and points at
  this decision packet plus `PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md`; or
- a local Codex repair if the operator/foreman decides Jules has already had a
  fair Package 7 repair opportunity and further waiting would only stall the
  Spell Phase 1 product goal.

If local Codex repair is chosen, keep it bounded to the original Package 7
write scope and record that the decision was a fallback after the Jules repair
loop stalled, not the preferred first path.

## Not Valid

- Do not merge PR #1009 while the `G72` blockers remain.
- Do not treat `Scout/Core review` in the dashboard as proof that the repair
  happened.
- Do not launch `G49` or another write-producing spell package while Package 7
  is still unresolved.
- Do not commit Symphony runtime/source/local receipts as part of this fallback.

## Verification Before Any Merge

Any accepted Package 7 repair, whether from Jules or local Codex, must run:

```powershell
node scripts\auditAtlasBuckets.mjs
git diff --check -- .gitignore src\spell-pipeline-atlas.tsx src\components\DesignPreview\steps\PreviewSpellDataFlow.tsx scripts\auditAtlasBuckets.mjs misc\spell_pipeline_atlas.html misc\dev_hub.html docs\tasks\spells\PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md docs\tasks\spells\PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_PROMPT.md docs\tasks\spells\PACKAGE_7_ATLAS_LOCAL_SOURCE_CONTEXT.md docs\tasks\spells\SPELL_PHASE_1_TASK_TRACKER.md docs\tasks\spells\PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md docs\tasks\spells\PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md
```

Then re-review the changed files for the specific `G72` blockers before merge.
