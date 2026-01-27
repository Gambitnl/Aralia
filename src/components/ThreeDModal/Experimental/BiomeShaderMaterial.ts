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
    // 1. Base Noise Texture
    // We scale the UVs by roughness to make the pattern more chaotic
    float n = noise(vUv * (10.0 + uRoughness * 20.0));
    
    // 2. Disturbance Mixing
    // Where disturbance is high (digging), we show the secondary (dirt/underlayer) color.
    // We smoothstep it to give it a nice edge.
    float dirtFactor = smoothstep(0.2, 0.8, vDisturbance / 5.0); 
    
    // 3. Color Mixing
    // Mix primary and secondary based on dirtFactor + some noise variation
    vec3 finalColor = mix(uPrimaryColor, uSecondaryColor, dirtFactor);
    
    // Add some noise variation to the base color itself so it's not flat
    float colorNoise = noise(vUv * 50.0) * 0.1;
    finalColor += vec3(colorNoise);

    // Simple lighting (fake diffuse)
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
    float diff = max(dot(vNormal, lightDir), 0.2); // 0.2 ambient
    
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
}

// Register it with R3F
extend({ BiomeShaderMaterial });


