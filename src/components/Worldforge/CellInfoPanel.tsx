/**
 * @file src/components/Worldforge/CellInfoPanel.tsx
 * Floating panel that reports the contents of a selected atlas cell.
 * Rendered by AtlasDemo when a cell is clicked; reads a pure CellInfo summary
 * (systems/worldforge/cellInfo) and offers a "Descend into region" action that
 * hands off to the existing L1 region generation.
 */

import React from "react";
import { MapPin, X, Layers, Mountain, Waves, Users, Crown, Anchor } from "lucide-react";
import type { CellInfo } from "../../systems/worldforge/cellInfo";

export interface CellInfoPanelProps {
  info: CellInfo;
  /** Close the panel (clear selection). */
  onClose: () => void;
  /** Descend into the L1 region for this cell (land cells only). */
  onDescend: (cellId: number) => void;
}

const Row: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
      {icon}
      {label}
    </span>
    <span className="text-xs font-mono text-gray-100 text-right">{value}</span>
  </div>
);

const CellInfoPanel: React.FC<CellInfoPanelProps> = ({ info, onClose, onDescend }) => {
  const isLand = info.terrain === "land";

  return (
    <div
      data-testid="cell-info-panel"
      className="pointer-events-auto w-72 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-800 bg-gray-950/50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600/20 text-indigo-400 p-1.5 rounded-md border border-indigo-500/30">
            <MapPin size={14} />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-100">
              {info.burg ? info.burg.name : info.state ? info.state.name : `Cell #${info.cellId}`}
            </div>
            <div className="text-[10px] text-gray-400 font-mono">Cell #{info.cellId}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid="cell-info-close"
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-2 divide-y divide-gray-800/60">
        <Row
          label="Terrain"
          icon={isLand ? <Mountain size={12} /> : <Waves size={12} />}
          value={isLand ? `Land (h ${info.height})` : `Water (h ${info.height})`}
        />
        {info.biome && <Row label="Biome" icon={<Layers size={12} />} value={info.biome} />}
        {info.state && <Row label="State" icon={<Crown size={12} />} value={info.state.name} />}
        {info.province && <Row label="Province" value={info.province.name} />}
        {info.culture && <Row label="Culture" value={info.culture.name} />}
        {info.religion && <Row label="Religion" value={info.religion.name} />}
        {info.burg && (
          <Row
            label="Settlement"
            icon={info.burg.port ? <Anchor size={12} /> : <Users size={12} />}
            value={
              <span>
                {info.burg.capital ? "★ " : ""}
                {info.burg.population.toLocaleString()} pop
              </span>
            }
          />
        )}
        {info.ruralPopulation != null && (
          <Row label="Rural pop." icon={<Users size={12} />} value={info.ruralPopulation.toLocaleString()} />
        )}
        {info.hasRiver && <Row label="River" icon={<Waves size={12} />} value="Yes" />}
        <Row
          label="Position"
          value={`${info.positionFt.x.toLocaleString()}, ${info.positionFt.y.toLocaleString()} ft`}
        />
      </div>

      {/* Action */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-950/30">
        <button
          type="button"
          disabled={!isLand}
          onClick={() => onDescend(info.cellId)}
          data-testid="cell-info-descend"
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 px-4 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
          title={isLand ? "Generate the L1 region for this cell" : "Water cells cannot be entered"}
        >
          <Layers size={14} />
          {isLand ? "Descend into region" : "Water — no region"}
        </button>
      </div>
    </div>
  );
};

export default CellInfoPanel;
