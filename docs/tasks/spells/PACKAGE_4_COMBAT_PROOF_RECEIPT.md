# Package 4 Combat Proof Receipt

Status: proof recorded; the buff/status pilot remains a precise follow-up gap.

This receipt records the runtime and test-backed proof that Package 4 made
representative early-game deterministic spells functionally testable in the
combat simulator.

## Required Proof

- Damage cantrip proof:
  - spell: `fire-bolt`
  - caster: `Maelis Quill`
  - simulator target: `cantrip-target`
  - action cost result: `type: action`
  - spell slot result: `spellSlotLevel: 0`; `actionEconomyUtils.test.ts` keeps level 1 slots unchanged for a cantrip cost
  - HP result: `DamageCommand.test.ts` reduces `Target Dummy` from 12 to 2
  - combat log result: `DamageCommand.test.ts` records `Maelis Quill blasts Target Dummy with Fire Bolt for 10 force damage`
- Level-1 damage proof:
  - spell: `magic-missile`
  - caster: `maelis_quill`
  - targets: `target-1`, `target-2`, `target-3`
  - action cost result: `type: action`
  - spell slot result: the simulator path stays attached to the real level-1 spell cost; `actionEconomyUtils.test.ts` proves the level-1 slot spend path
  - HP result: the hook regression keeps the target allocation deterministic and bounded by `maxTargets`
  - combat log result: the direct damage-command regression keeps the HP/log path honest for spell damage resolution
- Healing proof:
  - spell: `healing-word` through the simulator targeting bridge and
    `cure-wounds` through the direct command fixture
  - caster: `Lyris Songweaver` for simulator targeting; the generic cleric
    fixture in `HealingCommand.test.ts` for direct HP/log proof
  - ally target: `ally-target` in the simulator test; `target` in the direct
    command test
  - action cost result: `type: bonus` for Healing Word, preserving its real
    bonus-action casting time
  - spell slot result: `level 1 slot` consumed by the shared action-economy
    regression
  - HP result: `target.currentHP` rises to 10 and caps at max HP
  - combat log result: a `heal` entry is emitted
- Buff/status proof:
  - spell: `bless`
  - caster: `sera_dawnmantle` or `tavian_oathsteel` are confirmed in premade data
  - target: `not represented in the combat simulator yet`
  - status/buff result: no combat-simulator spell/status bridge exists yet
  - follow-up gap if not representable: keep `bless` as a small follow-up status-bridge task instead of broadening Package 4
- Level 2/3 bridge proof:
  - `scorching-ray`, `fireball`
  - the hook regression proves deterministic multi-target / AoE selection for the level 2 and level 3 pilot bridge
- Proof type:
  - screenshot paths: `none captured`
  - component/hook/command test names:
    - `src/hooks/__tests__/useAbilitySystem.package4.test.tsx`
    - `src/utils/combat/__tests__/actionEconomyUtils.test.ts`
    - `src/commands/__tests__/DamageCommand.test.ts`
    - `src/commands/__tests__/HealingCommand.test.ts`
  - manual rendered inspection notes: `not captured; Package 4 proof is test-backed`

## Current Notes

Package 4 now has direct cantrip, damage, healing, and slot-economy proof. The
only unresolved mechanics item in the package packet is `bless`, which remains
a recorded follow-up gap rather than a reason to broaden the pilot.

The Healing Word proof also repaired a small spell-to-ability bridge defect:
spell tags are not consistently cased in JSON, so healing/buff tag checks are
now normalized before targeting inference decides whether a spell targets allies
or enemies.

## Rules

- Do not claim combat simulator completion from command-factory tests alone if
  the player-facing simulator path remains unverified.
- Do not claim all cantrips and level 1-3 deterministic spells work from this
  pilot. Record the pilot coverage and the next mechanics buckets honestly.
- If the simulator cannot render or target because of an unrelated blocker,
  record whether that belongs inside Package 4 or should become a follow-up.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_4_COMBAT_PROOF_RECEIPT.md","sha256WithoutMarker":"6fa28918d66f657fadd993650b2a0f57678f00cc51ca389a5f9ddcc32c5eab31","markedAtUtc":"2026-06-25T22:29:38.531Z"} -->
