/**
 * @file ComparePane.tsx — the frame both sides of a comparison sit in.
 *
 * ONE frame, used twice, so the two sides cannot end up different sizes. That
 * is not a cosmetic point: a reader cannot judge two pictures that are not the
 * same size, and every earlier attempt at this drifted exactly there.
 *
 * IT ALSO OWNS THE FAILURE STATE. Aralia's no-fallback rule says a side that
 * cannot render says why, in words. `state="unavailable"` prints the reason on
 * a plainly empty plate. It never draws a placeholder image, a gradient, or a
 * spinner that could be mistaken for output.
 *
 * THE HEADER AND THE FACTS ARE EXPORTED SEPARATELY. The tree comparison puts
 * both sides in ONE three.js scene, so it cannot use two picture boxes — but it
 * must still carry the identical header and footer. Sharing the parts is what
 * keeps the three comparisons looking like one page.
 */
import React from 'react';

export type PaneState = 'idle' | 'working' | 'ready' | 'unavailable';

export type CompareSide = 'ships-today' | 'newly-built' | 'none';

const SIDE_TAG: Record<CompareSide, { label: string; className: string }> = {
  'ships-today': {
    label: 'SHIPS TODAY',
    className: 'border-slate-500/60 bg-slate-800/70 text-slate-300',
  },
  'newly-built': {
    label: 'NEWLY BUILT',
    className: 'border-amber-500/60 bg-amber-950/50 text-amber-300',
  },
  none: {
    label: 'NO COUNTERPART',
    className: 'border-rose-500/50 bg-rose-950/40 text-rose-300',
  },
};

/** Fixed height, in pixels, so two headers beside each other always agree. */
export const PANE_HEADER_PX = 58;
/**
 * Fixed height, in pixels, for the facts strip.
 *
 * Tall enough for three rows of two. A shorter strip clipped the last row, and
 * a clipped measurement is worse than no measurement: it looks complete.
 */
export const PANE_FACTS_PX = 88;

export const ComparePaneHeader: React.FC<{
  side: CompareSide;
  title: string;
  caption: string;
}> = ({ side, title, caption }) => {
  const tag = SIDE_TAG[side];
  return (
    <header
      className="flex flex-col justify-center overflow-hidden px-3 py-2"
      style={{ height: PANE_HEADER_PX }}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-5 flex-shrink-0 items-center rounded border px-1.5 text-[10px] font-bold tracking-wider ${tag.className}`}
        >
          {tag.label}
        </span>
        <h3 className="truncate text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      <p className="mt-1 truncate text-[11px] leading-snug text-gray-500">{caption}</p>
    </header>
  );
};

export const ComparePaneFacts: React.FC<{
  facts?: ReadonlyArray<readonly [string, string]>;
}> = ({ facts }) => (
  <footer
    className="overflow-hidden px-3 py-2"
    style={{ height: PANE_FACTS_PX }}
  >
    {facts && facts.length > 0 ? (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {facts.map(([k, v]) => (
          <div key={k} className="flex min-w-0 justify-between gap-2">
            <dt className="truncate text-gray-500">{k}</dt>
            <dd className="flex-shrink-0 font-mono text-gray-300">{v}</dd>
          </div>
        ))}
      </dl>
    ) : (
      <p className="text-[11px] text-gray-700">no measurements yet</p>
    )}
  </footer>
);

/**
 * The state message shown when a pane holds no picture.
 *
 * `unavailable` is the no-fallback state: words only, on an empty plate.
 */
export const ComparePaneState: React.FC<{
  state: PaneState;
  reason?: string;
  progress?: string;
}> = ({ state, reason, progress }) => {
  if (state === 'ready') return null;
  if (state === 'idle') {
    return <p className="px-6 text-center text-xs text-gray-600">Nothing generated yet.</p>;
  }
  if (state === 'working') {
    return <p className="px-6 text-center text-xs text-sky-400">{progress ?? 'Working...'}</p>;
  }
  return (
    <div className="max-w-md px-6 py-4 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-rose-400">Nothing to show</p>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-400">
        {reason ?? 'No reason was given, which is itself a fault.'}
      </p>
    </div>
  );
};

export interface ComparePaneProps {
  side: CompareSide;
  title: string;
  /** One sentence saying what this side is. Always shown. */
  caption: string;
  state: PaneState;
  /** Required when `state` is `unavailable`. The reason, in words. */
  reason?: string;
  /** Progress text while `state` is `working`. */
  progress?: string;
  facts?: ReadonlyArray<readonly [string, string]>;
  children?: React.ReactNode;
}

export const ComparePane: React.FC<ComparePaneProps> = ({
  side, title, caption, state, reason, progress, facts, children,
}) => (
  <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-950/60">
    <div className="flex-shrink-0 border-b border-gray-800">
      <ComparePaneHeader side={side} title={title} caption={caption} />
    </div>

    {/* The picture area. Every state uses this same box, so the two sides stay
        the same size whatever happens inside them. */}
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-gray-900">
      {/* Children are always mounted — a GPU surface needs its box to exist
          before it can be built — but they are invisible until the side is
          ready, so a half-built canvas never reads as output. */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: state === 'ready' ? 1 : 0 }}
      >
        {children}
      </div>
      <div className="relative">
        <ComparePaneState state={state} reason={reason} progress={progress} />
      </div>
    </div>

    <div className="flex-shrink-0 border-t border-gray-800">
      <ComparePaneFacts facts={facts} />
    </div>
  </section>
);
