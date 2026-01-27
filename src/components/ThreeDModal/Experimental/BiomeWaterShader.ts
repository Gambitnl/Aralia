import * as THREE from 'three';
import { extend } from '@react-three/fiber';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uWaveIntensity;

  void main() {
    vUv = uv;
    vPosition = position;
    
    // Simple wave animation
    float wave = sin(position.x * 0.2 + uTime) * cos(position.y * 0.2 + uTime) * uWaveIntensity;
    vec3 newPosition = position;
    newPosition.z += wave;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform vec3 uWaterColor;
  uniform float uWaterClarity;
  uniform float uTime;

  void main() {
    // Simple transparency gradient based on clarity
    float alpha = 1.0 - uWaterClarity;
    
    // Add some shimmer
    float shimmer = sin(vUv.x * 50.0 + uTime * 2.0) * cos(vUv.y * 50.0 + uTime * 2.0) * 0.05;
    vec3 finalColor = uWaterColor + shimmer;

    gl_FragColor = vec4(finalColor, alpha + shimmer);
  }
`;

export class BiomeWaterMaterial extends ((THREE as any)['ShaderMaterial']) {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uWaterColor: { value: new THREE.Color('#1e3a8a') },
        uWaterClarity: { value: 0.6 },
        uWaveIntensity: { value: 0.3 },
        uTime: { value: 0 },
      },
    });
  }

  updateWaterColor(val: string) {
    (this as any).uniforms.uWaterColor.value.set(val);
  }

  updateWaterClarity(val: number) {
    (this as any).uniforms.uWaterClarity.value = val;
  }

  updateWaveIntensity(val: number) {
    (this as any).uniforms.uWaveIntensity.value = val;
  }

  updateTime(val: number) {
    (this as any).uniforms.uTime.value = val;
  }
}

extend({ BiomeWaterMaterial });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      biomeWaterMaterial: any;
    }
  }
}
