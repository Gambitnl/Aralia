/**
 * @file characters/characterActor/defenseBadges.tsx
 * The 3D actor's defense-badge strip (resistance / vulnerability / immunity)
 * — the 3D counterpart to the 2D token-perimeter badges. Extracted verbatim
 * from CharacterActor.tsx.
 */
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { CombatCharacter } from '../../../../types/combat';

// Defense badge labels stay tiny and fixed so the 3D actor can mirror the 2D
// token language without stealing space from the model, HP orb, or nameplate.
type DefenseBadgeKind = 'resistance' | 'vulnerability' | 'immunity';

interface DefenseBadgeConfig {
  kind: DefenseBadgeKind;
  label: string;
  tooltip: string;
  toneClass: string;
}

const formatDefenseTooltip = (title: string, primary?: string[], secondary?: string[]) => {
  const segments: string[] = [];

  if (primary?.length) {
    segments.push(`${title}: ${primary.join(', ')}`);
  }

  if (secondary?.length) {
    segments.push(`Non-magical ${title.toLowerCase()}: ${secondary.join(', ')}`);
  }

  return segments.join(' | ');
};

const buildDefenseBadges = (character: CombatCharacter): DefenseBadgeConfig[] => {
  const badges: DefenseBadgeConfig[] = [];

  const resistanceTooltip = formatDefenseTooltip('Resistance', character.resistances, character.nonMagicalResistances);
  if (resistanceTooltip) {
    badges.push({
      kind: 'resistance',
      label: 'R',
      tooltip: resistanceTooltip,
      toneClass: 'border-emerald-200/70 bg-emerald-950/90 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.24)]'
    });
  }

  const vulnerabilityTooltip = formatDefenseTooltip('Vulnerability', character.vulnerabilities);
  if (vulnerabilityTooltip) {
    badges.push({
      kind: 'vulnerability',
      label: 'V',
      tooltip: vulnerabilityTooltip,
      toneClass: 'border-rose-200/70 bg-rose-950/90 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.24)]'
    });
  }

  const immunityTooltip = formatDefenseTooltip('Immunity', character.immunities, character.nonMagicalImmunities);
  if (immunityTooltip) {
    badges.push({
      kind: 'immunity',
      label: 'I',
      tooltip: immunityTooltip,
      toneClass: 'border-sky-200/70 bg-sky-950/90 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.24)]'
    });
  }

  return badges;
};

export const DefenseBadgeRow: React.FC<{ character: CombatCharacter }> = ({ character }) => {
  const defenseBadges = useMemo(() => buildDefenseBadges(character), [character]);

  if (defenseBadges.length === 0) {
    return null;
  }

  // This strip is the 3D counterpart to the 2D token-perimeter badges. It
  // stays compact and always visible so the renderer shows the same tactical
  // facts without replacing the existing HP/nameplate stack.
  return (
    <Html
      position={[0, 3.24, 0]}
      center
      distanceFactor={10}
      style={{ pointerEvents: 'none' }}
    >
      <div
        data-testid="character-defense-badges"
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
        {defenseBadges.map(badge => (
          <span
            key={badge.kind}
            data-testid={`defense-badge-${badge.kind}`}
            title={badge.tooltip}
            aria-label={badge.tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '14px',
              height: '14px',
              borderRadius: '999px',
              border: '1px solid currentColor',
              fontSize: '7px',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: 0,
            }}
            className={badge.toneClass}
          >
            {badge.label}
          </span>
        ))}
      </div>
    </Html>
  );
};
