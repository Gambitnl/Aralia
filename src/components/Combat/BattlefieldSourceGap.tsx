/**
 * @file BattlefieldSourceGap.tsx
 * A fail-closed combat state for encounters that have actors but no tactical
 * projection of their real WorldForge location.
 *
 * Production must never hide this gap by decorating a disconnected arena.
 * The explicit developer sandbox remains available through BattleMapDemo and
 * its dedicated deep link, while this screen lets players safely return to the
 * world without starting turns on invented terrain.
 */
import React from 'react';
import { ArrowLeft, CheckCircle2, MapPinned, ShieldAlert, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';

export interface BattlefieldSourceGapProps {
  /** Human-readable caller context; never substitute guessed terrain here. */
  detail?: string;
  /** Leaves the withheld encounter without resolving it as victory or defeat. */
  onReturn: () => void;
}

/** Visible evidence that the production source boundary withheld combat. */
export const BattlefieldSourceGap: React.FC<BattlefieldSourceGapProps> = ({
  detail = 'This encounter did not provide a WorldForge battlefield projection.',
  onReturn,
}) => (
  <main
    data-testid="battlefield-source-gap"
    className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-5 py-10 text-slate-100"
  >
    <section className="w-full max-w-3xl border-y border-slate-700/80 py-8 sm:py-10">
      <div className="flex items-center gap-3 text-amber-300">
        <ShieldAlert size={24} aria-hidden="true" />
        <span className="text-xs font-black uppercase tracking-widest">Tactical source gap</span>
      </div>

      <div className="mt-5 flex items-start gap-4">
        <MapPinned size={36} aria-hidden="true" className="mt-1 shrink-0 text-sky-300" />
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-slate-50 sm:text-3xl">
            Battlefield source missing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            {detail} Combat has been withheld rather than replacing the location with an unrelated procedural arena.
          </p>
        </div>
      </div>

      <dl className="mt-8 divide-y divide-slate-800 border-y border-slate-800 text-sm">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-slate-300">WorldForge tactical projection</dt>
          <dd className="inline-flex items-center gap-2 font-semibold text-rose-300">
            <XCircle size={16} aria-hidden="true" /> Missing
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-slate-300">Procedural production fallback</dt>
          <dd className="inline-flex items-center gap-2 font-semibold text-emerald-300">
            <CheckCircle2 size={16} aria-hidden="true" /> Withheld
          </dd>
        </div>
      </dl>

      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={onReturn}
        className="mt-8 border-slate-600 bg-slate-800 text-slate-100 hover:border-sky-400 hover:bg-slate-700 focus-visible:ring-sky-400"
      >
        <span className="inline-flex items-center gap-2">
          <ArrowLeft size={17} aria-hidden="true" />
          Return to world
        </span>
      </Button>
    </section>
  </main>
);

export default BattlefieldSourceGap;
