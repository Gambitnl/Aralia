/**
 * The shared performance display.
 *
 * Mount this ONCE per page. It finds every measured surface through the
 * registry, so a step with two canvases gets two tabs and a step with none
 * says so plainly instead of showing a frozen zero.
 *
 * What it shows, and why each number earns its place:
 *
 * - **fps** is the headline because that is what people ask for, but it is the
 *   least informative number here and is never shown alone.
 * - **mean, p95, worst** turn one number into a shape. A scene at "60 fps" with
 *   a 90 ms worst frame is not a scene at 60 fps.
 * - **stalls** counts hitches per window. A p95 says how rough, this says how
 *   often, and the two come apart constantly.
 * - **The graph** shows where in the last two seconds the bad frames landed —
 *   evenly spread reads as load, a single spike reads as an event.
 * - **Draw calls and triangles** are the two costs a scene author can act on.
 * - **Geometries, textures, programs, heap** move only when something leaks.
 * - **Surface size** because half of all "it got slow" reports are a canvas
 *   quietly running at twice the pixels anyone intended.
 * - **Spans** are per-scene attribution: which part of the frame was the cost.
 *
 * Styling is inline rather than Tailwind: this panel mounts inside devtools
 * surfaces that the Tailwind content globs do not all cover.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../styles/zIndex';
import { getPerfSessions, subscribePerfSessions } from './perfRegistry';
import { STALL_MS } from './frameStats';
import { classifyBottleneck } from './perfSession';
import type { Bottleneck, PerfSnapshot } from './perfSession';

/** One color per verdict, so the label reads at a glance. */
const BOUND_COLOR: Record<Bottleneck, string> = {
  gpu: '#f472b6',
  cpu: '#38bdf8',
  mixed: '#a78bfa',
  headroom: '#4ade80',
  unknown: '#94a3b8',
};

/** How often the display refreshes. Four times a second reads as live. */
const POLL_MS = 250;

const STORAGE_KEY = 'aralia.perfHud';

type HudMode = 'hidden' | 'pill' | 'panel';

const GOOD_FPS = 55;
const POOR_FPS = 30;

function fpsColor(fps: number): string {
  if (fps >= GOOD_FPS) return '#4ade80';
  if (fps >= POOR_FPS) return '#fbbf24';
  return '#f87171';
}

function readMode(): HudMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'hidden' || stored === 'pill' || stored === 'panel' ? stored : 'pill';
}

/**
 * The frame-time graph.
 *
 * Bars, not a line: a line invites the eye to interpolate between frames that
 * have nothing to do with each other. The two rules are the 60 Hz and 30 Hz
 * budgets, so "over the line" is literal.
 */
const FrameGraph: React.FC<{ history: number[]; width: number; height: number }> = ({
  history,
  width,
  height,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(0, 0, width, height);

    // The scale always covers the 30 Hz budget, so a calm scene does not draw
    // its own noise floor at full height and look alarming.
    const worst = history.reduce((a, b) => Math.max(a, b), 0);
    const top = Math.max(STALL_MS * 1.2, worst * 1.05);

    for (const [ms, color] of [
      [1000 / 60, 'rgba(74,222,128,0.35)'],
      [STALL_MS, 'rgba(248,113,113,0.35)'],
    ] as const) {
      const y = height - (ms / top) * height;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }

    const slots = 120;
    const barW = width / slots;
    const start = Math.max(0, history.length - slots);
    for (let i = start; i < history.length; i++) {
      const ms = history[i];
      const h = Math.max(1, Math.min(height, (ms / top) * height));
      ctx.fillStyle = ms > STALL_MS ? '#f87171' : ms > 1000 / 55 ? '#fbbf24' : '#38bdf8';
      ctx.fillRect((i - start) * barW, height - h, Math.max(1, barW - 0.5), h);
    }
  }, [history, width, height]);

  return <canvas ref={ref} style={{ width, height, display: 'block', borderRadius: 3 }} />;
};

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  color: '#94a3b8',
};

/** Short enough for a 272 px panel. The full sentence lives in the report. */
const SHORT_UNAVAILABLE: Record<string, string> = {
  'no-extension': 'browser withholds the clock',
  'no-webgl2': 'not WebGL2',
  webgpu: 'not available on WebGPU',
  'no-context': 'no context',
  disabled: 'off for this surface',
};

const button: React.CSSProperties = {
  flex: 1,
  padding: '3px 0',
  fontSize: 10,
  fontFamily: 'inherit',
  color: '#cbd5e1',
  background: 'rgba(30,41,59,0.9)',
  border: '1px solid #334155',
  borderRadius: 3,
  cursor: 'pointer',
};

