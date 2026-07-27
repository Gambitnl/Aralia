/**
 * @file classIcons.ts
 * Canonical mapping from character class names to GlossaryIcon identifiers.
 *
 * Used throughout the CharacterCreator (class list, detail pane, review panel)
 * and the design preview (CLASS_ICONS). Keep the two sources in sync.
 */
import { GlossaryIconName } from '../components/Glossary/IconRegistry';
export declare const CLASS_ICON_MAP: Record<string, GlossaryIconName>;
/**
 * Returns the GlossaryIconName for a class name, or undefined if not mapped.
 */
export declare function getClassIcon(className: string): GlossaryIconName | undefined;
