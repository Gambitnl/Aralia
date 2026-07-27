/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 23/07/2026, 21:24:37
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/SpellArtifact3DMarker.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { ActiveAnimatedObject, ActiveExtradimensionalSpace, ActiveSpellEmanation, ActiveFireEffect, ActiveSpellForce, ActiveSpellGuardian, ActiveSpellHelper, ActiveSpellStructure, ActiveTruePolymorphTransformation, CombatCharacter, Position, SpellObjectImpact, SpellObjectRepair, SpellObjectAccessChange } from '../../types/combat';
export interface SpellMapArtifacts {
    helpers?: ActiveSpellHelper[];
    forces?: ActiveSpellForce[];
    guardians?: ActiveSpellGuardian[];
    animatedObjects?: ActiveAnimatedObject[];
    structures?: ActiveSpellStructure[];
    extradimensionalSpaces?: ActiveExtradimensionalSpace[];
    emanations?: ActiveSpellEmanation[];
    objectImpacts?: SpellObjectImpact[];
    objectRepairs?: SpellObjectRepair[];
    objectAccessChanges?: SpellObjectAccessChange[];
    fireEffects?: ActiveFireEffect[];
    truePolymorphTransformations?: ActiveTruePolymorphTransformation[];
}
export interface SpellMapArtifactMarker {
    id: string;
    family: 'helper' | 'force' | 'guardian' | 'animated-object' | 'structure' | 'space' | 'emanation' | 'object-impact' | 'object-repair' | 'object-access' | 'fire-effect' | 'transformation';
    label: string;
    title: string;
    position: Position;
    radiusFeet?: number;
}
/**
 * Converts non-creature spell runtime records into one map-facing marker list.
 * The records remain owned by command/combat state; this helper only gives the
 * 2D and 3D renderers the same compact visual contract.
 */
export declare const buildSpellMapArtifactMarkers: (artifacts: SpellMapArtifacts | undefined, characters?: CombatCharacter[]) => SpellMapArtifactMarker[];
