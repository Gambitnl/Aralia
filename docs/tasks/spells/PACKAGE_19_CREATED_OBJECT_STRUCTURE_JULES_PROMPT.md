# Package 19 Jules Prompt: Created Objects And Structures Early-Game Slice

You are working on Aralia Spell Phase 1, Package 19.

Read first:

- `docs/tasks/spells/PACKAGE_19_CREATED_OBJECT_STRUCTURE_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/created_object_or_structure.md`
- relevant selected spell JSON files under `public/data/spells/level-0`,
  `level-1`, `level-2`, and `level-3`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- focused tests for spell validation, spell pipeline, utility/terrain behavior,
  and any command factory path you touch.

Goal:

Classify and reduce the early-game `created_object_or_structure` bucket in one
bounded package. The bucket currently records `44` open findings and `26` closed
findings. This slice should process the cantrip/level 1-3 subset and implement
the largest coherent safe set without becoming a general object-engine redesign.

Expected value for this package:

- This package should reduce a large mechanics bucket, not fix one isolated spell.
- It should preserve concrete created-object/created-structure facts that are
  currently trapped in utility prose when existing schema/runtime patterns can
  carry them safely.
- It should explicitly defer object lifecycle, destructible object HP, free-form
  illusion adjudication, servant autonomy, summon-control, and broad higher-level
  schema issues.

Candidate rows for this slice:

- `elementalism::created_object_or_structure`
- `shape-water::created_object_or_structure`
- `goodberry::manual_created_berries`
- `unseen-servant::created_object_or_structure`
- `flame-blade::manual_conjured_fiery_blade`
- `flaming-sphere::manual_persistent_fire_sphere_hazard`
- `knock::created_object_or_structure`
- `phantasmal-force::created_object_or_structure`
- `rope-trick::manual_extradimensional_space_capacity`
- `web::created_object_or_structure`
- `create-food-and-water::created_object_or_structure`
- `galders-tower::created_object_or_structure`
- `galders-tower::manual_slot_extra_stories`
- `melfs-minute-meteors::manual_six_orbiting_meteors`
- `plant-growth::created_object_or_structure`
- `tidal-wave::created_object_or_structure`
- `wall-of-water::created_object_or_structure`
- `wall-of-sand::created_object_or_structure` as proof/closure context if needed

Expected behavior:

- Classify each candidate row as `implement_now`,
  `already_represented_after_proof`, `defer_broader_system`, or
  `belongs_to_other_bucket`.
- Use existing spell-schema, validation, terrain, spatial-form, utility, duration,
  and scaling patterns where possible.
- Implement the selected rows only and avoid out-of-scope broadening.
- Update `created_object_or_structure.md` only for rows whose changes are proven.
- Keep the PR file list inside the allowed write scope in the task packet.

Do not edit:

- Symphony dashboard/runtime/source files.
- `.symphony`, `.jules`, dashboard caches, draft payload artifacts, or local
  orchestration logs.
- workflow files.
- levels 4-9 spell data.
- broad object inventory, destructible wall, shelter navigation, summon-control,
  AI arbitration, or combat HUD systems.

Verification:

Run these commands and report results in the completion note:

1. `npm run validate:spells`
2. `node scripts\auditAtlasBuckets.mjs`
3. `npx vitest run src/systems/spells/__tests__/spellPipeline.test.ts`

If runtime/schema files are touched and exported signatures change, run or explicitly
document dependency-header sync required by `AGENTS.md`.

Output you should include at package completion:

- Row classifications in `created_object_or_structure.md`.
- The implemented bounded row list and why it was safe to include.
- Proof commands and outcomes.
- Files changed.
- Residual rows left for later packages or broader systems.
