import type { StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile } from "../spellGateDataTypes";
import type { CastingTimeBucketDetail } from "./bucketDetailTypes";
export declare function buildCastingTimeMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function classifyCastingTimeMismatch(spell: unknown, mismatch: StructuredCanonicalMismatchRecord): CastingTimeBucketDetail;
