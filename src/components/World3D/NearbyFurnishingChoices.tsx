/** Connect the reached-object list to the physical object under consideration.
 * Room, compass direction and distance distinguish matching furniture. Hover
 * and keyboard focus nominate one outline; examination still uses the original
 * action and its live reach, room, source and permission checks. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 20:26:15
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, {useEffect, useState} from 'react';
import {Button} from '../ui/Button';
import type {NearbyFurnishingAction} from './NearbyFurnishing';

export function NearbyFurnishingChoices({actions, onFocusTarget}: {
  actions: readonly NearbyFurnishingAction[];
  onFocusTarget: (id: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const available = (id: string | null) => id !== null && actions.some(action => action.id === id);
  const active = available(hovered) ? hovered : available(focused) ? focused : null;
  useEffect(() => { onFocusTarget(active); }, [active, onFocusTarget]);
  useEffect(() => () => onFocusTarget(null), [onFocusTarget]);
  if (!actions.length) return null;
  return <section aria-label="Nearby furnishings" className="max-w-2xl rounded border border-amber-300/40 bg-slate-950 p-3 text-sm text-slate-100 shadow-xl">
    <h3 className="mb-2 font-semibold text-amber-200">Nearby furnishings</h3>
    <div className="flex flex-wrap gap-2">{actions.map(action =>
      <Button key={action.id} size="sm" variant="secondary" className="text-left"
        aria-label={`Examine ${action.name}${action.detail ? ', '+action.detail : ''}`}
        onMouseEnter={() => setHovered(action.id)} onMouseLeave={() => setHovered(null)}
        onFocus={() => setFocused(action.id)} onBlur={() => setFocused(null)}
        onClick={action.activate}>
        <span className="block">Examine {action.name}</span>
        {action.detail && <span className="block text-xs font-normal text-slate-300">{action.detail}</span>}
      </Button>)}</div>
  </section>;
}
