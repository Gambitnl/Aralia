import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { setPerfSceneDiagnostics } from '@/devtools/perf/perfRegistry';
import type { SceneFamilyDiagnostics } from '@/devtools/perf/perfSession';

/** Inventory mounted geometry after React commits. These are potential costs,
 * not per-part GPU timings; actual submitted work remains in the renderer counters. */
export function BuildingSceneDiagnostics({ revision, selection }: { revision: unknown; selection: string | null }) {
  const scene = useThree(state => state.scene);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const families = new Map<string, SceneFamilyDiagnostics>();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const family = object.name || 'Other scene meshes';
        const row = families.get(family) ?? { family, meshes: 0, instances: 0, triangles: 0, shadowMeshes: 0, shadowTriangles: 0 };
        const instances = object instanceof THREE.InstancedMesh ? object.count : 1;
        const triangles = (object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3 * instances;
        row.meshes++; row.instances += instances; row.triangles += triangles;
        if (object.castShadow) { row.shadowMeshes++; row.shadowTriangles += triangles; }
        families.set(family, row);
        geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      });
      const rows = [...families.values()].sort((a, b) => b.triangles - a.triangles);
      const totals = rows.reduce((sum, row) => ({ meshes: sum.meshes + row.meshes, instances: sum.instances + row.instances, triangles: sum.triangles + row.triangles, shadowMeshes: sum.shadowMeshes + row.shadowMeshes, shadowTriangles: sum.shadowTriangles + row.shadowTriangles }), { meshes: 0, instances: 0, triangles: 0, shadowMeshes: 0, shadowTriangles: 0 });
      setPerfSceneDiagnostics('building3d', { ...totals, geometries: geometries.size, materials: materials.size, families: rows });
    }, 0);
    return () => { window.clearTimeout(timer); setPerfSceneDiagnostics('building3d', null); };
  }, [scene, revision, selection]);
  return null;
}
