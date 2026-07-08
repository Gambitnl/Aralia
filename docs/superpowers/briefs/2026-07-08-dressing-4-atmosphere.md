# Build brief 4 — Atmosphere and day-night mood

## Goal
Sell the town through light and mood, not model detail. A plain town at golden hour beats a detailed one at flat noon. This is the cheapest way to make the whole scene feel alive.

## What to build
A self-contained browser prototype. Stack: three.js (r170 or newer), WebGPU renderer. One small Vite project or single HTML file. No external art assets. Orbit camera. A control panel with an hour slider.

Put ~12 simple low-poly buildings (mixed heights, a few with chimneys) on flat ground. Then build a driveable day-night cycle:
1. **Moving sun** — the sun angle follows an hour value (0–23). Warm, low, golden color near dawn and dusk; bright and high at noon; cool and dim at night. Long, soft shadows at low sun.
2. **Window glow** — windows turn emissive and glow warmly as the sun drops, fading out after dawn.
3. **Chimney smoke** — a cheap scrolling or particle plume rising from chimneys.
4. **Sky and haze** — sky color and a horizon haze tinted to the time of day.
5. **Optional ground fog** — a light, low fog at dawn and dusk.

## Expose these controls
An hour slider (0–23), sun intensity and color-warmth, haze/fog strength, and window-glow strength.

## Aesthetic target
Dramatic light and constant motion. Ghost of Tsushima is the reference for how mood carries a scene: strong directional light, atmospheric haze, everything moving a little.

## References
- Ghost of Tsushima, "Real-Time Samurai Cinema" (SIGGRAPH 2021): https://advances.realtimerendering.com/s2021/jpatry_advances2021/index.html
- How visual effects bring Ghost of Tsushima to life: https://blog.playstation.com/2021/01/12/how-stunning-visual-effects-bring-ghost-of-tsushima-to-life/
- Ghost of Tsushima SIGGRAPH talks roundup: https://www.glowybits.com/blog/2022/12/18/ghost_talks/

## Done when
Dragging the hour slider takes the town convincingly through dawn, noon, golden hour, and night. Windows light up at dusk. Smoke rises from chimneys. The light and haze shift with the hour. The mood does the heavy lifting — the buildings stay simple.

## Note for integration (context only)
Our engine already tracks an in-game hour and already marks which windows are lit and where each hearth sits. Keep your cycle driven by a single hour input and a list of window/chimney positions so it maps onto that data.
