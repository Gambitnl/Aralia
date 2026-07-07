// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/07/2026, 21:56:03
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file CharacterToken.tsx
 * Component to display a character's token on the battle map.
 * 
 * CURRENT FUNCTIONALITY:
 * - Renders character tokens with team-based coloring
 * - Displays status effects as badge overlays
 * - Shows compact resistance / vulnerability / immunity badges with tooltips
 * - Shows concentration indicator for spellcasters
 * - Implements selection and targeting states
 * - Uses React.memo for basic render optimization
 * 
 * PERFORMANCE OPPORTUNITIES:
 * - Individual DOM elements for each token (could batch with canvas)
 * - Status effect badges recreated for every render
 * - No level-of-detail scaling based on distance from camera
 * - CSS transforms recalculated even for static positions
 * - Tooltip creation overhead for every token
 */
import React, { useMemo } from 'react';
import { CombatCharacter } from '../../types/combat';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import Tooltip from '../Tooltip';
import { getStatusEffectIcon, getCharacterSizeMultiplier } from '../../utils/combatUtils';
import { Z_INDEX } from '../../styles/zIndex';
import { getCreatureTokenVisual } from '../../utils/visuals/combatIconVisuals';

interface CharacterTokenProps {
  character: CombatCharacter;
  position: { x: number; y: number };
  isSelected: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
  isTurn: boolean;
  onCharacterClick: (char: CombatCharacter) => void;
}

type DefenseBadgeKind = 'resistance' | 'vulnerability' | 'immunity';

interface DefenseBadgeConfig {
  kind: DefenseBadgeKind;
  label: string;
  tooltip: string;
  positionClass: string;
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
      // The badges stay on the token perimeter so the center icon, status row,
      // and concentration marker keep their current spacing.
      positionClass: 'left-0 top-0',
      toneClass: 'border-emerald-200/70 bg-emerald-950/90 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.24)]'
    });
  }

  const vulnerabilityTooltip = formatDefenseTooltip('Vulnerability', character.vulnerabilities);
  if (vulnerabilityTooltip) {
    badges.push({
      kind: 'vulnerability',
      label: 'V',
      tooltip: vulnerabilityTooltip,
      positionClass: 'left-0 top-1/2 -translate-y-1/2',
      toneClass: 'border-rose-200/70 bg-rose-950/90 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.24)]'
    });
  }

  const immunityTooltip = formatDefenseTooltip('Immunity', character.immunities, character.nonMagicalImmunities);
  if (immunityTooltip) {
    badges.push({
      kind: 'immunity',
      label: 'I',
      tooltip: immunityTooltip,
      positionClass: 'left-0 bottom-0',
      toneClass: 'border-sky-200/70 bg-sky-950/90 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.24)]'
    });
  }

  return badges;
};

