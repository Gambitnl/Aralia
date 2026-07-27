/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/06/2026, 06:37:00
 * Dependents: components/Religion/DivineFavorPanel.tsx, components/Religion/TempleModal.tsx, state/appState.ts, state/initialState.ts, state/reducers/religionReducer.ts, systems/religion/CombatReligionAdapter.ts, utils/world/religionUtils.ts, utils/world/templeUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/data/deities/index.ts
 * =========================================================================================
 * 🏛️ MYTHKEEPER DEITY DATA
 * =========================================================================================
 *
 * This file represents the authoritative source for deity data in Aralia RPG.
 * It adheres to D&D 5e (2014 & 2024) standards for domains and alignments.
 *
 * =========================================================================================
 */
import { Deity } from '../../types';
export declare const DEITIES: Deity[];
