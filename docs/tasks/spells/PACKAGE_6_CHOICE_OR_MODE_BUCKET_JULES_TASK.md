# Package 6 Jules Task: Choice/Mode Mechanics Bucket

Status: historical Package 6 packet; useful scope was locally consolidated after
PR #997 stayed conflicted.

This packet turns the first post-pilot mechanics bucket into a bounded Jules
task. It exists because the Spell Phase 1 tracker now has Packages 4 and 5
merged, so the next product work should reduce a reusable mechanics bucket
instead of hand-fixing one spell at a time.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns bucket selection, dashboard handoff, review,
verification, decision reporting, and honest Atlas/gate receipts. Jules should
own the implementation-heavy spell data, runtime mapping, and focused tests for
the bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package6-choice-mode-bucket`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package6-choice-mode-bucket-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package6-choice-mode-bucket`

## Goal

Close or materially reduce the `choice_or_mode` mechanics bucket for cantrips
and spell levels 1-3 by using the existing mode/choice data model where it
already fits, adding only small typed extensions where the current model is
clearly missing a repeated pattern.

This is not an all-spells rewrite. It should prove the bucket path with a
representative early-game set, update the tracker honestly, and leave any
out-of-scope choice cases visible for later mechanics packages.

## Source Context

Use these artifacts instead of inventing a parallel plan:

- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/`
- `docs/tasks/spells/templates/spell-structured-template.json`
- `docs/tasks/spells/templates/spell-json-template.json`
- `public/data/spells/level-0/`
- `public/data/spells/level-1/`
- `public/data/spells/level-2/`
- `public/data/spells/level-3/`
- `src/utils/character/spellAbilityFactory.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts`
- nearest existing spell validation and runtime tests

## Current Bucket Evidence

The plan ranks `choice_or_mode` as the first mechanics bucket family for levels
0-3. Current discovery evidence shows that several cantrips already have
mode-choice data, while many level 1-3 spells still keep choice behavior in
prose, generic utility text, or AI prompt text.

Representative already-modeled or mostly-modeled examples:

- `minor-illusion`
- `mold-earth`
- `prestidigitation`
- `shape-water`
- `thaumaturgy`
- `dancing-lights`
- `druidcraft`
- `elementalism`

Representative open early-game examples worth reducing in this package:

- `alarm`: audible/mental alarm choice and ward shape/object choice
- `chromatic-orb`: chosen damage type and leap target branch
- `blindness-deafness`: Blinded versus Deafened choice
- `alter-self`: three modes plus later Magic-action mode replacement
- `dragons-breath`: chosen damage type for the granted breath weapon
- `enhance-ability`: per-target ability choice
- `enlarge-reduce`: size mode choice and related effect branch
- `protection-from-energy`: selected damage type
- `plant-growth`: instant versus over-time casting mode and exclusion choices

Jules should start with the smallest coherent subset that shares one data shape.
If the chosen subset starts to require several unrelated schema designs, stop
and record the split instead of broadening silently.

## Ownership

Jules may edit:

- spell JSON files under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/` for the selected `choice_or_mode` spells
- structured spell docs under `docs/spells/` only when required to keep the
  structured/canonical/runtime story aligned for the selected spells
- template files in `docs/tasks/spells/templates/` only for a small repeated
  choice field that the selected spells genuinely need
- runtime mapping code in `src/utils/character/spellAbilityFactory.ts`,
  `src/commands/factory/SpellCommandFactory.ts`, or nearby command helpers only
  when the selected choice data needs deterministic simulator support
- focused tests under the nearest existing `__tests__` directories
- package-specific documentation updates in `docs/tasks/spells/` that report
  what was closed, deferred, or reclassified

Jules should not edit:

- Symphony dashboard/runtime/source files
- broad premade roster semantics
- character creator or spellbook UI unless a tiny choice display proof is
  explicitly needed for the selected spell behavior
- unrelated spell levels 4-9
- broad AI arbitration policy
- generated gate reports when the only change is a timestamp
- GitHub workflow files

## Required Work

1. Reconfirm the scoped `choice_or_mode` candidates from current discovery
   files before editing spell data.
2. Pick a bounded subset of early-game spells that share a coherent choice data
   shape. Prefer `blindness-deafness`, `dragons-breath`,
   `protection-from-energy`, and `enhance-ability` if they can be represented
   with existing typed fields or one small shared extension.
3. Update runtime spell JSON and structured docs for the chosen subset.
4. Keep AI arbitration only where player intent or adjudication is truly
   open-ended. Do not route deterministic damage type, status choice, target
   choice, action cost, spell slot cost, or concentration cleanup to AI.
5. Add focused tests proving the new choice data is parsed, routed, or exposed
   through the relevant runtime path.
6. Run spell validation and any focused tests added or changed.
7. Regenerate gate reports only as a verification step. Commit generated report
   output only if it contains meaningful state changes beyond timestamps.
8. Update this package's completion note or the living tracker with:
   - spells closed
   - spells deferred
   - fields added or reused
   - tests run
   - residual `choice_or_mode` gaps
   - whether Atlas proof was possible

## Verification Commands

Start with the narrowest relevant checks:

```powershell
npm run validate:spells
npm run generate:spell-gates
```

If runtime mapping or command behavior changes, add the nearest focused Vitest
command, for example:

```powershell
npx vitest run src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts --reporter=verbose
```

Use a more specific test file if the package adds one.

## Atlas And Gate Boundary

The living tracker currently records Atlas gap `G48`: the expected Atlas
entrypoint `misc/spell_pipeline_atlas.html` and source file
`src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx` are absent from
the current checkout, and `node scripts/auditAtlasBuckets.mjs` fails because of
that missing source.

For this package:

- Jules should not claim Atlas proof unless the Atlas path is repaired in a
  separate, explicit scope.
- Spell validation and gate generation should still run.
- The completion note should state whether Atlas proof was blocked by `G48` or
  repaired through a separate reviewed change.

## Acceptance Criteria

- At least one coherent `choice_or_mode` subset for cantrips/levels 1-3 is
  represented with typed data instead of prose-only or generic utility text.
- Focused tests cover the chosen data path.
- Spell validation passes.
- Any generated gate-report changes are meaningful, or timestamp-only churn is
  left uncommitted and reported.
- Residual choice/mode spells remain visible in the tracker or package note.
- The package does not expand into broad AI policy, all mechanics buckets, or
  Symphony runtime changes.


## Jules Completion Note
- Spells closed: blindness-deafness, dragons-breath, chromatic-orb, alter-self, enlarge-reduce, alarm, plant-growth.
- Spells verified already clean: enhance-ability, protection-from-energy.
- Fields reused/added: Used `modeChoice` for multi-effect toggles, reused `damageTypeSource: "chosen_damage_type"` for damage choice, adding it to `DamageData` in schemas and templates.
- Tests run: `npm run validate:spells` passed, added `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` to prove damage source parsing.
- Residual gaps: Atlas proof was blocked by `G48` missing source files.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_6_CHOICE_OR_MODE_BUCKET_JULES_TASK.md","sha256WithoutMarker":"c1eefaf36d745f2e9330b1d83c3b23a9fd769d022d0b6b0c29395f2e0ca651ff","markedAtUtc":"2026-06-25T22:29:38.362Z"} -->
