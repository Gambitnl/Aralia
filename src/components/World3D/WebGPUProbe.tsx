/**
 * @file WebGPUProbe.tsx
 * @description Host for the WebGPU render probe (?phase=webgpuprobe). Reuses the
 * SAME streamed ground world the game uses — createGroundChunkLoader over a
 * bridged L2 LocalArtifact — but renders it through WebGPUProbeScene, which
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

import React, { useEffect, useMemo, useState } from 'react';
import WebGPUProbeScene from './WebGPUProbeScene';
import { heightToMeters } from '@/systems/world3d/config';
import type { ChunkLoader } from '@/systems/world3d/types';
import { getWorldforgeLocalForLocation } from '@/systems/worldforge/bridge/legacySubmapBridge';
import {
  createGroundChunkLoader,
  type GroundWorld,
} from '@/systems/worldforge/bridge/groundChunkLoader';

/** Worldforge world seed for the ground sandbox (matches World3DDemo). */
const PROBE_WF_SEED = 42;

/** Live-verified backend + FPS + MISSING report surfaced by the scene. */
export interface ProbeStatus {
  /** 'webgpu' only ever appears when the renderer reports a real WebGPU backend. */
  backend: 'webgpu' | 'unknown';
  fps: number;
  /** Ordered list of things the probe could not render on the node path. */
  missing: string[];
}

/** Result of the pre-flight WebGPU capability check (before any renderer). */
type GpuCheck =
  | { state: 'checking' }
  | { state: 'ok' }
  | { state: 'unavailable'; reason: string };

