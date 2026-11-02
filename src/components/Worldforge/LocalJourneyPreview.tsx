// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 09:12:52
 * Dependents: components/Worldforge/AtlasDemo.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { LocalJourneyQuote } from '../../systems/worldforge/travel/localGroundJourney';
import { useEffect, useRef } from 'react';
import { formatTravelTime } from '../../systems/travel/travelReadout';
import { Button } from '../ui/Button';

/** Review a real journey before spending time or replacing the accepted ground body. */
export function LocalJourneyPreview({ quote, onCancel, onConfirm }: {
  quote: LocalJourneyQuote; onCancel: () => void; onConfirm: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; cancel.current?.focus(); return () => previous?.focus(); }, []);
  const minutes = Math.ceil(quote.totalSeconds / 60);
  // The existing quote already includes resolved navigation and event time.
  // Explain that total without changing its rolls, costs or arrival effects.
  // Older callers without a route-time field keep their complete total.
  const routeSeconds = Number.isFinite(quote.meta.seconds) ? quote.meta.seconds : quote.totalSeconds;
  const delaySeconds = Math.max(0, quote.totalSeconds - routeSeconds);
  return <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="local-journey-title" onKeyDown={event => { if (event.key === 'Escape') onCancel(); if (event.key === 'Tab') { event.preventDefault(); const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'); const index = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus(); } }} className="w-full max-w-lg rounded-xl border border-amber-700 bg-stone-950 p-5 text-stone-100 shadow-2xl">
      <h2 id="local-journey-title" className="text-xl font-semibold text-amber-200">Journey to {quote.label}</h2>
      <p className="mt-3">Walk {(quote.route.miles * 1.609344).toFixed(2)} km {quote.routeKind === 'town-streets'
        ? 'along mapped town streets. Maintained roads provide clear wayfinding; travel events and costs still apply.'
        : 'through the surrounding country, using its surveyed land and crossings.'}</p>
      <dl className="my-4 grid grid-cols-2 gap-2">
        {delaySeconds > 0 && <>
          <dt>Route time</dt><dd>{formatTravelTime(Math.ceil(routeSeconds / 60))}</dd>
          <dt>Navigation and delays</dt><dd>{formatTravelTime(Math.ceil(delaySeconds / 60))}</dd>
        </>}
        <dt>{delaySeconds > 0 ? 'Total travel time' : 'Travel time'}</dt><dd>{formatTravelTime(minutes)}</dd>
        <dt>Food / water spent</dt><dd>{quote.meta.provision?.rationsToSpend ?? 0} / {quote.meta.provision?.waterToSpend ?? 0}</dd>
        <dt>Encounter risk</dt><dd>{Math.round(quote.encounterChance * 100)}%</dd>
      </dl>
      <p className="text-sm text-stone-300">Travel time counts toward your next supply day. The total includes navigation and delays; the journey log records what happens.</p>
      {quote.meta.forcedMarch && <p className="mt-3 text-amber-300">This journey risks exhaustion from a forced march.</p>}
      {quote.refusal && <p role="alert" className="mt-3 text-red-300">{quote.refusal}</p>}
      <div className="mt-5 flex justify-end gap-3">
        {/* Shared Button style. Button forwards the ref, so "Stay here" still takes the first focus. */}
        <Button ref={cancel} type="button" variant="secondary" onClick={onCancel}>Stay here</Button>
        <Button type="button" variant="action" onClick={onConfirm} disabled={!quote.allowed}>Set out on foot</Button>
      </div>
    </section>
  </div>;
}
