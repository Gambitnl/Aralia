/** Reviews the innkeeper's real-bed offer before any coin is spent. The world
 * reducer closes this dialog only after payment and permission commit together. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 12:04:05
 * Dependents: components/layout/GameModals.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useRef, useState } from 'react';
import type { LodgingOffer } from '../../types/rest';
import { ModalDialog } from './ModalDialog';
import { formatGpAsCoins } from '../../utils/character';

export default function LodgingModal({ offer, gold, error, onConfirm, onClose }: {
  offer: LodgingOffer; gold: number; error?: string;
  onConfirm: () => void | Promise<void>; onClose: () => void;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const close = () => { if (!pending.current) onClose(); };
  const confirm = async () => {
    if (pending.current || gold < offer.costGp) return;
    pending.current = true; setBusy(true); setFailure(null);
    try { await onConfirm(); }
    catch (cause) { setFailure(cause instanceof Error ? cause.message : 'The stay could not be reserved.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <ModalDialog isOpen id="lodging" ariaLabel="Reserve guest beds" title="Reserve guest beds" onClose={close} size="lg"
    footer={<>
      <button type="button" onClick={close} disabled={busy} className="min-h-11 rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-50">Cancel</button>
      <button type="button" onClick={confirm} disabled={busy || gold < offer.costGp} className="min-h-11 rounded bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Reserving…' : `Reserve for ${formatGpAsCoins(offer.costGp)}`}</button>
    </>}>
    <div className="space-y-3 text-sm text-slate-200">
      <p><strong>{offer.keeperName}</strong> offers {offer.beds.length} guest bed(s) at <strong>{offer.businessName}</strong>.</p>
      <p>The total is <strong>{formatGpAsCoins(offer.costGp)}</strong>. Payment reserves these beds for your current party for 24 hours and covers one eight-hour rest. Food and water are separate.</p>
      <ul className="list-inside list-disc">{offer.beds.map((bed, index) => <li key={`${bed.level}:${bed.index}`}>{offer.roomLabels?.[index] ?? `Guest bed, ${bed.level === 0 ? 'ground floor' : `floor ${bed.level}`}`}</li>)}</ul>
      <p>Reach a reserved bed through the inn before resting. Reserving does not move the party or grant recovery. Normal rest eligibility and cooldown still apply.</p>
      <p>The room payment is not refunded if you leave it unused. You can cancel this offer before paying.</p>
      {gold < offer.costGp && <p role="alert" className="text-amber-200">You have {formatGpAsCoins(gold)} and cannot afford this stay.</p>}
      {(error || failure) && <p role="alert" className="text-red-300">{error || failure}</p>}
    </div>
  </ModalDialog>;
}
