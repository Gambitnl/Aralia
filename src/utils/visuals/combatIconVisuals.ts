// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 15/07/2026, 06:36:42
 * Dependents: components/BattleMap/AbilityButton.tsx, components/BattleMap/CharacterToken.tsx, components/BattleMap/CombatIntentPreview.tsx, components/BattleMap/InitiativeTracker.tsx, components/BattleMap/PartyDisplay.tsx, utils/visuals/spellVisuals.ts
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file connects the new battle-map SVG icon pack to live combat data.
 *
 * Spells, granted follow-up actions, and enemy tokens all arrive through
 * different runtime shapes. This helper keeps the visual matching in one place
 * so UI components can ask for a ready-to-render asset without learning every
 * spell-name or monster-name special case.
 *
 * Called by: AbilityButton, CharacterToken, and spellVisuals.
 * Depends on: the reusable SVG files under src/assets/icons/combat.
 */

import type { Ability, CombatCharacter } from '../../types/combat';
import type { Spell, SpellSchool } from '../../types/spells';
import type { VisualAsset } from '../../types/visuals';

import spellAttackIcon from '../../assets/icons/combat/spell-attack.svg';
import spellArcaneIcon from '../../assets/icons/combat/spell-arcane.svg';
import spellDancingLightsIcon from '../../assets/icons/combat/spell-dancing-lights.svg';
import spellFireIcon from '../../assets/icons/combat/spell-fire.svg';
import spellIceIcon from '../../assets/icons/combat/spell-ice.svg';
import spellLightningIcon from '../../assets/icons/combat/spell-lightning.svg';
import spellMovementIcon from '../../assets/icons/combat/spell-movement.svg';
import spellNatureIcon from '../../assets/icons/combat/spell-nature.svg';
import spellRadiantIcon from '../../assets/icons/combat/spell-radiant.svg';
import spellReactionShieldIcon from '../../assets/icons/combat/spell-reaction-shield.svg';
import spellShieldIcon from '../../assets/icons/combat/spell-shield.svg';

import creatureBeastIcon from '../../assets/icons/combat/creature-beast.svg';
import creatureCultistIcon from '../../assets/icons/combat/creature-cultist.svg';
import creatureGoblinIcon from '../../assets/icons/combat/creature-goblin.svg';
import creatureOrcIcon from '../../assets/icons/combat/creature-orc.svg';
import creatureUndeadIcon from '../../assets/icons/combat/creature-undead.svg';

// ============================================================================
// Palette Constants
// ============================================================================
// The icon resolver returns colors as well as image URLs because ability buttons
// already use the visual result to choose borders and interaction accents.
// ============================================================================

const SCHOOL_COLOR_HINTS: Partial<Record<SpellSchool, string>> = {
  Abjuration: '#38bdf8',
  Conjuration: '#f59e0b',
  Divination: '#a78bfa',
  Enchantment: '#f472b6',
  Evocation: '#fb7185',
  Illusion: '#c084fc',
  Necromancy: '#34d399',
  Transmutation: '#22c55e',
};

const DEFAULT_VISUAL: VisualAsset = {
  src: spellArcaneIcon,
  fallbackContent: '*',
  primaryColor: '#67e8f9',
  secondaryColor: '#f8fafc',
  label: 'Arcane ability',
};

// ============================================================================
// Name Normalization
// ============================================================================
// Runtime spell ids, spell names, and generated follow-up action labels do not
// always use the same separators. Normalize them once before pattern matching.
// ============================================================================

const normalizeVisualKey = (value?: string): string => (
  value ?? ''
).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ============================================================================
// Spell Icon Matching
// ============================================================================
// The first pass covers the icons visible in the battle-map reference and demo:
// light, protection, movement, elemental attacks, nature, radiant/divine, and a
// generic arcane fallback. More exact spell-name matches can be added here.
// ============================================================================

