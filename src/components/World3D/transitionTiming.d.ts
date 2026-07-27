/**
 * @file src/components/World3D/transitionTiming.ts
 * Shared timing constants for atlas ↔ 3D transitions (Plan 4 / T11).
 *
 * Centralized here so RTL tests, perf checks, and TransitionController stay aligned
 * on the same millisecond budget without duplicating magic numbers.
 */
/** Fade-out duration for the 2D atlas layer when entering 3D (ms). */
export declare const ATLAS_FADE_OUT_MS = 300;
/** Camera dive duration after the 3D scene mounts (ms). */
export declare const CAMERA_DIVE_MS = 1500;
/** Camera pull-up duration when exiting back to atlas (ms). */
export declare const CAMERA_LERP_UP_MS = 800;
/** Fade-in duration for the atlas layer on exit (ms). */
export declare const ATLAS_FADE_IN_MS = 400;
/** Plan 4 perf budget: fade + dive + small buffer (ms). */
export declare const ENTRY_TRANSITION_BUDGET_MS: number;
/** Exit path: lerp up + atlas fade-in (ms). */
export declare const EXIT_TRANSITION_BUDGET_MS: number;
/** World3DWrapper position dispatch interval (~10 Hz). */
export declare const POSITION_DISPATCH_INTERVAL_MS = 100;
