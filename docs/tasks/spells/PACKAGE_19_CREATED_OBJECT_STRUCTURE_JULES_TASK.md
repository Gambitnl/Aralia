# Package 19 Jules Task: Created Objects And Structures Early-Game Slice

Status: ready bounded packet for the next Spell Phase 1 mechanics-bucket package.

This packet moves Spell Phase 1 past the Package 18 reaction/opportunity closeout
boundary by promoting the next large mechanics family with a concrete early-game
scope. The target bucket is `created_object_or_structure`, which currently records
`44` open findings and `26` closed findings.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible Symphony/Jules handoff,
PR review, verification interpretation, compact decision reporting, and tracker
updates. Jules owns implementation-heavy spell data, scoped schema/runtime bridge
work, focused tests, and bucket-row classification updates for this bounded slice.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package19-created-object-structure`

Optional Codex review branch, only if bounded local follow-up is necessary:

- `codex/spells-package19-created-object-structure-review`

Recommended review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package19-created-object-structure`

## Jules Value

Jules value: This is a high-value slice because it groups many early-game rows that
share the same representational problem: spells create, alter, conjure, or sustain
objects, food, water, barriers, hazards, or structures, but the runtime JSON often
preserves those facts only as generic utility prose.

The package should avoid one-off spell behavior. It should classify the early-game
rows first, then implement the largest safe subset that can be represented through
existing target, utility, spatial-form, terrain, hazard, duration, scaling, and
validation patterns. Rows that require a new full object-lifecycle engine,
destructible wall hit-point model, inventory item model, summon/control system, or
free-form DM adjudication should be explicitly deferred instead of forced into a
weak schema.

## Goal

Classify and reduce the early-game `created_object_or_structure` bucket without
widening into levels 4-9 or a general object-engine redesign.

Current early-game candidate rows to process in this package:

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

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/created_object_or_structure.md`
- selected rows in:
  - `public/data/spells/level-0/elementalism.json`
  - `public/data/spells/level-0/shape-water.json`
  - `public/data/spells/level-1/goodberry.json`
  - `public/data/spells/level-1/unseen-servant.json`
  - `public/data/spells/level-2/flame-blade.json`
  - `public/data/spells/level-2/flaming-sphere.json`
  - `public/data/spells/level-2/knock.json`
  - `public/data/spells/level-2/phantasmal-force.json`
  - `public/data/spells/level-2/rope-trick.json`
  - `public/data/spells/level-2/web.json`
  - `public/data/spells/level-3/create-food-and-water.json`
  - `public/data/spells/level-3/galders-tower.json`
  - `public/data/spells/level-3/melfs-minute-meteors.json`
  - `public/data/spells/level-3/plant-growth.json`
  - `public/data/spells/level-3/tidal-wave.json`
  - `public/data/spells/level-3/wall-of-water.json`
  - `public/data/spells/level-3/wall-of-sand.json`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- existing focused tests for spell validation, command factory, terrain, utility,
  and spell pipeline behavior.

## Scope Rules

Do not edit:

- Symphony dashboard/runtime/source or local orchestration files.
- `.symphony`, `.jules`, dashboard caches, draft payload artifacts, or local
  orchestration logs.
- workflow files.
- levels 4-9 spell data.
- broad object inventory, destructible wall, shelter navigation, summon-control,
  AI arbitration, or combat HUD systems.
- broad terrain engine rewrites unless a tiny local bridge is required for a
  selected early-game row.

Allowed write scope for this package:

- listed level 0-3 spell JSON files.
- `docs/tasks/spells/mechanics-discovery/buckets/created_object_or_structure.md`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- focused tests under affected spell validation, utility, terrain, command factory,
  and spell pipeline files as needed.

## Required Work

1. Classify all listed rows as `implement_now`, `already_represented_after_proof`,
   `defer_broader_system`, or `belongs_to_other_bucket`.
2. Implement the largest safe coherent subset first:
   - created consumables or objects that can be represented with existing utility
     and duration fields,
   - conjured hazards or barriers already close to terrain/spatial-form modeling,
   - simple food, water, structure, or capacity facts that can be preserved without
     inventing a new simulation engine,
   - row closures that are already represented after proof.
3. Defer rows that need a real object lifecycle, destructible object HP, free-form
   illusion adjudication, servant autonomy, or higher-level schema redesign.
4. Update bucket rows only for proven changes.
5. Keep the PR file list inside expected scope and free of helper artifacts.

## Verification Commands

Run from repository root:

```powershell
npm run validate:spells
node scripts\auditAtlasBuckets.mjs
npx vitest run src/systems/spells/__tests__/spellPipeline.test.ts
```

If TypeScript signatures change in shared files, run dependency-header sync required
by `AGENTS.md`; if unavailable in this checkout, record the exact failure and
continue with this package verification rather than broad tooling repair.

## Acceptance Criteria

- All listed rows are classified in the bucket file first.
- Implementation is a multi-row subset, not a single-row micro-fix.
- Proof exists for selected rows through data/runtime or focused tests.
- `created_object_or_structure.md` is updated only where closure is proven.
- Broad object-engine, destructible-wall, summon-control, AI-arbitration, workflow,
  and Symphony runtime edits are excluded.
- Atlas and gate-relevant bucket statuses are consistent with completed closures.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_19_CREATED_OBJECT_STRUCTURE_JULES_TASK.md","sha256WithoutMarker":"cc68da482699e5753c87132e92297039770705336cbf4cefda25b83d7ecf6b4c","markedAtUtc":"2026-06-25T22:29:38.384Z"} -->
