# Design Preview navigation

Verified: 2026-10-14

Water opens a choice menu before mounting a demo. Other preview tabs retain their existing behavior.

## Water entry and exit

The main menu contains every record from `waterModeCatalog.ts` exactly once: currently 33 inventory cards. Skip stones, River mouth, and Side by side remain three combined-demo shortcuts above them. River, Ocean, and the four comparison systems now open from their own inventory cards instead of duplicate shortcuts. The menu mounts no canvas or simulation.

The former Every water in Aralia overlay is retired. Its Show category and Status filters, status counts and badges, descriptions, captures, source paths, notes, viewer URLs, and no-viewer explanations are retained in the inline cards. Show and Status combine; the mechanism table follows the same filtered inventory. Combined-demo shortcuts are outside those inventory filters, with their table rows shown only when the inventory is unfiltered.

Selecting River, Ocean, or Skip stones mounts the existing view. Selecting a comparison system opens its parked setup; its Start button remains the deliberate simulation gate. Side by side opens two parked panes.

The top Water tab, Reopen Preview Window for Water, and the in-view Water menu button return to the menu. Returning clears the scene selection and disarms the comparison panes, allowing the existing scene cleanup to run.

There is no All water modes launcher or separate catalog Close button. The in-view header retains the return-to-menu action and controls for the selected demo. The named/default `WaterModesCatalog` export remains as an inline compatibility adapter for older local-only callers; it no longer creates an overlay.

The 2026-10-10 live River return check exposed a cleanup exception that can blank the preview until reload. This separate lifecycle gap is recorded as GG-389 in `docs/projects/GLOBAL_GAPS.md`; return-to-menu reliability is not fully accepted on WebGPU yet.

## Addresses and compatibility

- A bare `?step=water` address opens the menu.
- `waterView=menu` explicitly selects the menu, overriding retained scene settings.
- Legacy `modes=1` addresses select the idle main menu even if they retain scene parameters. The query is then removed, while a `#water-mode-<id>` hash is preserved and reveals its inventory card.
- Explicit demo links such as `water=sheet`, `river=1`, or `ocean=1` still open their named view. Existing catalog links and capture tooling remain usable.
- The existing `__fluidCam.start()` capture entry point can still deliberately start a comparison scene.

## Implementation and evidence

### Mechanism table

`src/components/DesignPreview/steps/water/WaterMechanismTable.tsx` renders below the full inventory, using the same Show/Status selection. It has 33 inventory rows plus three combined-view rows when unfiltered. Six local viewer records reuse the implementation audit below; other rows use the retained inventory explanations and source paths, not a falsely claimed fresh solver audit. Opening the table starts no simulation.

At the user's request on 2026-10-14, the stale WaterPlane record was removed completely from the inventory. The component itself was already deleted in commit `4448b9d97` on 2026-09-28. Card, table row and retired counts derive from the registry and update together. Removal is recorded in Agora task `agora-22b7`; the other retired records are unchanged.

The 2026-10-14 source audit followed `PreviewWater` render branches, `WaterPane` selections, ocean extras mounting, and actual solver/renderer imports:

| Menu choice | Implementation identified |
|---|---|
| River | `RiverScene` -> `RiverLiveClient` / `riverWorker` -> `LiveRiver` / `RiverFlowSolver`; 2D HLL finite-volume flow, drawn by `RiverReachView` on WebGPU. Browser-live and automated steady-field capture paths differ. Spill/contact and neighboring comparison experiments are optional branches, not the base solver. |
| Open ocean | `SideBySideOcean` -> `createOceanField`; spectral JONSWAP/TMA wave synthesis using GPU inverse FFTs, drawn through `oceanSurface`. |
| Skip stones | Same ocean viewer with `sea=lake&extras=skip`; `oceanSkipWorker` runs rigid-body throws against waves sampled from the ocean spectra. |
| River mouth | Same ocean viewer with `sea=surf&extras=mouth`; `MouthField` / mouth worker and beach swash couple 2D shallow-water flow to the FFT boundary, jet/plume and shared surface/foam. This does not mount `RiverScene`. |
| Side by side | Two `WaterPane` selections, initially sheet and droplets; reuses the four implementations below rather than defining a fifth solver. |
| Inventory cards | `WaterInventoryCards` reads `waterModeCatalog` records and saved captures. It is inline documentation and routing, not a scene. |
| Thin layer | `SheetPane` / `SheetSurface` instantiate `ShallowWaterField`; CPU virtual-pipe depth/flux grid with head-driven discharge, soaking and exterior accounting; WebGL drawing via `waterLook`. |
| Droplets | `FlipScene3D` -> `flipCompute`; WebGPU MLS-MPM particles, displayed through `flipSurfaceRender`. The file name does not identify the numerical method. |
| Legacy cell grid | `FluidScene3D` -> `fluidBrickCompute` / `fluidBricks`; sparse-brick GPU cellular fluid, displayed as a column-reduced surface. Not the retired dense grid. |
| Original water | `FluidSolverLegacy` defines a local CPU `FluidField` three-pass cellular implementation based on the original solver. It does not import `fluidSolver.ts`. Display uses a WebGL heightfield. |

This audit identifies implementation paths; it does not accept solver accuracy, realism, performance, or every optional diagnostic mode. The table's source paths are the maintenance trace when those implementations change.

Earlier table verification on 2026-10-14 covered the original ten-row menu table: source expansion and horizontal keyboard scrolling passed; all 35 listed paths existed. This is historical evidence, not full-inventory validation.

Full-inventory migration verification on 2026-10-14: all 34 registry IDs appeared exactly once as cards. Retained mechanism text, source lists, notes, captures and destination query parameters matched the registry. All 24 Show/Status combinations returned the expected cards and table rows. Legacy catalog URLs normalized to an idle menu and preserved their hash. Thin-layer setup opened parked and returned without a canvas. Wide/narrow render checks reported no page errors or menu horizontal overflow. Scoped typecheck of the three changed UI files reported zero errors in scope (one imported-file diagnostic suppressed). Disposable checks and captures remain ignored under `.agent/scratch/water-menu/`.

Navigation is implemented in `src/components/DesignPreview/DesignPreviewPage.tsx` and `src/components/DesignPreview/steps/PreviewWater.tsx`. These Design Preview sources are local-only ignored files in this checkout; this note is the tracked discoverability record.

Scoped typecheck passed with zero errors. Rendered checks confirmed the idle nine-choice menu at wide and 989-pixel viewports, parked side-by-side panes, catalog entry, and River/Ocean/Skip entry and return paths. The test browser lacks WebGPU and stalled during individual-view checks, so these checks establish menu/navigation behavior rather than live GPU scene quality or complete individual-view acceptance. No solver, river geometry, or hydraulic acceptance status changed.
