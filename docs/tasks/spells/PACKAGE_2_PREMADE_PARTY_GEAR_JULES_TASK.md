# Package 2 Jules Task: Premade Party And Gear

Status: local Symphony draft created; setup branch pushed; fresh Symphony
readiness preflight required before Jules dispatch.

This is the first implementation slice for Spell Phase 1 after the Symphony
post-ARA-6 cleanup and Package 1 baseline. It intentionally focuses on premade
level-1 characters and combat-ready gear before broader spell mechanics, because
spell testing needs a reliable default party that can enter the combat simulator
with legal equipment, visible AC, usable weapons, and caster spellbooks that do
not pretend every known spell is prepared.

The Jules Environment `Run and Snapshot` proof has been captured for the
Package 2 scoped setup script:

```powershell
npm ci --no-audit --no-fund
npm run validate:spells
npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose
```

The original broad `npm run typecheck` setup failed in Jules because a clean
tracked clone lacks local untracked/generated TypeScript modules. That failure
is recorded in
`docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`; it is
not a blocker for this scoped Package 2 dispatch.

## Worker

Default worker: Jules.

Codex role: foreman only. Codex owns scoping, review, verification, decision
reporting, Atlas/gate evidence updates, and ROI receipt capture. Jules should
own the implementation-heavy data and runtime patch once the environment
snapshot is proven.

## Branch And Worktree

Do not create or push these until the Symphony task draft/handoff is created for
Package 2.

Reserved implementation branch:

- `jules/spells-package2-premade-party-gear`

Reserved local review/repair branch, only if Codex needs a follow-up repair
after reviewing Jules output:

- `codex/spells-package2-premade-party-gear-review`

Reserved local implementation/review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package2-premade-party-gear`

This branch/worktree reservation is documentation, not a dispatch action. The
branch is the Git identity for the slice; the worktree is only the local
isolation mechanism for review, verification, or bounded repair once the slice
is active.

## Prompt Packet

The exact Jules prompt packet is drafted at
`docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`.

That prompt is not a dispatch receipt. It may now be used to create the Package
2 Symphony/Jules task because the environment receipt says Package 2 may
dispatch.

The matching Symphony task-draft payload is prepared at
`docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json`. It was submitted
to the local Symphony dashboard API and returned draft id
`draft-1779344522441-vdy0hi`. That draft was initially
`blocked_by_git_sync`; the setup branch has since been pushed, so a fresh
Symphony task queue or Git preflight snapshot is required before dispatch.

The dispatch-readiness checklist is prepared at
`docs/tasks/spells/PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md`. It is the
current source of truth for what is ready, what remains blocked, and which
mutation-producing steps are still intentionally unperformed.

The local submission receipt is
`docs/tasks/spells/PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT.md`.

The current ROI baseline receipt is
`docs/tasks/spells/SPELL_PHASE_1_ROI_BASELINE_RECEIPT.md`. It says Package 2 ROI
is still unknown and must not be claimed until a real Jules handoff plus
task-scoped `roi-foreman-usage` and `roi-estimate` receipts exist.

The Atlas/gate checkpoint receipt is
`docs/tasks/spells/PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md`. It stays pending
until Package 2 has real implementation output and Codex records the spell gate,
Atlas, and combat verification evidence for the slice.

The foreman review and failure-classification receipt is
`docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md`. It stays pending until
Jules returns a PR or patch and Codex classifies scope, verification, and repair
or advancement decisions for the slice.

The task communication receipt is
`docs/tasks/spells/PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md`. It stays pending
until a Package 2 Symphony draft, task page, or Jules handoff exists and Codex
can record task-scoped messages, clarifications, operator answers, or Jules
dialogue without mixing them with broad thread context.

The PR/deployment/local-sync receipt is
`docs/tasks/spells/PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md`. It stays
pending until Package 2 has a real branch or PR and Codex can record GitHub
checks, merge, deployment proof or waiver, and local-sync evidence.

## Goal

Make the default level-1 premade party a usable combat simulator baseline for
testing cantrips and level 1 spells, while preserving the later Spell Phase 1
need for level 2-3 caster fixtures.

## Source Context

Use these existing artifacts instead of inventing a parallel plan:

- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/superpowers/plans/2026-05-12-equip-premade-characters.md`
- `public/premade-characters/manifest.json`
- `public/premade-characters/*.json`
- `src/utils/combat/combatUtils.ts`
- `src/utils/character/weaponUtils.ts`
- `src/types/items.ts`

## Ownership

Jules may edit:

