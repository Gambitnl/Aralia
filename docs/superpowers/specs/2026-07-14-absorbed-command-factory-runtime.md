# Absorbed: Command Factory Runtime (docs/projects/command-factory-runtime)

Absorbed into planmap topic `command-factory-runtime` on 2026-07-16 (wave 10R).
Folder deleted; git history is the archive.

## What this runtime is

The command creation surface under `src/commands/factory`. It translates spell
and ability payloads into executable command objects and hands them to shared
command execution. Read it as "creation and translation", never execution.

Boundary between:
- spell/ability data (`types/spells.ts`, combat abilities),
- command registration (`src/commands/index.ts` + `hooks/useAbilitySystem.ts`),
- command execution (`src/commands/base` + `src/commands/effects`).

## Live contracts (must not be lost)

- `SpellCommandFactory.createCommands(...)` is the main spell entry conversion
  surface; `AbilityCommandFactory.createCommands(...)` is the ability bridge.
- Both are wired directly by `useAbilitySystem.ts` and discoverable through
  `commandFactoryRegistry` in `src/commands/index.ts` (added 2026-06-18; keep
  the registry aligned with all creation producers and call sites).
- Integration paths:
  - Spell: `useAbilitySystem.ts` -> `SpellCommandFactory.createCommands` -> `CommandExecutor.execute`
  - Ability: `useAbilitySystem.ts` -> `AbilityCommandFactory.createCommands` -> `CommandExecutor.execute`
- `TargetValidationUtils.matchesFilter(...)` is the shared filter
  implementation; `SpellCommandFactory.matchesFilter(...)` survives only as a
  deprecated legacy wrapper with no internal callers (redirected 2026-06-14).
- `requestedReaction` and AI adjudication live in the spell branch for
  arbitration-style spells.
- Ability attack path -> `WeaponAttackCommand`; non-attack -> mapped
  spell-effect commands via `AbilityEffectMapper`.

## File map

- `src/commands/factory/SpellCommandFactory.ts` — effect-level command
  creation, scaling, mode-choice filtering, planar + AI branches.
- `src/commands/factory/AbilityCommandFactory.ts` — ability path split
  (attack -> WeaponAttackCommand, non-attack -> mapped effects). Also
  currently co-locates the WeaponAttackCommand implementation (open gap G6).
- `src/commands/factory/AbilityEffectMapper.ts` — battle-map ability effect
  payloads -> shared spell-effect shapes. Familiar pocket/senses are currently
  intercepted in AbilityCommandFactory instead, bypassing the mapper (open gap G5).
- `src/commands/factory/__tests__/*` — behavior lock (9 files / 34 tests green
  2026-06-18; +7 arbitration/mode-choice edge tests via W3-P6).

## Open follow-ups (now planmap features on the topic)

- G3: factory scaling helpers duplicate older number resolution logic
  (`resolveScalableNumber`); standardize if scale format changes again.
- G5: unify ability-effect mapping under AbilityEffectMapper.
- G6: move WeaponAttackCommand into its own file under `src/commands/effects/`.

## Neighbor runtimes

- `command-base-runtime` (planmap topic, done): contract + execution semantics.
- `command-effects-runtime` (planmap topic, active): concrete command classes.
