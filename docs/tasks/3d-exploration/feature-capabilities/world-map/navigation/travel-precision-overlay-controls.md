# Travel Precision Overlay Controls

## Decision
Provide navigation overlays for precision travel control and route clarity.

## Layman Description
Movement helpers can be shown when precision matters so travel is easier to control. The exact default behavior stays pending until playtests use real cell visuals.

## Implementation Notes (2026-05-22)
`MapPane.tsx` Travel mode now exposes a **Precision** toggle (default on) that draws transform-aware cell targeting overlays: player cell outline (sky) and hovered destination cell (amber). Overlay math lives in `src/utils/spatial/worldMapOverlayMath.ts`. Playtest feedback may still adjust default-on vs default-off behavior.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/3d-exploration/feature-capabilities/world-map/navigation/travel-precision-overlay-controls.md","sha256WithoutMarker":"a21ca3d70560b1f39984ecc2afdc582c1dcea812d32152b74263b9ec656c1763","markedAtUtc":"2026-06-25T22:29:38.603Z"} -->
