import type { EntityBlueprint } from '../types';
import { type CreaturePlan } from './planSchema';
export declare function compilePlan(plan: CreaturePlan): Pick<EntityBlueprint, 'gait' | 'frame' | 'palette' | 'parts' | 'label' | 'planSpec'>;
