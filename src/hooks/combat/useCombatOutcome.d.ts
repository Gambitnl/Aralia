import { CombatCharacter } from '../../types/combat';
import { Item } from '../../types';
export interface CombatRewards {
    gold: number;
    items: Item[];
    xp: number;
}
export type BattleOutcome = 'active' | 'victory' | 'defeat';
interface UseCombatOutcomeProps {
    characters: CombatCharacter[];
    initialEnemies: CombatCharacter[];
}
export declare const useCombatOutcome: ({ characters, initialEnemies }: UseCombatOutcomeProps) => {
    battleState: BattleOutcome;
    rewards: CombatRewards;
    forceOutcome: (outcome: BattleOutcome) => void;
};
export {};
