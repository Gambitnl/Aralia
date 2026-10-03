/** Shared authored surface images for streamed buildings, without an API dependency. */
import * as THREE from 'three';

const textures = new Map<string, THREE.Texture>();

/** Keep seeded hue variation, while letting the actual construction read correctly:
 * lime plaster is pale, thatch is straw, and clay is fired earth. The earlier
 * generic brown palette made all three look like dark painted timber.
 */
export function houseSurfaceColor(surface: 'wall' | 'roof', key: string, color: string): THREE.Color {
  const tint = new THREE.Color(color);
  if (surface === 'wall') {
    if (key.includes('/plaster/') || key.includes('/daub/')) return tint.lerp(new THREE.Color('#eadcbd'), 0.72);
    if (key.includes('/stone/')) return tint.lerp(new THREE.Color('#b6b0a1'), 0.35);
    if (key.includes('/brick/')) return tint.lerp(new THREE.Color('#bb8766'), 0.4);
    return tint.lerp(new THREE.Color('#ad9473'), 0.2);
  }
  if (key.includes('/thatch/')) return tint.lerp(new THREE.Color('#c6b176'), 0.8);
  if (key.includes('/tile/')) return tint.lerp(new THREE.Color('#b97754'), 0.5);
  if (key.includes('/slate/')) return tint.lerp(new THREE.Color('#7d8790'), 0.45);
  if (key.includes('/sod/')) return tint.lerp(new THREE.Color('#657449'), 0.75);
  return tint;
}
export function townSurfaceTexture(surface: 'wall' | 'roof' | 'stone', assetKey = ''): THREE.Texture {
  const file = assetKey.includes('/thatch/') ? 'reed-thatch.png'
    : surface === 'wall' && assetKey.includes('/wood/') ? 'weatherboard.png'
    : surface === 'wall' && assetKey.includes('/brick/') ? 'brickwork.png'
    : surface === 'roof' && assetKey.includes('/tile/') ? 'clay-tiles.png'
    : surface === 'stone' || assetKey.includes('/stone/') ? 'limestone.png'
    : surface === 'wall' ? 'lime-plaster.png' : 'roof-shingles.png';
  let texture = textures.get(file);
  if (!texture) {
    texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/town-materials/${file}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    textures.set(file, texture);
  }
  return texture;
}
