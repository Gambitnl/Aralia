import type { StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile, StructuredJsonMismatchRecord, StructuredJsonReportFile } from "../spellGateDataTypes";
import type { DescriptionBucketDetail, DescriptionRuntimeBucketDetail } from "./bucketDetailTypes";
export declare function buildDescriptionMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function buildDescriptionRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord>;
export declare function classifyDescriptionRuntimeMismatch(spell: unknown, mismatch: StructuredJsonMismatchRecord | undefined, structuredDescriptionBucket: DescriptionBucketDetail | undefined): DescriptionRuntimeBucketDetail | undefined;
export declare function classifyDescriptionMismatch(mismatch: StructuredCanonicalMismatchRecord): DescriptionBucketDetail;