const DefenseBadge: React.FC<DefenseBadgeConfig> = ({ kind, label, tooltip, positionClass, toneClass }) => (
  <Tooltip content={tooltip}>
    <span
      data-testid={`defense-badge-${kind}`}
      className={`absolute flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[6px] font-black uppercase leading-none tracking-tight ${positionClass} ${toneClass}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.45)' }}
      aria-label={tooltip}
    >
      {label}
    </span>
  </Tooltip>
);

const CharacterToken: React.FC<CharacterTokenProps> = React.memo(({ character, position, isSelected, isTargetable, targetingMode, isTurn, onCharacterClick }) => {
  const multiplier = getCharacterSizeMultiplier(character.stats.size);
  const defenseBadges = buildDefenseBadges(character);
  const tokenVisual = useMemo(() => getCreatureTokenVisual(character), [character]);

  // Memoized container style: only recalculates when position, size, or interaction
  // state changes — prevents redundant style-object allocation on unrelated renders.
  const style = useMemo((): React.CSSProperties => ({
    position: 'absolute',
    left: `${position.x * TILE_SIZE_PX}px`,
    top: `${position.y * TILE_SIZE_PX}px`,
    width: `${TILE_SIZE_PX * multiplier}px`,
    height: `${TILE_SIZE_PX * multiplier}px`,
    // Glide between tiles instead of teleporting: position-only so size and
    // interaction styling don't animate along for the ride.
    transition: 'left 0.35s ease-in-out, top 0.35s ease-in-out',
    zIndex: Z_INDEX.CONTENT_OVERLAY_LOW,
    cursor: targetingMode ? 'crosshair' : 'pointer',
  }), [position.x, position.y, multiplier, targetingMode]);

  // Memoized token circle style: only recalculates when visual state changes.
  const tokenStyle = useMemo((): React.CSSProperties => {
    // Bright faction rings + a thin light halo: the old dark-red-on-dark-slate
    // enemy ring disappeared entirely against the painted forest, which made
    // hostiles effectively invisible on the board.
    let borderColor = '#9CA3AF'; // gray-400 default
    if (character.team === 'player') borderColor = '#60A5FA'; // blue-400
    else borderColor = '#EF4444'; // red-500 for enemy team
    if (isTargetable) borderColor = '#F87171';
    if (isSelected)   borderColor = '#FBBF24';
    const halo = '0 0 0 1.5px rgba(255,255,255,0.4)';

    return {
      width: '80%',
      height: '80%',
      borderRadius: '50%',
      border: `3px solid ${borderColor}`,
      backgroundColor: '#1F2937',
      overflow: 'hidden',
      boxShadow: isSelected
        ? `${halo}, 0 0 10px #FBBF24, 0 0 20px #FBBF24`
        : isTargetable
          ? `${halo}, 0 0 10px #EF4444`
          : `${halo}, 0 2px 4px rgba(0,0,0,0.6)`,
      transform: isSelected ? 'scale(1.1)' : 'scale(1.0)',
      animation: isTurn ? 'pulseTurn 2s infinite' : 'none',
    };
  }, [character.team, isSelected, isTargetable, isTurn]);

  // HP arc around the token rim: state-at-a-glance without opening a sheet.
  const hpPct = Math.max(0, Math.min(1, character.maxHP > 0 ? character.currentHP / character.maxHP : 0));
  const hpColor = hpPct > 0.5 ? '#34D399' : hpPct > 0.25 ? '#FBBF24' : '#F87171';

  const handleActivate = () => onCharacterClick(character);

  return (
    <div
      style={style}
      className="relative flex items-center justify-center pointer-events-auto"
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select ${character.name}`}
    >
      <Tooltip content={`${character.name} (Armor Class: ${character.class.id === 'fighter' ? 18 : 12}, Hit Points: ${character.currentHP}/${character.maxHP})`}>
        <div
          style={tokenStyle}
          className="flex items-center justify-center font-bold text-white text-lg"
        >
          {tokenVisual.src ? (
            <img
              src={tokenVisual.src}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            tokenVisual.fallbackContent
          )}
        </div>
      </Tooltip>

      {/* HP arc hugging the ring: green → amber → red as the combatant drops,
          starting at 12 o'clock and sweeping clockwise. */}
      {hpPct < 1 && (
        <svg
          viewBox="0 0 36 36"
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="18"
            cy="18"
            r="16.5"
            fill="none"
            stroke={hpColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${hpPct * 100} 100`}
          />
        </svg>
      )}

      {/* Defense badges stay tiny and pinned to the perimeter so they expose
          the important damage traits without growing the token footprint or
          colliding with the center icon. The 3D renderer still needs a separate
          parity pass, so this slice deliberately stops at the 2D token layer. */}
      {defenseBadges.map(badge => (
        <DefenseBadge key={badge.kind} {...badge} />
      ))}

      {/* Status effect badges hover near the token to visualize buffs/debuffs without opening a sheet. */}
      {character.statusEffects.length > 0 && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {character.statusEffects.map((effect, idx) => (
            <Tooltip key={`${effect.id}-${idx}`} content={`${effect.name} (${effect.duration}t)`}>
              <span
                className="w-6 h-6 rounded-full bg-gray-900 border border-white/40 flex items-center justify-center text-xs"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.45)' }}
                aria-label={`${effect.name} status marker`}
              >
                {getStatusEffectIcon(effect)}
              </span>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Concentration Indicator: Shows a pulsing crystal orb if the character is maintaining a spell. */}
      {character.concentratingOn && (
        <Tooltip content={`Concentrating on ${character.concentratingOn.spellName}`}>
          <div
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-900 border border-purple-400 flex items-center justify-center text-xs shadow-md"
            style={{ animation: 'pulse 2s infinite', zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM }}
            aria-label={`Concentrating on ${character.concentratingOn.spellName}`}
          >
            🔮
          </div>
        </Tooltip>
      )}
    </div>
  );
});

CharacterToken.displayName = 'CharacterToken';

export default CharacterToken;
