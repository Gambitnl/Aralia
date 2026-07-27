/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 10:30:30
 * Dependents: components/DesignPreview/steps/PreviewVisTest.tsx, devtools/vistest/runnerCore.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file scenarios.ts — the visual test scenario registry.
 *
 * One scenario = a named, deep-linkable visual test: which page (relative
 * URL), what a reviewer should look for, and a declarative capture recipe the
 * headless runner (tools/vistest/shoot.ts) interprets. The harness page
 * (design.html?step=vistest) renders this same list with a live viewport.
 *
 * Adding a scenario = appending one object here. The registry test
 * (__tests__/scenarios.test.ts) fails loudly on malformed entries.
 *
 * Recipes reuse the window hooks the pages already expose:
 *   __entityforge (forge), __bm3dCam (battle map camera),
 *   __wf3dScene / __wf3dSetPose / __wfGroundWorld / __wfAgentClock (world).
 * The eval snippets are lifted verbatim from the proven capture probes.
 */
export type CaptureStep = {
    kind: "waitHook";
    expr: string;
    timeoutMs?: number;
} | {
    kind: "sleep";
    ms: number;
} | {
    kind: "eval";
    js: string;
} | {
    kind: "readback";
} | {
    kind: "screenshot";
};
export interface VisScenario {
    /** kebab-case, unique — becomes the capture filename `<id>.png`. */
    id: string;
    title: string;
    group: "entities" | "combat" | "world" | "interiors" | "crowds";
    /** Relative to the dev base (no leading slash), e.g. `misc/design.html?step=…`. */
    url: string;
    /** What a reviewer should look for in the capture. */
    notes: string;
    /** Non-empty; exactly one terminal step (`readback` | `screenshot`), last. */
    capture: CaptureStep[];
}
export declare const SCENARIOS: VisScenario[];
/** Validate a scenario list; returns human-readable problems ([] = valid). */
export declare function validateScenarios(list: VisScenario[]): string[];
