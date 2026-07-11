import type { GateResult } from "../spellGateDataTypes";

// ============================================================================
// Bucket detail aliases
// ============================================================================
// These aliases keep the classifier return types tied to the public GateResult
// shape. If the UI gains a new bucket field later, this module should add the
// matching alias and classifier here instead of widening the hook again.
// ============================================================================

export type CastingTimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["castingTime"]>;
export type ComponentsBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["components"]>;
export type ComponentsRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["componentsRuntime"]>;
export type MaterialComponentBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["materialComponent"]>;
export type MaterialComponentRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["materialComponentRuntime"]>;
export type DurationBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["duration"]>;
export type DurationRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["durationRuntime"]>;
export type RangeAreaRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["rangeAreaRuntime"]>;
export type DescriptionBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["description"]>;
export type DescriptionRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["descriptionRuntime"]>;
export type ClassesBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["classes"]>;
export type HigherLevelsBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["higherLevels"]>;
export type HigherLevelsRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["higherLevelsRuntime"]>;
export type SubClassesBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["subClasses"]>;
export type SubClassesRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["subClassesRuntime"]>;
