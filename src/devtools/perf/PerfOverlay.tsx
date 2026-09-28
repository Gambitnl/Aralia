/**
 * The shared performance display.
 *
 * Mount `<PerfOverlay />` from `./PerfOverlayHost` ONCE per page, or import
 * `./staple` at the page entry; either puts this view in a React root of its
 * own. It finds every measured surface through the registry, so a step with
 * two canvases gets two tabs and a step with none says so plainly instead of
 * showing a frozen zero. Since 2026-09-29 the renderer probe
 * (rendererProbe.ts) registers every three.js canvas by itself, so "every
 * measured surface" means every surface on the page.
 *
 * DIAGNOSE, NOT GAUGE (2026-09-29). The top of the panel still reads like a
 * gauge (fps, frame times, the graph, GPU and CPU), and then it says what the
 * numbers mean:
 *
 * - **vsync** says whether the frame time is the display's rhythm (16.7 and
 *   33.3 ms are buckets, not costs), what the real work is, how long the
 *   frame waits for the display, and the headroom against a BUDGET the reader
 *   picks (the display's rate, 60 fps or 30 fps).
 * - **passes** lists each render and compute pass by name, in order, with its
 *   CPU ms, GPU ms (WebGL), triangles and share of the budget.
 * - **groups** splits the triangles by the scene's own groups.
 * - **view** says what the camera sees: mounted against in-view against drawn
 *   triangles, the nearest water, and (on request) the share of the screen
 *   each group covers.
 * - **causes** says where the CPU time went, what was uploaded or compiled,
 *   and what made each slow frame slow.
 * - **memory** shows the counts that move, per second, so a leak shows.
 * - **compare** puts a marked reading beside the live one, with the delta.
 *
 * Styling is inline rather than Tailwind: this panel mounts inside devtools
 * surfaces that the Tailwind content globs do not all cover.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../styles/zIndex';
import { getPerfSessions, subscribePerfPanelRequests, subscribePerfSessions } from './perfRegistry';
import { STALL_MS } from './frameStats';
import { classifyBottleneck, formatBytes } from './perfSession';
import type { Bottleneck, PassReading, PerfSnapshot } from './perfSession';
import { BROWSER_PREFIX, type StallRecord } from './stallLog';
import { budgetMsFor, readWork, type BudgetChoice, type WorkReading } from './diagnose';
import { measureScreenShare, type CoverageResult } from './viewCoverage';

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
const TAB_KEY = 'aralia.perfTab';
const BUDGET_KEY = 'aralia.perfBudget';

type HudMode = 'hidden' | 'pill' | 'panel';
type DetailTab = 'passes' | 'groups' | 'view' | 'causes' | 'memory' | 'compare';

const TABS: { id: DetailTab; label: string; title: string }[] = [
  { id: 'passes', label: 'passes', title: 'Each render and compute pass: CPU, GPU, triangles, share of the budget' },
  { id: 'groups', label: 'groups', title: 'Triangles by the scene\'s own groups' },
  { id: 'view', label: 'view', title: 'What the camera sees: the cull, the nearest water, the screen share' },
  { id: 'causes', label: 'causes', title: 'Where the CPU went, uploads and compiles, and what made each slow frame slow' },
  { id: 'memory', label: 'memory', title: 'Geometries, textures, programs and heap, per second' },
  { id: 'compare', label: 'compare', title: 'A marked reading beside the live one, with the delta' },
];

const PANEL_W = 368;
const GOOD_FPS = 55;
const POOR_FPS = 30;

/** Green at 55 fps and above, amber from 30, red below. Shared with the window badge. */
export function fpsColor(fps: number): string {
  if (fps >= GOOD_FPS) return '#4ade80';
  if (fps >= POOR_FPS) return '#fbbf24';
  return '#f87171';
}

/** Keep large scene counts readable inside the diagnostic panel. */
function compactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
  return value.toLocaleString();
}

function signed(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function signedCount(value: number): string {
  return `${value >= 0 ? '+' : '-'}${compactCount(Math.abs(value))}`;
}

function ms(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined ? '—' : v.toFixed(digits);
}

/** Storage can throw (a private window, blocked site data); the panel then just forgets. */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the choice is simply not remembered */
  }
}

function readMode(): HudMode {
  return readStored<HudMode>(STORAGE_KEY, ['hidden', 'pill', 'panel'], 'pill');
}

/**
 * The frame-time graph.
 *
 * Bars, not a line: a line invites the eye to interpolate between frames that
 * have nothing to do with each other. The rules are the 60 Hz and 30 Hz
 * budgets, and the reader's own budget as a dashed amber line.
 */
const FrameGraph: React.FC<{ history: number[]; width: number; height: number; budgetMs: number }> = ({
  history,
  width,
  height,
  budgetMs,
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
    const top = Math.max(STALL_MS * 1.2, worst * 1.05, budgetMs * 1.2);

    for (const [lineMs, color] of [
      [1000 / 60, 'rgba(74,222,128,0.35)'],
      [STALL_MS, 'rgba(248,113,113,0.35)'],
    ] as const) {
      const y = height - (lineMs / top) * height;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }

    const slots = 120;
    const barW = width / slots;
    const start = Math.max(0, history.length - slots);
    for (let i = start; i < history.length; i++) {
      const v = history[i];
      const h = Math.max(1, Math.min(height, (v / top) * height));
      ctx.fillStyle = v > STALL_MS ? '#f87171' : v > budgetMs * 1.04 ? '#fbbf24' : '#38bdf8';
      ctx.fillRect((i - start) * barW, height - h, Math.max(1, barW - 0.5), h);
    }

    // The reader's budget, over the bars.
    const by = height - (budgetMs / top) * height;
    ctx.strokeStyle = '#fbbf24';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, by + 0.5);
    ctx.lineTo(width, by + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [history, width, height, budgetMs]);

  return <canvas ref={ref} style={{ width, height, display: 'block', borderRadius: 3 }} />;
};

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  color: '#94a3b8',
};

