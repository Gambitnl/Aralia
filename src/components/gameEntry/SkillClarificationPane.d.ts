import React from 'react';
import type { IntentSkillInfo } from '../../systems/gameEntry/resolveDeEscalationIntent';
interface Props {
    candidates: IntentSkillInfo[];
    onPick: (skill: IntentSkillInfo) => void;
    onCancel: () => void;
}
export declare const SkillClarificationPane: React.FC<Props>;
export {};
