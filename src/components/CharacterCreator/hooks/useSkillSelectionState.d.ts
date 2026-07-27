/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:18
 * Dependents: SkillSelection.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export declare function useSkillSelectionState(): {
    selectedClassSkillIds: Set<string>;
    selectedKeenSensesSkillId: string;
    viewedSkillId: string;
    toggleClassSkill: (skillId: string, maxSelected: number) => void;
    setSelectedKeenSensesSkillId: (skillId: string | null) => void;
    setViewedSkillId: (skillId: string | null) => void;
    resetSelectedClassSkills: () => void;
};
