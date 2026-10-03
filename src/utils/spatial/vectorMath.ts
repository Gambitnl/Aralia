/**
 * This file provides 2D and 3D vector arithmetic and distance calculations.
 *
 * In tactical combat and world map exploration, characters move on grids, spells
 * emanate in directional cones/spheres, and physics engines simulate knockbacks
 * and trajectories. Vector math calculates directions, distances, velocities,
 * and linear interpolations cleanly without duplicating math across components.
 *
 * Called by: Battle map 3D scene, AOE calculators, spell targeting, pathfinding.
 * Depends on: Pure mathematical operations.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================
// Data models for 2-dimensional (grid/atlas) and 3-dimensional (world/physics) coordinates.
// ============================================================================

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

// Small epsilon threshold for floating-point comparisons
const EPSILON = 1e-6;

// ============================================================================
// 2D Vector Operations
// ============================================================================
// Vector addition, subtraction, scaling, dot/cross products, and normalization for 2D grids.
// ============================================================================

/**
 * Adds two 2D vectors together.
 */
export function addVector2D(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Subtracts vector b from vector a (a - b).
 */
export function subtractVector2D(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Multiplies a 2D vector by a scalar factor.
 */
export function scaleVector2D(v: Vector2D, scalar: number): Vector2D {
  return { x: v.x * scalar, y: v.y * scalar };
}

/**
 * Calculates the dot product of two 2D vectors.
 */
export function dotProduct2D(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Calculates the 2D scalar cross product (z-component of the 3D cross product).
 * Positive if b is counter-clockwise from a, negative if clockwise.
 */
export function crossProduct2D(a: Vector2D, b: Vector2D): number {
  return a.x * b.y - a.y * b.x;
}

/**
 * Calculates the squared length of a 2D vector (avoids square root for fast comparisons).
 */
export function magnitudeSquared2D(v: Vector2D): number {
  return v.x * v.x + v.y * v.y;
}

/**
 * Calculates the exact Euclidean length (magnitude) of a 2D vector.
 */
export function magnitude2D(v: Vector2D): number {
  return Math.sqrt(magnitudeSquared2D(v));
}

/**
 * Returns a unit vector in the same direction, or {0, 0} if length is near zero.
 */
export function normalizeVector2D(v: Vector2D): Vector2D {
  const len = magnitude2D(v);
  if (len < EPSILON) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / len, y: v.y / len };
}

/**
 * Calculates the Euclidean distance between two 2D points.
 */
export function distance2D(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the Manhattan (grid taxicab) distance between two 2D points: |dx| + |dy|.
 */
export function manhattanDistance2D(a: Vector2D, b: Vector2D): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

/**
 * Calculates the Chebyshev (diagonal grid/king move) distance between two 2D points: max(|dx|, |dy|).
 */
export function chebyshevDistance2D(a: Vector2D, b: Vector2D): number {
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
}

/**
 * Linearly interpolates between vector a and vector b by factor t (0 to 1).
 */
export function lerpVector2D(a: Vector2D, b: Vector2D, t: number): Vector2D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Rotates a 2D vector counter-clockwise around the origin by an angle in radians.
 */
export function rotateVector2D(v: Vector2D, angleRadians: number): Vector2D {
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

/**
 * Clamps each coordinate of a 2D vector between minimum and maximum bounds.
 */
export function clampVector2D(v: Vector2D, min: Vector2D, max: Vector2D): Vector2D {
  return {
    x: Math.max(min.x, Math.min(max.x, v.x)),
    y: Math.max(min.y, Math.min(max.y, v.y)),
  };
}

/**
 * Checks if two 2D vectors are approximately equal within a tolerance epsilon.
 */
export function areVectorsEqual2D(a: Vector2D, b: Vector2D, tolerance: number = EPSILON): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

// ============================================================================
// 3D Vector Operations
// ============================================================================
// Full 3-axis math for 3D world meshes, camera positions, and particle trajectories.
// ============================================================================

/**
 * Adds two 3D vectors together.
 */
export function addVector3D(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Subtracts 3D vector b from vector a (a - b).
 */
export function subtractVector3D(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Multiplies a 3D vector by a scalar value.
 */
export function scaleVector3D(v: Vector3D, scalar: number): Vector3D {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

/**
 * Calculates the dot product of two 3D vectors.
 */
export function dotProduct3D(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Calculates the 3D cross product of two vectors (a × b), yielding a perpendicular vector.
 */
export function crossProduct3D(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Calculates the squared magnitude of a 3D vector.
 */
export function magnitudeSquared3D(v: Vector3D): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

/**
 * Calculates the exact magnitude of a 3D vector.
 */
export function magnitude3D(v: Vector3D): number {
  return Math.sqrt(magnitudeSquared3D(v));
}

/**
 * Returns a normalized 3D unit vector, or {0, 0, 0} if length is near zero.
 */
export function normalizeVector3D(v: Vector3D): Vector3D {
  const len = magnitude3D(v);
  if (len < EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Calculates the Euclidean distance between two 3D points.
 */
export function distance3D(a: Vector3D, b: Vector3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Linearly interpolates between 3D vector a and vector b by factor t (0 to 1).
 */
export function lerpVector3D(a: Vector3D, b: Vector3D, t: number): Vector3D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Checks if two 3D vectors are approximately equal within a tolerance epsilon.
 */
export function areVectorsEqual3D(a: Vector3D, b: Vector3D, tolerance: number = EPSILON): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.z - b.z) <= tolerance
  );
}
