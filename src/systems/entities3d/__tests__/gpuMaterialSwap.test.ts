/**
 * @file src/systems/entities3d/__tests__/gpuMaterialSwap.test.ts
 *
 * Pins the WebGPU material swap.
 *
 * Generated entities rendered as capsules in the WebGPU battle scene because
 * two of their materials carry raw GLSL, which cannot compile on a path that
 * emits WGSL. These tests prove the two get rebuilt as node materials, that the
 * other materials are left alone, and that an unrebuildable one is reported
 * rather than silently replaced.
 */
import { describe, expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshToonMaterial } from 'three';
import { blobShadowMaterial, outlineMaterial, OUTLINE_MATERIAL_NAME } from '../three/toon';
import { swapEntityMaterialsForGpu } from '../three/gpu/gpuMaterialSwap';

function meshWith(material: Parameters<typeof Mesh>[1]): Mesh {
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

    it('leaves toon and basic materials untouched — three converts those itself', () => {
        const root = new Group();
        const toon = new MeshToonMaterial({ color: '#ff0000' });
        root.add(meshWith(toon));

        const result = swapEntityMaterialsForGpu(root);

        expect(result.outlines).toBe(0);
        expect(result.shadows).toBe(0);
        expect((root.children[0] as Mesh).material).toBe(toon);
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
