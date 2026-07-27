import type { StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile, StructuredJsonMismatchRecord, StructuredJsonReportFile } from "../spellGateDataTypes";
import type { ComponentsBucketDetail, ComponentsRuntimeBucketDetail } from "./bucketDetailTypes";
export declare function buildComponentsMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function classifyComponentsMismatch(spell: unknown, mismatch: StructuredCanonicalMismatchRecord): ComponentsBucketDetail;
export declare function buildComponentsRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord>;
export declare function classifyComponentsRuntimeMismatch(spell: unknown, mismatch: StructuredJsonMismatchRecord | undefined, structuredComponentsBucket: ComponentsBucketDetail | undefined): ComponentsRuntimeBucketDetail | undefined;
