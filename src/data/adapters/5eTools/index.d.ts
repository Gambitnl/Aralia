import { MonsterData } from '../../../types/ui';
import { Spell } from '../../../types/spells';
export declare function convert5eToolsMonster(monsterData: any, spellLookup?: (name: string) => Spell | undefined): MonsterData;
