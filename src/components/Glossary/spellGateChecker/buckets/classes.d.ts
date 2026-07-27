import type { StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile } from "../spellGateDataTypes";
import type { ClassesBucketDetail } from "./bucketDetailTypes";
export declare function buildClassesMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function classifyClassesMismatch(spell: unknown, mismatch: StructuredCanonicalMismatchRecord): ClassesBucketDetail;
