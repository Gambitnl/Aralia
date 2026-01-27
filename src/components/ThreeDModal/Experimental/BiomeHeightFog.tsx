import * as THREE from 'three';
import React, { useMemo } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import { BiomeDNA } from '@/components/DesignPreview/steps/PreviewBiome';

// ============================================================================
// SHADER DEFINITION
// ============================================================================

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uDensity;
  uniform float uHeight;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // Simple noise for mist movement
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // Height gradient: 1.0 at bottom (y=0), 0.0 at top (y=uHeight)
    // We use vWorldPosition.y relative to the mesh position
    
    // We assume the mesh is placed at y=0 and scales up to uHeight
    float heightFactor = 1.0 - smoothstep(0.0, uHeight, vWorldPosition.y);
    
    // Noise movement
    float mist = noise(vUv * 5.0 + vec2(uTime * 0.1, 0.0));
    
    // Final alpha combines height gradient, density, and noise
    float alpha = heightFactor * uDensity * (0.5 + 0.5 * mist);

    gl_FragColor = vec4(uColor, alpha);
  }
`;

class BiomeFogMaterial extends (THREE as any)['ShaderMaterial'] {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false, // Don't block depth buffer, allow objects to render behind/in it
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color('#ffffff') },
        uDensity: { value: 0.5 },
        uHeight: { value: 10.0 },
        uTime: { value: 0 },
      },
    });
  }
}

extend({ BiomeFogMaterial });

// ============================================================================
// COMPONENT
// ============================================================================

interface BiomeHeightFogProps {
  dna: BiomeDNA;
  size: number;
}

export const BiomeHeightFog: React.FC<BiomeHeightFogProps> = ({ dna, size }) => {
  const materialRef = React.useRef<any>(null);
  
  // Update uniforms
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uColor.value.set(dna.secondaryColor); // Use secondary color for fog
      materialRef.current.uniforms.uDensity.value = (dna.fogDensity || 0.02) * 5.0; // Scale up for visual impact
      materialRef.current.uniforms.uHeight.value = dna.fogHeight || 10.0;
    }
  });

  return (
    <mesh position={[0, 0, 0]}>
      {/* Cylinder simulating a volumetric area */}
      <cylinderGeometry args={[size, size, (dna.fogHeight || 10), 32, 1, true]} />
      {/* Shift geometry up so pivot is at bottom */}
      <primitive object={new THREE.Matrix4().makeTranslation(0, (dna.fogHeight || 10) / 2, 0)} attach="applyMatrix" />
      
      {/* @ts-ignore */}
      <biomeFogMaterial ref={materialRef} />
    </mesh>
  );
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      biomeFogMaterial: any;
    }
  }
}
