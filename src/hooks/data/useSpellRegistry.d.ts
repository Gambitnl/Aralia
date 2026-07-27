import { Spell } from '../../types/spells';
export declare function useSpellRegistry(): {
    lookup: (name: string) => Promise<Spell | undefined>;
    isLoading: boolean;
};
