/**
 * @file World3DDemo.tsx
 * @description Self-contained host for the streamed 3D world. Generates a full world via the
 * real generation pipeline (`generateMap` â†’ `WorldData` v2) and feeds World3DScene an inline
 * (main-thread) chunk loader.
 *
 * Why this is built this way:
 * - Using the real `generateMap` pipeline (instead of a synthetic all-`plains` heightmap) means
 *   the demo showcases the *actual* implemented content: varied biomes, flow-traced rivers,
 *   the MST road graph, and placed towns/dungeons/ruins â€” the same data the live atlas + 3D
 *   world consume. (Resolves gap W3D-G8 / task T4.)
 * - The inline loader keeps the sandbox runnable without the Web Worker pool (worker-backed
 *   loading is tracked separately as W3D-G1).
 * - The camera spawns on the town with the greatest local terrain relief and is lifted to that
 *   ground elevation, so the now vertically-exaggerated hills read immediately rather than
 *   spawning on flat coast/ocean or a flat plateau (W3D-G11 / T8).
 */
import React from 'react';
declare const World3DDemo: React.FC;
export default World3DDemo;
