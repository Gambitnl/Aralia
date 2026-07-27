/**
 * @file headForms.test.ts — sculpted head form composition (pure geometry,
 * no renderer). Pins the composed beast skull (cranium + muzzle wedge + brow
 * pair) and the face-plane rule that keeps the assembler-seated eyes OUT of
 * the cranium (the old box beast head swallowed them).
 */
import { describe, it, expect } from 'vitest';
import { Mesh, MeshBasicMaterial, type BufferGeometry, type Object3D } from 'three';
import { buildHeadForm, type HeadForm } from '../three/headForms';

const SKIN = new MeshBasicMaterial({ color: '#8c3b2e' });
const TOOTH = new MeshBasicMaterial({ color: '#e8e2d4' });

function meshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}

describe('headForms (sculpted plan heads)', () => {
  it('every form builds a group of finite meshes', () => {
    for (const form of ['serpent', 'beast', 'blunt', 'skull'] as HeadForm[]) {
      const group = buildHeadForm(form, SKIN, TOOTH);
      const parts = meshes(group);
      expect(parts.length, `${form} produced no meshes`).toBeGreaterThanOrEqual(1);
      for (const m of parts) {
        const pos = (m.geometry as BufferGeometry).attributes.position;
        expect(pos.count, `${form}/${m.name} empty geometry`).toBeGreaterThan(0);
        for (let i = 0; i < pos.count; i++) {
          expect(
            Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i)),
            `${form}/${m.name} has a non-finite vertex`,
          ).toBe(true);
        }
      }
    }
  });

  it('beast: composed skull — cranium, muzzle wedge, brow pair, jaw, teeth', () => {
    const group = buildHeadForm('beast', SKIN, TOOTH);
    for (const name of ['skull', 'muzzle', 'browL', 'browR', 'jaw', 'tooth0', 'tooth1']) {
      expect(group.getObjectByName(name), `beast head missing ${name}`).toBeTruthy();
    }
    // the crate is gone: the cranium is a rounded icosahedron, not a box
    const skull = group.getObjectByName('skull') as Mesh;
    expect(skull.geometry.type).toBe('IcosahedronGeometry');
  });

  it('face-plane rule: beast cranium stays shallow and the muzzle stays below the eye line', () => {
    // the assembler seats eyes ~0.72r forward and ~0.16r up; a deep cranium
    // buries them (the box head did), a muzzle crossing the eye line pokes
    // through them
    const group = buildHeadForm('beast', SKIN, TOOTH);
    const skull = group.getObjectByName('skull') as Mesh;
    expect(skull.scale.z, 'cranium too deep — eyes will bury').toBeLessThanOrEqual(0.8);
    const muzzle = group.getObjectByName('muzzle') as Mesh;
    const muzzleTop = muzzle.position.y + 0.62 * muzzle.scale.y; // octahedron radius × scale
    expect(muzzleTop, 'muzzle crosses the eye line').toBeLessThan(0.16);
    // the muzzle still projects a nose past the cranium front
    const muzzleTip = muzzle.position.z + 0.62 * muzzle.scale.z;
    expect(muzzleTip, 'muzzle must protrude past the cranium').toBeGreaterThan(skull.scale.z);
  });
});
