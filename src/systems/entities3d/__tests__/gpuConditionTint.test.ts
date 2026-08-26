/**
 * @file src/systems/entities3d/__tests__/gpuConditionTint.test.ts
 *
 * Pins the WebGPU condition body tint (task agora-f821.35, GG-227).
 *
 * The tint itself is a picture and only a real GPU capture can judge it. What
 * a unit test CAN prove is everything around the picture: that the uniforms
 * are actually attached to the baked body, that the driver writes the palette's
 * own numbers rather than a second set invented here, that an unafflicted body
 * is left untouched, and that materials with no tint uniform (ink, eyes, blob
 * shadow) are skipped instead of being silently recolored.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, Color, type Material } from 'three';
import { blobShadowMaterial, outlineMaterial, toonMaterial } from '../three/toon';
import {
    setEntityConditionTint,
    setEntityDeathFade,
    swapEntityMaterialsForGpu,
} from '../three/gpu/gpuMaterialSwap';
import {
    CONDITION_TINT_UNIFORM_KEY,
    CONDITION_TINT_STRENGTH_UNIFORM_KEY,
    DEATH_FADE_UNIFORM_KEY,
} from '../three/gpu/toonNodes';
import { CONDITION_VISUALS, resolveDominantCondition } from '@/utils/visuals/conditionPalette';

function meshWith(material: Material): Mesh {
    return new Mesh(new BoxGeometry(1, 1, 1), material);
}

/** A swapped body plus a handle on the baked material's uniform bag. */
function bakedBody(): { root: Group; uniforms: Record<string, { value: number | Color }> } {
    const root = new Group();
    root.add(meshWith(toonMaterial('#ff0000')));
    swapEntityMaterialsForGpu(root);
    const material = (root.children[0] as Mesh).material as {
        userData: Record<string, { value: number | Color }>;
    };
    return { root, uniforms: material.userData };
}

describe('setEntityConditionTint', () => {
    it('gives every baked body both tint uniforms, parked at no-tint', () => {
        const { uniforms } = bakedBody();
        expect(uniforms[CONDITION_TINT_STRENGTH_UNIFORM_KEY].value).toBe(0);
        expect(uniforms[CONDITION_TINT_UNIFORM_KEY].value).toBeInstanceOf(Color);
    });

    it('writes the palette hue and strength for a poisoned body', () => {
        const { root, uniforms } = bakedBody();
        const poisoned = CONDITION_VISUALS.poisoned;

        expect(setEntityConditionTint(root, poisoned.tintColor, poisoned.tintStrength)).toBe(1);
        expect((uniforms[CONDITION_TINT_UNIFORM_KEY].value as Color).getHex()).toBe(poisoned.tintColor);
        expect(uniforms[CONDITION_TINT_STRENGTH_UNIFORM_KEY].value).toBe(poisoned.tintStrength);
    });

    it('drives every palette row that has a tint, straight from the palette', () => {
        for (const visual of Object.values(CONDITION_VISUALS)) {
            if (visual.tintColor === null) continue;
            const { root, uniforms } = bakedBody();
            setEntityConditionTint(root, visual.tintColor, visual.tintStrength);
            expect((uniforms[CONDITION_TINT_UNIFORM_KEY].value as Color).getHex(), visual.name).toBe(
                visual.tintColor,
            );
            expect(uniforms[CONDITION_TINT_STRENGTH_UNIFORM_KEY].value, visual.name).toBe(
                visual.tintStrength,
            );
        }
    });

    it('parks the strength at zero for a null tint, so an untinted body is untouched', () => {
        const { root, uniforms } = bakedBody();
        setEntityConditionTint(root, 0x00ff00, 0.5);
        setEntityConditionTint(root, null, 0.5);
        expect(uniforms[CONDITION_TINT_STRENGTH_UNIFORM_KEY].value).toBe(0);
    });

    it('clamps the strength to the 0..1 range the shader mix accepts', () => {
        const { root, uniforms } = bakedBody();
        setEntityConditionTint(root, 0x00ff00, 4);
        expect(uniforms[CONDITION_TINT_STRENGTH_UNIFORM_KEY].value).toBe(1);
        setEntityConditionTint(root, 0x00ff00, -2);
        expect(uniforms[CONDITION_TINT_STRENGTH_UNIFORM_KEY].value).toBe(0);
    });

    it('skips materials that carry no tint uniform — the ink outline keeps its color', () => {
        const root = new Group();
        root.add(meshWith(outlineMaterial('#20242c', 0.03)));
        root.add(meshWith(blobShadowMaterial()));
        swapEntityMaterialsForGpu(root);

        expect(setEntityConditionTint(root, 0x00ff00, 1)).toBe(0);
    });

    it('is independent of the death fade — a body can carry both', () => {
        const { root, uniforms } = bakedBody();
        setEntityConditionTint(root, 0x00ff00, 0.5);
        setEntityDeathFade(root, 1);
        expect(uniforms[CONDITION_TINT_STRENGTH_UNIFORM_KEY].value).toBe(0.5);
        expect(uniforms[DEATH_FADE_UNIFORM_KEY].value).toBe(1);
    });

    it('agrees with the palette about which condition wins on a multi-condition body', () => {
        const dominant = resolveDominantCondition(['Poisoned', 'Ignited']);
        expect(dominant?.key).toBe('ignited');

        const { root, uniforms } = bakedBody();
        setEntityConditionTint(root, dominant?.tintColor ?? null, dominant?.tintStrength ?? 0);
        expect((uniforms[CONDITION_TINT_UNIFORM_KEY].value as Color).getHex()).toBe(
            CONDITION_VISUALS.ignited.tintColor,
        );
    });
});

