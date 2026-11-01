/**
 * Shows the belongings inside one physically reached household container.
 * Repeated catalog IDs share a display row, but the source manifest, ownership
 * and inventory remain untouched. Expanding a row reads the existing item's
 * description; it does not create a book's contents or permission to take goods.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 13:54:30
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { ALL_ITEMS } from '../../data/items';
import type { ContainerManifest } from '../../systems/worldforge/interior/manifests';

export function HouseholdContainerContents({ manifest }: { manifest: ContainerManifest }) {
  const quantities = new Map<string, number>();
  for (const entry of manifest.entries) {
    quantities.set(entry.itemId, (quantities.get(entry.itemId) ?? 0) + entry.qty);
  }

  return <section aria-label="Household belongings" className="mt-3">
    <h4 className="font-semibold">Belongings of this household</h4>
    <ul className="mt-2 space-y-2">
      {[...quantities].map(([itemId, qty]) => {
        const item = ALL_ITEMS[itemId];
        const label = `${qty} × ${item?.name ?? itemId.replace(/[-_]/g, ' ')}`;
        return <li key={itemId}>
          {item?.description ? <details className="rounded border border-slate-700 bg-slate-900 p-2">
            <summary className="cursor-pointer text-amber-100">{label}</summary>
            <p className="mt-2 text-slate-300">{item.description}</p>
          </details> : <p className="px-2">{label}</p>}
        </li>;
      })}
    </ul>
  </section>;
}
