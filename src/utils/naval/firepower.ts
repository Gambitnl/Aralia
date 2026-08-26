/**
 * @file src/utils/naval/firepower.ts
 * Firepower: a rules-backed rating for a ship's armament (agora-d1c7.10).
 *
 * ShipWeapon carries a damage dice string and a range but no rate of fire or
 * crew, so a true damage-per-second number is not derivable. Firepower is the
 * SUM of each installed weapon's average damage per hit (dice mean plus flat
 * bonus), which is the number the naval rules (Ghosts of Saltmarsh, "Ships"
 * appendix) compare when a captain weighs one broadside against another.
 * Rams count like any other weapon.
 */
import type { Ship, ShipWeapon } from '../../types/naval';

const DICE_RE = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i;

/** Mean roll of a dice expression like "3d10", "d6", "2d8+2", or a plain number. Unknown text counts 0. */
export function averageDamage(damage: string): number {
  const text = String(damage ?? '').trim();
  if (!text) return 0;
  const m = DICE_RE.exec(text);
  if (m) {
    const count = m[1] ? Number(m[1]) : 1;
    const sides = Number(m[2]);
    const flat = m[3] ? Number(m[3].replace(/\s+/g, '')) : 0;
    return count * ((sides + 1) / 2) + flat;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

export interface FirepowerLine {
  weapon: ShipWeapon;
  averageDamage: number;
}

export interface FirepowerRating {
  /** Sum of every weapon's average damage per hit, one decimal. */
  total: number;
  lines: FirepowerLine[];
}

/** Firepower for a ship: per-weapon average damage and the total. */
export function calculateFirepower(ship: Pick<Ship, 'weapons'>): FirepowerRating {
  const lines = (ship.weapons ?? []).map((weapon) => ({ weapon, averageDamage: averageDamage(weapon.damage) }));
  const total = Math.round(lines.reduce((sum, l) => sum + l.averageDamage, 0) * 10) / 10;
  return { total, lines };
}

/** One line per weapon for a tooltip: "Fore Ballista 3d10 (16.5)". */
export function describeFirepower(rating: FirepowerRating): string[] {
  return rating.lines.map((l) => `${l.weapon.position} ${l.weapon.name} ${l.weapon.damage} (${l.averageDamage % 1 === 0 ? l.averageDamage : l.averageDamage.toFixed(1)})`);
}
