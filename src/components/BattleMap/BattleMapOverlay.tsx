import React, { useEffect, useState } from 'react';
import { Ability, Animation, BattleMapData, CombatCharacter, DamageNumber, Position, SpellEffectAnimationData } from '../../types/combat';
import DamageNumberOverlay from './DamageNumberOverlay';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import { getStatusEffectIcon } from '../../utils/combatUtils';
import { Z_INDEX } from '../../styles/zIndex';
import { UI_ID } from '../../styles/uiIds';

interface BattleMapOverlayProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  damageNumbers: DamageNumber[];
  animations: Animation[];
  aoePreview?: { center: { x: number; y: number }; affectedTiles: { x: number; y: number }[]; ability: Ability } | null;
}

/**
 * Layered overlay for the tactical map. Aggregates floating numbers, buff/debuff
 * badges, spell cues, and AoE previews using lightweight CSS transitions to
 * avoid expensive animation libraries.
 * 
 * CURRENT FUNCTIONALITY:
 * - Renders damage numbers with CSS transitions
 * - Displays status effect badges above character tokens
 * - Shows spell effect animations and AoE previews
 * - Uses requestAnimationFrame for smooth transitions
 * - Manages active/inactive animation states
 * 
 * PERFORMANCE OPPORTUNITIES:
 * - Individual DOM elements for each status effect badge
 * - Damage numbers use separate divs instead of canvas batching
 * - Spell animations create multiple elements per effect
 * - No virtualization for large numbers of effects
 * - Position calculations repeated for overlapping elements
 */
const BattleMapOverlay: React.FC<BattleMapOverlayProps> = ({
  mapData,
  characters,
  damageNumbers,
  animations,
  aoePreview,
}) => {
  type SpellEffectOverlayData = SpellEffectAnimationData & { targetPosition?: Position };
  const spellAnimations = animations.filter(anim => anim.type === 'spell_effect');
  const [activeSpells, setActiveSpells] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const newIds: string[] = [];
    spellAnimations.forEach(anim => {
      if (!activeSpells[anim.id]) newIds.push(anim.id);
    });

    if (newIds.length) {
      requestAnimationFrame(() => {
        setActiveSpells(prev => {
          const next = { ...prev };
          newIds.forEach(id => {
            next[id] = true;
          });
          return next;
        });
      });
    }
  }, [spellAnimations, activeSpells]);

  return (
    <div
      id={UI_ID.BATTLE_MAP_OVERLAY}
      data-testid={UI_ID.BATTLE_MAP_OVERLAY}
      className="pointer-events-none absolute inset-0"
      style={{
        width: mapData.dimensions.width * TILE_SIZE_PX,
        height: mapData.dimensions.height * TILE_SIZE_PX,
        zIndex: Z_INDEX.MINIMAP,
      }}
    >
      {/* Floating damage/heal numbers */}
      <DamageNumberOverlay damageNumbers={damageNumbers} />

      {/* Status icons on top of each character token */}
      {characters.map((character) => (
        <div
          key={`status-${character.id}`}
          className="absolute flex gap-1 items-center justify-center"
          style={{
            left: character.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            top: character.position.y * TILE_SIZE_PX - 6,
            transform: 'translate(-50%, -100%)',
            transition: 'opacity 200ms ease-out',
            opacity: character.statusEffects.length ? 1 : 0,
            zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
          }}
        >
          {character.statusEffects.map((effect) => (
            <span
              key={`${character.id}-${effect.id}`}
              className="text-xs font-semibold px-1 py-0.5 rounded-full bg-gray-900/80 border border-white/10"
              title={`${effect.name} (${effect.duration}r)`}
              style={{
                color: effect.type === 'buff' ? '#a7f3d0' : effect.type === 'debuff' ? '#fca5a5' : '#e5e7eb',
                transition: 'transform 150ms ease-out, opacity 150ms ease-out',
              }}
            >
              {getStatusEffectIcon(effect)}
            </span>
          ))}
        </div>
      ))}

      {/* Spell effect ripples */}
      {spellAnimations.map((anim) => {
        const data = anim.data as SpellEffectOverlayData | undefined;
        // Legacy payloads may include a single targetPosition instead of an array.
        const positions = data?.targetPositions || (data?.targetPosition ? [data.targetPosition] : []);
        return positions.map((pos) => (
          <div
            key={`${anim.id}-${pos.x}-${pos.y}`}
            className="absolute rounded-full bg-indigo-400/40 border border-indigo-300/40"
            style={{
              left: pos.x * TILE_SIZE_PX,
              top: pos.y * TILE_SIZE_PX,
              width: TILE_SIZE_PX,
              height: TILE_SIZE_PX,
              transform: activeSpells[anim.id] ? 'scale(1.05)' : 'scale(0.8)',
              opacity: activeSpells[anim.id] ? 0.85 : 0,
              transition: `opacity ${anim.duration}ms ease-out, transform ${anim.duration}ms ease-out`,
            }}
          />
        ));
      })}

      {/* AoE preview outline to complement per-tile tinting */}
      {aoePreview?.affectedTiles.map((pos) => (
        <div
          key={`aoe-${pos.x}-${pos.y}`}
          className="absolute border-2 border-red-300/70 bg-red-400/10"
          style={{
            left: pos.x * TILE_SIZE_PX,
            top: pos.y * TILE_SIZE_PX,
            width: TILE_SIZE_PX,
            height: TILE_SIZE_PX,
            transition: 'opacity 120ms ease-out',
          }}
        />
      ))}
    </div>
  );
};

export default BattleMapOverlay;
