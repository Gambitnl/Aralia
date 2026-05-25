# Package 9 Jules Prompt: Higher-Level Caster Fixture Coverage

You are working on Aralia Spell Phase 1, Package 9.

This package is ready to start when the Codex foreman dispatches it through the
visible Symphony/Jules handoff path. Package 8 has merged, so do not wait on
the Bless/Bane handoff.

Read first:

- `docs/tasks/spells/PACKAGE_9_CASTER_FIXTURE_COVERAGE_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `public/premade-characters/manifest.json`
- `public/premade-characters/*.json`
- `src/services/premadeCharacterService.ts`
- nearest party editor, combat simulator, and premade fixture tests

Goal: add a conservative fixture path for testing level 2 and level 3 spells
from legal caster characters, without changing the normal level 1 starting
party semantics.

Expected behavior:

- The existing 13 normal premades stay level 1 one-per-class starting-party
  choices.
- Additional higher-level caster fixtures are marked as dev/test or
  simulator-only.
- Caster fixtures have bounded cantrips, known spells, prepared spells, slots,
  spellcasting ability, equipment, hit points, and AC.
- At least one level 2 spell and one level 3 spell are reachable through the
  combat simulator or combat conversion layer.
- No caster fixture is made convenient by preparing every available spell.

Use existing fixture, manifest, and loader structures where possible. Add only
the smallest manifest metadata or loader support needed to keep normal premades
separate from dev/test fixtures.

Do not edit Symphony files, `.jules` or `.symphony` runtime state, GitHub
workflows, Package 8 Bless/Bane runtime files, levels 4-9 spell data, broad
character creator UI, broad spellbook UI, or broad AI arbitration policy. Do not
commit generated gate-report churn if it is only timestamps.

Expected output:

1. Focused fixture/manifest/loader changes for higher-level caster testing.
2. Focused tests or audits proving normal premades still load and dev/test
   fixtures are discoverable through the chosen path.
3. Proof that representative level 2 and level 3 spells can be reached from
   legal caster fixtures.
4. `npm run validate:spells`.
5. Any required dependency-header sync if exported/shared TypeScript signatures
   changed.
6. A completion note naming changed files, tests run, behavior proven, and any
   residual limitation.
