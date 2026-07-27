import type { StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile, StructuredJsonMismatchRecord, StructuredJsonReportFile } from "../spellGateDataTypes";
import type { HigherLevelsBucketDetail, HigherLevelsRuntimeBucketDetail } from "./bucketDetailTypes";
export declare function buildHigherLevelsMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function classifyHigherLevelsMismatch(spell: unknown, mismatch: StructuredCanonicalMismatchRecord): HigherLevelsBucketDetail;
export declare function buildHigherLevelsRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord>;
export declare function classifyHigherLevelsRuntimeMismatch(spell: unknown, mismatch: StructuredJsonMismatchRecord | undefined, structuredHigherLevelsBucket: HigherLevelsBucketDetail | undefined): HigherLevelsRuntimeBucketDetail | undefined;
