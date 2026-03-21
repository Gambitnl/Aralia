# Task 10: Disable Weapon Mastery for Non-Proficient Weapons

Status: active partial-gap note
Last reviewed: 2026-03-12

## Current reading

This remains an active follow-through note, but the older not-started framing is stale.

## Verified current state

Manual repo verification on 2026-03-12 confirmed that src/utils/combat/combatUtils.ts already gates mastery attachment:

- weapon abilities carry isProficient
- ability.mastery is attached only when the weapon is proficient and selected

That means the core Weapon Mastery Proficiency Gate already exists in combat ability generation.

## Remaining question

Any remaining work is narrower:

- prove that no downstream combat surface bypasses this gate
- add combat-log or UI explanation if the experience currently feels silent

So this file should be treated as a partial-gap note, not as an untouched future phase.