import type { GoldenDrillPath } from './__tests__/fixtures/drillPath';
import { readWorldCell, classifyCellType } from './worldCell';
import { auditCellSchema } from './cellSchema';
import {
  classifyTerrainBiome,
  classifyTownsAndBuildings,
  classifyHostiles,
  classifyFeatures,
  classifyHiddenSites,
} from './groundProvenance';
import type { EntityVerdict, ProvenanceReport } from './types';

/** Input shape: the same fields the drill-path fixture produces. */
export type AuditInput = GoldenDrillPath;

export function runCellProvenanceAudit(input: AuditInput): ProvenanceReport {
  const facts = readWorldCell(input.pack, input.cellId);
  const burg = input.pack.burgs?.[input.burgId];

  const verdicts: EntityVerdict[] = [
    classifyTerrainBiome(facts, input.biomeIdUsed),
    ...classifyTownsAndBuildings(input.burgId, input.ground),
    ...classifyHostiles(input.region, input.ground),
    ...classifyFeatures(input.ground),
    ...classifyHiddenSites(input.region, input.ground),
  ];

  const counts = {
    inherited: verdicts.filter((v) => v.state === 'inherited').length,
    elaborated: verdicts.filter((v) => v.state === 'elaborated').length,
    orphaned: verdicts.filter((v) => v.state === 'orphaned').length,
  };

  return {
    cellId: input.cellId,
    cellType: classifyCellType(facts),
    verdicts,
    schemaGaps: auditCellSchema(facts, burg),
    counts,
    passed: verdicts.every((v) => v.severity !== 'fail'),
  };
}