export const PerfOverlay: React.FC = () => {
  const [mode, setMode] = useState<HudMode>(() => readMode());
  const [snapshots, setSnapshots] = useState<PerfSnapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [capture, setCapture] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // Alt+P cycles the display. Alt is used because a bare key would fire while
  // typing a seed into any of the sandbox inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.key.toLowerCase() !== 'p') return;
      e.preventDefault();
      setMode((m) => (m === 'panel' ? 'pill' : m === 'pill' ? 'hidden' : 'panel'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // One timer drives every reading. Sessions also push when they mount so a
  // freshly opened step does not wait a quarter second to appear.
  useEffect(() => {
    if (mode === 'hidden') return;
    const tick = () => setSnapshots(getPerfSessions().map((s) => s.snapshot()));
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    const stop = subscribePerfSessions(tick);
    return () => {
      window.clearInterval(timer);
      stop();
    };
  }, [mode]);

  const active = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshots.find((s) => s.id === activeId) ?? snapshots[0];
  }, [snapshots, activeId]);

  const bound = useMemo(
    () => (active ? classifyBottleneck(active.gpu.meanMs, active.cpuMs, active.frame.meanMs) : null),
    [active],
  );

  const sessionFor = useCallback(
    (id: string) => getPerfSessions().find((s) => s.id === id) ?? null,
    [],
  );

  const onCopy = useCallback(
    (text: string) => {
      void navigator.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    },
    [],
  );

  if (mode === 'hidden') return null;

  const shell: React.CSSProperties = {
    position: 'fixed',
    right: 10,
    bottom: 10,
    zIndex: Z_INDEX.DEBUG_OVERLAY,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    lineHeight: 1.45,
    color: '#e2e8f0',
    background: 'rgba(2,6,23,0.92)',
    border: '1px solid #334155',
    borderRadius: 6,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    userSelect: 'none',
  };

  if (mode === 'pill') {
    const fps = active?.frame.fps ?? 0;
    return createPortal(
      <button
        type="button"
        onClick={() => setMode('panel')}
        title="Performance (Alt+P)"
        style={{ ...shell, padding: '4px 9px', cursor: 'pointer' }}
      >
        {active ? (
          <span style={{ color: active.live ? fpsColor(fps) : '#475569', fontWeight: 700 }}>
            {fps.toFixed(0)} fps
          </span>
        ) : (
          <span style={{ color: '#64748b' }}>no 3D</span>
        )}
      </button>,
      document.body,
    );
  }

  return createPortal(
    <div style={{ ...shell, width: 272, padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <strong style={{ flex: 1, fontSize: 10, letterSpacing: 0.6, color: '#7dd3fc' }}>
          PERFORMANCE
        </strong>
        <button
          type="button"
          onClick={() => setMode('pill')}
          title="Collapse (Alt+P)"
          style={{ ...button, flex: '0 0 auto', padding: '1px 6px' }}
        >
          –
        </button>
      </div>

      {!active ? (
        <div style={{ color: '#64748b', padding: '6px 2px' }}>
          No 3D surface on this step.
        </div>
      ) : (
        <>
          {snapshots.length > 1 && (
            <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap' }}>
              {snapshots.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  style={{
                    ...button,
                    flex: '0 0 auto',
                    padding: '1px 6px',
                    color: s.id === active.id ? '#0f172a' : '#cbd5e1',
                    background: s.id === active.id ? '#7dd3fc' : 'rgba(30,41,59,0.9)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ ...row, marginBottom: 2 }}>
            <span style={{ color: '#cbd5e1' }}>{active.label}</span>
            <span style={{ color: active.live ? '#475569' : '#f59e0b' }}>
              {active.live ? active.api : 'stopped'}
            </span>
          </div>

          {/* A surface that stopped drawing has no frame rate.
            *
            * The window holds the last second of frames it DID draw, and left
            * alone it would keep reporting them — a paused sandbox reading a
            * confident 112 fps. The last reading is still shown, dimmed and
            * labeled, because it describes the frame on screen. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: active.live ? fpsColor(active.frame.fps) : '#475569',
              }}
            >
              {active.frame.fps.toFixed(0)}
            </span>
            <span style={{ color: '#64748b' }}>{active.live ? 'fps' : 'fps when last drawn'}</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: active.live && active.stalls > 0 ? '#f87171' : '#475569' }}>
              {active.stalls} stall{active.stalls === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ margin: '4px 0 5px' }}>
            <FrameGraph history={active.history} width={256} height={38} />
          </div>

          {/* Three cells rather than one sentence. As a sentence the line wrapped
            * at the panel's width and put "worst" on its own row, which read as
            * a fourth number. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {[
              ['mean', active.frame.meanMs, '#e2e8f0'],
              ['p95', active.frame.p95Ms, '#e2e8f0'],
              ['worst', active.frame.worstMs, active.frame.worstMs > STALL_MS ? '#f87171' : '#e2e8f0'],
            ].map(([name, value, color]) => (
              <div key={name as string} style={{ textAlign: 'center' }}>
                <div style={{ color: color as string }}>{(value as number).toFixed(1)}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>{name as string} ms</div>
              </div>
            ))}
          </div>

          {/* The GPU line answers the question the frame line cannot: which
            * side is the bottleneck. It is the difference between "draw less"
            * and "compute less", so it sits directly under the frame times. */}
          <div style={{ ...row, marginTop: 4 }}>
            <span>gpu</span>
            {active.gpu.unavailable ? (
              <span style={{ color: '#64748b', textAlign: 'right' }}>
                {SHORT_UNAVAILABLE[active.gpu.unavailable]}
              </span>
            ) : active.gpu.meanMs === null ? (
              <span style={{ color: '#64748b' }}>waiting…</span>
            ) : (
              <span style={{ color: '#e2e8f0' }}>
                {active.gpu.meanMs.toFixed(2)} ms
                <span style={{ color: '#64748b' }}> · {active.gpu.worstMs.toFixed(2)} worst</span>
              </span>
            )}
          </div>
          <div style={row}>
            <span>cpu</span>
            <span style={{ color: active.cpuMs === null ? '#64748b' : '#e2e8f0' }}>
              {active.cpuMs === null ? 'waiting…' : `${active.cpuMs.toFixed(2)} ms of work`}
            </span>
          </div>
          {bound && (
            <div
              style={{
                marginTop: 3,
                textAlign: 'center',
                color: BOUND_COLOR[bound.kind],
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {bound.label}
            </div>
          )}

          <div style={{ height: 1, background: '#1e293b', margin: '6px 0' }} />

          <div style={row}>
            <span>draws</span>
            <span style={{ color: '#e2e8f0' }}>
              {active.counters.drawCalls.toLocaleString()} calls ·{' '}
              {active.counters.triangles.toLocaleString()} tris
            </span>
          </div>
          {active.counters.computeCalls > 0 && (
            <div style={row}>
              <span>compute</span>
              <span style={{ color: '#e2e8f0' }}>{active.counters.computeCalls} passes</span>
            </div>
          )}
          <div style={row}>
            <span>memory</span>
            <span style={{ color: '#e2e8f0' }}>
              {active.counters.geometries} geo · {active.counters.textures} tex
              {active.counters.programs !== null ? ` · ${active.counters.programs} prog` : ''}
            </span>
          </div>
          <div style={row}>
            <span>surface</span>
            <span style={{ color: '#e2e8f0' }}>
              {active.surface.width}×{active.surface.height} @{active.surface.dpr.toFixed(1)}
              {active.heapMB !== null ? ` · ${active.heapMB.toFixed(0)} MB` : ''}
            </span>
          </div>

          {active.spans.length > 0 && (
            <>
              <div style={{ height: 1, background: '#1e293b', margin: '6px 0' }} />
              {active.spans.map((sp) => (
                <div style={row} key={sp.name}>
                  <span>{sp.name}</span>
                  <span style={{ color: '#e2e8f0' }}>{sp.ms.toFixed(2)} ms</span>
                </div>
              ))}
            </>
          )}

          <div style={{ display: 'flex', gap: 4, marginTop: 7 }}>
            <button
              type="button"
              style={{
                ...button,
                color: active.recordingSec !== null ? '#0f172a' : '#cbd5e1',
                background: active.recordingSec !== null ? '#f87171' : 'rgba(30,41,59,0.9)',
              }}
              onClick={() => {
                const s = sessionFor(active.id);
                if (!s) return;
                if (s.isRecording) setCapture(s.stopRecording());
                else {
                  setCapture(null);
                  s.startRecording();
                }
              }}
              title="Capture every frame, then report the distribution"
            >
              {active.recordingSec !== null ? `stop ${active.recordingSec.toFixed(0)}s` : 'record'}
            </button>
            <button
              type="button"
              style={button}
              onClick={() => {
                const s = sessionFor(active.id);
                if (s) onCopy(s.report());
              }}
              title="Copy the live reading as text"
            >
              {copied ? 'copied' : 'copy'}
            </button>
            <button
              type="button"
              style={button}
              onClick={() => sessionFor(active.id)?.reset()}
              title="Throw away the window after a rebuild"
            >
              reset
            </button>
          </div>

          {capture && (
            <div style={{ marginTop: 6 }}>
              <pre
                style={{
                  margin: 0,
                  padding: 6,
                  maxHeight: 150,
                  overflow: 'auto',
                  fontSize: 10,
                  color: '#cbd5e1',
                  background: 'rgba(15,23,42,0.9)',
                  border: '1px solid #1e293b',
                  borderRadius: 3,
                  whiteSpace: 'pre',
                  userSelect: 'text',
                }}
              >
                {capture}
              </pre>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button type="button" style={button} onClick={() => onCopy(capture)}>
                  {copied ? 'copied' : 'copy capture'}
                </button>
                <button type="button" style={button} onClick={() => setCapture(null)}>
                  dismiss
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
};

export default PerfOverlay;
