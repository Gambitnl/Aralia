/**
 * @file travelReadout.ts — player-facing formatting for a planned route.
 *
 * Turns a `RoutePlan` (minutes/miles/danger) into the strings the travel-mode UI
 * shows so the player can decide before committing: how long the trip takes, how
 * far it is, and how dangerous it is. Pure: no React/DOM.
 */
import type { RoutePlan } from './routePlanning';

/** Human travel duration: "15 min", "6h 20m", "2d 4h". */
export function formatTravelTime(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const totalHours = Math.floor(m / 60);
  const mins = m % 60;
  if (totalHours < 24) return mins ? `${totalHours}h ${mins}m` : `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

/** Human distance: "0.4 mi", "19 mi". */
export function formatDistance(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export type DangerLevel = 'Safe' | 'Low' | 'Moderate' | 'High' | 'Perilous';

export interface DangerRating {
  level: DangerLevel;
  /** Display color for the rating chip / route tint. */
  color: string;
}

/** Map a 0..1 danger value to a labelled, colored rating. */
export function dangerRating(danger: number): DangerRating {
  const d = Math.max(0, Math.min(1, danger));
  if (d < 0.12) return { level: 'Safe', color: '#22c55e' };
  if (d < 0.3) return { level: 'Low', color: '#84cc16' };
  if (d < 0.5) return { level: 'Moderate', color: '#eab308' };
  if (d < 0.7) return { level: 'High', color: '#f97316' };
  return { level: 'Perilous', color: '#ef4444' };
}

/**
 * One-line route summary for the travel readout, e.g.
 * "≈ 6h 20m · ~19 mi · Danger: Moderate · on foot".
 */
export function formatRouteSummary(route: RoutePlan, transportLabel = 'on foot'): string {
  const rating = dangerRating(route.danger);
  return `≈ ${formatTravelTime(route.minutes)} · ~${formatDistance(route.miles)} · Danger: ${rating.level} · ${transportLabel}`;
}
