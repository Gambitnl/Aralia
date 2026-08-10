# Azgaar toggle parity — capture and status

Date: 2026-08-05. Owner directive: capture all Azgaar map toggles. Implement them in the Worldforge atlas. Worldforge is the one worldmap system.

## The full Azgaar toggle list

Azgaar FMG ships 28 layer toggles in its Layers menu. The table maps each one to its Worldforge status.

| # | Azgaar toggle | Worldforge status | Where |
|---|---|---|---|
| 1 | Texture | **ADDED 2026-08-05** — feature toggle, paper-grain filter | AtlasSvgView `texture` |
| 2 | Heightmap | **ADDED 2026-08-05** — area mode, land elevation ramp | atlasSvg `heightCells` |
| 3 | Biomes | Done — area mode | AtlasSvgView `biomes` |
| 4 | Cells | Done — feature toggle | `cells` |
| 5 | Grid | Done — feature toggle (square reference grid) | `grid` |
| 6 | Coordinates | **ADDED 2026-08-05** — labeled latitude and longitude graticule | AtlasSvgView `coordinates` |
| 7 | Compass rose | **ADDED 2026-08-05** — feature toggle, decorative rose | AtlasSvgView `compass` |
| 8 | Rivers | Done — feature toggle | `rivers` |
| 9 | Relief icons | **ADDED 2026-08-05** — now two panel toggles: relief and forests. The glyphs existed before but had no toggle. | `reliefGlyphs`, `forestGlyphs` |
| 10 | Religions | Done — area mode | `religions` |
| 11 | Cultures | Done — area mode | `cultures` |
| 12 | States | Done — area mode | `states` |
| 13 | Provinces | Done — area mode | `provinces` |
| 14 | Zones | Done — feature toggle | `zones` |
| 15 | Borders | Done — feature toggle | `borders` |
| 16 | Routes | Done — feature toggle | `routes` |
| 17 | Temperature | Done — area mode | `temperature` |
| 18 | Population | Done — area mode | `population` |
| 19 | Ice | Done — feature toggle | `ice` |
| 20 | Precipitation | Done — area mode | `precipitation` |
| 21 | Emblems | **OPEN** — see "Next slice" | — |
| 22 | Labels | Done — feature toggle | `labels` |
| 23 | Burg icons | Done — feature toggle | `burgs` |
| 24 | Military | Done — feature toggle | `military` |
| 25 | Markers | Done — feature toggle | `markers` |
| 26 | Rulers | **OPEN** — see "Next slice" | — |
| 27 | Scale bar | **ADDED 2026-08-05** — feature toggle, zoom-aware km bar | AtlasSvgView `scalebar` |
| 28 | Vignette | Done — feature toggle | `vignette` |

Worldforge also has toggles Azgaar does not: `coast`, `danger`, and the `none` plain-land mode.

## Next slice (in priority order)

1. **Emblems.** The COA data generator is ported (`src/systems/worldforge/fmg/coa-generator.ts`) but no renderer exists. Build an owned SVG renderer for shield, field, division, and ordinaries. Then place state emblems at capitals.
2. **Rulers.** An interactive measure tool: click two points, read the distance. The scale constant exists (`FEET_PER_FMG_PIXEL`, 3 km per FMG pixel).

## One-worldmap cleanup — DONE 2026-08-05

The Worldforge atlas is now the only worldmap generator in the codebase.

- `src/App.tsx` imported `generateMap` without a call site — dead import, removed.
- `src/services/mapService.ts` and `azgaarDerivedMapService.ts` — DELETED, with their tests. No caller remained after the World3DDemo cut below.
- `World3DDemo` — the legacy continent sandbox branch (generateMap → WorldData grid, inline chunk loader) is gone. `?phase=world3d` now always runs the canonical Worldforge ground pipeline. Boot-probed headless: mounts, canvas up, no error boundary.
- `SpawnPreview` — was already atlas-native; its stale header said otherwise. Header fixed.
- KEPT: `services/worldSim` + `worldDataMigration` — old-save migration only (`saveLoadService`). That is a save-compat transform, not a map generator. The DebugHUD keeps the `legacy-fallback` provenance label so old saves stay honest about their origin.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/specs/2026-08-05-azgaar-toggle-parity.md","sha256WithoutMarker":"67b06dd06e4aebc3179e5197586dc0f0d9b956363d9a6995341afd80a1e9a553","markedAtUtc":"2026-08-09T20:24:30.603Z"} -->
