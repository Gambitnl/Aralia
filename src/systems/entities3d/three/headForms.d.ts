/**
 * @file headForms.ts — sculpted head builds (Dragon Forge XO technique):
 * composed low-poly solids per form + a tapered-cylinder jaw + four-sided
 * cone teeth. Built once per head; the assembler re-poses the group at the
 * live head socket each frame.
 *
 * FACE-PLANE RULE: the assembler seats the eyes at ~0.72 head-radii forward
 * (+z) and ~0.16 up. Any solid occupying the eye line must keep its front at
 * or behind ~0.75r or the eyes bury inside the skull (the old box beast head
 * swallowed them whole — a crate with no face). Muzzles and jaws live BELOW
 * the eye line; only brows may cross it above.
 */
import { Group, Material } from 'three';
export type HeadForm = 'serpent' | 'beast' | 'blunt' | 'skull';
/**
 * Build one sculpted head, unit-radius (scale the group by the socket radius).
 * +z is the look direction, matching head sockets.
 */
export declare function buildHeadForm(form: HeadForm, skinMaterial: Material, toothMaterial: Material): Group;
