# MapPane Component (`src/components/MapPane.tsx`)

## Purpose

`MapPane.tsx` shows the world map in a window. The map surface is the Worldforge
atlas. The atlas is a native SVG map of Voronoi cells. Aralia owns the atlas and
generates it from the world seed.

The pane does these tasks:

* It draws the world atlas for one world seed.
* It resolves each click to one atlas cell.
* It lets the player go down into a cell to see more detail.
* It plans and commits travel.
* It starts entry into the streamed 3D world.

The pane does not use a map grid. The pane does not receive `MapData`. Each
callback receives a `WorldCellView`. A `WorldCellView` carries its own `cellId`.

## Props

`MapPaneProps` holds more than 20 props. Read the type in `MapPane.tsx` for the
full list and for the rules of each prop. These are the primary props:

* **`worldSeed?: number`**
  * The identity of the world. The pane generates the atlas from this seed.

* **`onTileClick: (x, y, cell: WorldCellView, travelMeta?: TravelMeta) => void`**
  * The pane calls this when the player commits a trip to a cell.
  * Required.

* **`onEnter3DAtCell?: (x, y, cell: WorldCellView, anchor?: Entry3DAnchor) => void`**
  * The pane calls this when the player starts 3D entry at a discovered cell.

* **`onSetSail?: (destinationBurgId, seaMiles, danger) => void`**
  * The pane calls this instead of `onTileClick` for a voyage in an owned ship.
  * A ship voyage does not move the player immediately.

* **`onClose: () => void`**
  * Closes the map window.
  * Required.

* **`allowTravel?: boolean`** and **`allow3DEntry?: boolean`**
  * These props show or hide the Travel mode and the Enter 3D mode.

* **`playerAtlasCellId?: number | null`**
  * The canonical atlas cell of the player. This value puts the player marker on
    the correct cell. If you do not supply it, the pane has no player marker.

The other props supply the data for travel and for the map decoration. Examples
are `provisionInventory`, `partySize`, `partyGold`, `transportParty`,
`activeShip`, `gameTime`, `exploredCellIds`, `discoveredHiddenSites` and
`clearedDungeonPaths`.

## Current Behavior

1. **Atlas Surface**
   * `AtlasSvgView` draws the atlas. The component draws ocean depth bands, land
     regions, rivers, routes, state borders, burgs and labels.
   * The player can pan the map and can zoom the map.
   * A click finds the cell below the pointer by the nearest site.
   * A marker shows the position of the player. A `Find Me` control moves the
     view to that marker. The marker and the control are only available if the
     caller supplies the cell of the player.

2. **Layer Panel**
   * `AtlasSvgView` also supplies the layer panel. The panel has two parts.
   * The first part is the map coloring. The coloring is one exclusive choice.
     The choices are Biomes, States, Cultures, Religions, Provinces, Population,
     Temperature, Precipitation, Heightmap and None. Only one choice can apply,
     because each choice tints all the land. The default choice is Biomes.
   * The second part is the feature layers. Each feature layer is an independent
     toggle. The panel puts these layers in three groups: Features, Places and
     Reference.
   * The panel disables a choice if the atlas has no data for it.
   * The panel keeps the selections of the player in local storage. The key is
     `aralia.atlas.layerPrefs.v1`. The pane scopes the key by the world seed.

3. **Interaction Modes**
   * **Explore** — a click goes down into the cell.
   * **Travel** — the pane plans a route to the cell. The player then selects a
     transport and commits the trip. This mode is available only if `allowTravel`
     is true.
   * **Enter 3D** — a click on a discovered cell starts streamed world entry.
     This mode is available only if `allow3DEntry` is true.

4. **Drill And The Drill Cap**
   * A drill is a stack of tiers below the world atlas.
   * The tier names by depth are Region, Local and Locale 1.
   * The pane stops the drill at three tiers. The full path is World, Region,
     Local, Locale 1. The pane pushes no tier after the third tier.
   * A cell that holds a burg is different. That cell goes down into the
     canonical town plan for the burg. A town plan is a leaf. The player cannot
     go deeper than a town plan.
   * The town plan comes from `getCanonicalTownPlan`. The same plan supplies the
     3D town for that burg. Thus the 2D town and the 3D town agree.
   * A breadcrumb shows the path. The player clicks a crumb to go up to that
     tier.

5. **Off-Thread Preparation**
   * The pane builds the atlas and the SVG model in a worker. Look at
     `responsiveAtlasPreparation`.
   * The pane shows a status message while the build runs.
   * If the build fails, the pane shows the error. The pane does not show a
     different map.
   * If the host cannot run the worker, the pane builds the atlas on the current
     thread.

## Data Dependencies

* `WorldCellView`, `TravelMeta` and `Entry3DAnchor` from `src/types`.
* `AtlasSvgView`, `SubmapSvgView`, `NeighbourhoodSvgView` and `TownPlanView`
  from `src/components/Worldforge`.
* The atlas generator and the SVG model in `src/systems/worldforge`.
* The submap engine and the town engine in `src/systems/worldforge`.
* The travel systems in `src/systems/travel`.

## History

The square-grid map renderer is gone. The grid retirement task `agora-608b`
removed the `MapData` prop, the `MapTile` payload and the world geography read
adapter.

An embedded Azgaar map was the surface before 2026-06-24. That surface is
retired. The Worldforge atlas is now the only cartography system. Do not add the
Azgaar map again.
