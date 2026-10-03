/**
 * @file src/systems/entities3d/__tests__/toonNodesRim.test.ts
 *
 * Pins the actor rim light on the WebGPU path (task agora-a2b8).
 *
 * The WebGL actor gets its silhouette edge from `useFresnelRim`, a GLSL
 * `onBeforeCompile` patch — which the WebGPU material swap drops, because the
 * node path has no GLSL to patch. `bakedToonNodeMaterial` now rebuilds the same
 * arithmetic as TSL nodes. These tests prove the term is actually attached, that
 * it can be turned off, and — the one that matters in six months — that the two
 * render paths still carry the SAME rim constants, since the values are
 * duplicated across the `src/systems` / `src/components` boundary on purpose.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MeshToonMaterial } from 'three';
import { BATTLE_MAP_ACTOR_RIM, bakedToonNodeMaterial } from '../three/gpu/toonNodes';

/** The node tree's root, as far as these tests need to read it. */
type NodeShape = { constructor: { name: string }; op?: string; method?: string };

function rootOf(material: { colorNode?: unknown }): NodeShape {
    return material.colorNode as unknown as NodeShape;
}

describe('bakedToonNodeMaterial rim light', () => {
    it('adds a rim term on top of the body color by default', () => {
        const baked = bakedToonNodeMaterial(new MeshToonMaterial({ color: 0x884422 }));

        // The body color alone is the death-fade `mix`; the rim is added to it,
        // so the root becomes an add operator.
        const root = rootOf(baked);
        expect(root.constructor.name).toBe('OperatorNode');
        expect(root.op).toBe('+');
    });

    it('leaves the body color untouched when the rim is off', () => {
        const source = new MeshToonMaterial({ color: 0x884422 });

        const disabled = rootOf(bakedToonNodeMaterial(source, undefined, null));
        const zeroed = rootOf(
            bakedToonNodeMaterial(source, undefined, { ...BATTLE_MAP_ACTOR_RIM, intensity: 0 }),
        );

        // No rim: the root is still the death-fade mix, with nothing added.
        expect(disabled.constructor.name).toBe('MathNode');
        expect(disabled.method).toBe('mix');
        expect(zeroed.constructor.name).toBe('MathNode');
        expect(zeroed.method).toBe('mix');
    });

    it('keeps the death-fade uniform reachable with the rim attached', () => {
        const baked = bakedToonNodeMaterial(new MeshToonMaterial({ color: 0x224488 }));

        // The rim is added AFTER the fade, so a corpse keeps its edge; the
        // swap's setEntityDeathFade must still find the uniform it writes.
        expect(baked.userData.gpuDeathFade).toBeDefined();
    });

    it('carries the same rim constants as the WebGL useFresnelRim defaults', () => {
        // Duplicated, not imported: `src/systems` must not depend on
        // `src/components`. This guard is what keeps the duplication honest.
        const source = readFileSync(
            resolve(__dirname, '../../../components/BattleMap/characters/useFresnelRim.ts'),
            'utf8',
        );
        const read = (key: string): string => {
            const match = source.match(new RegExp(`${key}:\\s*([^,\\n]+)`));
            if (!match) throw new Error(`useFresnelRim DEFAULTS.${key} not found`);
            return match[1].trim();
        };

        expect(read('rimColor')).toBe('0xbfd8ff');
        expect(BATTLE_MAP_ACTOR_RIM.colorHex.toLowerCase()).toBe('#bfd8ff');
        expect(Number(read('rimIntensity'))).toBe(BATTLE_MAP_ACTOR_RIM.intensity);
        expect(Number(read('rimPower'))).toBe(BATTLE_MAP_ACTOR_RIM.power);
    });
});
