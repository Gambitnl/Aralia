# Travel Precision Overlay Controls

## Decision
Provide navigation overlays for precision travel control and route clarity.

## Layman Description
Movement helpers can be shown when precision matters so travel is easier to control. The exact default behavior stays pending until playtests use real cell visuals.

## Implementation Notes (2026-05-22)
`MapPane.tsx` Travel mode now exposes a **Precision** toggle (default on) that draws transform-aware cell targeting overlays: player cell outline (sky) and hovered destination cell (amber). Overlay math lives in `src/utils/spatial/worldMapOverlayMath.ts`. Playtest feedback may still adjust default-on vs default-off behavior.
