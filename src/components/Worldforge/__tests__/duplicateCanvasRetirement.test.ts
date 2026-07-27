/**
 * This file audits the retired canvas world-map boundary from the source tree.
 *
 * Route tests prove URL selection at runtime. These checks complement them by
 * proving that no shipped component imports AtlasMapView, while the three
 * supported map entry families still point at the canonical SVG pipeline.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Narrow source inventory
// ============================================================================
// Only TypeScript application files can create a React renderer dependency.
// Tests and the isolated reference file are excluded because neither is a
// player or developer runtime entry point.
// ============================================================================

const REPO_ROOT = process.cwd();
const SRC_ROOT = path.join(REPO_ROOT, 'src');

function runtimeTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : runtimeTypeScriptFiles(absolute);
    }
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (absolute.endsWith(path.join('Worldforge', 'AtlasMapView.tsx'))) return [];
    return [absolute];
  });
}

function source(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

// ============================================================================
// Reachability and canonical-consumer proofs
// ============================================================================

describe('duplicate canvas world-map retirement', () => {
  it('has no runtime import of the isolated AtlasMapView canvas component', () => {
    const importers = runtimeTypeScriptFiles(SRC_ROOT).filter((file) =>
      /from\s+['"][^'"]*AtlasMapView['"]/.test(readFileSync(file, 'utf8')),
    );

    expect(importers).toEqual([]);
  });

  it('keeps Design Preview, World Generation, and MapPane on the SVG pipeline', () => {
    const preview = source('src/components/DesignPreview/steps/PreviewWorldforge.tsx');
    const startSelection = source('src/components/Worldforge/StartPointSelection.tsx');
    const mapPane = source('src/components/MapPane.tsx');
    const responsiveCore = source('src/components/Worldforge/responsiveAtlasCore.ts');
    const retainedHierarchy = source('src/components/Worldforge/AtlasDemo.tsx');

    expect(preview).toContain("WORLD_MAP_PREVIEW_QUERY = 'worldmap=1'");
    expect(preview).not.toContain("openAppRoute('phase=worldforge')");
    expect(startSelection).toContain("import AtlasSvgView from './AtlasSvgView'");
    expect(startSelection).toContain('getBridgeAtlas(worldSeed)');
    expect(mapPane).toContain("import AtlasSvgView from './Worldforge/AtlasSvgView'");
    expect(mapPane).toContain('prepareResponsiveAtlas');
    expect(responsiveCore).toContain('getBridgeAtlas(request.seed)');
    expect(retainedHierarchy).toContain('import AtlasSvgView from "./AtlasSvgView"');
    expect(retainedHierarchy).not.toContain('import AtlasMapView');
  });
});
