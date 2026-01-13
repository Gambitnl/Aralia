import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Object3D } from 'three';
import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface CameraRigProps {
  playerRef: RefObject<Object3D>;
  maxDistance: number;
  minDistance?: number;
}

const CameraRig = ({ playerRef, maxDistance, minDistance = 15 }: CameraRigProps) => {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const lastTargetRef = useRef(new Vector3());

  useEffect(() => {
    if (!gl.domElement) return undefined;
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.maxPolarAngle = Math.PI * 0.48;
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, maxDistance, minDistance]);

  useFrame(() => {
    const controls = controlsRef.current;
    const player = playerRef.current;
    if (!controls || !player) return;

    if (lastTargetRef.current.lengthSq() === 0) {
      lastTargetRef.current.copy(player.position);
    }

    const target = player.position;
    const delta = target.clone().sub(lastTargetRef.current);
    if (delta.lengthSq() > 0) {
      camera.position.add(delta);
    }
    controls.target.copy(target);
    lastTargetRef.current.copy(target);
    controls.update();
  });

  return null;
};

export default CameraRig;
