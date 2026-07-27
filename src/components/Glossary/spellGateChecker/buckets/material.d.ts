import type { StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile, StructuredJsonMismatchRecord, StructuredJsonReportFile } from "../spellGateDataTypes";
import type { MaterialComponentBucketDetail, MaterialComponentRuntimeBucketDetail } from "./bucketDetailTypes";
export declare function buildMaterialComponentMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function classifyMaterialComponentMismatch(spell: unknown, mismatch: StructuredCanonicalMismatchRecord): MaterialComponentBucketDetail;
export declare function buildMaterialComponentRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord>;
export declare function classifyMaterialComponentRuntimeMismatch(spell: unknown, mismatch: StructuredJsonMismatchRecord | undefined, structuredMaterialBucket: MaterialComponentBucketDetail | undefined): MaterialComponentRuntimeBucketDetail | undefined;
