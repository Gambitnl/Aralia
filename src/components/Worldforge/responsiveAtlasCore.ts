// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 22:08:03
 * Dependents: components/Worldforge/responsiveAtlasPreparation.ts, components/Worldforge/responsiveAtlasWorker.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file performs the deterministic, CPU-heavy half of responsive atlas
 * preparation.
 *
 * It has no browser-worker client code, so responsiveAtlasWorker.ts can import
 * it without recursively bundling another worker. The function calls the
 * canonical generator and SVG model builder directly and changes no world or
 * render contracts.
 */
import { dungeonStatesForWorld } from '../../systems/worldforge/dungeon/world/dungeonStates';
import { getBridgeAtlas } from '../../systems/worldforge/bridge/legacySubmapBridge';
import { buildAtlasSvgModel } from './atlasSvg';
import type {
  ResponsiveAtlasPrepared,
  ResponsiveAtlasRequest,
} from './responsiveAtlasProtocol';

// ============================================================================
// Worker-safe preparation
// ============================================================================
// Generation and path construction happen together so the large atlas crosses
// the worker boundary once. Only the function-bearing quadtree is omitted; the
// client reconstructs it from the exact same cell points.
// ============================================================================

export function prepareResponsiveAtlasNow(
  request: ResponsiveAtlasRequest,
): ResponsiveAtlasPrepared {
  const atlas = getBridgeAtlas(request.seed);
  const dungeonSites = request.seed === 0
    ? undefined
    : dungeonStatesForWorld(request.seed, request.clearedDungeonPaths);
  const model = buildAtlasSvgModel(atlas, dungeonSites);

  // FMG's precipitation pass leaves deterministic non-index properties on its
  // typed array. They are part of the generated object but structured clone
  // silently drops them, so carry them explicitly for byte-exact restoration.
  const gridPrecipitation = Object.entries(atlas.grid.cells.prec || {})
    .filter(([key]) => Number.isNaN(Number(key))) as Array<[string, number]>;

  const cloneableAtlas = {
    ...atlas,
    pack: {
      ...atlas.pack,
      cells: {
        ...atlas.pack.cells,
        q: undefined,
      },
    },
  } as typeof atlas;

  return {
    atlas: cloneableAtlas,
    model,
    transferProperties: { gridPrecipitation },
  };
}
