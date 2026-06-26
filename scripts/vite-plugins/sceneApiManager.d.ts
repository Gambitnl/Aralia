/**
 * Dev API for the OPENING-SCENARIO VISUAL.
 *
 * POST /api/scenes/generate  { prompt }  -> { url }
 *   Generates a wide scene illustration for the freshly written opening
 *   predicament and returns a locally-served image URL.
 *
 * Built on the SAME image generator the race-image tooling uses
 * (scripts/workflows/gemini/image-gen/image-gen-driver: generateImage +
 * downloadImage), rather than the portrait endpoint's missing
 * `generate-portrait` module.
 *
 * NO canned fallback: if generation fails this returns an honest error and the
 * client surfaces "illustration unavailable" — it never serves a stock image.
 */
export declare const sceneApiManager: () => {
    name: string;
    configureServer(server: any): void;
};
