# Package 8 Jules Task: Bless/Bane Roll Modifiers

Status: historical Package 8 packet; PR #1020 merged on 2026-05-25.

This packet promotes tracker gap `G49` into a bounded implementation task. It
exists because Package 7 restored the Spell Pipeline Atlas source and audit
surface, so the next product-facing work can return to early-game combat
mechanics instead of Atlas repair.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, dashboard handoff, PR review,
verification, decision reporting, and tracker updates. Jules should own the
implementation-heavy spell data, runtime bridge, and focused tests for the
bounded Bless/Bane slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package8-bless-bane-roll-modifiers`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package8-bless-bane-roll-modifier-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package8-bless-bane-roll-modifiers`

## Goal

Make Bless and Bane mechanically apply their `1d4` attack-roll and
saving-throw modifiers in the combat simulator.

The current spell JSON applies visible status labels (`Blessed` and `Bane`) and
concentration duration, but the runtime does not yet have honest data and proof
for the actual math:

- Bless: affected targets add `1d4` to attack rolls and saving throws while the
  spell is active.
- Bane: targets that fail the initial Charisma save subtract `1d4` from attack
  rolls and saving throws while the spell is active.

This package should close the gap without expanding into a broad roll-engine
rewrite, broad AI arbitration policy, or higher-level spell work.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`
- `docs/tasks/spells/PACKAGE_7_ATLAS_DISCOVERABILITY_SOURCE_REPAIR_JULES_TASK.md`
- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/level-1-00.json`
- `public/data/spells/level-1/bless.json`
- `public/data/spells/level-1/bane.json`
- `public/data/spells/level-0/frostbite.json`
- `public/data/spells/level-2/blur.json`
- `src/types/spells.ts`
- `src/types/combat.ts`
- `src/commands/effects/AttackRollModifierCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/systems/combat/SavePenaltySystem.ts`
- `src/utils/character/savingThrowUtils.ts`
- nearest existing command/factory/combat tests

Current evidence to preserve:

- `AttackRollModifierEffect` already has `modifier: "bonus" | "penalty"`,
  `direction`, `attackKind`, `consumption`, `duration`, `dice`, and `value`.
- `AttackRollModifierCommand` stores attack-roll riders in
  `activeEffects[].mechanics`.
- `AbilityCommandFactory` currently consumes several advantage/disadvantage
  sources for weapon attacks, but Package 8 must verify whether it consumes
  `bonus` / `penalty` dice from active attack-roll riders.
- `rollSavingThrow` already accepts positive or negative
  `SavingThrowModifier` dice, but `SavePenaltySystem` is penalty-oriented and
  may need to become a generalized save modifier path or be paired with a small
  positive modifier bridge.
- Manual review overrides already mark both `bane::attack_or_save_modifier` and
  `bless::attack_or_save_modifier` as `actionable_open`.

## Allowed Write Scope

Jules may edit:

