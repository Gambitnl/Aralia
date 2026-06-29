/**
 * @file chronicle.ts — Turn a town's append-only LifeEvent log into a readable,
 * year-grouped history ("Town Chronicle"). This is the play-and-eyeball surface
 * (SPEC D12): a human reads it to judge whether emergent history feels plausible.
 *
 * Pure: derives strings from state, mutates nothing.
 */
import { DAYS_PER_YEAR } from './constants';
import type { LifeEvent, TownSimState } from './types';

export interface ChronicleRange {
  fromDay?: number;
  toDay?: number;
}

/** Named, headline-worthy event kinds whose summaries appear verbatim. */
const HEADLINE_KINDS = new Set<LifeEvent['kind']>(['death', 'role_succession']);

/**
 * One line per year that had events, e.g.:
 *   "Year 3: Bedwyr died at age 81. Mara succeeded Bedwyr as innkeeper. 2 births, 1 came of age."
 */
export function summarizeChronicle(state: TownSimState, range: ChronicleRange = {}): string[] {
  const from = range.fromDay ?? -Infinity;
  const to = range.toDay ?? Infinity;

  const byYear = new Map<number, LifeEvent[]>();
  for (const e of state.chronicle.events) {
    if (e.day < from || e.day > to) continue;
    const year = Math.floor(e.day / DAYS_PER_YEAR);
    const list = byYear.get(year);
    if (list) list.push(e);
    else byYear.set(year, [e]);
  }

  const lines: string[] = [];
  for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
    const evs = byYear.get(year)!;
    const headlines = evs.filter((e) => HEADLINE_KINDS.has(e.kind)).map((e) => e.summary);

    const births = evs.filter((e) => e.kind === 'birth').length;
    const comingOfAge = evs.filter((e) => e.kind === 'came_of_age').length;
    const tail: string[] = [];
    if (births) tail.push(`${births} ${births === 1 ? 'birth' : 'births'}`);
    if (comingOfAge) tail.push(`${comingOfAge} came of age`);

    let line = `Year ${year}: ${headlines.join(' ')}`;
    if (tail.length) line += `${headlines.length ? ' ' : ''}${tail.join(', ')}.`;
    lines.push(line.trim());
  }
  return lines;
}
