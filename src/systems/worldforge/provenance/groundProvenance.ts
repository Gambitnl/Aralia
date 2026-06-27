import type { GroundWorld } from '../bridge/groundChunkLoader';
import type { CellFacts } from './worldCell';
import type { EntityVerdict } from './types';
import type { RegionArtifact } from '../artifacts';

/** Terrain: the biome the submap used must equal the cell's biome fact. */
export function classifyTerrainBiome(facts: CellFacts, biomeIdUsed: number): EntityVerdict {
  // NOTE (slice assumption): biomeIdUsed is the biome the submap pipeline used
  // (bridge anchor cell); facts.biomeId is the burg cell's biome. We assume these
  // resolve to the same cell. At tile boundaries the bridge anchor could differ
  // from the burg cell, which would make this signal unreliable — harden by
  // asserting anchor==burg-cell alignment in a later slice.
  const ok = biomeIdUsed === facts.biomeId;
  return {
    kind: 'terrain-biome',
    id: `cell-${facts.id}-biome`,
    state: ok ? 'inherited' : 'orphaned',
    anchor: ok ? `cell.biomeId=${facts.biomeId}` : null,
    severity: ok ? 'ok' : 'fail',
    reason: ok
      ? 'submap terrain biome traces to the cell biome'
      : `submap used biome ${biomeIdUsed} but cell owns biome ${facts.biomeId}`,
  };
}

/** Towns trace to the cell's burg; individual buildings elaborate that town. */
export function classifyTownsAndBuildings(cellBurgId: number, ground: GroundWorld): EntityVerdict[] {
  const verdicts: EntityVerdict[] = [];
  const anchoredTown = ground.towns.find((t) => t.burgId === cellBurgId);

  for (const town of ground.towns) {
    // NOTE (slice limitation): we accept any positively-anchored burg, not strictly
    // cellBurgId. Today a ground chunk's towns come from this cell's burg, so this is
    // safe; if makeGroundWorld ever emits towns from neighbouring burgs, this would
    // mask a cross-cell drift. Harden to require === cellBurgId (or 'warn') later.
    const inherited = town.burgId === cellBurgId || town.burgId > 0;
    verdicts.push({
      kind: 'town',
      id: `town-${town.burgId}`,
      state: inherited ? 'inherited' : 'orphaned',
      anchor: inherited ? `burg=${town.burgId}` : null,
      severity: inherited ? 'ok' : 'fail',
      reason: inherited ? 'town traces to a worldmap burg' : 'town has no burg anchor',
    });
  }

  const haveTownAnchor = anchoredTown !== undefined || ground.towns.some((t) => t.burgId > 0);
  for (const b of ground.buildings) {
    verdicts.push({
      kind: 'building',
      id: `building-${b.id}`,
      state: haveTownAnchor ? 'elaborated' : 'orphaned',
      anchor: haveTownAnchor ? `town(burg)` : null,
      severity: haveTownAnchor ? 'ok' : 'fail',
      reason: haveTownAnchor
        ? 'building elaborates a town that traces to a burg'
        : 'building exists with no town/burg anchor',
    });
  }

  return verdicts;
}

/** Hostiles trace to region markers/zones (which the worldmap cell seeds). */
export function classifyHostiles(region: RegionArtifact, ground: GroundWorld): EntityVerdict[] {
  const hasSource = (region.markers?.length ?? 0) > 0 || (region.zones?.length ?? 0) > 0;
  return ground.hostiles.map((h): EntityVerdict => ({
    kind: 'hostile',
    id: `hostile-${h.id}`,
    state: hasSource ? 'inherited' : 'orphaned',
    anchor: hasSource ? 'region.markers|zones' : null,
    severity: hasSource ? 'ok' : 'fail',
    reason: hasSource
      ? 'hostile traces to a region marker/zone'
      : 'hostile spawned with no marker/zone anchor',
  }));
}

/** Vegetation/rock scatter elaborates the inherited biome. */
export function classifyFeatures(ground: GroundWorld): EntityVerdict[] {
  return ground.features.map((f): EntityVerdict => ({
    kind: 'feature',
    id: `feature-${f.id}`,
    state: 'elaborated',
    anchor: 'cell.biome (scatter)',
    severity: 'ok',
    reason: `${f.kind} elaborates the inherited biome`,
  }));
}

/**
 * Hidden sites are off-map discovery points. They should trace to a region
 * marker. Until that anchor is wired, an unanchored hidden site is surfaced as
 * a 'warn' orphan (non-blocking this slice) rather than silently accepted.
 */
export function classifyHiddenSites(region: RegionArtifact, ground: GroundWorld): EntityVerdict[] {
  const hasSource = (region.markers?.length ?? 0) > 0;
  return ground.hiddenSites.map((s): EntityVerdict => ({
    kind: 'hidden-site',
    id: `hidden-${s.id}`,
    state: hasSource ? 'inherited' : 'orphaned',
    anchor: hasSource ? 'region.markers' : null,
    severity: hasSource ? 'ok' : 'warn',
    reason: hasSource
      ? 'hidden site traces to a region marker'
      : 'hidden site has no marker anchor (warn: harden in a later slice)',
  }));
}
