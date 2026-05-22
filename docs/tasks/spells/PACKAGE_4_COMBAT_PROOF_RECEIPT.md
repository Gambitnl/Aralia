# Package 4 Combat Proof Receipt

Status: proof target prepared; pending Jules implementation.

This receipt records the runtime and rendered/test-backed proof that Package 4
made representative early-game deterministic spells functionally testable in the
combat simulator.

## Required Proof

- Damage cantrip proof:
  - spell: `pending`
  - caster: `pending`
  - target: `pending`
  - action cost result: `pending`
  - spell slot result: `pending`
  - HP result: `pending`
  - combat log result: `pending`
- Level-1 damage proof:
  - spell: `pending`
  - caster: `pending`
  - target: `pending`
  - action cost result: `pending`
  - spell slot result: `pending`
  - HP result: `pending`
  - combat log result: `pending`
- Healing proof:
  - spell: `pending`
  - caster: `pending`
  - ally target: `pending`
  - action cost result: `pending`
  - spell slot result: `pending`
  - HP result: `pending`
  - combat log result: `pending`
- Buff/status proof:
  - spell: `pending`
  - caster: `pending`
  - target: `pending`
  - status/buff result: `pending`
  - follow-up gap if not representable: `pending`
- Proof type:
  - screenshot paths: `pending`
  - component/hook/command test names: `pending`
  - manual rendered inspection notes: `pending`

## Current Notes

Package 4 has not been dispatched yet. This file exists so Jules and Codex have
a durable place to attach combat simulator proof instead of treating terminal
output or screenshots as transient context.

## Rules

- Do not claim combat simulator completion from command-factory tests alone if
  the player-facing simulator path remains unverified.
- Do not claim all cantrips and level 1-3 deterministic spells work from this
  pilot. Record the pilot coverage and the next mechanics buckets honestly.
- If the simulator cannot render or target because of an unrelated blocker,
  record whether that belongs inside Package 4 or should become a follow-up.
