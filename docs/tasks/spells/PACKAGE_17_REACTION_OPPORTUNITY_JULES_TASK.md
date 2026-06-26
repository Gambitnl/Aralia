# Package 17 Jules Task: Reaction And Opportunity Restrictions

Status: historical Package 17 packet; PR #1140 and repair PR #1141 merged.

This packet promotes the next tracker-defined bucket after Package 16:
`reaction_or_opportunity_restriction`. Package 16 closed the safe
sustain/recast granted-action subset through PR #1135, and the live tracker now
points Package 17 at reaction and opportunity restrictions.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, compact decision reporting, and tracker
updates. Jules should own the implementation-heavy spell data, the smallest
reusable schema/runtime bridge, focused tests, and bucket-row classification for
the bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package17-reaction-opportunity`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package17-reaction-opportunity-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package17-reaction-opportunity`

## Jules Value

Jules value: this package is large enough for Jules because it groups 12
cantrip/level 1-3 reaction and opportunity findings into one repeated mechanics
family instead of asking for another isolated row repair. The bucket has 18 open
findings total across 17 distinct spells, and the early-game subset covers
cantrip attack riders, level 1 reaction suppression and reaction-consuming
movement, level 2 smite/flyby/familiar edge cases, and level 3 counterspell,
confusion, enemies-abound, and slow behavior.

The implementation-value floor is met only if Jules classifies every early-game
row first, then implements a safe multi-row subset through shared data/schema or
runtime concepts. A one-spell fix is not enough unless current source evidence
proves the rest crosses a major engine boundary.

## Goal

Make a coherent early-game subset of reaction suppression, opportunity-attack
suppression, reaction-consuming forced movement, and reaction-trigger metadata
mechanically visible and testable instead of leaving those rules in prose only.

Package 17 should classify every cantrip/level 1-3 open row first, then
implement the largest safe subset that fits existing `castingTime`,
`reactionCondition`, `combatCost`, `forcedMovement`, status-condition,
opportunity-attack, validation, command, and focused-test patterns. Do not
invent a broad async reaction prompt engine or full opportunity-attack policy
engine just to close rows.

The early-game open rows currently named by the bucket are:

- Cantrip: `shocking-grasp::manual_opportunity_attack_suppression`.
- Level 1: `arms-of-hadar`, `dissonant-whispers`, `find-familiar`.
- Level 2: `shining-smite`, `summon-beast`.
- Level 3: `blinding-smite`, `counterspell`, `enemies-abound`, `slow` (two
  rows), and `confusion`.

Likely safe implementation candidates are the rows that can be represented as
explicit reaction/opportunity facts without building a new reaction UI:

- `shocking-grasp`: target cannot make Opportunity Attacks until the start of
  its next turn after a hit.
- `arms-of-hadar`: failed-save targets cannot take reactions until the start of
  their next turn.
- `slow`: affected targets cannot take reactions while slowed; reconcile the
  duplicate bucket rows rather than closing the same mechanic twice.
- `confusion`: failed-save targets cannot take Bonus Actions or Reactions while
  confused.
- `dissonant-whispers`: failed-save forced movement uses the target reaction if
  available and follows the safest route away from the caster.
- `enemies-abound`: affected creatures must take an Opportunity Attack if an
  enemy provokes one and they are able.
- `counterspell`: the spell is a Reaction to seeing a creature cast within
  range, and failed interruption wastes the triggering action/Bonus
  Action/Reaction without expending the interrupted spell slot.

Rows likely needing classification or deferral unless current source already
has a narrow safe path:

- `find-familiar` may overlap familiar delivery, summon/control lifecycle, and
  touch-spell targeting.
- `summon-beast` may overlap Package 15 summon data and entity-specific Flyby
  behavior rather than spell-level reaction restrictions.
- `shining-smite` and `blinding-smite` may belong in a later after-hit
  casting-trigger package if the current reaction/casting-trigger shape cannot
  represent them safely.
- Broad UI prompts for optional reactions, player confirmation, or tactical
  opportunity-attack choice stay out of scope.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
