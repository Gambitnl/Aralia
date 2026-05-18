# Spell Mechanics Closure Project Progress

This folder is local-only project progress for the Aralia spell mechanics closure pass.

It holds restart, planning, refinement, and batch-history files that are useful to agents
working on the long-running spell closure project but are not runtime data, schema data,
spell corpus data, or validation inputs.

## Structure

- `handoff/`
  - Current restart surface for the spell mechanics closure project.
- `history/`
  - Batch-history index and older batch-history shards.
- `planning/`
  - Manual batch plans, subfamily classification reports, repeat-pattern notes, and
    refinement notes.

## Files intentionally left outside this folder

- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/`
  - Active mechanics-discovery control data read by `auditSpellMechanicsDiscovery.ts`.
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.*`
  - Generated reports written by `regenerateActionableSchemaBuckets.ts`.
- `docs/tasks/spells/mechanics-discovery/SPELL_MECHANICS_DISCOVERY_REPORT.md`
  - Generated report written by `auditSpellMechanicsDiscovery.ts`.
- spell `.md` files, spell `.json` files, templates, schema shards, validators, and TypeScript
  contract files
  - Active corpus and runtime/schema surfaces, not project-progress notes.

This folder is ignored by git on purpose. It is for local continuity between agents, not
for source-control review.
