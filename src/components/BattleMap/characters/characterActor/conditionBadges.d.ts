/**
 * @file characters/characterActor/conditionBadges.tsx
 * The 3D actor's condition-chip strip (buff/debuff/condition indicators,
 * GOAL #19) — the 3D counterpart to the 2D token's condition icons. Extracted
 * verbatim from CharacterActor.tsx.
 */
import React from 'react';
import { CombatCharacter } from '../../../../types/combat';
/**
 * The 3D counterpart of the 2D token's condition indicators (GOAL #19 — the
 * defense badges landed earlier; buff/debuff/condition icons were the missing
 * half). Sits below the HP pip; deduped by condition name; tooltip carries
 * the source when known. Inline styles (not Tailwind) so the chips are immune
 * to content-path gaps in 3D-embedded Html.
 */
export declare const ConditionBadgeRow: React.FC<{
    character: CombatCharacter;
}>;
