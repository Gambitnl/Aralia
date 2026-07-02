import React from 'react';
import { Z_INDEX } from '../../styles/zIndex';
import type { IntentSkillInfo } from '../../systems/gameEntry/resolveDeEscalationIntent';

interface Props {
  candidates: IntentSkillInfo[];
  onPick: (skill: IntentSkillInfo) => void;
  onCancel: () => void;
}

export const SkillClarificationPane: React.FC<Props> = ({ candidates, onPick, onCancel }) => (
  // z-index via inline style — Tailwind z-[${...}] silently fails in this repo.
  <div data-testid="skill-clarification" style={{ zIndex: Z_INDEX.MODAL_INTERACTIVE }}
    className="fixed right-0 top-1/4 bottom-1/4 w-80 bg-gray-900 border-l border-amber-500/60 shadow-2xl p-4 flex flex-col gap-2">
    <h3 className="text-amber-300 font-bold text-sm">Which approach?</h3>
    <p className="text-xs text-gray-400 mb-2">Pick the skill you mean. Bold = you're proficient.</p>
    {candidates.map((c) => (
      <button key={c.name} type="button" data-testid={`skill-pick-${c.name}`} onClick={() => onPick(c)}
        className={`flex justify-between items-center px-3 py-2 rounded border text-sm transition-colors
          ${c.proficient ? 'border-amber-500/70 bg-amber-900/20 text-amber-100 font-semibold' : 'border-gray-700 bg-gray-800 text-gray-200'}`}>
        <span>
          {c.name}
          {c.proficient && (
            <span data-testid={`skill-proficient-${c.name}`} className="ml-1 text-[10px] uppercase text-amber-400">prof</span>
          )}
        </span>
        <span className="tabular-nums">{`${c.modifier >= 0 ? '+' : ''}${c.modifier}`}</span>
      </button>
    ))}
    <button type="button" onClick={onCancel} className="mt-2 text-xs text-gray-500 hover:text-gray-300 self-end">Cancel</button>
  </div>
);