export const getSpellIconAsset = (spell: Pick<Spell, 'id' | 'name' | 'school' | 'damageType'>): string => {
  const spellKey = normalizeVisualKey(`${spell.id ?? ''} ${spell.name ?? ''}`);
  const damageKey = normalizeVisualKey(spell.damageType);

  if (spellKey.includes('dancing light') || spellKey.includes('light')) return spellDancingLightsIcon;
  if (spellKey.includes('shield') || spellKey.includes('armor') || spell.school === 'Abjuration') return spellShieldIcon;
  if (damageKey.includes('fire') || spellKey.includes('fire') || spellKey.includes('flame') || spellKey.includes('burning')) return spellFireIcon;
  if (damageKey.includes('cold') || damageKey.includes('ice') || spellKey.includes('frost') || spellKey.includes('ice')) return spellIceIcon;
  if (damageKey.includes('lightning') || damageKey.includes('thunder') || spellKey.includes('lightning') || spellKey.includes('thunder')) return spellLightningIcon;
  if (damageKey.includes('radiant') || spellKey.includes('bless') || spellKey.includes('heal') || spellKey.includes('cure') || spellKey.includes('radiant')) return spellRadiantIcon;
  if (spellKey.includes('thorn') || spellKey.includes('vine') || spellKey.includes('entangle') || spellKey.includes('nature')) return spellNatureIcon;
  if (spell.school === 'Transmutation') return spellNatureIcon;

  return spellArcaneIcon;
};

export const getSpellIconColor = (spell: Pick<Spell, 'school' | 'damageType'>): string => {
  const damageKey = normalizeVisualKey(spell.damageType);

  if (damageKey.includes('fire')) return '#fb923c';
  if (damageKey.includes('cold') || damageKey.includes('ice')) return '#67e8f9';
  if (damageKey.includes('lightning') || damageKey.includes('thunder')) return '#c4b5fd';
  if (damageKey.includes('radiant')) return '#fde047';

  return SCHOOL_COLOR_HINTS[spell.school] ?? DEFAULT_VISUAL.primaryColor;
};

// ============================================================================
// Ability Icon Matching
// ============================================================================
// Abilities include native attacks, move buttons, generated spell actions, and
// spell buttons. This resolver gives each lane a real SVG while preserving the
// old text fallback for any ability that still carries an authored icon.
// ============================================================================

export const getAbilityIconVisual = (ability: Ability): VisualAsset => {
  const abilityKey = normalizeVisualKey(`${ability.id} ${ability.name} ${ability.sourceSpellId ?? ''}`);
  const damageKey = normalizeVisualKey(ability.effects?.find(effect => effect.damageType)?.damageType);

  if (ability.spell) {
    return {
      src: getSpellIconAsset(ability.spell),
      fallbackContent: '*',
      primaryColor: getSpellIconColor(ability.spell),
      secondaryColor: '#ffffff',
      label: `${ability.name} (${ability.spell.school})`,
    };
  }

  if (ability.cost.type === 'movement-only' || ability.type === 'movement' || abilityKey.includes('move') || abilityKey.includes('dash')) {
    return {
      src: spellMovementIcon,
      fallbackContent: '>',
      primaryColor: '#22c55e',
      secondaryColor: '#dcfce7',
      label: ability.name,
    };
  }

  if (ability.cost.type === 'reaction' || abilityKey.includes('reaction')) {
    return {
      src: spellReactionShieldIcon,
      fallbackContent: '!',
      primaryColor: '#60a5fa',
      secondaryColor: '#dbeafe',
      label: ability.name,
    };
  }

  if (damageKey.includes('fire') || abilityKey.includes('fire') || abilityKey.includes('flame')) return { ...DEFAULT_VISUAL, src: spellFireIcon, primaryColor: '#fb923c', label: ability.name };
  if (damageKey.includes('cold') || damageKey.includes('ice') || abilityKey.includes('frost')) return { ...DEFAULT_VISUAL, src: spellIceIcon, primaryColor: '#67e8f9', label: ability.name };
  if (damageKey.includes('lightning') || damageKey.includes('thunder')) return { ...DEFAULT_VISUAL, src: spellLightningIcon, primaryColor: '#c4b5fd', label: ability.name };
  if (damageKey.includes('radiant') || abilityKey.includes('bless') || abilityKey.includes('heal')) return { ...DEFAULT_VISUAL, src: spellRadiantIcon, primaryColor: '#fde047', label: ability.name };
  if (abilityKey.includes('shield') || abilityKey.includes('armor')) return { ...DEFAULT_VISUAL, src: spellShieldIcon, primaryColor: '#38bdf8', label: ability.name };

  if (ability.type === 'attack' || ability.weapon) {
    return {
      src: spellAttackIcon,
      fallbackContent: '/',
      primaryColor: '#f97316',
      secondaryColor: '#fee2e2',
      label: ability.name,
    };
  }

  if (ability.icon && ability.icon !== '+') {
    return {
      src: undefined,
      fallbackContent: ability.icon,
      primaryColor: 'transparent',
      secondaryColor: '#ffffff',
      label: ability.name,
    };
  }

  return {
    ...DEFAULT_VISUAL,
    label: ability.name,
  };
};

