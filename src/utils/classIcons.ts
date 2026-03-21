/**
 * @file classIcons.ts
 * Canonical mapping from character class names to GlossaryIcon identifiers.
 *
 * Used throughout the CharacterCreator (class list, detail pane, review panel)
 * and the design preview (CLASS_ICONS). Keep the two sources in sync.
 */
import { GlossaryIconName } from '../components/Glossary/IconRegistry';

export const CLASS_ICON_MAP: Record<string, GlossaryIconName> = {
  Artificer: 'build',
  Barbarian: 'axe_battle',
  Bard:      'music',
  Cleric:    'fa_hands_praying',
  Druid:     'leaf',
  Fighter:   'sword_cross',
  Monk:      'martial_arts',
  Paladin:   'shield_cross',
  Ranger:    'bow_arrow',
  Rogue:     'mask',
  Sorcerer:  'magic_staff',
  Warlock:   'fa_skull',
  Wizard:    'fa_hat_wizard',
};

/**
 * Returns the GlossaryIconName for a class name, or undefined if not mapped.
 */
export function getClassIcon(className: string): GlossaryIconName | undefined {
  return CLASS_ICON_MAP[className];
}
