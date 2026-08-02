/**
 * @file creatureMaterials.ts — AAA Material & Shading System for Procedural Creatures.
 *
 * Provides high-fidelity physically based rendering (PBR) and stylized toon shading
 * for procedural creatures in Aralia.
 *
 * Fix: When vertexColors: true is enabled, material color MUST be white (#ffffff)
 * so vertex colors are not multiplied down to pure black.
 */

import {
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  ShaderMaterial,
  Color,
  CanvasTexture,
  RepeatWrapping,
  Vector3,
  Vector2,
  DoubleSide,
  BackSide,
} from 'three';
import type { SkinConfig } from '../genome/creatureGenomeSchema';

// ============================================================================
// PROCEDURAL TEXTURE GENERATOR
// ============================================================================

const textureCache = new Map<string, CanvasTexture>();

export function getProceduralNormalMap(pattern: string): CanvasTexture {
  if (textureCache.has(pattern)) {
    return textureCache.get(pattern)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new CanvasTexture(canvas);
  }

  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, 256, 256);

  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      let height = 0;

      if (pattern === 'scaly') {
        const sx = (x % 16) - 8;
        const sy = (y % 16) - 8;
        const dist = Math.sqrt(sx * sx + sy * sy);
        height = Math.max(0, 1 - dist / 8);
      } else if (pattern === 'chitinous') {
        const rx = Math.sin((x / 256) * Math.PI * 8);
        const ry = Math.cos((y / 256) * Math.PI * 8);
        height = Math.abs(rx * ry);
      } else if (pattern === 'striped' || pattern === 'spotted') {
        const n1 = Math.sin(x * 0.1) * Math.cos(y * 0.1);
        height = n1 * 0.5;
      } else {
        height = (Math.random() - 0.5) * 0.2;
      }

      const nx = Math.floor(128 + height * 64);
      const ny = Math.floor(128 + height * 64);
      const nz = 255;

      const idx = (y * 256 + x) * 4;
      data[idx] = Math.max(0, Math.min(255, nx));
      data[idx + 1] = Math.max(0, Math.min(255, ny));
      data[idx + 2] = nz;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;

  textureCache.set(pattern, texture);
  return texture;
}

// ============================================================================
// AAA MATERIAL CREATION
// ============================================================================

export interface CreatureMaterialBundle {
  bodyMaterial: MeshPhysicalMaterial | MeshStandardMaterial;
  outlineMaterial: ShaderMaterial | MeshStandardMaterial;
  eyeMaterial: MeshStandardMaterial;
  ringMaterial: MeshStandardMaterial;
}

export function createAAACreatureMaterials(
  skin: SkinConfig,
  style: 'pbr' | 'toon' | 'bioluminescent' = 'pbr'
): CreatureMaterialBundle {
  const secondaryColor = new Color(skin.secondaryColor);
  const normalMap = getProceduralNormalMap(skin.pattern);

  let bodyMaterial: MeshPhysicalMaterial | MeshStandardMaterial;

  if (style === 'pbr') {
    bodyMaterial = new MeshPhysicalMaterial({
      color: new Color('#ffffff'), // White base so vertex colors render at 100% brightness
      vertexColors: true,
      roughness: skin.pattern === 'chitinous' ? 0.3 : 0.6,
      metalness: skin.pattern === 'chitinous' ? 0.3 : 0.1,
      normalMap: normalMap,
      normalScale: new Vector2(0.4, 0.4),
      clearcoat: skin.pattern === 'chitinous' ? 0.6 : 0.15,
      clearcoatRoughness: 0.2,
      sheen: 0.4,
      sheenColor: secondaryColor,
    });
  } else if (style === 'bioluminescent') {
    bodyMaterial = new MeshStandardMaterial({
      color: new Color('#ffffff'),
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.2,
      emissive: secondaryColor,
      emissiveIntensity: 0.3,
    });
  } else {
    // Toon material
    bodyMaterial = new MeshStandardMaterial({
      color: new Color('#ffffff'),
      vertexColors: true,
      roughness: 0.7,
      metalness: 0.0,
      normalMap: normalMap,
      normalScale: new Vector2(0.3, 0.3),
    });
  }

  const outlineMat = new MeshStandardMaterial({
    color: new Color('#05070a'),
    side: BackSide,
    roughness: 1.0,
    metalness: 0.0,
  });

  const eyeMaterial = new MeshStandardMaterial({
    color: new Color('#ffcc00'),
    emissive: new Color('#ff6600'),
    emissiveIntensity: 2.5,
    roughness: 0.1,
    metalness: 0.9,
  });

  const ringMaterial = new MeshStandardMaterial({
    color: secondaryColor,
    emissive: secondaryColor,
    emissiveIntensity: 2.0,
    roughness: 0.2,
    metalness: 0.8,
    side: DoubleSide,
  });

  return {
    bodyMaterial,
    outlineMaterial: outlineMat,
    eyeMaterial,
    ringMaterial,
  };
}
