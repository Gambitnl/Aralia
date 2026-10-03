import { useEffect, useState } from 'react';

/**
 * One piece of view state, kept in step with the address bar.
 *
 * Several Design Preview steps used to read a parameter once at mount and then
 * forget it. Click a tab and the screen changed while the address did not, so a
 * saved link, a shared link and a screenshot could all disagree with what was
 * on screen. A capture run could shoot the wrong view and look correct.
 *
 * This reads the parameter on the first render and writes every later change
 * back with `replaceState`, so the address always names what you are looking
 * at. It never adds a history entry, because a tab click is not a page visit.
 *
 * A value equal to `fallback` removes the parameter instead of writing it, so
 * the default view keeps a clean address.
 */
export function useUrlParam<T extends string>(
  key: string,
  fallback: T | null,
  isValid: (raw: string) => boolean,
): [T | null, (next: T | null) => void] {
  const [value, setValue] = useState<T | null>(() => {
    const raw = new URLSearchParams(window.location.search).get(key);
    return raw !== null && isValid(raw) ? (raw as T) : fallback;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const current = url.searchParams.get(key);
    const wanted = value === fallback ? null : value;
    if (current === wanted) return;
    if (wanted === null) url.searchParams.delete(key);
    else url.searchParams.set(key, wanted);
    window.history.replaceState(null, '', url);
  }, [key, value, fallback]);

  return [value, setValue];
}

/**
 * Mirror a whole set of view values into the address at once.
 *
 * Use this where a step already reads many parameters at mount and keeps each
 * one in its own `useState`. One call writes them all back, so none of that
 * existing state has to change. Pass `null` for a value that should drop out
 * of the address, which is how a default keeps the link clean.
 */
export function useUrlMirror(values: Record<string, string | null>): void {
  // The values object is rebuilt on every render, so compare by content.
  const encoded = JSON.stringify(values);

  useEffect(() => {
    const next = JSON.parse(encoded) as Record<string, string | null>;
    const url = new URL(window.location.href);
    let changed = false;
    for (const [key, value] of Object.entries(next)) {
      const current = url.searchParams.get(key);
      if (value === null) {
        if (current !== null) {
          url.searchParams.delete(key);
          changed = true;
        }
      } else if (current !== value) {
        url.searchParams.set(key, value);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(null, '', url);
  }, [encoded]);
}

/** The same, for a parameter that always holds one of a fixed list. */
export function useUrlChoice<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [value, setValue] = useUrlParam<T>(
    key,
    fallback,
    (raw) => (options as readonly string[]).includes(raw),
  );
  return [(value ?? fallback) as T, setValue as (next: T) => void];
}
