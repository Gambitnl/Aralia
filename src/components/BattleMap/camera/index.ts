/**
 * @file camera/index.ts
 * Barrel export for the 3D camera system.
 */
export { default as CameraController } from './CameraController';
// Per-turn orbit refocus math (9A). Exported so the turn/camera contract is
// discoverable from the barrel rather than only from inside the controller.
export {
  TURN_FOCUS_LERP_SECONDS,
  easeTurnOrbit,
  focusPointForTile,
  lerpOrbitPoint,
  orbitDestinationForFocus,
  turnOrbitProgress,
  type OrbitPoint,
} from './turnOrbitFocus';
