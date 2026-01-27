import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BiomeDNA } from '@/components/DesignPreview/steps/PreviewBiome';
import './BiomeWaterShader';

interface BiomeWaterProps {
  size: number;
  dna: BiomeDNA;
}

export const BiomeWater: React.FC<BiomeWaterProps> = ({ size, dna }) => {
  const materialRef = useRef<any>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.updateTime(state.clock.elapsedTime);
      if (dna.waterColor) materialRef.current.updateWaterColor(dna.waterColor);
      if (dna.waterClarity !== undefined) materialRef.current.updateWaterClarity(dna.waterClarity);
      if (dna.waveIntensity !== undefined) materialRef.current.updateWaveIntensity(dna.waveIntensity);
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <planeGeometry args={[size, size, 32, 32]} />
      <biomeWaterMaterial ref={materialRef} />
    </mesh>
  );
};
