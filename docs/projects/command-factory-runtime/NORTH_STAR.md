# NORTH_STAR: Command Factory Runtime

Status: active  
Last updated: 2026-05-31

## Purpose

Own and document the command creation surface under `src/commands/factory`.
The runtime translates spell and ability payloads into executable command objects, then hands those commands to shared command execution.

## Why this project exists

This is the boundary between:
- spell/ability data (`types/spells.ts`, combat abilities),
- command registration (`src/commands/index.ts` + `useAbilitySystem.ts`), and
- command execution (`src/commands/base` + `src/commands/effects`).

It is the primary "creation lane" for runtime combat mechanics.

## Current implemented state

- Core factories:
  - `src/commands/factory/SpellCommandFactory.ts`
  - `src/commands/factory/AbilityCommandFactory.ts`
  - `src/commands/factory/AbilityEffectMapper.ts`
- Command export wiring:
  - `src/commands/index.ts` exports factories and base command types.
- Active integration path:
  - Spell path: `hooks/useAbilitySystem.ts` -> `SpellCommandFactory.createCommands(...)` -> `CommandExecutor.execute(...)`
  - Ability path: `hooks/useAbilitySystem.ts` -> `AbilityCommandFactory.createCommands(...)` -> `CommandExecutor.execute(...)`
- Data validation relation:
  - `systems/spells/validation/SpellIntegrityValidator.ts` and `LegacySpellValidator.ts` run before/alongside command creation at data quality level.
  - `TargetValidationUtils` is now the shared filter implementation; `SpellCommandFactory.matchesFilter(...)` is still present as a deprecated wrapper.
- Existing tests that assert factory behavior:
  - `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`
  - `src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts`
  - `src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts`
  - `src/commands/factory/__tests__/SpellCommandFactoryGrantedAction.test.ts`
  - `src/commands/factory/__tests__/ConditionalEnding.test.ts`
  - `src/commands/__tests__/SpellCommandFactory.test.ts`
  - `src/commands/factory/__tests__/AbilityCommandFactory.test.ts`
  - `src/commands/factory/__tests__/AbilityEffectMapper.test.ts`

## File map (narrow)

- `src/commands/factory/SpellCommandFactory.ts`: orchestration of effect-level command creation, scaling, mode-choice filtering, planar + AI branches.
- `src/commands/factory/AbilityCommandFactory.ts`: ability path split (attack -> `WeaponAttackCommand`, non-attack -> mapped spell-effect commands).
- `src/commands/factory/AbilityEffectMapper.ts`: lightweight mapping from battle-map ability effect payloads to shared spell-effect shapes.
- `src/commands/factory/__tests__/*`: behavior lock for factory outputs and command creation.

## Scope boundaries

In scope:
- Documenting this runtime boundary and its operational contracts.
- Tracking implemented command creation behavior and integration edges.
- Keeping durable implementation context for handoff.

Out of scope:
- Changing source code in `src/commands/factory`, `src/commands/base`, or `src/commands/effects`.
- Expanding spell/ability systems outside this factory/runtime boundary.

## Relationship to neighboring command runtimes

- `command-base-runtime`: provides contract + execution semantics for all command objects.
- `command-effects-runtime`: provides concrete command classes (`DamageCommand`, `HealingCommand`, etc.) selected by this runtime.
- This runtime should be read as "creation and translation" rather than command execution.

## What must not be lost

- `SpellCommandFactory.createCommands(...)` is the main spell entry conversion surface.
- `AbilityCommandFactory.createCommands(...)` is the ability-to-command bridge.
- Static factories are wired directly by `useAbilitySystem.ts`, not through a late-binding registry.
- `requestedReaction` and AI adjudication are currently in the spell branch for arbitration-style spells.

## Active task

| Field | Value |
|---|---|
| Task | Keep command-factory runtime docs as a cold-start-safe contract handoff for factory, validation, and integration boundaries |
| Acceptance criteria | Documentation includes file map, integrations, implemented state, gap log, and clear resume path |
| Allowed files | `docs/projects/command-factory-runtime/*` |
| Next check | Re-validate references against `src/commands/factory`, `src/commands/base`, and `src/commands/index.ts` after any factory refactor |
| Owner | Worker C |
| Stop condition | docs remain source-anchored and update next check evidence list when factory wiring changes |

## Known uncertainties and gap watch

- Which creation paths should be registered as first-class explicit factory registry entries versus direct-call surfaces.
- Whether `SpellCommandFactory.matchesFilter` should be removed once all call-sites use `TargetValidationUtils.matchesFilter`.
- Whether command scaling helpers should move to a shared utility with `resolveScalableNumber`.

## Resume path for cold agent

1. Read this file.
2. Read `docs/projects/command-factory-runtime/TRACKER.md`.
3. Read `docs/projects/command-factory-runtime/GAPS.md`.
4. Confirm factory files plus integration call-sites in `src/commands/factory` and `src/hooks/useAbilitySystem.ts`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
