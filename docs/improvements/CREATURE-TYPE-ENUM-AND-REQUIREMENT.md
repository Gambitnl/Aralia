# Future Feature: Canonical Creature Types & Required Typing

## Goal
Enforce a single canonical list of 5e creature types across monsters/NPCs/summons and require a `creatureType` when generating enemies. Avoid homebrew types unless a spell explicitly calls for one.

## Canonical Types (no extras unless a spell demands it)
- Aberration, Beast, Celestial, Construct, Dragon, Elemental, Fey, Fiend, Giant, Humanoid, Monstrosity, Ooze, Plant, Undead (optionally Swarm if already present).

## Requirements
- Add a shared enum/source of truth (e.g., `src/data/creatureTypes.ts` exporting a zod enum).
- Update monster/NPC/summon schemas to require `creatureType` and validate against the enum.
- Update spell filters that reference creature types (e.g., Detect Evil and Good, Protection from Evil and Good) to consume the enum to prevent string drift.
- Enemy generation must require `creatureType`; if not provided, select from the enum (with weights) and log if absent—never invent new types.
- Audit: one-time script to flag any non-canonical creatureType strings in existing data; fix or map them.

## Nice-to-haves
- Prefill creatureType in bestiary entries and display/filter by type in UI.
- Add a lint/check in CI to prevent introducing non-canonical types.

## Risks/Mitigations
- **Legacy data drift**: run the audit and fix; add CI check.
- **Spell coverage**: if a spell introduces a new type, extend the enum deliberately with a comment pointing to that spell.
