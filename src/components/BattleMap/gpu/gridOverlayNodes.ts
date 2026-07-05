/**
 * @file gridOverlayNodes.ts
 * @description TSL translation of the WebGL battle-map grid/movement overlay
 * (`terrain/GridOverlay.tsx`'s `ShaderMaterial`). The WebGL overlay draws faint
 * grid lines plus valid-move (green), active-path (blue), and blocked (dark)
 * tile fills from a per-tile RGBA state DataTexture, faded by a global opacity.
 *
 * Rung 3 of the WebGPU battle-map port (wave spec §8). Rebuilds the exact same
 * look as `colorNode` + `opacityNode` for an unlit transparent
 * `MeshBasicNodeMaterial`, driven by the same `uTileStateMap` texture and a
 * `uniform` opacity the scene lerps for the fade-in/out.
 *
 * The AoE/targeting overlay rides the same state texture: the scene packs the
 * AoE set into the state map's alpha channel and this node tints those tiles.
 *
 * TESTABILITY: the builders take a texture + uniforms and return real TSL nodes
 * (no GPU), so the graph construction is unit-tested in CI.
 */
import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  floor,
  fract,
  step,
  min as tslMin,
  max as tslMax,
  positionWorld,
  texture,
  If,
} from 'three/tsl';
import type { Texture } from 'three/webgpu';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

export interface GridOverlayNodeParams {
  /** RGBA per-tile state: R=validMove, G=activePath, B=blocked, A=aoe. */
  stateTex: Texture;
  mapWidth: number;
  mapHeight: number;
  lineWidth: number;
  /** A `uniform(float)` node the scene lerps for the fade transition. */
  opacityUniform: N;
}

interface GridEval {
  colorNode: N;
  opacityNode: N;
}

/** Shared evaluation: returns { color, alpha } for the current fragment. */
function evalGrid(p: GridOverlayNodeParams): GridEval {
  const { stateTex, mapWidth, mapHeight, lineWidth, opacityUniform } = p;
  const W = float(mapWidth);
  const H = float(mapHeight);
  const lw = float(lineWidth);

  const colorNode = Fn(() => {
    const tileX = positionWorld.x;
    const tileZ = positionWorld.z;
    const fracX = fract(tileX);
    const fracZ = fract(tileZ);
    const lineX = step(fracX, lw).add(step(float(1.0).sub(lw), fracX));
    const lineZ = step(fracZ, lw).add(step(float(1.0).sub(lw), fracZ));
    const gridLine = tslMin(1.0, lineX.add(lineZ));

    const tileUV = vec2(floor(tileX).add(0.5).div(W), floor(tileZ).add(0.5).div(H));
    const st = texture(stateTex, tileUV);
    const isValid = st.r;
    const isPath = st.g;
    const isBlocked = st.b;
    const isAoe = st.a;

    // Base: neutral blue-gray grid lines.
    const color = vec3(0.5, 0.6, 0.7).toVar();
    If(isValid.greaterThan(0.5), () => {
      color.assign(vec3(0.13, 0.67, 0.27)); // green
    });
    If(isAoe.greaterThan(0.5), () => {
      color.assign(vec3(1.0, 0.42, 0.2)); // AoE amber-red (matches TargetingDecals)
    });
    If(isPath.greaterThan(0.5), () => {
      color.assign(vec3(0.27, 0.53, 1.0)); // bright blue
    });
    If(isBlocked.greaterThan(0.5), () => {
      color.assign(vec3(0.15, 0.1, 0.1)); // dark
    });
    void gridLine;
    return color;
  })();

  const opacityNode = Fn(() => {
    const tileX = positionWorld.x;
    const tileZ = positionWorld.z;
    const fracX = fract(tileX);
    const fracZ = fract(tileZ);
    const lineX = step(fracX, lw).add(step(float(1.0).sub(lw), fracX));
    const lineZ = step(fracZ, lw).add(step(float(1.0).sub(lw), fracZ));
    const gridLine = tslMin(1.0, lineX.add(lineZ));

    const tileUV = vec2(floor(tileX).add(0.5).div(W), floor(tileZ).add(0.5).div(H));
    const st = texture(stateTex, tileUV);
    const isValid = st.r;
    const isPath = st.g;
    const isBlocked = st.b;
    const isAoe = st.a;

    const alpha = gridLine.mul(0.12).toVar();
    If(isValid.greaterThan(0.5), () => {
      alpha.assign(tslMax(alpha, tslMax(float(0.3), gridLine.mul(0.6))));
    });
    If(isAoe.greaterThan(0.5), () => {
      alpha.assign(tslMax(alpha, tslMax(float(0.34), gridLine.mul(0.6))));
    });
    If(isPath.greaterThan(0.5), () => {
      alpha.assign(tslMax(alpha, tslMax(float(0.45), gridLine.mul(0.8))));
    });
    If(isBlocked.greaterThan(0.5), () => {
      alpha.assign(tslMax(alpha, float(0.2)));
    });
    return alpha.mul(opacityUniform);
  })();

  return { colorNode, opacityNode };
}

/** Build the grid overlay's `colorNode`. */
export function buildGridColorNode(p: GridOverlayNodeParams): N {
  return evalGrid(p).colorNode;
}

/** Build the grid overlay's `opacityNode` (already multiplied by fade opacity). */
export function buildGridOpacityNode(p: GridOverlayNodeParams): N {
  return evalGrid(p).opacityNode;
}

export { vec4 };
/* eslint-enable @typescript-eslint/no-explicit-any */
