// TODO(Ecologist): Integrate WeatherSystem into GameState.
// 1. Add `weather: WeatherState` to `GameState` interface in `src/types/index.ts`.
// 2. Initialize it in `src/state/initialState.ts` using `WeatherSystem.generateWeatherForBiome`.
// 3. Update weather on biome change (in `useGameActions` or `handleMovement`).
// 4. Pass weather to `useTurnManager` to affect combat mechanics.
