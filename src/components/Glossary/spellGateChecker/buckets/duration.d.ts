import type { StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile, StructuredJsonMismatchRecord, StructuredJsonReportFile } from "../spellGateDataTypes";
import type { DurationBucketDetail, DurationRuntimeBucketDetail } from "./bucketDetailTypes";
export declare function buildDurationMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function buildDurationRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord>;
export declare function classifyDurationMismatch(spell: unknown, mismatch: StructuredCanonicalMismatchRecord): DurationBucketDetail;
export declare function classifyDurationRuntimeMismatch(spell: unknown, mismatch: StructuredJsonMismatchRecord | undefined, structuredDurationBucket: DurationBucketDetail | undefined): DurationRuntimeBucketDetail | undefined;
