import type { GateResult, StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile, StructuredJsonMismatchRecord, StructuredJsonReportFile } from "../spellGateDataTypes";
import type { RangeAreaRuntimeBucketDetail } from "./bucketDetailTypes";
export declare function buildRangeAreaMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord>;
export declare function classifyRangeAreaMismatch(spell: unknown, mismatch: StructuredCanonicalMismatchRecord): NonNullable<NonNullable<GateResult["bucketDetails"]>["rangeArea"]>;
export declare function buildRangeAreaRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord>;
export declare function classifyRangeAreaRuntimeMismatch(spell: unknown, mismatch: StructuredJsonMismatchRecord | undefined, structuredCanonicalMismatch: StructuredCanonicalMismatchRecord | undefined): RangeAreaRuntimeBucketDetail | undefined;