const dim: React.CSSProperties = { color: '#64748b' };
const bright: React.CSSProperties = { color: '#e2e8f0' };
const rule: React.CSSProperties = { height: 1, background: '#1e293b', margin: '6px 0' };
const heading: React.CSSProperties = { fontSize: 10, letterSpacing: 0.5, color: '#7dd3fc', margin: '2px 0' };
const clip: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/** Short enough for the panel. The full sentence lives in the report. */
const SHORT_UNAVAILABLE: Record<string, string> = {
  'no-extension': 'browser withholds the clock',
  'no-webgl2': 'not WebGL2',
  // Short form of GPU_UNAVAILABLE_TEXT.webgpu in perfSession.ts.
  webgpu: 'not measured on WebGPU (three r172)',
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

const chip = (on: boolean): React.CSSProperties => ({
  ...button,
  flex: '0 0 auto',
  padding: '1px 6px',
  color: on ? '#0f172a' : '#cbd5e1',
  background: on ? '#7dd3fc' : 'rgba(30,41,59,0.9)',
});

/** A thin bar of `share` (0 to 1+), red past 1. */
const Bar: React.FC<{ share: number; width?: number }> = ({ share, width = 40 }) => (
  <span
    style={{
      display: 'inline-block',
      width,
      height: 6,
      background: '#1e293b',
      borderRadius: 2,
      position: 'relative',
      verticalAlign: 'middle',
      flex: '0 0 auto',
    }}
  >
    <span
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${Math.min(1, Math.max(0, share)) * 100}%`,
        background: share > 1 ? '#f87171' : share > 0.5 ? '#fbbf24' : '#38bdf8',
        borderRadius: 2,
      }}
    />
  </span>
);

/**
 * One slow frame.
 *
 * The headline is the cost that MOVED, not the largest cost. A span that always
 * takes 20 ms did not cause this frame; a span that jumped from 2 ms to 20 did.
 */
const StallRow: React.FC<{ rec: StallRecord; detail?: boolean }> = ({ rec, detail = false }) => {
  const top = rec.contributors[0];
  const over = rec.frameMs - rec.baselineMs;
  return (
    <div style={{ marginBottom: detail ? 4 : 0 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
        <span style={{ color: '#f87171', width: 52, flex: '0 0 auto' }}>{rec.frameMs.toFixed(1)} ms</span>
        {top ? (
          <>
            <span
              style={{ ...bright, ...clip }}
              title={`${top.valueMs.toFixed(1)} ms against a usual ${top.baselineMs.toFixed(1)} ms · frame ran ${over.toFixed(1)} ms over`}
            >
              {top.name}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ color: '#fbbf24', flex: '0 0 auto' }}>+{top.deltaMs.toFixed(1)}</span>
          </>
        ) : (
          <span style={dim}>nothing measured explains it</span>
        )}
      </div>
      {detail &&
        rec.contributors.slice(1, 4).map((c) => (
          <div key={c.name} style={{ display: 'flex', gap: 6, paddingLeft: 58, color: '#94a3b8' }}>
            <span style={clip} title={`${c.valueMs.toFixed(1)} ms against a usual ${c.baselineMs.toFixed(1)} ms`}>
              {c.name}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ flex: '0 0 auto' }}>+{c.deltaMs.toFixed(1)}</span>
          </div>
        ))}
      {detail &&
        rec.notes.map((n) => (
          <div key={n} style={{ paddingLeft: 58, color: '#a78bfa', ...clip }} title={n}>
            also: {n}
          </div>
        ))}
    </div>
  );
};

// ── 1. The vsync floor, the work, the wait, the headroom ─────────────────────

const VsyncBlock: React.FC<{ s: PerfSnapshot; work: WorkReading }> = ({ s, work }) => {
  const v = s.vsync;
  const headroomColor =
    work.headroomShare === null ? '#94a3b8' : work.headroomShare < 0 ? '#f87171' : work.headroomShare < 0.15 ? '#fbbf24' : '#4ade80';
  return (
    <div style={{ marginTop: 4, padding: '4px 6px', background: 'rgba(15,23,42,0.7)', border: '1px solid #1e293b', borderRadius: 3 }}>
      {v.locked && v.intervalMs !== null ? (
        <div
          style={{ color: '#fbbf24' }}
          title="The frame time is the display's rhythm, not the render cost: 16.7 ms and 33.3 ms are buckets. The work lines below are the cost."
        >
          vsync floor · {v.hz} Hz · {v.refreshesPerFrame} refresh{v.refreshesPerFrame === 1 ? '' : 'es'} a frame
          <span style={dim}> ({Math.round(v.lockedShare * 100)}% of frames)</span>
        </div>
      ) : (
        <div style={{ color: '#94a3b8' }} title="Frames are not locked to a refresh interval, so the frame time is the work itself.">
          no vsync floor · the frame time is the work
        </div>
      )}
      {work.busiestMs !== null ? (
        <>
          <div style={row}>
            <span>work</span>
            <span style={bright} title="The CPU builds the next frame while the GPU draws this one, so the longer side sets the pace, not the sum.">
              {work.busiestSide === 'gpu' ? 'GPU' : 'CPU'} {work.busiestMs.toFixed(2)} ms
              <span style={dim}>
                {work.serialMs !== null ? ` · ${work.serialMs.toFixed(1)} in series` : ' · GPU not measured'}
              </span>
            </span>
          </div>
          {work.waitMs !== null && (
            <div style={row}>
              <span>wait</span>
              <span style={bright}>{work.waitMs.toFixed(2)} ms for the display</span>
            </div>
          )}
          <div style={row}>
            <span>headroom</span>
            <span style={{ color: headroomColor, fontWeight: 700 }}>
              {work.headroomMs !== null && work.headroomMs >= 0 ? '' : 'over by '}
              {Math.abs(work.headroomMs ?? 0).toFixed(2)} ms · {Math.round(Math.abs(work.headroomShare ?? 0) * 100)}%
              <span style={{ ...dim, fontWeight: 400 }}>
                {' '}of {work.budgetMs.toFixed(1)} ms{work.gpuMeasured ? '' : ' · CPU side only: GPU not measured'}
              </span>
            </span>
          </div>
        </>
      ) : (
        <div style={dim}>work: waiting for the first CPU reading…</div>
      )}
    </div>
  );
};

// ── 2 and 5. Passes against the budget ────────────────────────────────────────

const PassesTab: React.FC<{ s: PerfSnapshot; budgetMs: number }> = ({ s, budgetMs }) => {
  if (s.passes.length === 0) return <div style={dim}>No pass has been measured yet.</div>;
  const unnamed = s.passes.some((p) => p.name.includes('target #'));
  const totalCpu = s.passes.reduce((a, p) => a + p.cpuMs, 0);
  const timed = s.passes.filter((p) => p.gpuMs !== null);
  const totalGpu = timed.length ? timed.reduce((a, p) => a + (p.gpuMs ?? 0), 0) : null;
  const col: React.CSSProperties = { width: 40, flex: '0 0 auto', textAlign: 'right' };
  return (
    <>
      <div style={{ display: 'flex', gap: 4, ...dim, fontSize: 10 }}>
        <span style={{ flex: 1 }}>pass (in order)</span>
        <span style={col}>cpu</span>
        <span style={col}>gpu</span>
        <span style={{ ...col, width: 44 }}>tris</span>
        <span style={{ ...col, width: 40 }}>budget</span>
      </div>
      {s.passes.map((p: PassReading) => {
        const cost = p.gpuMs ?? p.cpuMs;
        const share = budgetMs > 0 ? cost / budgetMs : 0;
        return (
          <div key={p.key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span
              style={{ flex: 1, paddingLeft: p.depth * 8, color: p.kind === 'compute' ? '#a78bfa' : p.kind === 'shadow' ? '#f472b6' : '#cbd5e1', ...clip }}
              title={`${p.name}\n→ ${p.target} · ${p.drawCalls} draws${p.lines ? ` · ${p.lines} lines` : ''}${p.runShare < 0.95 ? `\nran in ${Math.round(p.runShare * 100)}% of recent frames` : ''}`}
            >
              {p.name}
              {p.runShare < 0.95 && <span style={dim}> ·{Math.round(p.runShare * 100)}%</span>}
            </span>
            <span style={{ ...col, ...bright }}>{p.cpuMs.toFixed(2)}</span>
            <span style={{ ...col, color: p.gpuMs === null ? '#475569' : '#e2e8f0' }}>{ms(p.gpuMs)}</span>
            <span style={{ ...col, width: 44, ...bright }}>{compactCount(p.triangles)}</span>
            <span style={{ ...col, width: 40, display: 'flex', justifyContent: 'flex-end' }} title={`${Math.round(share * 100)}% of the ${budgetMs.toFixed(1)} ms budget (${p.gpuMs !== null ? 'GPU' : 'CPU'} time)`}>
              <Bar share={share} width={36} />
            </span>
          </div>
        );
      })}
      <div style={{ ...rule, margin: '4px 0' }} />
      <div style={row}>
        <span>all passes</span>
        <span style={bright}>
          cpu {totalCpu.toFixed(2)} · gpu {ms(totalGpu)} ms
          <span style={dim}> of {budgetMs.toFixed(1)}</span>
        </span>
      </div>
      <div style={{ ...dim, fontSize: 10, marginTop: 2 }}>
        {s.passGpuNote
          ? `GPU per pass: ${s.passGpuNote}.`
          : 'GPU per pass from EXT_disjoint_timer_query; GPU work between passes is not timed.'}
        {unnamed && ' Name a pass with userData.perfPass or renderTarget.texture.name.'}
      </div>
    </>
  );
};

// ── 3. Triangles by group ─────────────────────────────────────────────────────

const GroupsTab: React.FC<{ s: PerfSnapshot }> = ({ s }) => {
  const inv = s.inventory;
  if (!inv) return <div style={dim}>Walking the scenes (once a second, between frames)…</div>;
  const total = Math.max(1, inv.mountedTriangles);
  const unnamed = inv.groups.find((g) => g.name === 'unnamed');
  const col: React.CSSProperties = { width: 48, flex: '0 0 auto', textAlign: 'right' };
  return (
    <>
      <div style={{ display: 'flex', gap: 4, ...dim, fontSize: 10 }}>
        <span style={{ flex: 1 }}>group</span>
        <span style={col}>tris</span>
        <span style={col}>in view</span>
        <span style={{ ...col, width: 36 }}>share</span>
      </div>
      {inv.groups.slice(0, 12).map((g) => (
        <React.Fragment key={g.name}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span
              style={{ flex: 1, color: g.source === 'unnamed' ? '#fbbf24' : '#cbd5e1', ...clip }}
              title={`${g.meshes} meshes · ${g.instances} instances · ${g.shadowCasters} cast shadows · named by ${g.source}`}
            >
              {g.name}
              {g.source === 'ancestor' && <span style={dim}> (parent)</span>}
              {g.source === 'tag' && <span style={dim}> (tag)</span>}
            </span>
            <span style={{ ...col, ...bright }}>{compactCount(g.triangles)}</span>
            <span style={{ ...col, ...bright }}>{compactCount(g.inViewTriangles)}</span>
            <span style={{ ...col, width: 36, display: 'flex', justifyContent: 'flex-end' }}>
              <Bar share={g.triangles / total} width={32} />
            </span>
          </div>
          {g.name === 'unnamed' &&
            inv.unnamed.slice(0, 4).map((u) => (
              <div key={u.kind} style={{ display: 'flex', gap: 4, paddingLeft: 10, color: '#94a3b8', fontSize: 10 }}>
                <span style={{ flex: 1, ...clip }} title={u.kind}>
                  {u.kind}
                </span>
                <span>
                  {u.meshes}× · {compactCount(u.triangles)}
                </span>
              </div>
            ))}
        </React.Fragment>
      ))}
      <div style={{ ...dim, fontSize: 10, marginTop: 3 }}>
        {inv.objects.toLocaleString()} objects · walk {inv.tookMs.toFixed(1)} ms, once a second between frames.
        {unnamed && unnamed.triangles / total > 0.5 && ' Most triangles are unnamed: set object.name or userData.perfGroup.'}
      </div>
    </>
  );
};

// ── 6. What the camera sees ───────────────────────────────────────────────────

const ViewTab: React.FC<{
  s: PerfSnapshot;
  coverage: CoverageResult | { error: string } | null;
  measuring: boolean;
  onMeasure: () => void;
}> = ({ s, coverage, measuring, onMeasure }) => {
  const inv = s.inventory;
  return (
    <>
      {!inv && <div style={dim}>Walking the scenes…</div>}
      {inv &&
        inv.scenes
          .filter((sc) => sc.mountedTriangles > 16)
          .map((sc) => {
            const drawnBy = s.passes
              .filter((p) => p.sceneKey === sc.sceneKey)
              .sort((a, b) => b.triangles - a.triangles)[0];
            const culled = sc.mountedTriangles > 0 ? 1 - sc.inViewTriangles / sc.mountedTriangles : 0;
            return (
              <div key={sc.sceneKey} style={{ marginBottom: 3 }}>
                <div style={{ color: '#cbd5e1', ...clip }} title={`scene "${sc.label}" judged through ${sc.camera}`}>
                  {sc.label} <span style={dim}>via {sc.camera}</span>
                </div>
                <div style={row}>
                  <span>mounted · in view · drawn</span>
                  <span style={bright}>
                    {compactCount(sc.mountedTriangles)} · {compactCount(sc.inViewTriangles)} ·{' '}
                    {drawnBy ? compactCount(drawnBy.triangles) : '—'}
                  </span>
                </div>
                <div style={{ ...dim, fontSize: 10, ...clip }}>
                  the cull leaves out {Math.round(culled * 100)}% of the mounted triangles
                  {drawnBy ? ` · drawn in "${drawnBy.name}"` : ''}
                  {sc.unknownBounds ? ` · ${sc.unknownBounds} objects without bounds counted as in view` : ''}
                </div>
              </div>
            );
          })}
      {inv && (
        <div style={row}>
          <span>nearest water</span>
          <span style={inv.nearestWater ? bright : dim}>
            {inv.nearestWater
              ? `${inv.nearestWater.distanceM.toFixed(1)} m (${inv.nearestWater.group})`
              : inv.waterNamed
                ? 'no bounds yet'
                : 'no group is named water'}
          </span>
        </div>
      )}
      <div style={{ ...rule, margin: '5px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, color: '#94a3b8' }}>share of the screen</span>
        <button type="button" style={{ ...button, flex: '0 0 auto', padding: '1px 8px' }} onClick={onMeasure} disabled={measuring}
          title="Draw the camera's view once, one flat color per group, and count the pixels">
          {measuring ? 'measuring…' : 'measure'}
        </button>
      </div>
      {coverage && 'error' in coverage && <div style={{ color: '#fbbf24' }}>{coverage.error}</div>}
      {coverage && !('error' in coverage) && (
        <>
          {coverage.shares.slice(0, 7).map((c) => (
            <div key={c.group} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ flex: 1, color: /water|sea|ocean|river/i.test(c.group) ? '#38bdf8' : '#cbd5e1', ...clip }}>{c.group}</span>
              <span style={bright}>{(c.share * 100).toFixed(1)}%</span>
              <Bar share={c.share} width={40} />
            </div>
          ))}
          <div style={{ ...dim, fontSize: 10 }}>
            {coverage.width}×{coverage.height} ID render via {coverage.camera} · {coverage.tookMs.toFixed(0)} ms · visible surfaces only
          </div>
        </>
      )}
    </>
  );
};

// ── 4. Causes ─────────────────────────────────────────────────────────────────

const CausesTab: React.FC<{ s: PerfSnapshot }> = ({ s }) => {
  const cpu = Math.max(0.001, s.cpuMs ?? 0);
  const c1 = s.costs.lastSecond;
  const c10 = s.costs.lastTenSeconds;
  return (
    <>
      <div style={heading}>WHERE THE CPU GOES (mean ms a frame)</div>
      {s.cpuParts.length === 0 && <div style={dim}>No parts measured yet.</div>}
      {s.cpuParts.slice(0, 8).map((p) => (
        <div key={p.name} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ flex: 1, color: '#cbd5e1', ...clip }} title={p.name}>
            {p.name}
          </span>
          <span style={bright}>{p.ms.toFixed(2)}</span>
          <Bar share={p.ms / cpu} width={32} />
        </div>
      ))}
      <div style={{ ...rule, margin: '5px 0' }} />
      <div style={heading}>UPLOADS AND COMPILES</div>
      <div style={row}>
        <span>last second</span>
        <span style={bright}>
          tex {c1.textureUploads} ({formatBytes(c1.textureBytes)}) · buf {formatBytes(c1.bufferBytes)} · compiles {c1.compiles}
        </span>
      </div>
      <div style={row}>
        <span>last 10 s</span>
        <span style={bright} title={`texture ${c10.textureUploadMs.toFixed(1)} ms · buffer ${c10.bufferUploadMs.toFixed(1)} ms · compile ${c10.compileMs.toFixed(1)} ms`}>
          {c10.textureUploadMs.toFixed(1)} + {c10.bufferUploadMs.toFixed(1)} + {c10.compileMs.toFixed(1)} ms
          {c10.programsAdded > 0 ? ` · +${c10.programsAdded} prog` : ''}
        </span>
      </div>
      <div style={{ ...rule, margin: '5px 0' }} />
      <div style={{ ...heading, color: '#f87171' }}>SLOW FRAMES (newest first)</div>
      {s.stallLog.length === 0 && <div style={dim}>None in the window.</div>}
      {s.stallLog.slice(0, 5).map((rec) => (
        <StallRow key={rec.frame} rec={rec} detail />
      ))}
      <div style={{ ...dim, fontSize: 10, marginTop: 2 }}>
        Named causes are measured: this surface's script, each pass, uploads, compiles, and
        {` "${BROWSER_PREFIX}…" `}parts from Chrome's report of frames over 50 ms. What is left stays
        "outside the measured frame".
      </div>
    </>
  );
};

// ── 7. Memory that moves ──────────────────────────────────────────────────────

const MemoryTab: React.FC<{ s: PerfSnapshot }> = ({ s }) => {
  const m = s.memory;
  const rows: { name: string; now: string; last: number | null; per10: number | null; grow: boolean; unit: string }[] = [
    { name: 'geometries', now: String(s.counters.geometries), last: m.lastSecond?.geometries ?? null, per10: m.perSecondOver10s?.geometries ?? null, grow: m.growing.includes('geometries'), unit: '' },
    { name: 'textures', now: String(s.counters.textures), last: m.lastSecond?.textures ?? null, per10: m.perSecondOver10s?.textures ?? null, grow: m.growing.includes('textures'), unit: '' },
    { name: 'programs', now: s.counters.programs === null ? '—' : String(s.counters.programs), last: m.lastSecond?.programs ?? null, per10: m.perSecondOver10s?.programs ?? null, grow: m.growing.includes('programs'), unit: '' },
    { name: 'heap', now: s.heapMB === null ? '—' : `${s.heapMB.toFixed(0)} MB`, last: m.lastSecond?.heapMB ?? null, per10: m.perSecondOver10s?.heapMB ?? null, grow: m.growing.includes('heap'), unit: ' MB' },
  ];
  const col: React.CSSProperties = { width: 62, flex: '0 0 auto', textAlign: 'right' };
  const fmt = (v: number | null, unit: string) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(unit ? 2 : 1)}${unit}`);
  return (
    <>
      <div style={{ display: 'flex', gap: 4, ...dim, fontSize: 10 }}>
        <span style={{ flex: 1 }}>count</span>
        <span style={col}>now</span>
        <span style={col} title="Change over the last second">last 1 s</span>
        <span style={col} title="Mean change per second over the last ten seconds">10 s /s</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', gap: 4, color: r.grow ? '#f87171' : '#cbd5e1' }}>
          <span style={{ flex: 1 }} title={r.grow ? 'grew in every one of the last ten seconds: a leak, or a scene still loading' : ''}>
            {r.name}
            {r.grow && ' · growing'}
          </span>
          <span style={{ ...col, ...bright }}>{r.now}</span>
          <span style={col}>{fmt(r.last, r.unit)}</span>
          <span style={col}>{fmt(r.per10, r.unit)}</span>
        </div>
      ))}
      <div style={{ ...dim, fontSize: 10, marginTop: 3 }}>
        {m.heapCoarse
          ? 'The heap reading is coarse in this browser (Chrome without --enable-precise-memory-info), so a garbage collection cannot show.'
          : 'A heap fall of 1 MB or more in one frame is named on the slow frame as a garbage collection.'}
      </div>
    </>
  );
};

