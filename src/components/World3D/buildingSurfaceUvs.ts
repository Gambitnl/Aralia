/** Physical material coordinates shared by the meter-based town and foot-based lab.
 * Wall courses stay aligned across window segments; roof courses follow each
 * slope instead of stretching a single overhead image over the entire roof.
 */
import * as THREE from 'three';

export function applyWallSurfaceUvs(
  geometry: THREE.BufferGeometry,
  offset: { x: number; y: number; z: number },
  metersPerUnit = 1,
): THREE.BufferGeometry {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = (p.getX(i) + offset.x) * metersPerUnit;
    const y = (p.getY(i) + offset.y) * metersPerUnit;
    const z = (p.getZ(i) + offset.z) * metersPerUnit;
    uv[i * 2] = (Math.abs(n.getX(i)) > 0.5 ? z : x) / 2;
    uv[i * 2 + 1] = (Math.abs(n.getY(i)) > 0.5 ? z : y) / 2;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

export function applyRoofSurfaceUvs(geometry: THREE.BufferGeometry, metersPerUnit = 1): THREE.BufferGeometry {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * metersPerUnit, y = p.getY(i) * metersPerUnit, z = p.getZ(i) * metersPerUnit;
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    const horizontal = Math.hypot(nx, nz);
    // Tangent runs along the eave; the second axis runs down the actual slope.
    // Flat caps retain an ordinary overhead projection.
    uv[i * 2] = horizontal > 0.01 ? (nz * x - nx * z) / horizontal / 3 : x / 3;
    uv[i * 2 + 1] = horizontal > 0.01 ? ((nx * x + nz * z) * ny / horizontal - horizontal * y) / 3 : z / 3;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}
