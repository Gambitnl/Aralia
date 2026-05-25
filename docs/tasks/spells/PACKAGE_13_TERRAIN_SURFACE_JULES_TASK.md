# Package 13 Jules Task: Terrain And Surface Mechanics

Status: draft package packet for the next Jules-preferred mechanics slice.

This packet promotes tracker gap `G125` into a bounded implementation task. It
exists because Package 12 closed the representative `conditional_ending` slice,
and the execution plan lists `terrain_or_surface` as the next mechanics bucket.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, compact decision reporting, and tracker
updates. Jules should own the implementation-heavy spell data, smallest
reusable terrain/runtime bridge, and focused tests for the bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package13-terrain-surface`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package13-terrain-surface-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package13-terrain-surface`

## Goal

Make a coherent early-game subset of terrain/surface spell rules mechanically
visible and testable instead of leaving those rules in prose only.

Package 13 should be larger than the smallest possible spell row. The target is
the largest safe batch of cantrip/level 1-3 terrain or surface rows that can be
represented with existing `TerrainEffect`, `MovementEffect`, targeting, status,
and focused test patterns. Do not force all terrain rows into one PR if that
would require a broad wall engine, trap/glyph authoring system, summon/control
system, illusion arbitration, or combat HUD work.

Primary candidate families:

- Difficult-terrain creation or removal.
- Ground/floor/ceiling/surface eligibility that can be represented through
  targeting notes or existing object/surface filters.
- Movement through vertical surfaces or altered surfaces when a small existing
  movement/status representation is enough.
- Persistent terrain hazards that can reuse `TerrainCommand` and existing
  area-trigger tests.

Candidate early-game rows from the current bucket evidence:

- Cantrip: `mold-earth`, `prestidigitation`, `thaumaturgy`.
- Level 1: `snare`, plus classify `catapult`,
  `comprehend-languages`, `tensers-floating-disk`, and `unseen-servant`.
- Level 2: `spider-climb`, `spike-growth`, `web`,
  `flaming-sphere`, `levitate`, `rope-trick`, and classify
  `cordon-of-arrows` / `phantasmal-force`.
- Level 3: `erupting-earth`, `plant-growth`, `sleet-storm`,
  `speak-with-plants`, and classify `gaseous-form`,
  `glyph-of-warding`, `meld-into-stone`, `melfs-minute-meteors`,
  `summon-lesser-demons`, `tidal-wave`, `tiny-servant`,
  `wall-of-sand`, `wall-of-water`, `water-walk`, and `wind-wall`.

Jules should classify all of those early-game open rows first, then implement
the largest coherent safe subset. The expected useful subset is likely the
terrain-effect and movement-surface rows such as `mold-earth`,
`spider-climb`, `spike-growth`, `web`, `erupting-earth`, `plant-growth`, and
`sleet-storm`, but Jules should verify current JSON/runtime state before
choosing the exact batch.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/terrain_or_surface.md`
- relevant spell JSON files under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/commands/effects/TerrainCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- nearest existing ability/combat/spell-validation tests, including terrain or
  command-factory tests if present

Current evidence to preserve:

- `src/types/spells.ts` already defines `TerrainEffect` and
  `TerrainManipulation`.
- `src/commands/effects/TerrainCommand.ts` already applies difficult terrain,
  blocking, obscuring, damaging, wall, and Mold Earth-style manipulation to map
  tiles.
- `SpellCommandFactory` already dispatches `TERRAIN` effects to
  `TerrainCommand`.
- Closed examples such as `entangle` and `grease` show the existing JSON shape
  for square difficult terrain and status-on-area follow-up effects.
- Open rows such as `web`, `erupting-earth`, and `sleet-storm` already contain
  partial terrain/status/damage data, but the bucket still marks them
  `actionable_open`; the package must prove or honestly narrow what remains.

## Allowed Write Scope

Jules may edit:

- selected terrain/surface spell JSON under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/buckets/terrain_or_surface.md` only to
  mark rows resolved after proof exists or to document residual rows
- manual review overrides only when a row is proven resolved or deliberately
  narrowed
- `src/types/spells.ts` only for the smallest typed extension needed to
  represent reusable terrain/surface facts