// ── 8. Compare ────────────────────────────────────────────────────────────────

const CompareTab: React.FC<{ s: PerfSnapshot; base: PerfSnapshot | null; baseAt: number | null; budgetMs: number; onMark: () => void }> = ({
  s,
  base,
  baseAt,
  budgetMs,
  onMark,
}) => {
  if (!base) {
    return (
      <>
        <div style={dim}>
          Mark saves the numbers now as a column. Change one thing, then read the marked and the live numbers side by side.
        </div>
        <button type="button" style={{ ...button, marginTop: 5, flex: '0 0 auto', padding: '2px 10px' }} onClick={onMark}>
          mark now
        </button>
      </>
    );
  }
  const w0 = readWork(base.frame.meanMs, base.gpu.meanMs, base.cpuMs, base.vsync, budgetMs);
  const w1 = readWork(s.frame.meanMs, s.gpu.meanMs, s.cpuMs, s.vsync, budgetMs);
  type Line = { name: string; a: number | null; b: number | null; digits: number; lowerIsBetter: boolean; count?: boolean };
  const lines: Line[] = [
    { name: 'fps', a: base.frame.fps, b: s.frame.fps, digits: 1, lowerIsBetter: false },
    { name: 'frame mean ms', a: base.frame.meanMs, b: s.frame.meanMs, digits: 2, lowerIsBetter: true },
    { name: 'frame p95 ms', a: base.frame.p95Ms, b: s.frame.p95Ms, digits: 2, lowerIsBetter: true },
    { name: 'GPU ms', a: base.gpu.meanMs, b: s.gpu.meanMs, digits: 2, lowerIsBetter: true },
    { name: 'CPU ms', a: base.cpuMs, b: s.cpuMs, digits: 2, lowerIsBetter: true },
    { name: 'longer side ms', a: w0.busiestMs, b: w1.busiestMs, digits: 2, lowerIsBetter: true },
    { name: 'draws', a: base.counters.drawCalls, b: s.counters.drawCalls, digits: 0, lowerIsBetter: true, count: true },
    { name: 'triangles', a: base.counters.triangles, b: s.counters.triangles, digits: 0, lowerIsBetter: true, count: true },
    { name: 'geometries', a: base.counters.geometries, b: s.counters.geometries, digits: 0, lowerIsBetter: true, count: true },
    { name: 'textures', a: base.counters.textures, b: s.counters.textures, digits: 0, lowerIsBetter: true, count: true },
  ];
  for (const p of s.passes) {
    const q = base.passes.find((x) => x.key === p.key);
    if (!q) continue;
    const useGpu = p.gpuMs !== null && q.gpuMs !== null;
    lines.push({ name: `${useGpu ? 'gpu' : 'cpu'}: ${p.name}`, a: useGpu ? q.gpuMs : q.cpuMs, b: useGpu ? p.gpuMs : p.cpuMs, digits: 2, lowerIsBetter: true });
  }
  const col: React.CSSProperties = { width: 56, flex: '0 0 auto', textAlign: 'right' };
  const fmt = (v: number | null, l: Line) => (v === null ? '—' : l.count ? compactCount(v) : v.toFixed(l.digits));
  return (
    <>
      <div style={{ display: 'flex', gap: 4, ...dim, fontSize: 10 }}>
        <span style={{ flex: 1 }}>marked {baseAt !== null ? `${Math.round((performance.now() - baseAt) / 1000)} s ago` : ''}</span>
        <span style={col}>marked</span>
        <span style={col}>live</span>
        <span style={col}>delta</span>
      </div>
      {lines.map((l) => {
        const d = l.a !== null && l.b !== null ? l.b - l.a : null;
        const better = d === null || d === 0 ? null : l.lowerIsBetter ? d < 0 : d > 0;
        return (
          <div key={l.name} style={{ display: 'flex', gap: 4 }}>
            <span style={{ flex: 1, color: '#cbd5e1', ...clip }} title={l.name}>
              {l.name}
            </span>
            <span style={col}>{fmt(l.a, l)}</span>
            <span style={{ ...col, ...bright }}>{fmt(l.b, l)}</span>
            <span style={{ ...col, color: better === null ? '#64748b' : better ? '#4ade80' : '#f87171' }}>
              {d === null ? '—' : l.count ? signedCount(d) : signed(d, l.digits)}
            </span>
          </div>
        );
      })}
      <div style={{ ...dim, fontSize: 10, marginTop: 3 }}>
        One pair proves nothing on a shared GPU: alternate A B A B with vsync off (--disable-gpu-vsync
        --disable-frame-rate-limit), in the same minutes, and read the spread between the two As. A number on the
        16.7 or 33.3 ms floor is a lower bound, not a cost.
      </div>
    </>
  );
};

