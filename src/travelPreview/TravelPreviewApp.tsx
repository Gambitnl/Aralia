/**
 * @file TravelPreviewApp.tsx — standalone harness for the Worldforge travel-mode
 * route preview, decoupled from game state.
 *
 * Generates a world, builds the travel graph + single-source route field from a
 * chosen origin, and mounts `AtlasSvgView` in travel mode: hover any cell to see
 * the fastest route line + a time/distance/danger readout. Pick a transport to
 * change speed and mobility (a flying mount crosses water a horse can't); click a
 * cell to move the origin. Served on its own port via `.claude/launch.json`
 * ("dev:travel") so travel mode can be exercised without starting a full game.
 */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import AtlasSvgView from '../components/Worldforge/AtlasSvgView';
import type { CellTraits } from '../components/Worldforge/atlasSvg';
import { generateFmgWorld } from '../systems/worldforge/fmg/generateWorld';
import {
  buildAtlasTravelGraph, buildRoadCells, atlasMilesPerUnit, transportMobility,
} from '../systems/worldforge/travel/atlasTravelGraph';
import { planRoutesFrom, transportSpeedMph } from '../systems/travel/routePlanning';
import { STANDARD_VEHICLES, type TransportOption } from '../types/travel';

interface TransportChoice {
  id: string;
  label: string;       // travel-readout label
  option: TransportOption;
}
const TRANSPORTS: TransportChoice[] = [
  { id: 'foot', label: 'on foot', option: { method: 'walking' } },
  { id: 'horse', label: 'by horse', option: { method: 'mounted', vehicle: STANDARD_VEHICLES.riding_horse } },
  { id: 'cart', label: 'by cart', option: { method: 'vehicle', vehicle: STANDARD_VEHICLES.cart } },
  { id: 'boat', label: 'by boat', option: { method: 'vehicle', vehicle: STANDARD_VEHICLES.keelboat } },
  { id: 'griffon', label: 'by griffon', option: { method: 'mounted', vehicle: { id: 'griffon', name: 'Griffon', speed: 80, capacityWeight: 400, type: 'air' } } },
];

/** First capital burg's cell, else any land cell nearest the map centre. */
function defaultOrigin(atlas: ReturnType<typeof generateFmgWorld>): number {
  const pack = atlas.pack as unknown as {
    burgs?: Array<{ cell?: number; capital?: number; removed?: number }>;
    cells: { h: ArrayLike<number>; p: Array<[number, number]> };
  };
  const capital = (pack.burgs ?? []).find((b) => b.capital && b.cell != null && !b.removed);
  if (capital?.cell != null) return capital.cell;
  const cx = atlas.graphWidth / 2, cy = atlas.graphHeight / 2;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pack.cells.h.length; i++) {
    if ((pack.cells.h[i] ?? 0) < 20) continue;
    const p = pack.cells.p[i];
    if (!p) continue;
    const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export default function TravelPreviewApp(): React.ReactElement {
  const [seed, setSeed] = useState('761');
  const [transportId, setTransportId] = useState('foot');
  const transport = TRANSPORTS.find((t) => t.id === transportId)!;

  const atlas = useMemo(() => generateFmgWorld(seed), [seed]);
  const roadCells = useMemo(() => buildRoadCells(atlas), [atlas]);
  const milesPerUnit = useMemo(() => atlasMilesPerUnit(atlas), [atlas]);

  const [origin, setOrigin] = useState(() => defaultOrigin(atlas));
  useEffect(() => { setOrigin(defaultOrigin(atlas)); }, [atlas]);

  // Single-source route field: rebuilt only when the world / origin / transport
  // changes, so hovering any cell reconstructs its route instantly.
  const field = useMemo(() => {
    const mobility = transportMobility(transport.option);
    const graph = buildAtlasTravelGraph(atlas, { roadCells, mobility });
    return planRoutesFrom(graph, origin, { milesPerUnit, speedMph: transportSpeedMph(transport.option) });
  }, [atlas, roadCells, milesPerUnit, origin, transport]);

  const planRoute = useCallback((toCell: number) => field.to(toCell), [field]);
  const onPickCell = useCallback((info: CellTraits) => setOrigin(info.i), []);

  const originPos = (atlas.pack as unknown as { cells: { p: Array<[number, number]> } }).cells.p[origin];
  const marker = originPos ? { x: originPos[0], y: originPos[1] } : null;

  // Fill the viewport below the control bar.
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 56 });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight - 56 });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#e2e8f0' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px', background: '#0f1b2a', borderBottom: '1px solid #1e293b' }}>
        <strong style={{ color: '#f5c542' }}>Travel Mode Preview</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Seed
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            style={{ width: 90, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, padding: '3px 6px' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Transport
          <select
            value={transportId}
            onChange={(e) => setTransportId(e.target.value)}
            data-testid="travel-transport"
            style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, padding: '3px 6px' }}
          >
            {TRANSPORTS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          Hover a cell to preview the fastest route · click a cell to move the origin · ⌖ marks the origin
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AtlasSvgView
          atlas={atlas}
          width={size.w}
          height={size.h}
          marker={marker}
          onPickCell={onPickCell}
          travelActive
          planRoute={planRoute}
          transportLabel={transport.label}
        />
      </div>
    </div>
  );
}