- relevant spell JSON files under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/combat/reactions/OpportunityAttackSystem.ts`
- nearest focused tests for spell validation, command factories, forced
  movement, opportunity attacks, and action economy

Current evidence to preserve:

- `dissonant-whispers` already has `forcedMovement.usesReaction`,
  `direction: away_from_caster`, and a prose/custom-formula safest-route hint.
  Strengthen or prove this path instead of duplicating it.
- `hellish-rebuke` is already closed because casting-time reaction data stores
  the trigger and combat cost. Reuse that shape where it fits.
- `dominate-monster`, `primordial-ward`, and `power-word-heal` are higher-level
  closed examples that show acceptable interim patterns: utility options,
  granted reaction actions, and reaction sustain costs.
- `OpportunityAttackSystem` already checks status effects and `canTakeReaction`
  for attacker eligibility. Do not widen this package into a full tactical
  reaction-prompt rebuild.

## Allowed Write Scope

Jules may edit:

- selected reaction/opportunity spell JSON under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
  only to mark rows resolved after proof exists or to document residual rows
- manual review overrides only when a row is proven resolved or deliberately
  narrowed
- `src/types/spells.ts` only for the smallest typed extension needed to
  represent reusable reaction/opportunity facts
- `src/systems/spells/schema/spell.schema.json`,
  `src/systems/spells/schema/parts/20-effect-payloads.json`, and
  `src/systems/spells/validation/spellValidator.ts` only when schema/validation
  must accept those reusable facts
- `src/systems/combat/reactions/OpportunityAttackSystem.ts`,
  `src/hooks/combat/useActionExecutor.ts`, command factories, or nearby combat
  helpers only when they are the narrow runtime bridge for selected rows
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
- combat HUD/rider-icon UI
- broad optional-reaction prompt UI
- broad summon/control engines already outside Package 15 closeout
- broad AI arbitration policy
- broad illusion/social arbitration
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

1. Reconfirm the current `reaction_or_opportunity_restriction` bucket rows and
   selected spell JSON files before editing.
2. Classify every cantrip/level 1-3 open row named in this packet as one of:
   `implement_now`, `already_represented_after_proof`,
   `defer_broader_system`, or `belongs_to_other_bucket`.
3. Implement the largest coherent safe subset covered by existing
   `castingTime`, `reactionCondition`, `combatCost`, `forcedMovement`,
   status-condition, opportunity-attack, validation, command, and focused-test
   patterns.
4. Prefer narrow reusable data/schema facts over a new broad action-economy or
   reaction-prompt engine.
5. Add or update focused tests proving the selected rows carry the intended
   reaction/opportunity facts through the data/runtime path.
6. Mark only proven rows closed in `reaction_or_opportunity_restriction.md`;
   leave broader or unproven rows open with a concise residual reason.
7. Do not close familiar delivery, summon flyby, after-hit smite triggers, or
   optional tactical reaction UI rows unless the implementation truly covers
   them without a broad new system.
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
include spell validation, command factory tests, forced-movement tests,
`OpportunityAttackSystem` tests, or nearby combat action-economy tests depending
on the implementation.

If exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file. If that
documented sync command is unavailable, record the exact failure and continue
with the package verification rather than widening into tooling repair.

## Acceptance Criteria

- Jules classifies all named early-game reaction/opportunity rows before
  selecting the implementation subset.
- The implemented subset contains more than one isolated spell row unless
  current evidence proves that a broader batch would cross a major system
  boundary.
- Selected reaction/opportunity rules are represented by explicit data or a
  narrow runtime bridge instead of prose only.
- Existing spell validation and already-closed bucket rows remain valid.
- Focused tests prove the selected rows expose the intended facts through the
  chosen runtime/data path.
- Bucket counts and statuses are updated only for rows proven by the final diff.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_17_REACTION_OPPORTUNITY_JULES_TASK.md","sha256WithoutMarker":"934e3b5ac58571a5db8ff9a908ab7db2a0122da3a6f7087b1ba7f7c813a905dd","markedAtUtc":"2026-06-25T22:29:38.380Z"} -->
