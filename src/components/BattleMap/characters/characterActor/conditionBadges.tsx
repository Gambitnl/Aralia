/**
 * @file characters/characterActor/conditionBadges.tsx
 * The 3D actor's condition-chip strip (buff/debuff/condition indicators,
 * GOAL #19) — the 3D counterpart to the 2D token's condition icons. Extracted
 * verbatim from CharacterActor.tsx.
 */
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { CombatCharacter } from '../../../../types/combat';
import { resolveConditionVisual } from '../../../../utils/visuals/conditionPalette';

// ---------------------------------------------------------------------------
// Condition badge row (task 76, GOAL #19) — buff/debuff/condition chips
// ---------------------------------------------------------------------------

/**
 * The chip label and color now come from the shared condition palette
 * (`src/utils/visuals/conditionPalette.ts`), which the 2D token, the 3D body
 * tint and the status registry all read. The 18-row table that used to live
 * here was one of three disagreeing color tables; it is gone, not copied.
 */

/**
 * The 3D counterpart of the 2D token's condition indicators (GOAL #19 — the
 * defense badges landed earlier; buff/debuff/condition icons were the missing
 * half). Sits below the HP pip; deduped by condition name; tooltip carries
 * the source when known. Inline styles (not Tailwind) so the chips are immune
 * to content-path gaps in 3D-embedded Html.
 */
export const ConditionBadgeRow: React.FC<{ character: CombatCharacter }> = ({ character }) => {
  const badges = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; label: string; color: string; tooltip: string }[] = [];
    for (const cond of character.conditions ?? []) {
      const name = String(cond.name);
      if (seen.has(name)) continue;
      seen.add(name);
      // Unknown/homebrew names still surface: the resolver hands back their
      // first two letters on the neutral default rather than dropping them.
      const visual = resolveConditionVisual(name);
      out.push({
        name,
        label: visual.chipLabel,
        color: visual.chipColor,
        tooltip: cond.source ? `${name} (${cond.source})` : name,
      });
    }
    return out;
  }, [character.conditions]);

  if (badges.length === 0) return null;

  return (
    <Html
      position={[0, 1.7, 0]}
      center
      distanceFactor={10}
      style={{ pointerEvents: 'none' }}
    >
      <div
        data-testid="character-condition-badges"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '2px 5px',
          borderRadius: '999px',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          background: 'rgba(2, 6, 23, 0.78)',
          boxShadow: '0 0 12px rgba(0, 0, 0, 0.32)',
          pointerEvents: 'none',
        }}
      >
        {badges.map(badge => (
          <span
            key={badge.name}
            data-testid={`condition-badge-${badge.name}`}
            title={badge.tooltip}
            aria-label={badge.tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '14px',
              height: '14px',
              borderRadius: '999px',
              border: `1px solid ${badge.color}`,
              color: badge.color,
              fontSize: '7px',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: 0,
            }}
          >
            {badge.label}
          </span>
        ))}
      </div>
    </Html>
  );
};
