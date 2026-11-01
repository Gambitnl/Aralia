import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { beamRotation, buildBeamGeometry } from '../beamGeometry';
import { townBuildingVisit } from '../../../components/Worldforge/townBuildingVisit';
import { buildBuildingMeshData, returnStairBoxes } from '../buildingModels';
import { buildBlueprintParts } from '../../worldforge/bridge/interiorParts';
import { buildingSceneModel } from '../buildingSceneModel';
import { buildSiteBoxBatches } from '../siteBoxBatches';
import type { LoadedChunk } from '../types';

describe('continuous timber rail geometry', () => {
  it('keeps sloped timbers continuous inside their conservative collision bounds', () => {
    const { plan } = townBuildingVisit(1793146029630, 10, 1);
    const boxes = returnStairBoxes(plan.stairs[0].layout!, 0).filter(b => b.beam);
    expect(boxes.filter(b => Math.abs(Math.hypot(b.beam!.dx, b.beam!.dz) - 7) < 1e-8)).toHaveLength(4);
    for (const b of boxes) for (const sign of [-1, 1]) {
      const geometry = buildBeamGeometry(b.beam!, sign);
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      expect(bounds.min.x).toBeGreaterThanOrEqual(-b.w / 2 - 1e-6);
      expect(bounds.max.x).toBeLessThanOrEqual(b.w / 2 + 1e-6);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-b.h / 2 - 1e-6);
      expect(bounds.max.y).toBeLessThanOrEqual(b.h / 2 + 1e-6);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-b.d / 2 - 1e-6);
      expect(bounds.max.z).toBeLessThanOrEqual(b.d / 2 + 1e-6);
      const end = new THREE.Vector3(0, Math.hypot(b.beam!.dx, b.beam!.dy, b.beam!.dz) / 2, 0)
        .applyQuaternion(beamRotation(b.beam!, sign));
      expect(end.distanceTo(new THREE.Vector3(b.beam!.dx / 2, b.beam!.dy / 2, b.beam!.dz * sign / 2))).toBeLessThan(1e-10);
      geometry.dispose();
    }
  });

  it('retains the same beams in feet previews and meter site/instancing data', () => {
    const { plan } = townBuildingVisit(1793146029630, 10, 1);
    const canonical = buildBuildingMeshData(plan).floors.flatMap(f => f.boxes).filter(b => b.beam);
    const preview = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 }).boxes.filter(b => b.beam);
    expect(preview.map(b => b.beam)).toEqual(canonical.map(b => b.beam));
    const { parts } = buildBlueprintParts(plan, 3.048, '#aaa');
    const rails = parts.filter(p => p.beam);
    expect(rails).toHaveLength(canonical.length);
    for (const sign of [-1, 1] as const) {
      const batches = buildSiteBoxBatches([{ id: 'home', kind: 'ruin', localX: 0, localZ: 0,
        radius: 10, surfaceY: 0, walled: false, boxWidth: 10, boxDepth: 10, boxHeight: 6,
        doorZSign: sign, parts }] as LoadedChunk['bundle']['sites']);
      const instanced = batches.flatMap(b => b.instances).filter(i => i.beam);
      expect(instanced).toHaveLength(rails.length);
      for (const [i, part] of rails.entries()) {
        expect(part.beam!.dx).toBeCloseTo(canonical[i].beam!.dx * .3048);
        const instance = instanced.find(v => v.sourceId === `home:part:${parts.indexOf(part)}`)!;
        expect(instance.beam).toEqual({ ...part.beam!, dz: part.beam!.dz * -sign });
      }
    }
  });

  it('rejects an invalid beam before creating render geometry', () => {
    expect(() => buildBeamGeometry({ dx: 0, dy: 0, dz: 0, thickness: .1 })).toThrow();
    expect(() => buildBeamGeometry({ dx: 1, dy: 0, dz: 0, thickness: 0 })).toThrow();
  });
});
