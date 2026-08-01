/**
 * @file proceduralCreatureMesh.ts — Procedural Creature Mesh Generator for Aralia.
 *
 * Wraps skin geometry around an AssembledSkeleton by generating a unified
 * capsule-sweep mesh with automatic skin weights, vertex colors, and
 * countershading. This creates a smooth, organic-looking body surface
 * that follows the bone hierarchy.
 *
 * Capabilities:
 * - Sweeps tapered capsules along each bone segment
 * - Merges all capsules into a single BufferGeometry
 * - Computes skin weights based on inverse-square distance to bone line segments
 * - Applies countershading (darker belly, lighter back) via vertex colors
 * - Binds the mesh to the skeleton for animation
 */

import {
  SkinnedMesh,
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Vector3,
  Material,
  MeshStandardMaterial,
  Color
} from 'three';
import type { AssembledSkeleton } from './skeletonAssembler';
import type { CreatureGenome } from '../genome/creatureGenomeSchema';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

/** Conversion factor: feet to meters (1 ft = 0.3048 m) */
const FT_TO_M = 0.3048;

/** Small epsilon to prevent division by zero in weight calculations */
const WEIGHT_EPSILON = 1e-4;

/** Number of bones per vertex (max 4 for standard skinning) */
const MAX_BONES_PER_VERTEX = 4;

export interface CreatureMeshOptions {
  radialSegments?: number;
  capSegments?: number;
  materialFactory?: (colorHex: string, pattern: string) => Material;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function parseColor(hexColor: string): Color {
  return new Color(hexColor);
}

function hexToRGB(hexColor: string): [number, number, number] {
  const color = parseColor(hexColor);
  return [color.r, color.g, color.b];
}

function closestPointOnSegment(
  point: Vector3,
  lineStart: Vector3,
  lineEnd: Vector3
): { point: Vector3; t: number } {
  const segmentDir = new Vector3().subVectors(lineEnd, lineStart);
  const segmentLengthSq = segmentDir.lengthSq();
  
  if (segmentLengthSq < 1e-8) {
    return { point: lineStart.clone(), t: 0 };
  }
  
  const t = Math.max(0, Math.min(1, 
    new Vector3().subVectors(point, lineStart).dot(segmentDir) / segmentLengthSq
  ));
  
  const closestPoint = new Vector3().copy(lineStart).addScaledVector(segmentDir, t);
  return { point: closestPoint, t };
}

function distanceToSegment(
  point: Vector3,
  lineStart: Vector3,
  lineEnd: Vector3
): number {
  const { point: closest } = closestPointOnSegment(point, lineStart, lineEnd);
  return point.distanceTo(closest);
}

function computeSkinWeight(distance: number): number {
  return 1 / (distance * distance + WEIGHT_EPSILON);
}

function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((acc, val) => acc + val, 0);
  if (sum < 1e-6) {
    return weights.map((_, idx) => (idx === 0 ? 1 : 0));
  }
  return weights.map(w => w / sum);
}

// ============================================================================
// SKIN WEIGHT COMPUTATION
// ============================================================================

function computeSkinWeights(
  positions: number[],
  skeleton: AssembledSkeleton
): { skinIndices: number[]; skinWeights: number[] } {
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];

  for (let i = 0; i < positions.length; i += 3) {
    const vertex = new Vector3(positions[i], positions[i + 1], positions[i + 2]);
    const distances: Array<{ boneIdx: number; distance: number }> = [];

    for (let b = 0; b < skeleton.bones.length; b++) {
      const bone = skeleton.bones[b];
      const startPos = skeleton.bindWorldPos[b];
      
      let endPos = startPos;
      if (bone.children.length > 0) {
        const childBone = bone.children[0];
        const childIdx = skeleton.boneIndex.get(childBone.name);
        if (childIdx !== undefined) {
          endPos = skeleton.bindWorldPos[childIdx];
        }
      }

      const dist = distanceToSegment(vertex, startPos, endPos);
      distances.push({ boneIdx: b, distance: dist });
    }

    distances.sort((a, b) => a.distance - b.distance);
    const closestBones = distances.slice(0, MAX_BONES_PER_VERTEX);
    const weights = closestBones.map(b => computeSkinWeight(b.distance));
    const normalized = normalizeWeights(weights);

    for (let j = 0; j < MAX_BONES_PER_VERTEX; j++) {
      if (j < closestBones.length) {
        skinIndices.push(closestBones[j].boneIdx);
        skinWeights.push(normalized[j]);
      } else {
        skinIndices.push(0);
        skinWeights.push(0);
      }
    }
  }

  return { skinIndices, skinWeights };
}

