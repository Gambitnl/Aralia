/**
 * Headless proof script that renders the procedural FMG atlas.
 *
 * It generates an atlas using the FMG engine with a fixed seed ('world-42'),
 * renders the canvas using drawAtlas in a Playwright browser page,
 * and writes two PNG proofs: one default view, and one zoomed-in (3x) centered on land.
 * It also measures the performance benefits of caching by comparing the time taken for a
 * full redraw against a cached pan blit.
 *
 * The draw functions (drawAtlas, drawRegion) are bundled with esbuild — with all
 * their module dependencies — into one browser IIFE and injected into the page.
 *
 * Usage: npx tsx scripts/worldforge/renderAtlasProof.ts
 */
export {};