/**
 * The display itself.
 *
 * Mount it through `PerfOverlayHost`, never straight into a page tree. The
 * host gives it a React root of its own, which stops its refresh timer from
 * restarting the page's own render work. `PerfOverlayHost.tsx` records what
 * that cost when the two shared a root.
 */
export const PerfOverlayView: React.FC = () => {
  const [mode, setMode] = useState<HudMode>(() => readMode());
  const [snapshots, setSnapshots] = useState<PerfSnapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [capture, setCapture] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [baselines, setBaselines] = useState<Record<string, { snap: PerfSnapshot; at: number }>>({});
  const [tab, setTab] = useState<DetailTab>(() =>
    readStored<DetailTab>(TAB_KEY, ['passes', 'groups', 'view', 'causes', 'memory', 'compare'], 'passes'),
  );
  const [budget, setBudget] = useState<BudgetChoice>(() => readStored<BudgetChoice>(BUDGET_KEY, ['display', '60', '30'], 'display'));
  const [coverage, setCoverage] = useState<Record<string, CoverageResult | { error: string }>>({});
  const [measuring, setMeasuring] = useState(false);

  useEffect(() => writeStored(STORAGE_KEY, mode), [mode]);
  useEffect(() => writeStored(TAB_KEY, tab), [tab]);
  useEffect(() => writeStored(BUDGET_KEY, budget), [budget]);

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

  // A badge in a window title bar asks for one surface through the registry,
  // because this view sits in a React root of its own and shares no state.
  useEffect(
    () =>
      subscribePerfPanelRequests((id) => {
        setActiveId(id);
        setMode('panel');
      }),
    [],
  );

  // With no choice made, show the first surface that is still drawing. The
  // renderer probe finds every canvas on a page, and a stopped one listed
  // first used to take the pill.
  const active = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshots.find((s) => s.id === activeId) ?? snapshots.find((s) => s.live) ?? snapshots[0];
  }, [snapshots, activeId]);
  const liveCount = snapshots.filter((s) => s.live).length;

  const bound = useMemo(
    () => (active ? classifyBottleneck(active.gpu.meanMs, active.cpuMs, active.frame.meanMs) : null),
    [active],
  );
  const budgetMs = active ? budgetMsFor(budget, active.vsync) : 1000 / 60;
  const work = useMemo(
    () => (active ? readWork(active.frame.meanMs, active.gpu.meanMs, active.cpuMs, active.vsync, budgetMs) : null),
    [active, budgetMs],
  );
  const marked = active ? baselines[active.id] ?? null : null;
  const baseline = marked?.snap ?? null;

  const sessionFor = useCallback((id: string) => getPerfSessions().find((s) => s.id === id) ?? null, []);

  const onCopy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, []);

  const toggleMark = useCallback(() => {
    if (!active) return;
    setBaselines((current) => {
      const next = { ...current };
      if (next[active.id]) delete next[active.id];
      else next[active.id] = { snap: active, at: performance.now() };
      return next;
    });
  }, [active]);

  const onMeasure = useCallback(() => {
    if (!active) return;
    const id = active.id;
    const order = [...new Set(active.passes.map((p) => p.sceneKey).filter((k): k is number => k !== null))];
    setMeasuring(true);
    // A task of its own, between frames: the page's own frame is never mid-draw.
    window.setTimeout(() => {
      measureScreenShare(id, order)
        .then((r) => setCoverage((c) => ({ ...c, [id]: r })))
        .catch((e) => setCoverage((c) => ({ ...c, [id]: { error: String(e) } })))
        .finally(() => setMeasuring(false));
    }, 0);
  }, [active]);

  if (mode === 'hidden') return null;

  const shell: React.CSSProperties = {
    position: 'fixed',
    right: 10,
    bottom: 10,
    // Above the full-window views (`&full=1` on the river and ocean pages sits at MAXIMUM, 9999), or the pill is covered: Remy, 2026-09-29, "i don't see it anywhere?".
    zIndex: Z_INDEX.MAXIMUM + 1,
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
          <>
            <span style={{ color: active.live ? fpsColor(fps) : '#475569', fontWeight: 700 }}>{fps.toFixed(0)} fps</span>
            {/* More than one surface is drawing: say so, so the reader knows
              * the number belongs to one of them. The panel has a tab each. */}
            {liveCount > 1 && (
              <span style={{ color: '#64748b' }} title={`${liveCount} surfaces are drawing`}>
                {' '}· {active.label} +{liveCount - 1}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: '#64748b' }}>no 3D</span>
        )}
      </button>,
      document.body,
    );
  }

  const cover = active ? coverage[active.id] ?? null : null;

  return createPortal(
    <div
      data-testid="perf-panel"
      style={{ ...shell, width: PANEL_W, padding: 8, maxHeight: 'calc(100vh - 20px)', overflowY: 'auto', boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <strong style={{ flex: 1, fontSize: 10, letterSpacing: 0.6, color: '#7dd3fc' }}>PERFORMANCE</strong>
        <span style={{ ...dim, fontSize: 10 }} title="The budget each pass and the headroom are judged against">
          budget
        </span>
        {(['display', '60', '30'] as BudgetChoice[]).map((b) => (
          <button key={b} type="button" style={chip(budget === b)} onClick={() => setBudget(b)}
            title={b === 'display' ? 'The refresh interval this page shows' : `${b} fps: ${(1000 / Number(b)).toFixed(1)} ms a frame`}>
            {b === 'display' ? 'display' : `${b}`}
          </button>
        ))}
        <button type="button" onClick={() => setMode('pill')} title="Collapse (Alt+P)" style={{ ...button, flex: '0 0 auto', padding: '1px 6px' }}>
          –
        </button>
      </div>

      {!active ? (
        <div style={{ color: '#64748b', padding: '6px 2px' }}>No three.js surface is drawing on this page.</div>
      ) : (
        <>
          {snapshots.length > 1 && (
            <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap' }}>
              {snapshots.map((s) => (
                <button type="button" key={s.id} onClick={() => setActiveId(s.id)} style={chip(s.id === active.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ ...row, marginBottom: 2 }}>
            <span style={{ color: '#cbd5e1' }}>{active.label}</span>
            <span
              style={{ color: active.live ? '#475569' : '#f59e0b' }}
              title={
                active.origin === 'auto'
                  ? 'Found by the renderer probe. Nothing on this surface named it; the label is its window title.'
                  : `Named "${active.id}" by the surface.`
              }
            >
              {active.live ? active.api : 'stopped'}
              {active.origin === 'auto' ? ' · auto' : ''}
            </span>
          </div>

          {/* A surface that stopped drawing has no frame rate. The last reading
            * is still shown, dimmed and labeled, because it describes the frame
            * on screen. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: active.live ? fpsColor(active.frame.fps) : '#475569' }}>
              {active.frame.fps.toFixed(0)}
            </span>
            <span style={dim}>{active.live ? 'fps' : 'fps when last drawn'}</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: active.live && active.stalls > 0 ? '#f87171' : '#475569' }}>
              {active.stalls} stall{active.stalls === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ margin: '4px 0 5px' }}>
            <FrameGraph history={active.history} width={PANEL_W - 16} height={38} budgetMs={budgetMs} />
          </div>

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

          <div style={{ ...row, marginTop: 4 }}>
            <span>gpu</span>
            {active.gpu.unavailable ? (
              <span style={{ color: '#64748b', textAlign: 'right' }}>{SHORT_UNAVAILABLE[active.gpu.unavailable]}</span>
            ) : active.gpu.meanMs === null ? (
              <span style={dim}>waiting…</span>
            ) : (
              <span style={bright}>
                {active.gpu.meanMs.toFixed(2)} ms<span style={dim}> · {active.gpu.worstMs.toFixed(2)} worst</span>
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
            <div style={{ marginTop: 3, textAlign: 'center', color: BOUND_COLOR[bound.kind], fontWeight: 700, ...clip }}>{bound.label}</div>
          )}

          {work && <VsyncBlock s={active} work={work} />}

          <div style={rule} />

          <div style={row}>
            <span>draws</span>
            <span style={bright}>
              {active.counters.drawCalls.toLocaleString()} calls · {active.counters.triangles.toLocaleString()} tris
              {/* A wireframe view draws LINES, so its triangle count reads near
                * zero (the golem: 126 calls, 2 tris). Say what it drew. */}
              {active.counters.lines > 0 ? ` · ${compactCount(active.counters.lines)} lines` : ''}
              {active.counters.points > 0 ? ` · ${compactCount(active.counters.points)} points` : ''}
            </span>
          </div>
          {active.counters.computeCalls > 0 && (
            <div style={row}>
              <span>compute</span>
              {/* Calls to renderer.compute, not dispatches: one call can run a
                * whole list of compute nodes (the ocean runs 15 in one call). */}
              <span style={bright}>{active.counters.computeCalls} calls per frame</span>
            </div>
          )}
          <div style={row}>
            <span>memory</span>
            <span style={bright}>
              {active.counters.geometries} geo · {active.counters.textures} tex
              {active.counters.programs !== null ? ` · ${active.counters.programs} prog` : ''}
            </span>
          </div>
          <div style={row}>
            <span>surface</span>
            <span style={bright}>
              {active.surface.width}×{active.surface.height} @{active.surface.dpr.toFixed(1)}
              {active.heapMB !== null ? ` · ${active.heapMB.toFixed(0)} MB` : ''}
            </span>
          </div>

          {/* Renderer totals include every pass, but cannot identify who made
            * them. A scene probe supplies that missing component breakdown. */}
          {active.scene && (
            <>
              <div style={rule} />
              <div style={{ ...row, color: '#7dd3fc' }}>
                <span>SCENE COST</span>
                <span title="Submitted triangles divided by mounted main-pass triangles. Values above 1 include shadow and post-processing work.">
                  {(active.counters.triangles / Math.max(1, active.scene.triangles)).toFixed(2)}x pass load
                </span>
              </div>
              <div style={row}>
                <span>mounted</span>
                <span style={bright}>
                  {compactCount(active.scene.triangles)} main · {compactCount(active.scene.shadowTriangles)} shadow
                </span>
              </div>
              <div style={row}>
                <span>objects</span>
                <span style={bright}>
                  {compactCount(active.scene.meshes)} meshes · {compactCount(active.scene.instances)} instances
                </span>
              </div>
              {active.scene.families.slice(0, 5).map((family) => {
                const share = active.scene!.triangles > 0 ? Math.round((family.triangles / active.scene!.triangles) * 100) : 0;
                return (
                  <div
                    style={{ ...row, paddingLeft: 6 }}
                    key={family.family}
                    title={`${family.meshes.toLocaleString()} meshes · ${family.instances.toLocaleString()} instances · ${family.shadowTriangles.toLocaleString()} potential shadow triangles`}
                  >
                    <span style={{ color: '#cbd5e1' }}>{family.family}</span>
                    <span style={bright}>
                      {share}% · {compactCount(family.triangles)} tris
                      {family.shadowTriangles > 0 ? ` · ${compactCount(family.shadowTriangles)} shadow` : ''}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {active.spans.length > 0 && (
            <>
              <div style={rule} />
              {active.spans.map((sp) => (
                <div style={row} key={sp.name}>
                  <span>{sp.name}</span>
                  <span style={bright}>{sp.ms.toFixed(2)} ms</span>
                </div>
              ))}
            </>
          )}

          {/* Readings only this surface knows (a solver's cell count). */}
          {active.stats.length > 0 && (
            <>
              <div style={rule} />
              {active.stats.map((st) => (
                <div style={row} key={st.name}>
                  <span>{st.name}</span>
                  <span style={bright}>{st.value}</span>
                </div>
              ))}
            </>
          )}

          {baseline && (
            <div style={{ marginTop: 4, color: '#bae6fd', fontSize: 10 }}>
              Δ frame {signed(active.frame.meanMs - baseline.frame.meanMs)} ms · tris{' '}
              {signedCount(active.counters.triangles - baseline.counters.triangles)} · see compare
            </div>
          )}

          <div style={rule} />

          {/* The diagnosis, one topic at a time. */}
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 5 }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" style={chip(tab === t.id)} onClick={() => setTab(t.id)} title={t.title}>
                {t.label}
                {t.id === 'causes' && active.stallLog.length > 0 ? ` ${active.stallLog.length}` : ''}
                {t.id === 'memory' && active.memory.growing.length > 0 ? ' !' : ''}
              </button>
            ))}
          </div>
          <div data-testid={`perf-tab-${tab}`}>
            {tab === 'passes' && <PassesTab s={active} budgetMs={budgetMs} />}
            {tab === 'groups' && <GroupsTab s={active} />}
            {tab === 'view' && <ViewTab s={active} coverage={cover} measuring={measuring} onMeasure={onMeasure} />}
            {tab === 'causes' && <CausesTab s={active} />}
            {tab === 'memory' && <MemoryTab s={active} />}
            {tab === 'compare' && <CompareTab s={active} base={baseline} baseAt={marked?.at ?? null} budgetMs={budgetMs} onMark={toggleMark} />}
          </div>

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
              title="Copy the live reading and the diagnosis as text"
            >
              {copied ? 'copied' : 'copy'}
            </button>
            <button
              type="button"
              style={{ ...button, color: baseline ? '#082f49' : '#cbd5e1', background: baseline ? '#7dd3fc' : 'rgba(30,41,59,0.9)' }}
              onClick={toggleMark}
              title={baseline ? 'Clear the marked column' : 'Save the numbers now as the marked column (see compare)'}
            >
              {baseline ? 'unmark' : 'mark'}
            </button>
            <button type="button" style={button} onClick={() => sessionFor(active.id)?.reset()} title="Throw away the window after a rebuild">
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

export default PerfOverlayView;
