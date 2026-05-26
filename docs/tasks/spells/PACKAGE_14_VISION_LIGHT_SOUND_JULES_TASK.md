# Package 14 Jules Task: Vision, Light, And Sound Mechanics

Status: draft package packet for the next Jules-preferred mechanics slice.

This packet promotes the next tracker-defined bucket after Package 13:
`vision_light_sound`. Package 13 closed the terrain/surface slice through PR
#1096, and the execution plan lists `vision_light_sound` as the next mechanics
bucket.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, compact decision reporting, and tracker
updates. Jules should own the implementation-heavy spell data, smallest
reusable runtime bridge, focused tests, and bucket-row classification for the
bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package14-vision-light-sound`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package14-vision-light-sound-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package14-vision-light-sound`

## Goal

Make a coherent early-game subset of vision, light, sound, darkness,
obscurement, and sensory manifestation spell rules mechanically visible and
testable instead of leaving those rules in prose only.

Package 14 should be larger than the smallest possible spell row. The current
bucket has 48 actionable-open early-game rows across 40 unique cantrip/level
1-3 spells. The target is the largest safe batch that can reuse existing light,
sound, sensory, status, terrain-obscurement, targeting, and focused test
patterns without inventing a broad visibility engine inside one PR.

Primary candidate families:

- Light-source facts already supported by `UtilityEffect.light` and
  `UtilityCommand`.
- Sound emission facts already supported by `soundEmission`.
- Sensory manifestation facts already supported by `sensoryManifestation` and
  illusion metadata.
- Blinded, Deafened, Invisible, and related status facts already supported by
  status-condition data.
- Obscurement or darkness rows that can be represented with existing
  terrain/environment visibility concepts without building a broad line-of-
  sight, magical-darkness, or one-way-visibility engine.

Candidate early-game rows from the current bucket evidence:

- Cantrip: `message`, `thaumaturgy`, `vicious-mockery`.
- Level 1: `alarm`, `comprehend-languages`, `detect-magic`,
  `disguise-self`, `find-familiar`, `fog-cloud`, `illusory-script`,
  `silent-image`, `snare`, and `unseen-servant`.
- Level 2: `alter-self`, `darkness`, `magic-mouth`, `mind-spike`,
  `mirror-image`, `phantasmal-force`, `pyrotechnics`, `rope-trick`,
  `see-invisibility`, `silence`, `skywrite`, `spike-growth`, and
  `summon-beast`.
- Level 3: `blink`, `call-lightning`, `clairvoyance`, `daylight`,
  `enemies-abound`, `glyph-of-warding`, `hunger-of-hadar`,
  `hypnotic-pattern`, `incite-greed`, `leomunds-tiny-hut`, `major-image`,
  `meld-into-stone`, `motivational-speech`, and `wall-of-sand`.

Jules should classify all of those early-game open rows first, then implement
the largest coherent safe subset. Likely safe candidates include `alarm`
audible-alarm metadata, `thaumaturgy` phantom-sound and sensory-mode metadata,
`daylight` light-source normalization/proof, `silent-image` and `major-image`
sensory manifestation metadata, and `fog-cloud` / `darkness` / `silence` only
where current data structures already support the exact fact. Jules must verify
current JSON/runtime state before choosing the exact batch.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/vision_light_sound.md`
- relevant spell JSON files under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/commands/effects/StatusConditionCommand.ts`
- `src/commands/effects/TerrainCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- nearest existing ability/combat/spell-validation tests, especially
  `src/commands/__tests__/UtilityCommand.test.ts`,
  `src/commands/__tests__/LightMechanics.test.ts`, and nearby
  spell-validation tests

Current evidence to preserve:

- `src/types/spells.ts` already defines `UtilityEffect.light`.
- `src/commands/effects/UtilityCommand.ts` already creates
  `activeLightSources` for `utilityType: "light"`.
- Spell validation already accepts `soundEmission` and
  `sensoryManifestation`.
- Existing JSON examples include `continual-flame` light data, `daylight`
  light radii, `knock` sound emission, `faerie-fire` dim-light and Invisible
  interaction text, `blindness-deafness` Blinded/Deafened modes, and
  `minor-illusion` sensory manifestation metadata.
- `fog-cloud`, `darkness`, `silence`, and `hunger-of-hadar` already contain
  partial prose/status/terrain data, but the bucket still marks specific
  vision/light/sound facts open; the package must prove or honestly narrow what
  remains.

## Allowed Write Scope

Jules may edit:

- selected vision/light/sound spell JSON under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/buckets/vision_light_sound.md` only
  to mark rows resolved after proof exists or to document residual rows
- manual review overrides only when a row is proven resolved or deliberately
  narrowed
- `src/types/spells.ts` or `src/systems/spells/validation/spellValidator.ts`
  only for the smallest typed extension needed to represent reusable
  vision/light/sound facts
- `src/commands/effects/UtilityCommand.ts`,
  `src/commands/effects/StatusConditionCommand.ts`,
  `src/commands/effects/TerrainCommand.ts`,
  `src/commands/factory/SpellCommandFactory.ts`, or nearby combat/area helpers
  only when they are the narrow runtime bridge for selected rows
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
- broad line-of-sight, magical-darkness, one-way-visibility, remote-sensor,
  trap/glyph authoring, summon/control, illusion/social arbitration, object-
  animation, or building/structure systems
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

1. Reconfirm the current `vision_light_sound` bucket rows and selected spell
   JSON files before editing.
2. Classify every cantrip/level 1-3 open row named in this packet as one of:
   `implement_now`, `already_represented_after_proof`,
   `defer_broader_system`, or `not_really_vision_light_sound`.
3. Implement the largest coherent safe subset covered by existing light, sound,
   sensory, status, terrain-obscurement, targeting, and test patterns.
4. Reuse existing `UtilityEffect.light`, `soundEmission`,
   `sensoryManifestation`, status conditions, terrain obscuring, and targeting
   structures before adding new types.
5. Add or update focused tests proving the selected rows carry the intended
   vision/light/sound facts through the data/runtime path.
6. Mark only proven rows closed in `vision_light_sound.md`; leave broader or
   unproven rows open with a concise residual reason.
7. Do not close remote-sensor, magical-darkness interaction, one-way-visibility,
   silence-propagation, target-can-hear/target-can-see, glyph/trap, summon, or
   illusion-arbitration rows unless the implementation truly covers them
   without a broad new system.
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
include `UtilityCommand`, `LightMechanics`, `StatusConditionCommand`,
`TerrainCommand`, `SpellCommandFactory`, or spell-validation tests depending on
the implementation.

If exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file. If that
documented sync command is unavailable, record the exact failure and continue
with the package verification rather than widening into tooling repair.

## Acceptance Criteria

- Jules classifies all named early-game vision/light/sound rows before
  selecting the implementation subset.
- The implemented subset contains more than one isolated spell row unless
  current evidence proves that a broader batch would cross a major system
  boundary.
- Selected vision/light/sound rules are represented by explicit data or a
  runtime bridge instead of prose only.
- Existing closed light/sound/sensory examples remain valid.
- Focused tests prove the selected rows expose the intended facts through the
  chosen runtime/data path.
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
