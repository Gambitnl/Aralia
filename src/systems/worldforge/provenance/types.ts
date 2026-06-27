export type ProvenanceState = 'inherited' | 'elaborated' | 'orphaned';

export type EntityKind =
  | 'terrain-biome'
  | 'town'
  | 'building'
  | 'hostile'
  | 'feature'
  | 'hidden-site';

/** 'fail' orphans block the audit; 'warn' orphans are surfaced but non-blocking this slice. */
export type Severity = 'ok' | 'warn' | 'fail';

export interface EntityVerdict {
  kind: EntityKind;
  id: string;
  state: ProvenanceState;
  /** The parent-cell fact this entity derives from, or null if orphaned. */
  anchor: string | null;
  severity: Severity;
  reason: string;
}

export interface SchemaGap {
  field: string;
  cellId: number;
  reason: string;
}

export interface ProvenanceReport {
  cellId: number;
  cellType: 'wilderness' | 'settlement';
  verdicts: EntityVerdict[];
  schemaGaps: SchemaGap[];
  counts: { inherited: number; elaborated: number; orphaned: number };
  /** True iff no verdict has severity 'fail'. Schema gaps do NOT fail this slice. */
  passed: boolean;
}