// ============================================================================
// VERTEX COLOR COMPUTATION
// ============================================================================

function computeVertexColors(
  positions: number[],
  primaryColor: [number, number, number],
  secondaryColor: [number, number, number],
  skeleton: AssembledSkeleton
): number[] {
  const colors: number[] = [];

  for (let i = 0; i < positions.length; i += 3) {
    const vertex = new Vector3(positions[i], positions[i + 1], positions[i + 2]);

    let closestBoneIdx = 0;
    let closestDist = Infinity;

    for (let b = 0; b < skeleton.bones.length; b++) {
      const bonePos = skeleton.bindWorldPos[b];
      const dist = vertex.distanceTo(bonePos);
      if (dist < closestDist) {
        closestDist = dist;
        closestBoneIdx = b;
      }
    }

    const bonePos = skeleton.bindWorldPos[closestBoneIdx];
    const radialDir = new Vector3().subVectors(vertex, bonePos).normalize();
    const isBelly = radialDir.y < -0.1;
    const blendFactor = isBelly ? 1.0 : 0.0;

    const r = primaryColor[0] * (1 - blendFactor) + secondaryColor[0] * blendFactor;
    const g = primaryColor[1] * (1 - blendFactor) + secondaryColor[1] * blendFactor;
    const b = primaryColor[2] * (1 - blendFactor) + secondaryColor[2] * blendFactor;

    colors.push(r, g, b);
  }

  return colors;
}

// ============================================================================
// MATERIAL CREATION
// ============================================================================

function createDefaultMaterial(genome: CreatureGenome): Material {
  return new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.1,
    color: new Color(genome.skin.primaryColor)
  });
}

// ============================================================================
// MAIN MESH GENERATION FUNCTION
// ============================================================================

export function generateCreatureMesh(
  skeleton: AssembledSkeleton,
  genome: CreatureGenome,
  options: CreatureMeshOptions = {}
): SkinnedMesh {
  const radialSegments = options.radialSegments ?? 8;
  const allPositions: number[] = [];
  const allNormals: number[] = [];

  for (let i = 1; i < skeleton.bones.length; i++) {
    const bone = skeleton.bones[i];
    const parentPos = skeleton.bindWorldPos[i - 1] || new Vector3();
    const bonePos = skeleton.bindWorldPos[i];
    
    const len = parentPos.distanceTo(bonePos);
    if (len < 1e-4) continue;
    
    const rStart = 0.15 * FT_TO_M;
    const rEnd = rStart * 0.85;

    const dir = new Vector3().subVectors(bonePos, parentPos).normalize();
    
    for (let r = 0; r <= radialSegments; r++) {
      const angle = (r / radialSegments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const perpendicular = new Vector3(0, 1, 0);
      if (Math.abs(dir.y) > 0.9) perpendicular.set(1, 0, 0);
      const right = new Vector3().crossVectors(dir, perpendicular).normalize();
      const up = new Vector3().crossVectors(right, dir).normalize();
      
      const pStart = parentPos.clone().addScaledVector(right, cos * rStart).addScaledVector(up, sin * rStart);
      const pEnd = bonePos.clone().addScaledVector(right, cos * rEnd).addScaledVector(up, sin * rEnd);
      
      allPositions.push(pStart.x, pStart.y, pStart.z);
      allPositions.push(pEnd.x, pEnd.y, pEnd.z);
      
      const normal = new Vector3().addScaledVector(right, cos).addScaledVector(up, sin).normalize();
      allNormals.push(normal.x, normal.y, normal.z);
      allNormals.push(normal.x, normal.y, normal.z);
    }
  }

  const { skinIndices, skinWeights } = computeSkinWeights(allPositions, skeleton);
  const primaryRGB = hexToRGB(genome.skin.primaryColor);
  const secondaryRGB = hexToRGB(genome.skin.secondaryColor);
  const colors = computeVertexColors(allPositions, primaryRGB, secondaryRGB, skeleton);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(allPositions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(allNormals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4));

  const material = options.materialFactory
    ? options.materialFactory(genome.skin.primaryColor, genome.skin.pattern)
    : createDefaultMaterial(genome);

  const mesh = new SkinnedMesh(geometry, material);
  mesh.bind(skeleton.skeleton);
  
  return mesh;
}
