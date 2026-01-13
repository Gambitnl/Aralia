import type { RefObject } from 'react';
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh } from 'three';
import { Vector3 } from 'three';
import { useKeyInput } from './useKeyInput';

interface PlayerControllerProps {
  playerRef: RefObject<Mesh>;
  speedFeetPerRound: number;
  tileHalfSize: number;
  heightSampler: (x: number, z: number) => number;
  heightOffset?: number;
  onPositionChange?: (position: { x: number; y: number; z: number }) => void;
  onSpeedChange?: (speedFeetPerRound: number) => void;
}

const UP = new Vector3(0, 1, 0);

const PlayerController = ({
  playerRef,
  speedFeetPerRound,
  tileHalfSize,
  heightSampler,
  heightOffset = 3,
  onPositionChange,
  onSpeedChange,
}: PlayerControllerProps) => {
  const keysRef = useKeyInput();
  const { camera } = useThree();
  const lastNotifyRef = useRef(0);
  const lastSpeedNotifyRef = useRef(0);
  const lastSpeedRef = useRef(0);

  useFrame((state, delta) => {
    const player = playerRef.current;
    if (!player) return;

    const forward = new Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new Vector3().crossVectors(forward, UP).normalize();
    const direction = new Vector3();

    const keys = keysRef.current;
    if (keys.has('KeyW')) direction.add(forward);
    if (keys.has('KeyS')) direction.sub(forward);
    if (keys.has('KeyD')) direction.add(right);
    if (keys.has('KeyA')) direction.sub(right);

    let currentSpeedPerRound = 0;

    if (direction.lengthSq() > 0) {
      direction.normalize();
      const dashMultiplier = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2 : 1;
      const speedPerSecond = (speedFeetPerRound || 30) / 6;
      const moveDistance = speedPerSecond * dashMultiplier * delta;
      currentSpeedPerRound = speedPerSecond * dashMultiplier * 6;

      player.position.addScaledVector(direction, moveDistance);
      player.position.x = Math.min(tileHalfSize, Math.max(-tileHalfSize, player.position.x));
      player.position.z = Math.min(tileHalfSize, Math.max(-tileHalfSize, player.position.z));
      player.rotation.y = Math.atan2(direction.x, direction.z);
    }

    player.position.y = heightSampler(player.position.x, player.position.z) + heightOffset;

    if (onPositionChange && state.clock.elapsedTime - lastNotifyRef.current > 0.25) {
      lastNotifyRef.current = state.clock.elapsedTime;
      onPositionChange({
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      });
    }

    if (onSpeedChange && state.clock.elapsedTime - lastSpeedNotifyRef.current > 0.1) {
      if (currentSpeedPerRound !== lastSpeedRef.current) {
        lastSpeedRef.current = currentSpeedPerRound;
        onSpeedChange(currentSpeedPerRound);
      }
      lastSpeedNotifyRef.current = state.clock.elapsedTime;
    }
  });

  return null;
};

export default PlayerController;
