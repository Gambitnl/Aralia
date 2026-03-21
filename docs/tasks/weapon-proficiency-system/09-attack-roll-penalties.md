# Task 09: Apply Non-Proficiency Penalties to Attack Rolls

Status: active gap note
Last reviewed: 2026-03-12

## Current reading

This remains an active gap note.

## Verified current state

Manual repo verification on 2026-03-12 confirmed that src/utils/combat/combatUtils.ts already tags generated weapon abilities with isProficient, but this pass did not prove that the final attack-bonus pipeline strips proficiency bonus before calling resolveAttack().

## Concrete remaining question

Wherever the final attack modifier is assembled, it should explicitly zero out proficiency bonus for non-proficient weapon attacks. Until that path is proven, this capability should remain open as Attack Roll Proficiency Penalty.

## Scope

This file should no longer be read as combat integration has not started at all. It is specifically about the unresolved final attack-roll modifier enforcement and any combat-log explanation that should accompany it.