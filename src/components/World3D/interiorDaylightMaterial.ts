/**
 * @file interiorDaylightMaterial.ts
 * @description Materials for live building interiors that take their sky
 * light through the windows (see systems/world3d/interiorDaylight.ts).
 *
 * The rule: the indirect (sky and ground bounce) light of an interior surface
 * is multiplied by its sky factor, as an ambient-occlusion term. Direct lights
 * (sun, hearths, the camera-inside fill) are not touched; the sun reaches the
 * room through the window openings by the shadow map.
 *
 * Two ways to give the factor:
 * - 'attribute': a per-vertex `skyView` attribute baked on the merged
 *   structure geometry, so a floor is bright at the window and dark at the
 *   back wall.
 * - a number: one factor for a whole furnishing, baked at its top center.
 *
 * Both renderers: WebGL patches MeshStandardMaterial's AO step; WebGPU uses
 * MeshStandardNodeMaterial.aoNode, which the node lighting applies to the
 * indirect light only (AONode), the same as the WebGL path.
 */
import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, float } from 'three/tsl';

export type SkyViewSource = 'attribute' | number;

export interface InteriorMaterialLook {
  color: THREE.ColorRepresentation;
  map: THREE.Texture | null;
  emissive: string;
  emissiveIntensity: number;
  skyView: SkyViewSource;
  /** Window glass: see-through, so the room and the street show through it. */
  glass?: boolean;
}

/**
 * Glass opacity. A dark pane by day shows the street through it; a lit pane
 * at night shows the lamplit room, so it reads as nearly opaque light.
 * Clear glass reflects about 8% at normal incidence; the tint of old glass
 * absorbs more, so a daytime pane keeps about a third of its own color.
 */
const GLASS_OPACITY_DAY = 0.35;
const GLASS_OPACITY_LIT = 0.9;

const VERT_DECL = '#include <common>\nattribute float skyView;\nvarying float vSkyView;';
const FRAG_DECL_ATTR = '#include <common>\nvarying float vSkyView;';
const FRAG_DECL_UNIFORM = '#include <common>\nuniform float uSkyView;';

function webglMaterial(look: InteriorMaterialLook): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: look.color,
    map: look.map,
    emissive: look.emissive,
    emissiveIntensity: look.emissiveIntensity,
  });
  const fromAttribute = look.skyView === 'attribute';
  // Kept on userData so a proof rig can compare against the open sky (1).
  const skyUniform = { value: fromAttribute ? 1 : (look.skyView as number) };
  m.userData.skyViewUniform = skyUniform;
  m.onBeforeCompile = (shader) => {
    if (fromAttribute) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', VERT_DECL)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkyView = skyView;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', FRAG_DECL_ATTR);
    } else {
      shader.uniforms.uSkyView = skyUniform;
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', FRAG_DECL_UNIFORM);
    }
    const factor = fromAttribute ? 'vSkyView' : 'uSkyView';
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <aomap_fragment>',
      `#include <aomap_fragment>\n\treflectedLight.indirectDiffuse *= ${factor};\n\treflectedLight.indirectSpecular *= ${factor};`,
    );
  };
  // One program per variant; the uniform value differs per material only.
  m.customProgramCacheKey = () => (fromAttribute ? 'interior-sky-attr' : 'interior-sky-uniform');
  return m;
}

function webgpuMaterial(look: InteriorMaterialLook): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.color = new THREE.Color(look.color);
  m.map = look.map;
  m.emissive = new THREE.Color(look.emissive);
  m.emissiveIntensity = look.emissiveIntensity;
  m.aoNode = look.skyView === 'attribute' ? attribute('skyView', 'float') : float(look.skyView);
  return m;
}

/** Build one interior material for the active renderer. */
export function makeInteriorMaterial(look: InteriorMaterialLook, webgpu: boolean): THREE.Material {
  const m = webgpu ? webgpuMaterial(look) : webglMaterial(look);
  if (look.glass) {
    m.transparent = true;
    m.opacity = look.emissiveIntensity > 0 ? GLASS_OPACITY_LIT : GLASS_OPACITY_DAY;
    m.depthWrite = false;
  }
  return m;
}

/** Quantize a furnishing's factor so materials stay shared (1/64 steps). */
export function quantizeSkyView(f: number): number {
  return Math.round(Math.max(0, Math.min(1, f)) * 64) / 64;
}
