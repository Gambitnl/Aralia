# Rituals System North Star

Status: active  
Last updated: 2026-05-31  
Owner: Rituals Worker  
Evidence seed: `docs/projects/PROJECT_TRACKER.md` row 54

## Purpose and Scope

This project documents one bounded ritual lane:
- long-duration casting state in `src/state/reducers/ritualReducer.ts`
- ritual timing and rule helpers in `src/systems/rituals/RitualManager.ts`
- spell-time bridge in `src/utils/core/spellTimeUtils.ts`
- ritual schema and contracts in `src/types/rituals.ts`

The scope is intentionally read-only and discovery-first: preserve what currently works,
what is stubbed, and what is still unlinked to execution so next workers can continue
without losing intent.

## Concrete File Map

| File | Role |
|---|---|
| `src/systems/rituals/RitualManager.ts` | Start/advance/interrupt logic for active rituals, including validation helpers and placeholder backlash path. |
| `src/systems/rituals/__tests__/RitualManager.test.ts` | Core timing, conversion, and interrupt expectations. |
| `src/systems/rituals/__tests__/RitualConstraints.test.ts` | Requirement checker coverage for time, location, biome, participant count, and multi-condition logic. |
| `src/state/reducers/ritualReducer.ts` | Active ritual state transitions: start, advance, interrupt, complete. |
| `src/state/reducers/__tests__/ritualReducer.test.ts` | Reducer-driven progress/completion checks across seconds, minutes, and rounds inputs. |
| `src/types/rituals.ts` | Canonical ritual types and interfaces used by system + reducer. |
| `src/types/ritual.ts` | Orphaned duplicate of ritual interfaces (not imported by active systems). |
| `src/state/actionTypes.ts` | Ritual action signatures, with an unfinished `RitualEvent` typing placeholder. |
| `src/state/reducers/worldReducer.ts` | Invokes `ritualReducer` during `ADVANCE_TIME` pipeline. |
| `src/utils/core/spellTimeUtils.ts` | Canonical cast-time translation and ritual time bonus constants. |
| `src/utils/world/sceneUtils.ts` | Uses `activeRitual` as a focus gate. |
| `src/components/BattleMap/BattleMap.tsx` | Contains UI TODO for ritual progress rendering. |
| `src/hooks/combat/useActionExecutor.ts` | Contains TODO for routing ritual-tagged/long-cast abilities into ritual flow. |

## Implemented State (What Exists Today)

- Ritual timing is canonicalized in seconds:
  - `src/systems/rituals/RitualManager.ts` and `src/utils/core/spellTimeUtils.ts` set base cast seconds.
  - `RITUAL_CASTING_BONUS_SECONDS = 10 * 60`.
  - `startRitual(..., true)` applies that bonus for ritual mode.
- Special/unknown cast times currently fall back to one combat round to avoid zero-duration lock.
- Reducer handles these action shapes in `src/state/reducers/ritualReducer.ts`:
  - `START_RITUAL` with `RitualState`
  - `ADVANCE_TIME` with seconds
  - `ADVANCE_RITUAL` with seconds or minutes or rounds
  - `INTERRUPT_RITUAL` with an `event` payload
  - `COMPLETE_RITUAL`
- World-time integration is active:
  - `App.tsx` dispatches `ADVANCE_TIME` for passive clock, travel waits, and combat round callbacks.
  - `worldReducer` runs `ritualReducer` inside the `ADVANCE_TIME` pipeline before other daily/world effects.
- Focus integration exists:
  - `isPlayerFocused` treats active ritual as a focus-intensive state in `src/utils/world/sceneUtils.ts`.
- Test evidence confirms core progress math and completion behavior:
  - base cast: 1 minute for a 1-minute spell
  - ritual cast: +10 minutes
  - completion transition and message emission
  - movement-only interruption logic when `breaksOnMove` is enabled

## Integration Surface

- State/action dispatch: `src/state/actionTypes.ts`, `src/state/reducers/ritualReducer.ts`.
- Time: `src/utils/core/spellTimeUtils.ts`, `App.tsx`, `src/state/reducers/worldReducer.ts`.
- Combat and spell execution: `src/hooks/combat/useActionExecutor.ts` (TODO notes only).
- UI presence layer: `src/components/BattleMap/BattleMap.tsx` (TODO for active ritual progress display).
- Combat/event context: `src/types/combat.ts` includes optional `currentRitual` on `CombatCharacter`.

## Gaps and Uncertainties (Current, Concrete)

- `src/systems/rituals/RitualManager.ts` uses a casted access to `spell.ritualRequirements` and does not yet consume a stable, typed requirement schema from `Spell`.
- `checkRitualInterrupt` does not apply all declared condition types (for example `silence` is in config but not explicitly handled).
- `getBacklashOnFailure` is a placeholder and currently returns no effects.
- `src/state/actionTypes.ts` still keeps `RitualEvent` as `unknown` while reducer logic expects a shaped event.
- `src/state/reducers/ritualReducer.ts` marks interrupted rituals as paused and only produces generic interruption messaging.
- `src/types/ritual.ts` is still present but orphaned while active exports use `src/types/rituals.ts`.
- No runtime ritual UI is wired beyond data presence; no completed progress bar, failure effect text, or player controls for ritual management are active.
- No evidence in codebase for ritual cost multipliers, influence-based costs, or ritual economics math.

## Next Checks

1. Confirm no direct ritual start path exists outside tests by re-running a full `src` search for `startRitual(` and map real callers.
2. Validate whether ritual requirements from `types/spells` are meant to feed `RitualManager.canStartRitual` without type casting.
3. Verify whether `silence`, `incapacitated`, and event-shaped interruption checks can be made symmetric in reducer and manager.
4. Resolve whether `src/types/ritual.ts` is legacy cleanup or should be merged into `src/types/rituals.ts`.
5. Add minimal ritual execution route from combat ability use path (`useActionExecutor`) when TODO intent is implemented.
