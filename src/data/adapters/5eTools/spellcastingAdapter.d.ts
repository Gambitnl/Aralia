import { Ability } from '../../../types/combat';
import { Spell } from '../../../types/spells';
export declare function parseSpellcasting(spellcastingBlocks: any[] | undefined, spellLookup?: (name: string) => Spell | undefined): Ability[];
