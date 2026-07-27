import type { StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile, StructuredJsonMismatchRecord, StructuredJsonReportFile } from "../spellGateDataTypes";
import type { SubClassesBucketDetail, SubClassesRuntimeBucketDetail } from "./bucketDetailTypes";
export declare function buildSubClassesMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function classifySubClassesMismatch(spell: unknown, mismatch: StructuredCanonicalMismatchRecord): SubClassesBucketDetail;
export declare function buildSubClassesRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord>;
export declare function classifySubClassesRuntimeMismatch(spell: unknown, mismatch: StructuredJsonMismatchRecord | undefined, structuredSubClassesBucket: SubClassesBucketDetail | undefined): SubClassesRuntimeBucketDetail | undefined;
