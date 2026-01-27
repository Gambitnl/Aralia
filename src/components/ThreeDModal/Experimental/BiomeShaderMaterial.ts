// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:42:18
 * Dependents: DeformableTerrain.tsx
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import { extend } from '@react-three/fiber';

// ============================================================================
// VERTEX SHADER
// ============================================================================
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vDisturbance;
  varying vec3 vNormal;

  // Custom attribute we will pass from the CPU
  attribute float aDisturbance;

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    vDisturbance = aDisturbance;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ============================================================================
// FRAGMENT SHADER
// ============================================================================
const fragmentShader = `
  uniform vec3 uPrimaryColor;
  uniform vec3 uSecondaryColor;
  uniform float uRoughness;
  uniform float uTime;
  // TODO: Add support for noise texture maps for more organic biome transitions

  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vDisturbance;
  varying vec3 vNormal;

  // Simple pseudo-random noise
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  // 2D Noise
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
  }

  void main() {
    // 1. TRI-PLANAR MAPPING
    // Calculate blend weights based on normal
    vec3 blend = abs(vNormal);
    // Tighten the blend to reduce blur on corners
    blend = pow(blend, vec3(4.0));
    blend /= dot(blend, vec3(1.0));

    // Sample textures
    // Top (Y-axis) -> Grass
    vec3 texTop = texture2D(uTexTop, vPosition.xz * uTextureScale).rgb;
    
    // Sides (X/Z-axis) -> Dirt
    vec3 texSideX = texture2D(uTexSide, vPosition.yz * uTextureScale).rgb;
    vec3 texSideZ = texture2D(uTexSide, vPosition.xy * uTextureScale).rgb;
    
    // Combine side textures
    vec3 texSide = texSideX * blend.x + texSideZ * blend.z;

    // 2. MIXING LOGIC
    // Base mix is determined by the normal (Y-up is top, others are side)
    // But we also have vDisturbance which forces "dirt" (side texture)
    
    // Determine how much "Top" texture to show. 
    // Usually it's just blend.y, but disturbance eats away at it.
    float topFactor = blend.y;
    
    // Disturbance masking
    float dirtiness = smoothstep(0.2, 0.8, vDisturbance / 5.0);
    topFactor = mix(topFactor, 0.0, dirtiness); // If disturbed, reduce top factor

    // Final texture Color
    // We mix the RAW texture samples based on the calculated topFactor
    // However, since we blended X/Z into 'texSide' already, we need to blend Top vs Side
    vec3 baseTexture = mix(texSide, texTop, topFactor);

    // 3. TINTING (DNA)
    // We multiply the texture by the DNA colors to allow biome variation
    // Primary (Green) tints the Top, Secondary (Brown) tints the Side
    vec3 tintColor = mix(uSecondaryColor, uPrimaryColor, topFactor);
    
    // Blend mode: Multiply (Texture * DNA Color)
    // We brighten the texture slightly so multiply doesn't get too dark
    vec3 finalColor = baseTexture * tintColor * 1.5;

    // Add noise variation
    float n = noise(vUv * (10.0 + uRoughness * 20.0));
    finalColor += vec3(n * 0.05);

    // Simple lighting
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
    float diff = max(dot(vNormal, lightDir), 0.2); 
    
    gl_FragColor = vec4(finalColor * diff, 1.0);
  }
`;

export class BiomeShaderMaterial extends ((THREE as any)['ShaderMaterial']) {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uPrimaryColor: { value: new THREE.Color('#2d5a27') },
        uSecondaryColor: { value: new THREE.Color('#8b5a2b') },
        uRoughness: { value: 0.5 },
        uTime: { value: 0 },
        uTexTop: { value: null },
        uTexSide: { value: null },
        uTextureScale: { value: 0.2 },
      },
    });
  }

  // Helper methods to update uniforms
  updatePrimaryColor(val: string) {
    (this as any).uniforms.uPrimaryColor.value.set(val);
  }

  updateSecondaryColor(val: string) {
    (this as any).uniforms.uSecondaryColor.value.set(val);
  }

  updateRoughness(val: number) {
    (this as any).uniforms.uRoughness.value = val;
  }
  
  updateTextures(top: THREE.Texture, side: THREE.Texture) {
    (this as any).uniforms.uTexTop.value = top;
    (this as any).uniforms.uTexSide.value = side;
    top.wrapS = top.wrapT = THREE.RepeatWrapping;
    side.wrapS = side.wrapT = THREE.RepeatWrapping;
  }
}

// Register it with R3F
extend({ BiomeShaderMaterial });


