/**
 * @file postGeometry.ts — owned, seeded post-mounted street furniture.
 *
 * Replaces the absurd barrel reuse for `lantern-post` / `tavern-sign` and the
 * boulder reuse for `fingerpost` (beautification wave, owned-generators
 * slice). Three kinds sharing one tilted-wooden-post skeleton:
 *  - lantern: post + short arm + hanging lantern box with a warm glow pane.
 *  - sign: post + arm + hanging swing sign board.
 *  - fingerpost: post with 1–2 pointing finger boards at different headings.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
export type PostKind = 'lantern' | 'sign' | 'fingerpost';
export declare function createPostGeometry(seed: number, kind?: PostKind): THREE.BufferGeometry;
