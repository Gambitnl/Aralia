import { Canvas } from '@react-three/fiber';
import { DeformableTerrain } from './DeformableTerrain';
import { SimpleControls } from './SimpleControls';

export const DeformableScene = () => {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 50, 50], fov: 50 }}
      className="w-full h-full"
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <DeformableTerrain size={100} segments={64} />
      <SimpleControls />
    </Canvas>
  );
};
