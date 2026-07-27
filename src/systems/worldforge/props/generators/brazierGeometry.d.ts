/**
 * @file brazierGeometry.ts — owned, seeded brazier / candle-stand geometry.
 *
 * Replaces the boulder reuse for `brazier` (beautification wave,
 * owned-generators slice): an iron bowl on three splayed legs with a ring of
 * ember-colored coals cresting the rim — the warm top is the read at night
 * gate posts and graveyard shrines. Some seeds are the taller candle-stand
 * form (narrow column + wide drip pan + candle glow).
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
export declare function createBrazierGeometry(seed: number): THREE.BufferGeometry;
