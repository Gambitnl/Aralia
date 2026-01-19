import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh, Object3D } from 'three';
import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface CameraRigProps {
  playerRef: RefObject<Object3D | Mesh | null>;
  maxDistance: number;
  minDistance?: number;
  focusTarget?: { x: number; y: number; z: number } | null;
  focusRequestId?: number;
  focusDistance?: number;
  lockOnFocus?: boolean;
}

const CameraRig = ({
  playerRef,
  maxDistance,
  minDistance = 15,
  focusTarget,
  focusRequestId,
  focusDistance = 180,
  lockOnFocus = false,
}: CameraRigProps) => {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const lastTargetRef = useRef(new Vector3());
  const lastFocusRequestRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!focusTarget) {
      lastTargetRef.current.set(0, 0, 0);
    }
  }, [focusTarget]);

  useEffect(() => {
    if (!focusTarget || focusRequestId === undefined) return;
    const controls = controlsRef.current;
    if (!controls) return;
    if (lastFocusRequestRef.current === focusRequestId) return;
    lastFocusRequestRef.current = focusRequestId;

    // Snap the camera once per focus request so it doesn't fight the user's
    // orbit controls every frame.
    const target = new Vector3(focusTarget.x, focusTarget.y, focusTarget.z);
    const offset = camera.position.clone().sub(controls.target);
    const distance = Math.max(20, focusDistance);
    if (offset.lengthSq() === 0) {
      offset.set(0, distance * 0.35, distance);
    }
    offset.normalize().multiplyScalar(distance);
    camera.position.copy(target).add(offset);
    controls.target.copy(target);
    lastTargetRef.current.copy(target);
    controls.update();
  }, [camera, focusDistance, focusRequestId, focusTarget]);

  useFrame(() => {
    const controls = controlsRef.current;
    const player = playerRef.current;
    if (!controls || !player) return;

    // Lock-on mode keeps the camera anchored to a tree test target; otherwise
    // we follow the player and preserve the orbit offset.
    if (focusTarget && lockOnFocus) {
      controls.target.set(focusTarget.x, focusTarget.y, focusTarget.z);
      lastTargetRef.current.copy(controls.target);
      controls.update();
      return;
    }

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
