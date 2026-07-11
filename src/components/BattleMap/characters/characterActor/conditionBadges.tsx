/**
 * @file characters/characterActor/conditionBadges.tsx
 * The 3D actor's condition-chip strip (buff/debuff/condition indicators,
 * GOAL #19) — the 3D counterpart to the 2D token's condition icons. Extracted
 * verbatim from CharacterActor.tsx.
 */
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { CombatCharacter } from '../../../../types/combat';

// ---------------------------------------------------------------------------
// Condition badge row (task 76, GOAL #19) — buff/debuff/condition chips
// ---------------------------------------------------------------------------

/**
 * Visual map for 5e conditions: 2-letter chip + tone color. Unknown/custom
 * condition strings fall back to their first two letters in neutral slate so
 * homebrew conditions still surface instead of silently disappearing.
 */
const CONDITION_BADGES: Record<string, { label: string; color: string }> = {
  Blinded: { label: 'BL', color: '#94a3b8' },
  Charmed: { label: 'CH', color: '#f472b6' },
  Deafened: { label: 'DF', color: '#a8a29e' },
  Exhaustion: { label: 'EX', color: '#b45309' },
  Frightened: { label: 'FR', color: '#a78bfa' },
  Grappled: { label: 'GR', color: '#fb923c' },
  Incapacitated: { label: 'IN', color: '#f87171' },
  Invisible: { label: 'IV', color: '#bae6fd' },
  Paralyzed: { label: 'PA', color: '#22d3ee' },
  Petrified: { label: 'PE', color: '#9ca3af' },
  Poisoned: { label: 'PO', color: '#4ade80' },
  Prone: { label: 'PR', color: '#d6a05a' },
  Restrained: { label: 'RE', color: '#fbbf24' },
  Stunned: { label: 'ST', color: '#fde047' },
  Unconscious: { label: 'UN', color: '#cbd5e1' },
  Ignited: { label: 'IG', color: '#fb7185' },
  Slowed: { label: 'SL', color: '#7dd3fc' },
  'Slasher Slow': { label: 'SL', color: '#7dd3fc' },
};

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
      const visual = CONDITION_BADGES[name] ?? {
        label: name.slice(0, 2).toUpperCase(),
        color: '#e2e8f0',
      };
      out.push({
        name,
        label: visual.label,
        color: visual.color,
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
