// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026, 01:53:00
 * Dependents: components/BattleMap/pixi/PixiBattleBoard.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter } from '../../../types/combat';
import { getCharacterSizeMultiplier } from '../../../utils/combat';

/** Everything the Pixi token needs to draw, matching CharacterToken.tsx:
 *  blue-400 ally / red-500 hostile rings, amber-400 selection, and the
 *  green→amber→red HP arc. Colors are Pixi hex numbers. */
export interface TokenViewModel {
  ringColor: number;
  hpPct: number;
  hpColor: number;
  label: string;
  sizeMultiplier: number;
  isDown: boolean;
}

export const buildTokenViewModel = (
  character: CombatCharacter,
  flags: { isSelected: boolean; isTurn: boolean },
): TokenViewModel => {
  let ringColor = character.team === 'player' ? 0x60a5fa : 0xef4444;
  if (flags.isSelected) ringColor = 0xfbbf24;
  const hpPct = Math.max(0, Math.min(1, character.maxHP > 0 ? character.currentHP / character.maxHP : 0));
  const hpColor = hpPct > 0.5 ? 0x34d399 : hpPct > 0.25 ? 0xfbbf24 : 0xf87171;
  return {
    ringColor,
    hpPct,
    hpColor,
    label: (character.name?.trim()[0] ?? '?').toUpperCase(),
    sizeMultiplier: getCharacterSizeMultiplier(character.stats.size),
    isDown: character.currentHP <= 0,
  };
};
