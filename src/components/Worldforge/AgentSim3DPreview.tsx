/**
 * @file AgentSim3DPreview.tsx — standalone 3D proof for the agent-walking render.
 *
 * Reachable at `?phase=agentsim3d`. A self-contained R3F scene (no chunk streaming,
 * no game session) that builds a demo town + roster, wraps it in a minimal
 * GroundWorld, and renders the real `<GroundAgents>` InstancedMesh over a flat
 * plane with the town's building plots as low boxes. Scrub the clock and the
 * townsfolk walk the streets between buildings — the in-3D counterpart to the 2D
 * `?phase=agentsim` preview, reachable WITHOUT the load-save → Enter-3D → click-cell
 * chain (which the headless preview can't drive). Light enough to screenshot.
 */
import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { rootSeedPath } from '../../systems/worldforge/seedPath';
import { generateTownPlan } from '../../systems/worldforge/town/generateTownPlan';
import { generateTownRoster } from '../../systems/worldforge/roster/generateTownRoster';
import { groundSurfaceY, type GroundWorld } from '../../systems/worldforge/bridge/groundChunkLoader';
import GroundAgents from '../World3D/GroundAgents';

const FT = 0.3048;
const SYLL = ['ar', 'be', 'cor', 'dun', 'el', 'fen', 'gor', 'hal', 'kel', 'mor', 'tan', 'wyn'];

function buildDemoSite(seed: number) {
  const size = 1800;
  const envelope = { x: 10_000, y: 20_000, width: size, height: size };
  const cx = envelope.x + size / 2;
  const cy = envelope.y + size / 2;
  const gates: Array<[number, number]> = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + (seed % 7) * 0.1;
    gates.push([cx + Math.cos(a) * (size / 2), cy + Math.sin(a) * (size / 2)]);
  }
  return { burgId: 9001, envelope, gates };
}

function buildDemoGround(seed: number) {
  const seedPath = rootSeedPath(seed);
  const site = buildDemoSite(seed);
  const plan = generateTownPlan(site, seedPath);
  const nameFor = (rng: { next(): number }) => {
    let s = '';
    const n = 2 + Math.floor(rng.next() * 2);
    for (let i = 0; i < n; i++) s += SYLL[Math.floor(rng.next() * SYLL.length)];
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const roster = generateTownRoster(plan, seedPath, { nameFor });
  const boundsFeet = { x: site.envelope.x, y: site.envelope.y };
  const cols = 64;
  const rows = 64;
  // Minimal GroundWorld: only the fields groundAgentScenePositions reads. Flat
  // terrain (height 50) so figures stand on a level plane.
  const ground = {
    cols, rows,
    // Height 0 → flat ground near y=0 (avoid the streamed world's vertical
    // exaggeration lifting the whole scene ~900 m up, off-camera).
    heights: new Array(cols * rows).fill(0),
    biomeIds: [],
    extentMetersX: site.envelope.width * FT,
    extentMetersZ: site.envelope.height * FT,
    features: [], hostiles: [], hiddenSites: [], rivers: [], roads: [], towns: [], buildings: [],
    rosters: [roster],
    occupants: [],
    townPlans: [{ burgId: site.burgId, plan }],
    boundsFeet,
  } as unknown as GroundWorld;
  return { ground, plan, boundsFeet, size: site.envelope.width };
}

const AgentSim3DPreview: React.FC = () => {
  const [seed] = useState(42);
  const [clock, setClock] = useState(7.5);
  const [figureScale, setFigureScale] = useState(6);

  const { ground, plan, boundsFeet, size } = useMemo(() => buildDemoGround(seed), [seed]);

  // Center the town at the scene origin so the camera framing is simple.
  const centerXm = (size / 2) * FT;
  const centerZm = (size / 2) * FT;
  const sceneOrigin = { x: centerXm, z: centerZm };
  const surfaceY = useMemo(() => groundSurfaceY(ground, centerXm, centerZm), [ground, centerXm, centerZm]);

  // Building plots as low boxes (context), centered via the same origin.
  const buildings = useMemo(
    () =>
      plan.plots.map((p) => {
        const cx = p.footprint.reduce((a, q) => a + q[0], 0) / p.footprint.length;
        const cy = p.footprint.reduce((a, q) => a + q[1], 0) / p.footprint.length;
        const x = (cx - boundsFeet.x) * FT - centerXm;
        const z = (cy - boundsFeet.y) * FT - centerZm;
        const market = p.role === 'market' || p.role === 'workshop';
        return { id: p.id, x, z, market };
      }),
    [plan, boundsFeet, centerXm, centerZm],
  );

  const span = size * FT; // ~548 m
  const hh = String(Math.floor(clock)).padStart(2, '0');
  const mm = String(Math.floor((clock % 1) * 60)).padStart(2, '0');

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Agent-Sim 3D Preview</h1>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
          Demo burg in the real 3D scene — orange figures are townsfolk walking the streets at {hh}:{mm}. Scrub the clock.
        </p>
      </div>
      <div style={{ flex: 1, position: 'relative' }} data-testid="agentsim3d-canvas">
        <Canvas
          camera={{ position: [0, span * 0.55, span * 0.7], fov: 45, far: 5000 }}
          onCreated={({ camera }) => camera.lookAt(0, surfaceY, 0)}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[300, 400, 200]} intensity={1.6} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, surfaceY, 0]}>
            <planeGeometry args={[span * 1.4, span * 1.4]} />
            <meshStandardMaterial color="#3a4a32" />
          </mesh>
          {buildings.map((b) => (
            <mesh key={b.id} position={[b.x, surfaceY + 4, b.z]}>
              <boxGeometry args={[14, 8, 14]} />
              <meshStandardMaterial color={b.market ? '#7a5a2a' : '#555a66'} />
            </mesh>
          ))}
          <GroundAgents ground={ground} clock={clock} sceneOrigin={sceneOrigin} figureScale={figureScale} />
        </Canvas>
      </div>
      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong style={{ width: 60, fontVariantNumeric: 'tabular-nums' }}>{hh}:{mm}</strong>
          <input type="range" min={0} max={24} step={0.05} value={clock} onChange={(e) => setClock(Number(e.target.value))} style={{ flex: 1 }} data-testid="agentsim3d-clock" />
          {[3, 6, 7.5, 12, 18].map((h) => (
            <button key={h} onClick={() => setClock(h)} style={{ padding: '4px 10px', borderRadius: 6, background: '#334155', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12 }}>
              {String(Math.floor(h)).padStart(2, '0')}:{String(Math.floor((h % 1) * 60)).padStart(2, '0')}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
          <span>Figure scale ×{figureScale}</span>
          <input type="range" min={1} max={12} step={1} value={figureScale} onChange={(e) => setFigureScale(Number(e.target.value))} style={{ width: 160 }} />
        </div>
      </div>
    </div>
  );
};

export default AgentSim3DPreview;
