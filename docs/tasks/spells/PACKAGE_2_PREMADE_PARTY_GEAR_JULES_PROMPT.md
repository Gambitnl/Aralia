# Package 2 Jules Prompt: Premade Party And Gear

Status: prompt-ready, not dispatched.

Historical closeout note: Package 2 has since been dispatched to Jules and
merged through PR #935. This prompt is retained as evidence of what Jules was
asked to do; the current active package state lives in
`docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`.

Do not paste this into Jules until
`docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md` has a
real `passed` or approved `waived` result and the matching decision-report entry
says Package 2 may dispatch.

Current dispatch gate: the environment receipt now has a Package 2 scoped
`passed` result, and the matching local Symphony task draft has been recorded as
`draft-1779344522441-vdy0hi`. Do not send this prompt until the current
`blocked_by_git_sync` state is resolved or explicitly classified.

The matching Symphony task-draft payload is prepared at
`docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json`; the submission
receipt is `docs/tasks/spells/PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT.md`.

## Prompt To Send

```text
You are Jules working on Aralia Spell Phase 1, Package 2: premade party and gear.

Goal:
Make the default level-1 premade party a usable combat simulator baseline for
testing cantrips and level 1 spells. Equip all 13 premade characters with
class-appropriate working gear, verify caster spellbook/preparation legality,
and repair only the narrow combat conversion issues needed for AC/baseAC and
ranged weapon range.

Branch:
Use `jules/spells-package2-premade-party-gear`.

Primary context:
- docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md
- docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md
- docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md
- docs/superpowers/plans/2026-05-12-equip-premade-characters.md
- public/premade-characters/manifest.json
- public/premade-characters/*.json
- src/utils/combat/combatUtils.ts
- src/utils/character/weaponUtils.ts
- src/types/items.ts

Allowed write scope:
- public/premade-characters/*.json
- src/utils/combat/combatUtils.ts
- nearest existing combat utility tests under src/utils/combat/__tests__/
- optional narrow premade legality audit/test if no existing test covers the
  loadout checks cleanly

Do not edit in this slice:
- broad spell schema/runtime architecture
- character creator UI
- character sheet spellbook UI
- AI arbitration policy
- Symphony orchestration files
- unrelated spell data or generated Atlas/gate scripts, except by running the
  verification commands below

Required work:
1. Equip all 13 level-1 premade characters with class-appropriate working gear.
   Preserve identity, class, level, stats, spellbook intent, and descriptive
   scaffolding.
2. Ensure weapon items match the shape expected by `weaponUtils.ts`, especially
   `type: "weapon"`, `damageDice`, `damageType`, `properties`, and martial flags.
3. Ensure armor and shields reflect existing `armorClass` and `baseAC`
   expectations. Do not lower AC to fit a simplified loadout.
4. If needed, repair `createPlayerCombatCharacter` so `armorClass` and `baseAC`
   reach the `CombatCharacter`.
5. If needed, repair ranged weapon conversion so weapons can expose useful range
   via the existing `range:N` property convention.
6. Audit level-1 caster spellbooks. Cantrips should be available without spell
   slots; known spells should remain class-appropriate; prepared spells should
   remain count-limited and not silently become "all known". If this exposes a
   wider spellbook model issue, report it as a Package 3 follow-up instead of
   broadening this slice.
7. Add or update focused verification proving premades are combat-loadable with
   working main-hand attacks, AC/baseAC, and legal caster spellbook counts.

Verification to run:
- npm run validate:spells
- npm run generate:spell-gates
- npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose

The tracked repo uses split `combatUtils_*.test.ts` files rather than a single
`combatUtils.test.ts` file. If you add a more specific premade legality test,
run it too and report the path. Do not claim visual spellbook or character
creator verification from this package; those belong to Package 3.

Completion report:
- List changed files.
- Summarize each premade's equipped main hand, off hand, armor, AC/baseAC, and
  caster spellbook/prepared-spell status where applicable.
- Include exact verification commands and results.
- Call out any Package 3 follow-up instead of folding broader UI/spellbook work
  into this package.
```

## Foreman Dispatch Checklist

Before sending:

1. Confirm the Jules Environment snapshot receipt says Package 2 may dispatch.
2. Confirm the decision report has the matching dispatch decision.
3. Submit the Symphony draft payload and record the returned draft id.
4. Confirm the working branch remains
   `jules/spells-package2-premade-party-gear`.
5. Send exactly one Package 2 implementation slice; do not start Package 3 in
   parallel.

After Jules returns:

1. Inspect scope and changed files.
2. Run the Package 2 verification commands locally.
3. Refresh spell gates if data changed.
4. Record PR/review/deployment/local-sync evidence in the Symphony trail.
5. Record task-scoped ROI facts before claiming any Jules savings.