/**
 * A SOURCE-LEVEL gate, in the idiom of BattleMap3D.skyDome.test.ts, for a
 * defect no assertion about uniforms can see.
 *
 * Driving the body cues from a useEffect alone left the WebGPU body untinted:
 * the material swap hands the token a fresh set of materials whose uniforms
 * start at zero, and that happens AFTER the effect has run for this character.
 * With the blueprint unchanged nothing re-runs the effect, so the tint landed
 * on materials that no longer render. It was measured, not guessed: a forced
 * full-strength magenta read back as driven on 14 materials while the body on
 * screen kept its own color.
 *
 * The fix is that the adapter callback applies the cues to the root it has
 * just swapped. That is a fact about WHERE two calls sit, so where they sit is
 * what this pins.
 */
describe('BattleMap3DGpuScene drives the cues on the body it just swapped', () => {
    const source = readFileSync(
        resolve(__dirname, '../../../components/BattleMap/BattleMap3DGpuScene.tsx'),
        'utf8',
    );

    it('applies both body cues inside the material adapter, not only in an effect', () => {
        const adapter = source.slice(
            source.indexOf('const adaptMaterials = useCallback'),
            source.indexOf('}, []);', source.indexOf('const adaptMaterials = useCallback')),
        );
        expect(adapter).toContain('adaptEntityForWebGpu(root)');
        expect(adapter).toContain('setEntityDeathFade(root');
        expect(adapter).toContain('setEntityConditionTint(root');
    });

    it('swaps the materials before it writes any uniform onto them', () => {
        const start = source.indexOf('const adaptMaterials = useCallback');
        const swapAt = source.indexOf('adaptEntityForWebGpu(root)', start);
        const tintAt = source.indexOf('setEntityConditionTint(root', start);
        expect(swapAt).toBeGreaterThan(-1);
        expect(tintAt).toBeGreaterThan(swapAt);
    });

    it('still keeps an effect, so a condition gained without a rebuild shows up', () => {
        expect(source).toContain('}, [alive, blueprint, dominantCondition]);');
    });
});
