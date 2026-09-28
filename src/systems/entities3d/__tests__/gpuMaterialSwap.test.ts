/**
 * @file src/systems/entities3d/__tests__/gpuMaterialSwap.test.ts
 *
 * Pins the WebGPU material swap.
 *
 * Generated entities rendered as capsules in the WebGPU battle scene for two
 * reasons: two of their materials carry raw GLSL, which cannot compile on a
 * path that emits WGSL, and the toon body's node twin is LIT in a scene that
 * deliberately has no lights, so it would draw black. These tests prove all
 * three get rebuilt as node materials, that the plain basic materials three
 * converts itself are left alone, that the death fade the old token carried
 * survives on the real body, and that an unrebuildable material is reported
 * rather than silently replaced.
 */
import { describe, expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, MeshToonMaterial, type Material } from 'three';
import { blobShadowMaterial, outlineMaterial, OUTLINE_MATERIAL_NAME, toonMaterial } from '../three/toon';
import { setEntityDeathFade, swapEntityMaterialsForGpu } from '../three/gpu/gpuMaterialSwap';
import { DEATH_FADE_UNIFORM_KEY } from '../three/gpu/toonNodes';

// `Parameters<typeof Mesh>` resolves to `never` for a class, which made every
// call site a type error; the constructor's own material type is `Material`.
function meshWith(material: Material): Mesh {
    return new Mesh(new BoxGeometry(1, 1, 1), material);
}

describe('swapEntityMaterialsForGpu', () => {
    it('rebuilds the ink outline as a node material', () => {
        const root = new Group();
        root.add(meshWith(outlineMaterial('#20242c', 0.03)));

        const result = swapEntityMaterialsForGpu(root);

        expect(result.outlines).toBe(1);
        expect(result.skipped).toEqual([]);
        const mesh = root.children[0] as Mesh;
        // A node material carries a positionNode; the GLSL original did not.
        expect((mesh.material as { positionNode?: unknown }).positionNode).toBeDefined();
    });

    it('rebuilds the blob shadow as a node material', () => {
        const root = new Group();
        root.add(meshWith(blobShadowMaterial()));

        const result = swapEntityMaterialsForGpu(root);

        expect(result.shadows).toBe(1);
        const mesh = root.children[0] as Mesh;
        expect((mesh.material as { opacityNode?: unknown }).opacityNode).toBeDefined();
    });

    it("leaves toon materials for three's own lit conversion when asked to", () => {
        const root = new Group();
        const toon = new MeshToonMaterial({ color: '#ff0000' });
        root.add(meshWith(toon));

        const result = swapEntityMaterialsForGpu(root, { toon: 'keep' });

        expect(result.outlines).toBe(0);
        expect(result.shadows).toBe(0);
        expect(result.toons).toBe(0);
        expect((root.children[0] as Mesh).material).toBe(toon);
    });

    it('leaves plain basic materials untouched — three converts those itself', () => {
        const root = new Group();
        const basic = new MeshBasicMaterial({ color: '#f4f1e6' });
        root.add(meshWith(basic));

        const result = swapEntityMaterialsForGpu(root);

        expect(result.skipped).toEqual([]);
        expect((root.children[0] as Mesh).material).toBe(basic);
    });

    it('rebuilds the toon body as an unlit baked material by default', () => {
        const root = new Group();
        const toon = toonMaterial('#ff0000');
        root.add(meshWith(toon));

        const result = swapEntityMaterialsForGpu(root);

        // A LIT node material in this scene has no lights to read and would
        // draw black; the baked twin carries the ramp in its colorNode.
        expect(result.toons).toBe(1);
        const material = (root.children[0] as Mesh).material as {
            colorNode?: unknown;
            isMeshBasicNodeMaterial?: boolean;
        };
        expect(material).not.toBe(toon);
        expect(material.colorNode).toBeDefined();
        expect(material.isMeshBasicNodeMaterial).toBe(true);
    });

    it('gives each baked toon body a death-fade uniform the scene can drive', () => {
        const root = new Group();
        root.add(meshWith(toonMaterial('#ff0000')));
        swapEntityMaterialsForGpu(root);

        const material = (root.children[0] as Mesh).material as { userData: Record<string, { value: number }> };
        expect(material.userData[DEATH_FADE_UNIFORM_KEY].value).toBe(0);

        // The token this replaced turned flat grey when a combatant dropped;
        // that affordance now rides on the real body.
        expect(setEntityDeathFade(root, 1)).toBe(1);
        expect(material.userData[DEATH_FADE_UNIFORM_KEY].value).toBe(1);
    });

    it('leaves the death fade alone on materials that never carried one', () => {
        const root = new Group();
        root.add(meshWith(new MeshBasicMaterial({ color: '#f4f1e6' })));
        root.add(meshWith(outlineMaterial('#20242c', 0.03)));

        swapEntityMaterialsForGpu(root);

        // Eyes and ink keep their look on a corpse — the ink is what keeps a
        // downed body readable at all.
        expect(setEntityDeathFade(root, 1)).toBe(0);
    });

    it('shares ONE rebuilt material across every mesh that used the original', () => {
        const root = new Group();
        const shared = outlineMaterial('#20242c', 0.03);
        root.add(meshWith(shared));
        root.add(meshWith(shared));
        root.add(meshWith(shared));

        swapEntityMaterialsForGpu(root);

        const materials = root.children.map((c) => (c as Mesh).material);
        // Rebuilding per mesh would triple the pipeline count for no visual gain.
        expect(materials[0]).toBe(materials[1]);
        expect(materials[1]).toBe(materials[2]);
    });

    it('carries the per-vertex ink flag through the rebuild', () => {
        const root = new Group();
        root.add(meshWith(outlineMaterial('#20242c', 0.03, 1, true)));

        swapEntityMaterialsForGpu(root);

        // A missing aInk attribute reads 0 and would erase the outline, so the
        // opt-in must survive; losing it silently un-inks the hands.
        const mesh = root.children[0] as Mesh;
        expect((mesh.material as { positionNode?: unknown }).positionNode).toBeDefined();
    });

    it('reports a tagged material it cannot rebuild instead of faking one', () => {
        const root = new Group();
        const broken = outlineMaterial('#20242c', 0.03);
        broken.userData = {};
        root.add(meshWith(broken));

        const result = swapEntityMaterialsForGpu(root);

        expect(result.outlines).toBe(0);
        expect(result.skipped[0]).toContain(OUTLINE_MATERIAL_NAME);
        // Left in place, so it fails loudly at draw time rather than quietly
        // changing the art.
        expect((root.children[0] as Mesh).material).toBe(broken);
    });

    it('is idempotent — a swapped tree has nothing tagged left to find', () => {
        const root = new Group();
        root.add(meshWith(outlineMaterial('#20242c', 0.03)));

        swapEntityMaterialsForGpu(root);
        const second = swapEntityMaterialsForGpu(root);

        expect(second.outlines).toBe(0);
        expect(second.skipped).toEqual([]);
    });
});
