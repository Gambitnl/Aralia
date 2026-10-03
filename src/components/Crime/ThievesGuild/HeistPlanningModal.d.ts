import React from 'react';
import { HeistPlan } from '../../../types/crime';
type HeistApproach = {
    type: string;
    riskModifier: number;
    timeModifier: number;
    requiredSkills: string[];
};
interface HeistPlanningModalProps {
    plan: HeistPlan;
    onSelectApproach: (approach: HeistApproach) => void;
    onStartHeist: () => void;
    onClose: () => void;
}
export declare const HeistPlanningModal: React.FC<HeistPlanningModalProps>;
export {};
