/**
 * @file sceneOrigin.ts
 * Convert between absolute world meters (what the streamer/sampler use) and
 * scene-local meters (what R3F renders). The scene origin is a fixed world point
 * near the player; subtracting it keeps rendered coordinates near 0, avoiding
 * float precision loss and keeping the camera/shadow math simple.
 */
export interface SceneOrigin {
  x: number;
  z: number;
}

export function worldToScene(worldX: number, worldZ: number, origin: SceneOrigin): { x: number; z: number } {
  return { x: worldX - origin.x, z: worldZ - origin.z };
}

export function sceneToWorld(sceneX: number, sceneZ: number, origin: SceneOrigin): { x: number; z: number } {
  return { x: sceneX + origin.x, z: sceneZ + origin.z };
}
