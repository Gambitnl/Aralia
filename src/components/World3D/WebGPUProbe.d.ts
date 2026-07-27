/**
 * @file WebGPUProbe.tsx
 * @description Host for the WebGPU render probe (?phase=webgpuprobe). Reuses the
 * SAME streamed ground world the game uses — worker-backed chunk meshing over
 * a bridged L2 LocalArtifact — but renders it through WebGPUProbeScene, which
 * drives three.js WebGPURenderer instead of the default WebGL path.
 *
 * FULL-STACK PARITY (2026-07-04): the probe no longer renders only terrain +
 * building boxes. It now streams the SAME content the live ground world ships at
 * this pose — procedural trees, near-camera grass, the full prop set, styled
 * roofs, town walls/roads/decks — so hardware parity is proven against the whole
 * beautification stack, not a slice. Content that cannot render on the node path
 * yet is surfaced as an explicit on-screen "MISSING:" line (no silent skips).
 *
 * The loader setup here mirrors World3DDemo's ground branch (?ground=1): same
 * bridge, same seed, same spawn-at-center framing. It ALSO builds the GroundWorld
 * object (makeGroundWorld) so the prop layer — which reads ground.props, not
 * per-chunk data — has its source, exactly like the live scene.
 */
import React from 'react';
/** Live-verified backend + FPS + MISSING report surfaced by the scene. */
export interface ProbeStatus {
    /** 'webgpu' only ever appears when the renderer reports a real WebGPU backend. */
    backend: 'webgpu' | 'unknown';
    fps: number;
    /** Ordered list of things the probe could not render on the node path. */
    missing: string[];
}
declare const WebGPUProbe: React.FC;
export default WebGPUProbe;