- `public/premade-characters/*.json`
- `src/utils/combat/combatUtils.ts`
- the nearest existing combat utility tests under `src/utils/combat/__tests__/`
- a narrow premade legality audit/test if no existing test covers the loadout
  checks cleanly

Jules should not edit:

- broad spell schema/runtime architecture
- character creator UI
- character sheet spellbook UI
- AI arbitration policy
- Atlas/gate generation scripts except through normal verification commands
- Symphony orchestration files

## Required Work

1. Equip all 13 level-1 premade characters with class-appropriate working gear.
   Preserve each premade identity, class, level, stats, spellbook intent, and
   existing descriptive scaffolding.
2. Ensure weapon items use the shape expected by `weaponUtils.ts`, especially
   `type: "weapon"`, `damageDice`, `damageType`, `properties`, and martial
   flags.
3. Ensure armor and shields reflect the premade's existing `armorClass` and
   `baseAC` expectations. Do not lower AC just to match a simplified equipment
   assumption.
4. Repair combat conversion if needed so `createPlayerCombatCharacter` carries
   `armorClass` and `baseAC` into the `CombatCharacter`.
5. Repair ranged weapon conversion if needed so ranged weapons can expose a
   useful combat range, using the existing `range:N` property convention from
   the older premade-equipment plan.
6. Audit caster spellbooks for the level-1 premades. The goal is legality and
   simulator usefulness, not maximizing spell count:
   - cantrips should stay available without spell slots
   - known spell lists should remain class-appropriate
   - prepared spells should be count-limited and not silently become "all known"
   - if a wider spellbook model issue is found, report it instead of broadening
     this slice into character creator or spellbook UI work
7. Add or update a focused verification path proving the premades are combat
   loadable with working main-hand attacks, AC/baseAC, and legal caster
   spellbook counts.

## Expected Files

Expected write scope:

- `public/premade-characters/kael_ironvow.json`
- `public/premade-characters/brynna_ashward.json`
- `public/premade-characters/oren_pathmark.json`
- `public/premade-characters/tavian_oathsteel.json`
- `public/premade-characters/sera_dawnmantle.json`
- `public/premade-characters/merrit_greenbough.json`
- `public/premade-characters/lyris_songweaver.json`
- `public/premade-characters/nyx_velorin.json`
- `public/premade-characters/thalren_deeproot.json`
- `public/premade-characters/pip_coppercoil.json`
- `public/premade-characters/ivel_sparkvein.json`
- `public/premade-characters/cassian_blackreed.json`
- `public/premade-characters/maelis_quill.json`
- `src/utils/combat/combatUtils.ts`
- the split `src/utils/combat/__tests__/combatUtils_*.test.ts` files or the
  nearest existing combat utility test file
- optional narrow premade legality audit/test under the existing test or script
  structure

## Verification Commands

Jules should run the narrowest relevant checks first, then the spell gates:

```powershell
npm run validate:spells
npm run generate:spell-gates
npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose
```

The aggregate `combatUtils.test.ts` path is retained as a historical draft
mistake; the working tracked-clone path is the split `combatUtils_*.test.ts`
glob. Jules should use the split glob unless it creates a more specific premade
legality test in this slice. Do not claim visual spellbook or character creator
verification from this package; those belong to Package 3.

## Acceptance Criteria

- All 13 premades have non-empty, class-appropriate `equippedItems`.
- Player-to-combat conversion preserves AC/baseAC for premades.
- At least one ranged premade has a meaningful ranged attack range in combat.
- Every equipped weapon remains compatible with current proficiency helpers.
- Caster premades remain level-1 legal enough for simulator testing, with
  prepared spell counts distinguished from broader known spell access.
- Verification output is attached to the Symphony decision/evidence trail.
- Any discovered broader spellbook or character assembly issue is recorded as a
  follow-up for Package 3 instead of silently folded into this package.

## Foreman Review Checklist

After Jules returns a PR or patch, Codex should:

1. inspect changed files for scope discipline
2. run the Package 2 verification commands locally
3. refresh spell gates if data changed
4. fill `docs/tasks/spells/PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md` with the
   gate, Atlas, and combat verification result
5. fill `docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` with scope
   review, failure classification, and the selected review outcome
6. fill `docs/tasks/spells/PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md` with
   task-scoped messages, clarifications, and operator/Jules communication facts
7. fill `docs/tasks/spells/PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md` once
   Package 2 has real PR, merge, deployment, and local-sync evidence
8. record the decision boundary and result in
   `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
9. record task-scoped ROI facts before claiming Symphony/Jules savings
10. decide whether Package 3 can begin or whether Package 2 needs repair
