# Package 6 Jules Prompt: Choice/Mode Mechanics Bucket

You are working on Aralia Spell Phase 1, Package 6.

Read first:

- `docs/tasks/spells/PACKAGE_6_CHOICE_OR_MODE_BUCKET_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- current `choice_or_mode` entries in
  `docs/tasks/spells/mechanics-discovery/manual-review-overrides/`

Goal: reduce the `choice_or_mode` mechanics bucket for cantrips and spell
levels 1-3 with a bounded, coherent implementation slice. Prefer a small group
of spells sharing the same choice-data shape over a broad rewrite.

Recommended starting candidates:

- `blindness-deafness`
- `dragons-breath`
- `protection-from-energy`
- `enhance-ability`

Use existing template/runtime fields where they fit. Add only a small shared
extension if the selected spells genuinely require it.

Do not edit Symphony files, GitHub workflows, broad premade roster semantics, or
levels 4-9. Do not commit generated gate-report timestamp churn. Do not route
deterministic choice mechanics to AI arbitration unless the spell's actual
effect requires open-ended adjudication.

Expected output:

1. Focused spell data/runtime changes for the selected subset.
2. Focused tests proving the choice data is parsed, routed, or exposed through
   the relevant runtime path.
3. `npm run validate:spells`.
4. `npm run generate:spell-gates` as verification, with generated output
   committed only if meaningful.
5. A completion note naming closed spells, deferred spells, tests run, and any
   Atlas limitation. The current Atlas source gap is tracked as `G48`; do not
   claim Atlas proof unless that separate gap is repaired.

