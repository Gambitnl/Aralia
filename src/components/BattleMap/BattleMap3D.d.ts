/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 10:29:18
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file BattleMap3D.tsx
 * 3D rendering frontend for the tactical combat map, using react-three-fiber.
 *
 * This component is the 3D equivalent of BattleMap.tsx. It consumes the same
 * hooks and props but renders a Three.js scene instead of HTML/CSS grid.
 *
 * Architecture:
 * - All game logic stays in shared hooks (useBattleMap, useTurnManager, etc.)
 * - This component is purely a rendering layer
 * - Can be toggled with the 2D BattleMap via RenderModeToggle
 *
 * Research references:
 * - R3F TypeScript setup: https://r3f.docs.pmnd.rs/api/typescript
 * - drei controls: https://drei.docs.pmnd.rs/controls/introduction
 * - Postprocessing: https://react-postprocessing.docs.pmnd.rs/effects/ssao
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md
 */
import React from 'react';
import { BattleMapData, CombatCharacter } from '../../types/combat';
import type { useTurnManager } from '../../hooks/combat/useTurnManager';
import type { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { type SpellMapArtifacts } from './spellMapArtifacts';
interface BattleMap3DProps {
    mapData: BattleMapData | null;
    characters: CombatCharacter[];
    /** Non-creature summon/control records rendered as explicit 3D markers. */
    spellMapArtifacts?: SpellMapArtifacts;
    combatState: {
        turnManager: ReturnType<typeof useTurnManager>;
        turnState: ReturnType<typeof useTurnManager>['turnState'];
        abilitySystem: ReturnType<typeof useAbilitySystem>;
        isCharacterTurn: (id: string) => boolean;
        onCharacterUpdate: (character: CombatCharacter) => void;
    };
}
declare const BattleMap3D: React.FC<BattleMap3DProps>;
export default BattleMap3D;