// ============================================================================
// Creature Token Matching
// ============================================================================
// Demo enemies and generated monsters often share broad humanoid types. Names
// are the strongest signal today, with creature type as the fallback for the
// dev verification lineups.
// ============================================================================

export const getCreatureTokenVisual = (character: CombatCharacter): VisualAsset => {
  const nameKey = normalizeVisualKey(character.name);
  const typeKey = normalizeVisualKey(character.creatureTypes?.join(' '));

  // A source-state defender is a known military role, not a generic monster.
  // Use the neutral weapon emblem until the art pack gains dedicated human
  // archer and infantry portraits; falling through to the enemy default would
  // falsely depict Turino's generated humanoid regiment as orcs.
  if (character.worldSource?.kind === 'worldforge-defender') {
    const role = character.worldSource.unitType === 'archers'
      ? 'archer'
      : character.worldSource.unitType === 'infantry'
        ? 'infantry'
        : character.worldSource.unitType;
    return {
      src: spellAttackIcon,
      fallbackContent: role.slice(0, 1).toUpperCase(),
      primaryColor: '#f59e0b',
      secondaryColor: '#fef3c7',
      label: `${character.name} ${role} from a WorldForge regiment`,
    };
  }

  if (nameKey.includes('cult') || nameKey.includes('magus')) {
    return { src: creatureCultistIcon, fallbackContent: 'C', primaryColor: '#ef4444', secondaryColor: '#fca5a5', label: `${character.name} cult caster token` };
  }

  if (nameKey.includes('goblin') || typeKey.includes('goblinoid')) {
    return { src: creatureGoblinIcon, fallbackContent: 'G', primaryColor: '#84cc16', secondaryColor: '#ecfccb', label: `${character.name} goblin token` };
  }

  if (nameKey.includes('orc') || nameKey.includes('reaver') || nameKey.includes('brute')) {
    return { src: creatureOrcIcon, fallbackContent: 'O', primaryColor: '#ef4444', secondaryColor: '#fee2e2', label: `${character.name} orc token` };
  }

  if (nameKey.includes('skeleton') || nameKey.includes('undead') || nameKey.includes('slain') || typeKey.includes('undead')) {
    return { src: creatureUndeadIcon, fallbackContent: 'U', primaryColor: '#38bdf8', secondaryColor: '#e0f2fe', label: `${character.name} undead token` };
  }

  if (nameKey.includes('wolf') || typeKey.includes('beast')) {
    return { src: creatureBeastIcon, fallbackContent: 'B', primaryColor: '#9ca3af', secondaryColor: '#fbbf24', label: `${character.name} beast token` };
  }

  if (character.team === 'enemy') {
    return { src: creatureOrcIcon, fallbackContent: 'E', primaryColor: '#ef4444', secondaryColor: '#fee2e2', label: `${character.name} enemy token` };
  }

  return {
    src: undefined,
    fallbackContent: character.class.id.slice(0, 1).toUpperCase(),
    primaryColor: character.team === 'player' ? '#60a5fa' : '#ef4444',
    secondaryColor: '#ffffff',
    label: `${character.name} token`,
  };
};