const WebGPUProbe: React.FC = () => {
  const [status, setStatus] = useState<ProbeStatus>({ backend: 'unknown', fps: 0, missing: [] });
  const [gpu, setGpu] = useState<GpuCheck>({ state: 'checking' });
  // Runtime failure surfaced by the scene (renderer inited but backend != WebGPU,
  // or init threw). FAIL-FAST: any such case tears the scene down to the error pane.
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // ── FAIL-FAST pre-flight (no fallback) ──────────────────────────────────────
  // three.js WebGPURenderer silently falls back to WebGL2 when no WebGPU adapter
  // exists. Forbidden here: probe WebGPU support ourselves FIRST, and if it is
  // unavailable we render NO scene — a clear full-pane error instead.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nav = navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } };
      if (!nav.gpu) {
        if (!cancelled) setGpu({ state: 'unavailable', reason: 'navigator.gpu is not present (browser/context has no WebGPU)' });
        return;
      }
      try {
        const adapter = await nav.gpu.requestAdapter();
        if (cancelled) return;
        if (!adapter) {
          setGpu({ state: 'unavailable', reason: 'requestAdapter() returned null (no WebGPU adapter available)' });
          return;
        }
        setGpu({ state: 'ok' });
      } catch (e) {
        if (!cancelled) setGpu({ state: 'unavailable', reason: `requestAdapter() threw: ${(e as Error).message}` });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { loader, ground, start, startSurfaceY } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const gx = Number(params.get('gx') ?? 16);
    const gy = Number(params.get('gy') ?? 4);
    const hour = Number(params.get('hour') ?? 12);
    const wfSeed = Number(params.get('wfseed') ?? PROBE_WF_SEED);

    const bridged = getWorldforgeLocalForLocation(wfSeed, gx, gy, 25, 16);
    const { ground: groundWorld, loader: groundLoader } = createGroundChunkLoader(
      bridged.local,
      wfSeed,
      bridged.region,
      { hour },
    );

    const startX = groundWorld.extentMetersX / 2;
    const startZ = groundWorld.extentMetersZ / 2;
    const cgx = Math.round(groundWorld.cols / 2);
    const cgy = Math.round(groundWorld.rows / 2);
    const centerH = groundWorld.heights[cgy * groundWorld.cols + cgx] ?? 0;
    return {
      loader: groundLoader as ChunkLoader,
      ground: groundWorld as GroundWorld,
      start: [startX, 0, startZ] as const,
      startSurfaceY: heightToMeters(centerH),
    };
  }, []);

  const backendOk = status.backend === 'webgpu';

  // Equivalent WebGL ground-world view at the SAME pose, for the error-pane
  // "View in WebGL" button. Carries the probe's gx/gy/wfseed so the WebGL scene
  // frames the same spot the probe would have.
  const webglViewSearch = useMemo(() => {
    const src = new URLSearchParams(window.location.search);
    const out = new URLSearchParams();
    out.set('phase', 'world3d');
    out.set('ground', '1');
    for (const k of ['gx', 'gy', 'wfseed', 'hour']) {
      const v = src.get(k);
      if (v != null) out.set(k, v);
    }
    return `?${out.toString()}`;
  }, []);

  // FAIL-FAST: the scene renders ONLY when the pre-flight confirmed WebGPU AND no
  // runtime backend/init failure has been reported. Any WebGPU shortfall → error
  // pane, never a WebGL-fallback render.
  const failureReason =
    gpu.state === 'unavailable' ? gpu.reason : runtimeError ?? null;
  const showScene = gpu.state === 'ok' && !runtimeError;

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100dvh', boxSizing: 'border-box' }}>
      <h1 style={{ margin: 0, fontSize: '22px', fontFamily: 'Outfit, sans-serif', color: '#1a2a3a' }}>
        WebGPU Probe — full ground stack on WebGPURenderer
      </h1>
      <p style={{ margin: 0, fontSize: '13px', color: '#4a5a6a' }}>
        Same ground chunks + trees + grass + props + roofs as ?phase=world3d&ground=1,
        rendered through three.js WebGPURenderer. FAIL-FAST: if a real WebGPU backend
        is not available the probe renders no scene — only the error pane below.
      </p>
      <div style={{ flex: '1 1 auto', minHeight: '520px', position: 'relative' }}>
        {showScene && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <WebGPUProbeScene
              loader={loader}
              ground={ground}
              start={start}
              startSurfaceY={startSurfaceY}
              onStatus={setStatus}
              onFatal={setRuntimeError}
            />
          </div>
        )}

        {/* ── FAIL-FAST ERROR PANE (no fallback) ───────────────────────────────
            Shown whenever WebGPU is unavailable or the renderer reported a
            non-WebGPU backend / init failure. This IS the correct headless
            outcome when Chromium can't do WebGPU. */}
        {failureReason && (
          <div
            data-testid="probe-error"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 32,
              textAlign: 'center',
              background: '#2a0d12',
              borderRadius: 12,
              color: '#ffe0e3',
              fontFamily: 'ui-monospace, Menlo, monospace',
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: '#ff8f9a' }}>WebGPU unavailable</div>
            <div style={{ fontSize: 15, maxWidth: 640, lineHeight: 1.6 }}>{failureReason}</div>
            <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 640 }}>
              This probe never falls back to WebGL automatically. Verify WebGPU on real
              hardware with a WebGPU-capable browser; a headless environment without
              WebGPU is expected to show exactly this screen.
            </div>
            {/* ACTIVE error: the user (not the code) chooses to view the SAME scene
                in WebGL. Same pose params (gx/gy/wfseed) are carried onto the
                equivalent ground-world phase so the two views are comparable. */}
            <button
              data-testid="probe-view-webgl"
              onClick={() => {
                window.location.search = webglViewSearch;
              }}
              style={{
                marginTop: 8,
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid #ff8f9a',
                background: '#ff8f9a',
                color: '#2a0d12',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              View this scene in WebGL instead →
            </button>
          </div>
        )}

        {/* Checking state (brief): pre-flight adapter probe in progress. */}
        {gpu.state === 'checking' && (
          <div
            data-testid="probe-checking"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#cdd9e6',
              borderRadius: 12,
              color: '#3a4a5a',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 15,
            }}
          >
            Checking for a WebGPU adapter…
          </div>
        )}

        {/* ── ON-SCREEN BACKEND BADGE (success only) ───────────────────────────
            Derived from the renderer's real backend flag. Only ever green
            "WebGPU" — a non-WebGPU backend triggers the error pane instead. */}
        {showScene && backendOk && (
          <div
            data-testid="probe-backend-badge"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 6,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 8,
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                background: '#1e7d3e',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8ff0a4' }} />
              WebGPU
              <span style={{ opacity: 0.85, fontWeight: 500 }}>· {status.fps} fps</span>
            </div>

            {status.missing.length > 0 && (
              <div
                data-testid="probe-missing"
                style={{
                  maxWidth: 320,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'rgba(120,15,25,0.92)',
                  color: '#ffe0e3',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  textAlign: 'right',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}
              >
                {status.missing.map((m) => (
                  <div key={m}>MISSING: {m}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebGPUProbe;
