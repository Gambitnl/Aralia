/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 10:16:10
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Ability, Position, CombatCharacter, BattleMapData } from '../../types/combat';
interface UseTargetingProps {
    mapData: BattleMapData | null;
    characters: CombatCharacter[];
}
interface TeleportDestinationPreview {
    origin: Position;
    targetId: string;
    affectedTiles: Position[];
    ability: Ability;
}
export declare const useTargeting: ({ mapData, characters }: UseTargetingProps) => {
    selectedAbility: Ability;
    targetingMode: boolean;
    aoePreview: {
        center: Position;
        affectedTiles: Position[];
        ability: Ability;
    };
    teleportDestinationPreview: TeleportDestinationPreview;
    startTargeting: (ability: Ability) => void;
    cancelTargeting: () => void;
    previewAoE: (position: Position, caster: CombatCharacter) => void;
    previewTeleportDestinations: (ability: Ability, caster: CombatCharacter, movedTarget?: CombatCharacter) => void;
    isTeleportDestination: (position: Position) => boolean;
    setSelectedAbility: import("react").Dispatch<import("react").SetStateAction<Ability>>;
    setTargetingMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
};
export {};
