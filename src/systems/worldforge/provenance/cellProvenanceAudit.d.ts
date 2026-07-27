import type { GoldenDrillPath } from './__tests__/fixtures/drillPath';
import type { ProvenanceReport } from './types';
/** Input shape: the same fields the drill-path fixture produces. */
export type AuditInput = GoldenDrillPath;
export declare function runCellProvenanceAudit(input: AuditInput): ProvenanceReport;
