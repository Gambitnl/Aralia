# Package 9 Jules Prompt: Higher-Level Caster Fixture Coverage

You are working on Aralia Spell Phase 1, Package 9.

This is the replacement Package 9 attempt. Package 8 has merged, so do not wait
on the Bless/Bane handoff. The first Package 9 Jules path produced stale PR
#1030 and stale session `236577711126494484`; do not use that branch as your
base.

Read first:

- `docs/tasks/spells/PACKAGE_9_CASTER_FIXTURE_COVERAGE_JULES_TASK.md`
- `docs/tasks/spells/PACKAGE_9_STALE_PR_REPLACEMENT_DECISION.md`
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

Replacement guardrails:

- Start from current `origin/master`, not stale PR #1030.
- Keep tracker rows aligned with the current master tracker and do not mark the
  package complete before foreman review and merge.
- Prove manifest discoverability against the real
  `public/premade-characters/manifest.json`; do not rely only on a mocked
  two-character manifest.
- Prove combat reachability by calling `createPlayerCombatCharacter` or the
  current combat conversion layer for representative level 2 and level 3 spells.
- Do not include UI files, GitHub workflow files, Symphony runtime/source files,
  generated reports, or temporary conflict helper scripts.

Do not edit Symphony files, `.jules` or `.symphony` runtime state, GitHub
workflows, Package 8 Bless/Bane runtime files, levels 4-9 spell data, broad
character creator UI, broad spellbook UI, or broad AI arbitration policy. Do not
edit `src/components/Party/PartyEditorModal.tsx` unless you pause first and
explain why the package cannot be completed through fixture, manifest, service,
and focused test changes. Do not commit generated gate-report churn if it is
only timestamps.

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
