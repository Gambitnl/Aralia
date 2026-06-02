# Encounter Generator North Star

Status: active
Last updated: 2026-05-31

## Purpose and scope

The Encounter Generator project tracks how player encounters are created, balanced, and moved into combat.  
This doc captures source reality so future work can continue without guessing intent.

## Implementation map

| File | Why it matters |
|---|---|
| src/components/Combat/EncounterModal.tsx | Main encounter creation flow (AI, custom, bestiary) |
| src/components/Combat/MonsterPicker.tsx | Manual monster selection and lair setup |
| src/hooks/actions/handleEncounter.ts | Action entry points and modal dispatch |
| src/state/reducers/encounterReducer.ts | Builds battle-ready encounter payload |
| src/state/appState.ts | Maps encounter actions into app/combat state transitions |
| src/utils/encounterDifficulty.ts | Shared XP threshold and difficulty math |
| src/utils/encounterUtils.ts | AI encounter validation/fallback helpers |
| src/utils/world/bestiaryEncounterGenerator.ts | Offline bestiary encounter generation |
| src/services/gemini/encounters.ts | AI encounter generation service path |
| src/services/geminiServiceFallback.ts | Fallback encounter generation path |
| src/components/EncounterGenerator/PartyManager.tsx | Existing auxiliary UI for party settings |

## Implemented state

- Encounter creation is already wired into gameplay via action handlers, reducers, and the combat modal stack.
- AI, custom, and bestiary encounter paths are implemented and operational.
- Difficulty is computed through shared utilities and displayed in the modal before battle launch.
- Seedable generation is not implemented; results rely on default RNG and AI outputs.
- There is no dedicated encounter pipeline inside `EncounterGenerator/`; most logic is in Combat/services/utils/state.

## Integrations

- `EncounterModal` is opened from game actions, managed in `GameModals.tsx`, and closes through encounter actions.
- Modal outputs pass through `START_BATTLE_MAP_ENCOUNTER` reducer logic into active combat.
- Monster selection and bestiary use shared generated monster data from the data layer.
- AI flows depend on Gemini service + fallback utilities for safety.

## Gaps and uncertainties

- Seedability and deterministic replay are not in place across bestiary, fallback, or AI paths.
- Difficulty behavior is partially duplicated across AI/custom/bestiary paths and can diverge in edge cases.
- Current evidence suggests future intent may be wider than currently documented, since registry points are narrower than runtime spread.

## Next checks

- Confirm desired seed model (single seed, per-source seeds, and seed UI).
- Decide and lock one difficulty contract for all generation paths.
- Add docs proof after any change to generation or combat handoff.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
