import { useState, useMemo } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { DeformableTerrain } from './DeformableTerrain';
import { SimpleControls } from './SimpleControls';
import { DeformationManager } from './DeformationManager';
import { OverlayMesh } from './OverlayMesh';
import { EnvironmentalEffectType } from './types';

export type ToolType = 'mold_earth' | 'create_bonfire' | 'grease' | 'ice' | 'clear';

interface DeformableSceneProps {
  activeTool: ToolType;
}

export const DeformableScene = ({ activeTool }: DeformableSceneProps) => {
  const manager = useMemo(() => new DeformationManager(), []);
  const [version, setVersion] = useState(0);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    const { x, z } = (event as any).point;

    if (activeTool === 'mold_earth') {
      const type = event.shiftKey ? 'lower' : 'raise';
      manager.applyDeformation(x, z, 15, 4, type);
    } else if (activeTool === 'create_bonfire') {
      manager.addOverlay({
        id: `bonfire-${Date.now()}`,
        type: 'fire',
        x,
        z,
        radius: 8,
        intensity: 1.0
      });
    } else if (activeTool === 'grease') {
      manager.addOverlay({
        id: `grease-${Date.now()}`,
        type: 'grease',
        x,
        z,
        radius: 12,
        intensity: 0.8
      });
    } else if (activeTool === 'clear') {
      manager.clear();
    }

    setVersion(v => v + 1);
  };

  return (
    <Canvas
      shadows
      camera={{ position: [0, 80, 80], fov: 50 }}
      className="w-full h-full"
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 100, 50]} intensity={1.5} castShadow />
      <DeformableTerrain
        size={200}
        segments={128}
        manager={manager}
        version={version}
      />

      {/* Environmental Overlays */}
      {manager.getOverlays().map(overlay => (
        <OverlayMesh
          key={overlay.id}
          overlay={overlay}
          manager={manager}
          version={version}
        />
      ))}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.1, 0]}
        onPointerDown={handlePointerDown}
        visible={false}
      >
        <planeGeometry args={[1000, 1000]} />
      </mesh>
      <SimpleControls />
    </Canvas>
  );
};
