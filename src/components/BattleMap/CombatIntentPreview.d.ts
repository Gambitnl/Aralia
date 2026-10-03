/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 19:44:58
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file CombatIntentPreview.tsx
 * Floating "intent" card shown over the battle map while the player is choosing
 * a target for an ability. It mirrors the tactical mockup's Intent Preview: the
 * ability's icon and name, its action cost, range, any granted follow-up, and a
 * short description — so the player can confirm what they're about to do before
 * committing a click on the grid. It also owns the visible cancel action and
 * Escape behavior so every map renderer exits targeting consistently.
 */
import React from 'react';
import { Ability } from '../../types/combat';
interface CombatIntentPreviewProps {
    ability: Ability;
    casterName?: string;
    onCancel: () => void;
}
export declare const CombatIntentPreview: React.FC<CombatIntentPreviewProps>;
export default CombatIntentPreview;