- `src/commands/effects/TerrainCommand.ts`, `src/commands/factory/SpellCommandFactory.ts`,
  or nearby combat/area helpers only when they are the narrow runtime bridge for
  selected rows
- focused tests under the nearest existing `__tests__` directories
- package-specific completion notes in this file or the living tracker

Jules should not edit:

- Symphony dashboard/runtime/source files
- `.symphony`, `.jules`, dashboard caches, generated manifests, draft IDs,
  click receipts, or local orchestration logs
- GitHub workflow files
- levels 4-9 spell data
- premade roster semantics
- character creator or spellbook UI
- combat HUD/rider-icon UI; record active spell-rider icon visibility as a
  later combat-visibility follow-up if noticed
- broad AI arbitration policy
- broad wall engine, trap/glyph authoring, summon/control, illusion/social
  arbitration, object-animation, or building/structure systems
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

1. Reconfirm the current `terrain_or_surface` bucket rows and selected spell
   JSON files before editing.
2. Classify every cantrip/level 1-3 open row named in this packet as one of:
   `implement_now`, `already_represented_after_proof`, `defer_broader_system`,
   or `not_really_terrain_surface`.
3. Implement the largest coherent safe subset covered by existing terrain,
   movement, targeting, status, and test patterns.
4. Reuse existing `TerrainEffect`, `TerrainManipulation`, area targeting,
   status, and movement structures before adding new types.
5. Add or update focused tests proving the selected rows carry the intended
   terrain/surface facts through the data/runtime path.
6. Mark only proven rows closed in `terrain_or_surface.md`; leave broader or
   unproven rows open with a concise residual reason.
7. Do not close wall, glyph/trap, summon/control, illusion/social, or
   object-animation rows unless the implementation truly covers them without a
   broad new system.
8. Run validation, Atlas audit, focused tests, and TypeScript/build checks when
   runtime code changes.
9. Update this packet or the living tracker with the implementation result,
   tests run, behavior proven, and residual limitations.

## Verification Commands

Run from the repository root:

```powershell
npm run validate:spells
node scripts\auditAtlasBuckets.mjs
```

Add the focused tests created or changed by this package. Candidate targets may
include `TerrainCommand`, `SpellCommandFactory`, area-trigger, or spell-data
tests depending on the implementation.

If exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file. If that
documented sync command is unavailable, record the exact failure and continue
with the package verification rather than widening into tooling repair.

## Acceptance Criteria

- Jules classifies all named early-game terrain/surface rows before selecting
  the implementation subset.
- The implemented subset contains more than one isolated spell row unless
  current evidence proves that a broader batch would cross a major system
  boundary.
- Selected terrain/surface rules are represented by explicit data or a runtime
  bridge instead of prose only.
- Existing closed terrain examples remain valid.
- Focused tests prove the selected rows expose the intended terrain/surface data
  through the chosen runtime/data path.
- Spell validation passes.
- Atlas audit remains green.
- The bucket tracker or completion note honestly distinguishes closed rows from
  residual rows.
- No Symphony runtime/source/local-state artifacts are committed.

## Decision Logging And Wait States

Use compact decision logging for this package.

Full decision entries are for real forks: plan approval or rejection, scope
expansion, replacement handoff, bounded repair request, branch-hygiene repair,
merge/closeout, or a decision to abandon/replace a Jules session.

Repeated observations that preserve the same state should be compact wait-state
rows in the tracker, task receipt, or PR review notes. A compact wait-state row
should name:

- observed Jules/dashboard/GitHub state
- what Codex is waiting for
- next recheck condition
- whether any explicit Jules message or PR feedback was sent

Once a Jules session starts, later local tracker edits or merged GitHub task-doc
PRs do not automatically reach that isolated clone. Any task adjustment after
launch needs an explicit visible channel: Jules message, bounded PR feedback,
PR-branch repair/rebase, or replacement handoff from current `origin/master`.

## Artifact Boundary

- Aralia GitHub: this task packet, the matching Jules prompt, living tracker
  updates, implementation PR, focused tests, and concise completion notes.
- External Symphony / local ignored state: dashboard run state, draft IDs,
  handoff receipts, generated manifests, click logs, and raw Jules process
  output.
