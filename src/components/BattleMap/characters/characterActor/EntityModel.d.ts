/**
 * @file EntityModel.tsx — the combat actor's body: a generated entity
 * (src/systems/entities3d) breathing in place, with combat action overlays
 * (lunge / recoil / cast rise / death fall) applied to its root.
 *
 * Replaces the box-primitive Humanoid/Beast/Dragon/Ooze/Aberration models.
 * The combat chrome (rings, badges, pips, nameplate) stays in CharacterActor;
 * this component owns only the body.
 */
import React from 'react';
import type { EntityBlueprint } from '@/systems/entities3d/types';
import type { AnimationState } from './models';
import { type ControlPose } from '../../controlOptionPose';
interface EntityModelProps {
    blueprint: EntityBlueprint;
    animState: AnimationState;
    /** Live animation clock — a ref so per-frame time never goes stale. */
    animTimeRef: React.MutableRefObject<number>;
    /** G7 shared contract: sustained control-option pose (grovel/halt/…), eased
     * on per frame and eased back off when the directive expires. Null = base. */
    controlPose?: ControlPose | null;
}
export declare const EntityModel: React.FC<EntityModelProps>;
export {};