- `public/data/spells/level-1/bless.json`
- `public/data/spells/level-1/bane.json`
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/level-1-00.json`
  only to mark the Bless/Bane rows resolved after runtime proof exists
- `src/types/spells.ts` and `src/types/combat.ts` only for the smallest typed
  extension needed to represent reusable attack/save roll modifiers
- `src/commands/effects/AttackRollModifierCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/systems/combat/SavePenaltySystem.ts` or a narrowly named replacement
  helper if general save modifiers are cleaner than stretching a penalty-only
  class
- `src/utils/character/savingThrowUtils.ts` only if the existing modifier API is
  insufficient
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
- broad AI arbitration policy
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

1. Reconfirm the current Bless/Bane data and manual-review rows from the files
   above before editing.
2. Add honest runtime data for Bless and Bane attack-roll modifiers. Preserve
   the existing status labels and concentration duration where they are useful
   for UI and readability, but do not rely on status names for combat math.
3. Add or reuse runtime data for Bless and Bane saving-throw modifiers.
4. Make outgoing weapon/spell attack rolls consume active `bonus` / `penalty`
   dice where the effect says they apply. Bless should add `1d4`; Bane should
   subtract `1d4`.
5. Make saving throws collect the active modifier for the character making the
   save. Bless should add `1d4`; Bane should subtract `1d4`.
6. Keep Bane's initial Charisma save as the gate for applying the Bane rider.
   A successful save must not receive the attack/save penalty.
7. Keep Bless as a no-save buff applied to chosen targets.
8. Keep modifier consumption/duration faithful to the spell text: these riders
   should apply while the spell is active, not only to the next attack or next
   save.
9. Add focused tests that prove:
   - Bless registers a positive `1d4` attack-roll modifier.
   - Bane registers a negative `1d4` attack-roll modifier only after a failed
     Charisma save.
   - saving throws can receive Bless's positive `1d4` and Bane's negative
     `1d4`.
   - existing Frostbite or similar attack-roll rider behavior is not broken.
10. Run validation and focused tests.
11. Update this packet or the living tracker with the implementation result,
    tests run, and any residual limitation.

## Verification Commands

Run from the repository root:

```powershell
npm run validate:spells
node scripts\auditAtlasBuckets.mjs
```

Add the focused tests created or changed by this package. Candidate examples:

```powershell
npx vitest run src/commands/effects/__tests__/AttackRollModifierCommand.test.ts --reporter=verbose
npx vitest run src/commands/factory/__tests__/AbilityCommandFactory.test.ts --reporter=verbose
npx vitest run src/utils/character/__tests__/savingThrowUtils.test.ts --reporter=verbose
```

Use the actual nearest test paths present in the implementation branch. If
exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file.

## Acceptance Criteria

- Bless and Bane no longer depend on status-condition names for their roll
  modifier math.
- Bless applies `+1d4` to affected targets' attack rolls and saving throws
  while active.
- Bane applies `-1d4` to failed-save targets' attack rolls and saving throws
  while active.
- Bane's initial Charisma save still prevents the debuff on success.
- The combat log or deterministic tests expose enough modifier detail that the
  behavior is testable instead of invisible.
- Existing attack-roll rider behavior, especially Frostbite-style
  disadvantage, remains covered.
- Spell validation passes.
- Atlas audit remains green after Package 7.
- Manual-review rows for Bless/Bane are updated only after implementation proof
  exists.
- No Symphony runtime/source/local-state artifacts are committed.

## Decision Report

Decision point: choose the next package after Package 7 restored Atlas proof.

Decision made by Codex foreman: promote `G49` into Package 8 and delegate it to
Jules first.

Why: Bless/Bane is a bounded mechanics gap with clear product value for early
combat testing. The implementation crosses spell data, combat roll runtime, and
focused tests, which is suitable for Jules under a narrow handoff.

Artifact boundary:

- Aralia GitHub: this task packet, the matching Jules prompt, living tracker
  updates, implementation PR, focused tests, and concise completion notes.
- External Symphony / local ignored state: dashboard run state, draft IDs,
  handoff receipts, generated manifests, click logs, and raw Jules process
  output.



### Completion Note
Implementation complete.
- **Changed files:**
  - `src/types/spells.ts`: Added `savingThrowModifier` structure within `AttackRollModifierEffect` to support combined roll riders.
  - `src/types/combat.ts`: Added matching fields to `ActiveEffect` mechanics.
  - `src/commands/effects/AttackRollModifierCommand.ts`: Updated to bundle and describe saving throw modifiers alongside attack roll modifiers.
  - `public/data/spells/level-1/bless.json` & `bane.json`: Added `ATTACK_ROLL_MODIFIER` effects specifying 1d4 bonuses/penalties decoupled from condition names.
  - `src/commands/factory/AbilityCommandFactory.ts`: Integrated active effect riders to dynamically sum bonus/penalty dice into weapon and spell attacks, logging sources.
  - `src/systems/combat/SavePenaltySystem.ts`: Extended `getActivePenalties` to dynamically collect and calculate active effect saving throw riders.
  - `docs/tasks/spells/mechanics-discovery/manual-review-overrides/level-1-00.json`: Marked Bless and Bane roll modifier tracker items as closed.
- **Verification Commands Run:**
  - `npm run validate:spells` (All passed)
  - `node scripts/auditAtlasBuckets.mjs` (All passed)
  - `npx vitest run src/commands/factory/__tests__/AbilityCommandFactory.test.ts` (Added Bless/Bane dice modifier tests; All passed)
  - `npx vitest run src/systems/combat/__tests__/SavePenaltySystem.test.ts` (Added tests for active effect save modifiers; All passed)
- **Behavior Proven:**
  - Bless provides 1d4 bonus to attacks and saves. Bane provides -1d4 penalty to attacks and saves.
  - Combat math explicitly relies on runtime explicit effect structures (`ATTACK_ROLL_MODIFIER`) instead of generic status strings.
- **Residual Limitations:** None noted.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_8_BLESS_BANE_ROLL_MODIFIERS_JULES_TASK.md","sha256WithoutMarker":"c86d1b8fa614e050c554402beb103fe4f2635b8a6f706d03397c26f5c54c2ecf","markedAtUtc":"2026-06-25T22:29:38.367Z"} -->
