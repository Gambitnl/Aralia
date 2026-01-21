import { useState, useMemo } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { DeformableTerrain } from './DeformableTerrain';
import { SimpleControls } from './SimpleControls';
import { DeformationManager } from './DeformationManager';

export const DeformableScene = () => {
  const manager = useMemo(() => new DeformationManager(), []);
  const [version, setVersion] = useState(0);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    // Left click to raise, Shift+Left click to lower
    const type = event.shiftKey ? 'lower' : 'raise';
    manager.applyDeformation(event.point.x, event.point.z, 15, 4, type);
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
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.1, 0]} 
        onPointerDown={handlePointerDown}
        visible={false} // Invisible interaction plane
      >
        <planeGeometry args={[1000, 1000]} />
      </mesh>
      <SimpleControls />
    </Canvas>
  );
};
