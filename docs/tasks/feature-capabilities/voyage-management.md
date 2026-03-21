# Voyage Management

This capability note tracks the current naval and voyage-management foundations. The repo already contains a naval state model, voyage-related action types, a naval reducer, and travel-event generation, but the broader player-facing naval loop still looks less mature than the underlying scaffolding.

## Current Status

Voyage management is partially implemented. Core state and reducer paths exist, but this pass did not verify a complete player-facing end-to-end naval loop.

## Verified Repo Surfaces

- src/types/naval.ts
- src/state/actionTypes.ts
- src/state/appState.ts
- src/state/reducers/navalReducer.ts
- src/services/travelEventService.ts
- src/systems/naval/VoyageManager.ts

## Verified Capabilities

### Voyage State Model

- naval.ts defines VoyageState, VoyageEvent, VoyageLogEntry, and NavalState, including currentVoyage in the top-level naval state.
- appState.ts initializes naval state with playerShips, activeShipId, currentVoyage, and knownPorts.

### Voyage Action Wiring

- actionTypes.ts defines NAVAL_INITIALIZE_FLEET, NAVAL_START_VOYAGE, NAVAL_ADVANCE_VOYAGE, NAVAL_RECRUIT_CREW, NAVAL_SET_ACTIVE_SHIP, and TOGGLE_NAVAL_DASHBOARD.
- navalReducer.ts handles fleet initialization, voyage start, voyage advancement, crew recruitment, and active-ship switching.

### Voyage State Progression

- navalReducer.ts advances the active voyage through VoyageManager.advanceDay and updates ship state and voyage logs.
- Arrival handling already flips a completed voyage back to Docked and appends an arrival log entry.

### Voyage Event Generation

- travelEventService.ts generates biome-aware travel events and landmark discoveries.
- The service already supports weighted event pools and discovery overrides, even though it is broader than naval travel alone.

## Remaining Gaps Or Uncertainty

- This doc no longer treats voyage management as fully absent, because the state model and reducer path already exist.
- The remaining uncertainty is about complete player-facing orchestration and UI maturity, not about whether voyage foundations exist in code.
