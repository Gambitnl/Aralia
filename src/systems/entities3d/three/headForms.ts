/**
 * @file headForms.ts — sculpted head builds (Dragon Forge XO technique):
 * one non-uniformly scaled platonic solid per form + a tapered-cylinder jaw +
 * four-sided cone teeth. Built once per head; the assembler re-poses the
 * group at the live head socket each frame.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Material,
  Mesh,
  OctahedronGeometry,
} from 'three';

export type HeadForm = 'serpent' | 'beast' | 'blunt' | 'skull';

interface FormSpec {
  /** Skull solid + non-uniform scale (x width, y height, z length). */
  solid: () => IcosahedronGeometry | OctahedronGeometry | BoxGeometry;
  scale: [number, number, number];
  /** Jaw: length/drop as fractions of head radius; 0 length = no jaw. */
  jawLen: number;
  jawDrop: number;
  jawR: number;
  teeth: number;
}

const FORMS: Record<HeadForm, FormSpec> = {
  serpent: { solid: () => new IcosahedronGeometry(1, 1), scale: [0.95, 0.72, 1.45], jawLen: 1.1, jawDrop: 0.42, jawR: 0.3, teeth: 4 },
  beast: { solid: () => new BoxGeometry(1.7, 1.35, 2.1), scale: [1, 1, 1], jawLen: 1.0, jawDrop: 0.5, jawR: 0.42, teeth: 2 },
  blunt: { solid: () => new IcosahedronGeometry(1, 1), scale: [1.05, 1.0, 1.08], jawLen: 0, jawDrop: 0, jawR: 0, teeth: 0 },
  skull: { solid: () => new OctahedronGeometry(1, 1), scale: [0.95, 1.1, 1.25], jawLen: 0.95, jawDrop: 0.55, jawR: 0.26, teeth: 3 },
};

/**
 * Build one sculpted head, unit-radius (scale the group by the socket radius).
 * +z is the look direction, matching head sockets.
 */
export function buildHeadForm(form: HeadForm, skinMaterial: Material, toothMaterial: Material): Group {
  const spec = FORMS[form];
  const group = new Group();

  const skull = new Mesh(spec.solid(), skinMaterial);
  skull.scale.set(...spec.scale);
  skull.name = 'skull';
  group.add(skull);

  if (spec.jawLen > 0) {
    // tapered jaw swung down-forward from below the skull
    const jaw = new Mesh(new CylinderGeometry(spec.jawR * 0.55, spec.jawR, spec.jawLen, 7), skinMaterial);
    jaw.position.set(0, -spec.jawDrop, spec.jawLen * 0.42);
    jaw.rotation.x = Math.PI / 2 - 0.28; // hinge open a touch
    jaw.name = 'jaw';
    group.add(jaw);

    for (let t = 0; t < spec.teeth; t++) {
      const u = spec.teeth === 1 ? 0.5 : t / (spec.teeth - 1);
      const tooth = new Mesh(new ConeGeometry(0.07, 0.22, 4), toothMaterial);
      tooth.position.set((u - 0.5) * spec.jawR * 2.2, -spec.jawDrop + 0.16, spec.jawLen * 0.55 + Math.sin(u * Math.PI) * 0.12);
      tooth.rotation.x = Math.PI; // points down
      tooth.name = `tooth${t}`;
      group.add(tooth);
    }
  }
  return group;
}
