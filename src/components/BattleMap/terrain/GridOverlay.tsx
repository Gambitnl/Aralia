/**
 * @file GridOverlay.tsx
 * Transparent grid overlay that appears on the terrain during movement mode.
 *
 * Uses a custom ShaderMaterial with world-space UV calculations to draw:
 * - Faint grid lines at tile boundaries
 * - Green/blue fill on valid move tiles (30% opacity)
 * - Bright highlight on active path tiles
 * - Darkened fill on tiles that block movement
 *
 * The overlay fades in/out with a 200ms transition when actionMode changes.
 *
 * Research references:
 * - World-space grid shader: https://threejs-journey.com/lessons/shader-patterns
 * - GLSL mod() for repeating patterns: standard technique
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Grid Overlay" section
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData, BattleMapTile } from '../../../types/combat';
import { makeTerrainHeightSampler } from './TerrainMesh';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const GRID_LINE_WIDTH = 0.02;
const OVERLAY_HEIGHT_OFFSET = 0.02; // Slight offset above terrain to prevent z-fighting

// ---------------------------------------------------------------------------
// Shader code
// ---------------------------------------------------------------------------

const gridVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const gridFragmentShader = /* glsl */ `
  uniform float uTileSize;
  uniform float uLineWidth;
  uniform float uOpacity;
  uniform float uMapWidth;
  uniform float uMapHeight;
  uniform sampler2D uTileStateMap; // R=validMove, G=activePath, B=blocksMovement

  varying vec3 vWorldPosition;

  void main() {
    // Tile coordinates
    float tileX = vWorldPosition.x / uTileSize;
    float tileZ = vWorldPosition.z / uTileSize;

    // Discard if outside map bounds
    if (tileX < 0.0 || tileX >= uMapWidth || tileZ < 0.0 || tileZ >= uMapHeight) {
      discard;
    }

    // Fractional position within tile
    float fracX = fract(tileX);
    float fracZ = fract(tileZ);

    // Grid lines at tile edges
    float lineX = step(fracX, uLineWidth) + step(1.0 - uLineWidth, fracX);
    float lineZ = step(fracZ, uLineWidth) + step(1.0 - uLineWidth, fracZ);
    float gridLine = min(1.0, lineX + lineZ);

    // Sample tile state from data texture
    // UV maps tile integer coords to texture pixels
    vec2 tileUV = vec2(
      (floor(tileX) + 0.5) / uMapWidth,
      (floor(tileZ) + 0.5) / uMapHeight
    );
    vec4 tileState = texture2D(uTileStateMap, tileUV);

    float isValidMove = tileState.r;
    float isActivePath = tileState.g;
    float isBlocked = tileState.b;

    // Base color: nearly invisible grid lines
    vec3 color = vec3(0.5, 0.6, 0.7); // Neutral blue-gray for grid lines
    float alpha = gridLine * 0.12;

    // Valid move highlight (green-blue)
    if (isValidMove > 0.5) {
      color = vec3(0.13, 0.67, 0.27); // Green
      alpha = max(alpha, 0.3);
      // Brighter grid lines on valid tiles
      alpha = max(alpha, gridLine * 0.6);
    }

    // Active path highlight (bright blue)
    if (isActivePath > 0.5) {
      color = vec3(0.27, 0.53, 1.0); // Bright blue
      alpha = max(alpha, 0.45);
      alpha = max(alpha, gridLine * 0.8);
    }

    // Blocked tiles (darkened)
    if (isBlocked > 0.5) {
      color = vec3(0.15, 0.1, 0.1);
      alpha = max(alpha, 0.2);
    }

    // Apply global opacity (for fade in/out transition)
    alpha *= uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GridOverlayProps {
  mapData: BattleMapData;
  validMoves: Set<string>;
  activePath: { id: string }[];
  actionMode: 'move' | 'ability' | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GridOverlay: React.FC<GridOverlayProps> = ({
  mapData,
  validMoves,
  activePath,
  actionMode,
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const targetOpacity = useRef(0);

  const { width, height } = mapData.dimensions;

  // Grid visible only during movement mode, and faintly during ability targeting
  targetOpacity.current = actionMode === 'move' ? 1.0 : actionMode === 'ability' ? 0.4 : 0.0;

  // Active path set
  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach(p => set.add(p.id));
    return set;
  }, [activePath]);

  // Generate tile state data texture (updated when validMoves/activePath change)
  const tileStateTexture = useMemo(() => {
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const tileId = `${x}-${y}`;
        const tile = mapData.tiles.get(tileId);

        data[idx] = validMoves.has(tileId) ? 255 : 0;       // R: valid move
        data[idx + 1] = activePathSet.has(tileId) ? 255 : 0; // G: active path
        data[idx + 2] = tile?.blocksMovement ? 255 : 0;       // B: blocks movement
        data[idx + 3] = 255;                                   // A: unused
      }
    }

    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, [mapData, validMoves, activePathSet, width, height]);

  // Shader material uniforms
  const uniforms = useMemo(() => ({
    uTileSize: { value: TILE_SIZE },
    uLineWidth: { value: GRID_LINE_WIDTH },
    uOpacity: { value: 0.0 },
    uMapWidth: { value: width },
    uMapHeight: { value: height },
    uTileStateMap: { value: tileStateTexture },
  }), [width, height, tileStateTexture]);

  // Update tile state texture when it changes
  useFrame((_state, delta) => {
    if (!materialRef.current) return;

    // Update texture reference
    materialRef.current.uniforms.uTileStateMap.value = tileStateTexture;

    // Smooth fade in/out (200ms transition → ~5 frames at 60fps)
    const current = materialRef.current.uniforms.uOpacity.value as number;
    const target = targetOpacity.current;
    const speed = 5.0; // ~200ms transition at 60fps
    const newOpacity = THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));

    materialRef.current.uniforms.uOpacity.value = newOpacity;

    // Skip rendering when fully transparent
    materialRef.current.visible = newOpacity > 0.01;
  });

  // Generate overlay geometry — terrain-conforming mesh (gap #30).
  // The original 1×1-segment flat plane at y=0.02 was silently BURIED under
  // elevated tiles (move/path highlights vanished on hills) and knifed OUT of
  // water-carved banks as a floating sheet (scatter24-before2-crop.png).
  // Subdivide 2 cells per tile and drop every vertex onto the same surface
  // formula the terrain mesh renders; the world-space fragment shader is
  // untouched. ~80×60 cells ≈ 9.6k tris — negligible.
  const geometry = useMemo(() => {
    const SUBDIV = 2; // cells per tile
    const geo = new THREE.PlaneGeometry(
      width * TILE_SIZE,
      height * TILE_SIZE,
      width * SUBDIV,
      height * SUBDIV,
    );
    geo.rotateX(-Math.PI / 2);

    const grid: (BattleMapTile | null)[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
      }
    }
    const sampleGround = makeTerrainHeightSampler(grid, width, height, mapData.seed ?? 42);

    // Shift to match terrain positioning (origin at tile 0,0) and conform
    const positions = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + (width / 2) * TILE_SIZE;
      const z = positions.getZ(i) + (height / 2) * TILE_SIZE;
      positions.setX(i, x);
      positions.setZ(i, z);
      positions.setY(i, sampleGround(x, z));
    }
    positions.needsUpdate = true;
    return geo;
  }, [width, height, mapData]);

  // Rebuilds with mapData now — release the old GPU buffers.
  React.useEffect(() => () => { geometry.dispose(); }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[0, OVERLAY_HEIGHT_OFFSET, 0]}
      renderOrder={1}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={gridVertexShader}
        fragmentShader={gridFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default GridOverlay;
