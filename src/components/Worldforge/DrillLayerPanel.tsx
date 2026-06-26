import React, { useState } from 'react';
import { DRILL_LAYER_DEFS, type DrillLayerId, type LayerDef } from './useDrillLayers';

export interface DrillLayerPanelProps<K extends string> {
  layers: Record<K, boolean>;
  toggle: (id: K) => void;
  /** Toggle definitions to show; defaults to the region/submap set. */
  defs?: ReadonlyArray<LayerDef<K>>;
}

/**
 * Compact layer toggle menu for the drill tiers (region / submap / town),
 * mirroring the atlas Layers menu but with the feature toggles that exist at that
 * tier (passed via `defs`). Top-right, above the breadcrumb/ascend controls.
 * Generic over the toggle id set so each tier keeps its own typed layers.
 */
function DrillLayerPanel<K extends string = DrillLayerId>({ layers, toggle, defs }: DrillLayerPanelProps<K>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const items = defs ?? (DRILL_LAYER_DEFS as ReadonlyArray<LayerDef<string>> as ReadonlyArray<LayerDef<K>>);
  return (
    <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'sans-serif', zIndex: 3 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="drill-layers-toggle"
        style={{
          background: 'rgba(15,30,45,0.85)', color: '#e2e8f0', border: '1px solid #475569',
          borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer',
        }}
      >
        ☰ Layers
      </button>
      {open ? (
        <div
          data-testid="drill-layers-panel"
          style={{
            marginTop: 4, background: 'rgba(15,30,45,0.92)', border: '1px solid #475569',
            borderRadius: 4, padding: '6px 8px', minWidth: 120,
          }}
        >
          {items.map((d) => (
            <label
              key={d.id}
              title={d.desc}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0', fontSize: 12, padding: '2px 0', cursor: 'pointer' }}
            >
              <input type="checkbox" checked={!!layers[d.id]} onChange={() => toggle(d.id)} />
              {d.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default DrillLayerPanel;
