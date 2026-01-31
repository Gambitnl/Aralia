import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import GridCellOutline from './GridCellOutline';

interface EnemyUnitProps {
  position: { x: number; z: number };
  heightSampler: (x: number, z: number) => number;
  showOutline: boolean;
  bodyColor?: number;
  outlineColor?: number;
}

const EnemyUnit = ({
  position,
  heightSampler,
  showOutline,
  bodyColor = 0xef4444,
  outlineColor = 0xf97316,
}: EnemyUnitProps) => {
  const enemyRef = useRef<Mesh>(null);
  const height = useMemo(() => heightSampler(position.x, position.z), [heightSampler, position.x, position.z]);

  return (
    <>
              <mesh ref={enemyRef} position={[position.x, height + 3, position.z]} castShadow>
                <sphereGeometry args={[4, 16, 16]} />
                <meshStandardMaterial color={bodyColor} roughness={0.45} map={null} />
              </mesh>      <GridCellOutline
        playerRef={enemyRef}
        gridSize={5}
        heightSampler={heightSampler}
        color={outlineColor}
        visible={showOutline}
      />
    </>
  );
};

export default EnemyUnit;
