// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:54:15
 * Dependents: components/screens/AppPhaseContent.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../types/state';
import type { SaveLoadResult } from '../../services/saveLoadService';
import {
  createDefeatSlotId, defeatSlotFromSearch, loadDefeatChronicle, saveDefeatChronicle,
} from '../../services/combatDefeatService';

interface Props {
  gameState: GameState;
  title: string;
  onRestore: (state: GameState) => void;
  onReturnToMainMenu: () => void;
}

/** The terminal record owns the earned aftermath; recovery remains an explicit older save. */
export default function GameOverScreen({ gameState, title, onRestore, onReturnToMainMenu }: Props) {
  const snapshot = useRef(gameState);
  const restore = useRef(onRestore);
  restore.current = onRestore;
  const heading = useRef<HTMLHeadingElement>(null);
  const [initial] = useState(() => {
    const requested = defeatSlotFromSearch(typeof window === 'undefined' ? '' : window.location.search);
    if (requested && gameState.party.length && gameState.lastCombatOutcome?.chronicleSlotId === requested) {
      return { mode: 'ready' as const, slot: requested };
    }
    if (requested) return { mode: 'load' as const, slot: requested };
    if (gameState.party.length && gameState.lastCombatOutcome?.result === 'defeat') {
      return { mode: 'save' as const, slot: createDefeatSlotId() };
    }
    return { mode: 'empty' as const, slot: '' };
  });
  const [status, setStatus] = useState<'saving' | 'loading' | 'saved' | 'empty' | 'error'>(
    initial.mode === 'ready' ? 'saved' : initial.mode === 'empty' ? 'empty' : initial.mode === 'save' ? 'saving' : 'loading',
  );
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const attempt = useRef<{ retry: number; promise: Promise<SaveLoadResult> } | null>(null);

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (initial.mode === 'empty' || initial.mode === 'ready') return;
    // React's repeated effect setup must join the same write. A real retry
    // keeps this record's slot too, rather than creating duplicate defeats.
    if (!attempt.current || attempt.current.retry !== retry) {
      setStatus(initial.mode === 'save' ? 'saving' : 'loading');
      setError('');
      attempt.current = { retry, promise: initial.mode === 'save'
        ? saveDefeatChronicle(snapshot.current, initial.slot)
        : loadDefeatChronicle(initial.slot) };
    }
    let active = true;
    void attempt.current.promise.then(result => {
      if (!active) return;
      if (!result.success) {
        setError(result.message || 'The defeat record could not be confirmed.');
        setStatus('error');
        return;
      }
      if (initial.mode === 'load' && result.data) restore.current(result.data);
      setStatus('saved');
    }).catch(reason => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'The defeat record could not be confirmed.');
        setStatus('error');
      }
    });
    return () => { active = false; };
  }, [initial, retry]);

  const outcome = gameState.lastCombatOutcome?.result === 'defeat' ? gameState.lastCombatOutcome : null;
  const busy = status === 'saving' || status === 'loading';
  return <main className="h-screen w-full overflow-y-auto overflow-x-hidden bg-slate-950 px-4 py-8 text-slate-100">
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 ref={heading} tabIndex={-1} className="text-4xl font-serif tracking-wide text-red-300 outline-none sm:text-6xl">{title}</h1>
      <div role="status" aria-live="polite" className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm leading-relaxed">
        {status === 'saving' && 'Recording this defeat…'}
        {status === 'loading' && 'Restoring the recorded defeat…'}
        {status === 'saved' && 'This defeat is recorded separately. Earlier recovery saves remain available through Resume Journey.'}
        {status === 'empty' && 'No saved defeat is attached to this page. Resume Journey lets you choose an earlier stored Chronicle.'}
        {status === 'error' && <><p role="alert">{error}</p><button type="button"
          onClick={() => { setStatus(initial.mode === 'save' ? 'saving' : 'loading'); setRetry(value => value + 1); }}
          className="mt-3 rounded border border-amber-500 px-4 py-2 text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Retry recording or loading</button></>}
      </div>
      {outcome && <>
        <section aria-labelledby="defeat-party-heading" className="rounded-lg border border-slate-700 p-4">
          <h2 id="defeat-party-heading" className="mb-3 text-xl font-semibold">Party at defeat</h2>
          <ul className="space-y-3">
            {outcome.party.map(member => <li key={member.id} className="break-words">
              <span className="font-semibold">{member.name}</span>: {member.currentHP}/{member.maxHP} HP
              {member.currentHP <= 0 && <span className="text-red-200"> · {(member.deathSaves?.failures ?? 0) >= 3 ? 'Dead' : 'Incapacitated'}</span>}
              {member.deathSaves && <p className="text-sm text-slate-300">Death saves: {member.deathSaves.successes} successes, {member.deathSaves.failures} failures.</p>}
            </li>)}
          </ul>
          <p className="mt-4 text-sm text-slate-300">Gold retained: {gameState.gold} GP. No victory rewards were granted.</p>
        </section>
        <section aria-labelledby="defeat-enemies-heading" className="rounded-lg border border-slate-700 p-4">
          <h2 id="defeat-enemies-heading" className="mb-3 text-xl font-semibold">Enemies at the end</h2>
          <ul className="space-y-2">{outcome.enemies.map(enemy => <li key={enemy.id} className="break-words">{enemy.name}: {enemy.currentHP}/{enemy.maxHP} HP</li>)}</ul>
        </section>
        <details open className="rounded-lg border border-slate-700 p-4">
          <summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Final combat events</summary>
          {outcome.events.length ? <ol className="mt-3 max-h-80 space-y-3 overflow-y-auto break-words pr-2 text-sm leading-relaxed">
            {outcome.events.map(event => <li key={event.id} className="whitespace-pre-wrap">{event.message}</li>)}
          </ol> : <p className="mt-3 text-sm text-slate-300">No events were captured for this battle.</p>}
        </details>
      </>}
      <button type="button" disabled={busy} onClick={onReturnToMainMenu}
        className="w-full rounded-lg border border-red-700 bg-red-900/50 px-5 py-3 text-lg text-red-100 hover:bg-red-800/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60 sm:w-fit">
        Return to Main Menu
      </button>
    </div>
  </main>;
}
