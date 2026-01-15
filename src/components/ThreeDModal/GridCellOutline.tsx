import type { RefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BufferGeometry, LineSegments, Material, Object3D } from 'three';
import { BufferAttribute, BufferGeometry as ThreeBufferGeometry, Color, LineBasicMaterial } from 'three';

interface GridCellOutlineProps {
  playerRef: RefObject<Object3D>;
  gridSize: number;
  heightSampler: (x: number, z: number) => number;
  color?: number;
  offset?: number;
  visible?: boolean;
}

const buildSquareGeometry = (size: number): BufferGeometry => {
  const half = size / 2;
  const vertices = new Float32Array([
    -half, 0, -half, half, 0, -half,
    half, 0, -half, half, 0, half,
    half, 0, half, -half, 0, half,
    -half, 0, half, -half, 0, -half,
  ]);
  const lineGeometry = new ThreeBufferGeometry();
  lineGeometry.setAttribute('position', new BufferAttribute(vertices, 3));
  return lineGeometry;
};

const GridCellOutline = ({
  playerRef,
  gridSize,
  heightSampler,
  color = 0x38bdf8,
  offset = 0.15,
  visible = true,
}: GridCellOutlineProps) => {
  const lineRef = useRef<LineSegments>(null);

  const geometry = useMemo(() => buildSquareGeometry(gridSize), [gridSize]);
  const material = useMemo<Material>(() => new LineBasicMaterial({ color: new Color(color) }), [color]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(() => {
    const line = lineRef.current;
    const player = playerRef.current;
    if (!line || !player) return;

    const snapX = (Math.floor(player.position.x / gridSize) + 0.5) * gridSize;
    const snapZ = (Math.floor(player.position.z / gridSize) + 0.5) * gridSize;
    const height = heightSampler(snapX, snapZ) + offset;

    line.position.set(snapX, height, snapZ);
  });

  if (!visible) return null;

  return (
    <lineSegments ref={lineRef} geometry={geometry} material={material} />
  );
};

export default GridCellOutline;
