// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 05/02/2026, 21:41:59
 * Dependents: SkillSelection.tsx
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useReducer } from 'react';

type SkillSelectionState = {
  selectedClassSkillIds: Set<string>;
  selectedKeenSensesSkillId: string | null;
  viewedSkillId: string | null;
};

type SkillSelectionAction =
  | { type: 'toggleClassSkill'; skillId: string; maxSelected: number }
  | { type: 'setKeenSenses'; skillId: string | null }
  | { type: 'setViewedSkill'; skillId: string | null }
  | { type: 'resetClassSkills' };

function reducer(state: SkillSelectionState, action: SkillSelectionAction): SkillSelectionState {
  switch (action.type) {
    case 'toggleClassSkill': {
      const next = new Set(state.selectedClassSkillIds);
      if (next.has(action.skillId)) {
        next.delete(action.skillId);
      } else if (next.size < action.maxSelected) {
        next.add(action.skillId);
      }
      return { ...state, selectedClassSkillIds: next };
    }
    case 'setKeenSenses':
      return { ...state, selectedKeenSensesSkillId: action.skillId };
    case 'setViewedSkill':
      return { ...state, viewedSkillId: action.skillId };
    case 'resetClassSkills':
      return { ...state, selectedClassSkillIds: new Set() };
    default:
      return state;
  }
}

export function useSkillSelectionState() {
  const [state, dispatch] = useReducer(reducer, {
    selectedClassSkillIds: new Set<string>(),
    selectedKeenSensesSkillId: null,
    viewedSkillId: null,
  });

  const toggleClassSkill = useCallback((skillId: string, maxSelected: number) => {
    dispatch({ type: 'toggleClassSkill', skillId, maxSelected });
  }, []);

  const setSelectedKeenSensesSkillId = useCallback((skillId: string | null) => {
    dispatch({ type: 'setKeenSenses', skillId });
  }, []);

  const setViewedSkillId = useCallback((skillId: string | null) => {
    dispatch({ type: 'setViewedSkill', skillId });
  }, []);

  const resetSelectedClassSkills = useCallback(() => {
    dispatch({ type: 'resetClassSkills' });
  }, []);

  return {
    selectedClassSkillIds: state.selectedClassSkillIds,
    selectedKeenSensesSkillId: state.selectedKeenSensesSkillId,
    viewedSkillId: state.viewedSkillId,
    toggleClassSkill,
    setSelectedKeenSensesSkillId,
    setViewedSkillId,
    resetSelectedClassSkills,
  };
}

