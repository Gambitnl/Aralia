import type { CellFacts } from './worldCell';
import { classifyCellType } from './worldCell';
import type { SchemaGap } from './types';
import type { Burg } from '../fmg/burgs-generator';

/**
 * Canonical facts every land cell must own at its altitude. `featureTraces`
 * represents discrete notable features (forest, ruin, dungeon, camp,
 * roadside tavern) as presence + approx location + type. The current FMG pack
 * does not carry these, so they surface as gaps = the upstream worldmap backlog.
 */
function hasFeatureTraces(_facts: CellFacts): boolean {
  // No field exists on the pack today. River presence is the only proxy trace.
  // Treat the dedicated feature-trace layer as absent until the worldmap owns it.
  return false;
}

export function auditCellSchema(facts: CellFacts, burg: Burg | undefined): SchemaGap[] {
  const gaps: SchemaGap[] = [];

  if (facts.biomeId < 0) {
    gaps.push({ field: 'biomeId', cellId: facts.id, reason: 'land cell has no biome id' });
  }
  if (facts.height <= 0) {
    gaps.push({ field: 'height', cellId: facts.id, reason: 'cell has no elevation' });
  }

  if (classifyCellType(facts) === 'settlement') {
    if (!burg) {
      gaps.push({ field: 'burg', cellId: facts.id, reason: 'settlement cell references a missing burg' });
    } else if (!burg.population || burg.population <= 0) {
      gaps.push({ field: 'population', cellId: facts.id, reason: 'settlement burg has no population magnitude' });
    }
  }

  if (!hasFeatureTraces(facts)) {
    gaps.push({
      field: 'featureTraces',
      cellId: facts.id,
      reason:
        'cell owns no discrete feature traces (forest/ruin/dungeon/camp/roadside-tavern); worldmap generator must add them',
    });
  }

  return gaps;
}
