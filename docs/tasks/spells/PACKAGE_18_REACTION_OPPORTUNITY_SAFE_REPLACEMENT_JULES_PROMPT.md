# Package 18 Jules Prompt: Reaction Opportunity Safe Replacement

You are working on Aralia Spell Phase 1, Package 18.

Use this replacement packet instead of the earlier Package 18 continuation
packet. The earlier Jules session `12854522108539821255` became unsafe and must
not be resumed as-is.

Read first:

- `docs/tasks/spells/PACKAGE_18_REACTION_OPPORTUNITY_SAFE_REPLACEMENT_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
- the selected spell JSON and focused tests named in the task packet

Goal:

Progress Package 18 by proving and reconciling the remaining cantrip/level 1-3
`reaction_or_opportunity_restriction` rows that fit existing runtime/schema
patterns. Do not create a broad reaction-engine, spell-interruption schema, or
type/validator bridge in this package.

Candidate rows for this replacement run:

- `arms-of-hadar::reaction_or_opportunity_restriction`
- `dissonant-whispers::reaction_or_opportunity_restriction`
- `enemies-abound::reaction_or_opportunity_restriction`
- `counterspell::reaction_or_opportunity_restriction`
- `slow::reaction_or_opportunity_restriction` repeated early-game variants

Do not process:

- `confusion::reaction_or_opportunity_restriction`
- `lightning-arrow::manual_attack_hit_or_miss_trigger`

Expected behavior:

- Classify each candidate row as `already_represented_after_proof`,
  `implement_now`, `defer_broader_system`, or `belongs_to_other_bucket`.
- Prefer proving existing closures over changing schema/type files.
- Keep Counterspell open or deferred if it requires a new spell-casting
  interruption event model.
- Update bucket rows only when the evidence is current and specific.
- Stop and report a blocker if the implementation requires forbidden files.

Forbidden files:

- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/**`
- `src/hooks/combat/useActionExecutor.ts`
- `public/data/spells/level-3/confusion.json`
- any Lightning Arrow spell JSON
- `.github/**`
- package or lock files
- repo config/tooling files
- root helper scripts or one-off patch scripts
- Symphony/Jules runtime, cache, dashboard, draft, or click-log artifacts

Verification:

Run these commands and report results:

1. `npm run validate:spells`
2. `node scripts\auditAtlasBuckets.mjs`
3. `npx vitest run src/commands/factory/__tests__/SpellCommandFactoryGrantedAction.test.ts src/systems/combat/__tests__/OpportunityAttackSystem.test.ts src/systems/spells/__tests__/spellPipeline.test.ts`

Completion output:

- row classifications and evidence
- changed files
- verification commands and outcomes
- explicit confirmation that no forbidden files were touched
- residual rows or broader reaction-engine gaps left for later packages

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_18_REACTION_OPPORTUNITY_SAFE_REPLACEMENT_JULES_PROMPT.md","sha256WithoutMarker":"15ad59641b3a3a88a79cf01d79b07cfba1db9c795eb65f6b7d4545a6f24f41ca","markedAtUtc":"2026-06-25T22:29:38.383Z"} -->
