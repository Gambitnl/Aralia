/**
 * @file headForms.test.ts — sculpted head form composition (pure geometry,
 * no renderer). round 5 (creature-anatomy): the skull is a LOFTED MASS, not a
 * scaled ball — these tests pin the swept construction (wide cranium behind a
 * tapering snout, occiput at the rear underside where the neck merges), the
 * face-plane rule that keeps the assembler-seated eyes OUT of the muzzle, and
 * the outward-winding guard (positive signed volume).
 */
import { describe, it, expect } from 'vitest';
import { Mesh, MeshBasicMaterial, type BufferGeometry, type Object3D } from 'three';
import { buildHeadForm, buildHumanoidHead, HUMANOID_EYE, type HeadForm } from '../three/headForms';

const SKIN = new MeshBasicMaterial({ color: '#8c3b2e' });
const TOOTH = new MeshBasicMaterial({ color: '#e8e2d4' });

const ALL_FORMS: HeadForm[] = ['serpent', 'beast', 'blunt', 'skull'];

function meshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}

/** Max half-width |x| of the skull surface within a z band. */
function maxHalfWidth(geo: BufferGeometry, z0: number, z1: number): number {
  const pos = geo.attributes.position;
  let w = 0;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z >= z0 && z <= z1) w = Math.max(w, Math.abs(pos.getX(i)));
  }
  return w;
}

/** Max y of the skull surface within a z band. */
function maxTop(geo: BufferGeometry, z0: number, z1: number): number {
  const pos = geo.attributes.position;
  let top = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z >= z0 && z <= z1) top = Math.max(top, pos.getY(i));
  }
  return top;
}

/** Signed volume (×6) of a non-indexed triangle soup. Negative = inside-out. */
function signedVolume(geo: BufferGeometry): number {
  const p = geo.attributes.position;
  let vol = 0;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i);
    const bx = p.getX(i + 1), by = p.getY(i + 1), bz = p.getZ(i + 1);
    const cx = p.getX(i + 2), cy = p.getY(i + 2), cz = p.getZ(i + 2);
    vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return vol;
}

describe('headForms (sculpted plan heads)', () => {
  it('every form builds a group of finite meshes', () => {
    for (const form of ALL_FORMS) {
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

  it('round 5: every skull is a sculpted loft — wide cranium, tapering snout, protruding nose', () => {
    for (const form of ALL_FORMS) {
      const group = buildHeadForm(form, SKIN, TOOTH);
      const skull = group.getObjectByName('skull') as Mesh;
      expect(skull, `${form} missing skull loft`).toBeTruthy();
      const geo = skull.geometry as BufferGeometry;
      // the cheek/cranium band is the head's widest statement…
      const cranium = maxHalfWidth(geo, -0.6, 0.4);
      expect(cranium, `${form} cranium too narrow — ball-head read`).toBeGreaterThan(0.85);
      // …the snout tapers forward from it (no constant-width hose)…
      const snoutTip = maxHalfWidth(geo, 0.9, 2.0);
      expect(snoutTip, `${form} snout does not taper`).toBeLessThan(cranium * 0.55);
      // …and the nose protrudes past the unit sphere the old ball occupied
      const pos = geo.attributes.position;
      let zMax = 0;
      for (let i = 0; i < pos.count; i++) zMax = Math.max(zMax, pos.getZ(i));
      expect(zMax, `${form} has no snout projection`).toBeGreaterThan(1.0);
    }
  });

  it('round 5: the occiput sits at the rear underside so the neck flows into the skull', () => {
    for (const form of ALL_FORMS) {
      const group = buildHeadForm(form, SKIN, TOOTH);
      const skull = group.getObjectByName('skull') as Mesh;
      const geo = skull.geometry as BufferGeometry;
      // the neck-tube tip arrives at local ≈ (0, -0.35, -0.5); the skull's
      // rear must reach past z −0.8 and be NARROWER than the cheek there —
      // the neck merges into a tapering rear, not a sphere equator
      const pos = geo.attributes.position;
      let zMin = 0;
      for (let i = 0; i < pos.count; i++) zMin = Math.min(zMin, pos.getZ(i));
      expect(zMin, `${form} skull has no rear occiput extension`).toBeLessThan(-0.8);
      const occiput = maxHalfWidth(geo, -1.4, -0.75);
      const cheek = maxHalfWidth(geo, -0.6, 0.4);
      expect(occiput, `${form} rear as wide as the cheek — butt-join read`).toBeLessThan(cheek * 0.7);
    }
  });

  it('face-plane rule: muzzles stay below the assembler eye line (y 0.16 at z ≥ 0.6)', () => {
    for (const form of ALL_FORMS) {
      const group = buildHeadForm(form, SKIN, TOOTH);
      const skull = group.getObjectByName('skull') as Mesh;
      const top = maxTop(skull.geometry as BufferGeometry, 0.6, 2.0);
      expect(top, `${form} muzzle crosses the eye line — eyes will bury`).toBeLessThan(0.16);
    }
  });

  it('winding guard: every skull and jaw loft winds outward (positive signed volume)', () => {
    for (const form of ALL_FORMS) {
      const group = buildHeadForm(form, SKIN, TOOTH);
      for (const name of ['skull', 'jaw']) {
        const mesh = group.getObjectByName(name) as Mesh | undefined;
        if (!mesh) continue; // blunt has no jaw
        expect(
          signedVolume(mesh.geometry as BufferGeometry),
          `${form}/${name} is inside-out (the Emberwing lesson)`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('beast: composed head — skull loft, brow pair, hinged jaw, teeth', () => {
    const group = buildHeadForm('beast', SKIN, TOOTH);
    // round 5: the muzzle is part of the skull loft (no glued wedge); the
    // brow pair and the hinged jaw group remain composed extras
    for (const name of ['skull', 'browL', 'browR', 'jawGroup', 'jaw', 'tooth0', 'tooth1']) {
      expect(group.getObjectByName(name), `beast head missing ${name}`).toBeTruthy();
    }
  });

  it('round 8 (humanoid-anatomy): the humanoid head is ONE continuous loft with carved sockets', () => {
    const group = buildHumanoidHead(SKIN);
    const skull = group.getObjectByName('skull') as Mesh;
    expect(skull, 'humanoid missing skull loft').toBeTruthy();
    // ONE surface: no attached feature pieces — the round-7 collage (separate
    // jaw loft, brow boxes, lid lines, cheek lumps) is the pinned regression
    expect(meshes(group), 'humanoid head must be exactly one mesh').toHaveLength(1);
    for (const name of ['jaw', 'jawGroup', 'browL', 'browR', 'lidLineL', 'lidLineR', 'cheekL', 'cheekR']) {
      expect(group.getObjectByName(name), `detached feature piece "${name}" is back`).toBeFalsy();
    }
    // outward winding (the Emberwing lesson)
    const geo = skull.geometry as BufferGeometry;
    expect(signedVolume(geo)).toBeGreaterThan(0);
    // proportion span the 1/7 head-to-body math in bipedSkullRadiusM assumes:
    // crown just under 0.9 radii, chin below −0.55, narrower than a unit ball
    const pos = geo.attributes.position;
    let crown = -Infinity;
    let chin = Infinity;
    let halfWidth = 0;
    for (let i = 0; i < pos.count; i++) {
      crown = Math.max(crown, pos.getY(i));
      chin = Math.min(chin, pos.getY(i));
      halfWidth = Math.max(halfWidth, Math.abs(pos.getX(i)));
    }
    expect(crown).toBeGreaterThan(0.8);
    expect(crown).toBeLessThan(0.95);
    expect(chin, 'the loft must end in a chin, not a ball equator').toBeLessThan(-0.55);
    expect(halfWidth, 'skull as wide as the old ball — egg-head read').toBeLessThan(0.8);
    // CARVED SOCKETS: at the eye station the eye columns (x ≈ ±0.3) must be
    // recessed behind the brow shelf above them AND behind the nose ridge —
    // the eyeball nests into the surface instead of sticking on it
    const frontAt = (y0: number, y1: number, x0: number, x1: number): number => {
      let z = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const x = Math.abs(pos.getX(i));
        if (y >= y0 && y <= y1 && x >= x0 && x <= x1) z = Math.max(z, pos.getZ(i));
      }
      return z;
    };
    const socketFloor = frontAt(HUMANOID_EYE.y - 0.04, HUMANOID_EYE.y + 0.04, 0.2, 0.42);
    const browFront = frontAt(0.26, 0.34, 0, 0.42);
    const noseFront = frontAt(-0.04, 0.08, 0, 0.12);
    expect(socketFloor, 'no geometry at the eye station').toBeGreaterThan(-Infinity);
    expect(socketFloor, 'sockets not carved — eye columns flush with the brow').toBeLessThan(browFront - 0.1);
    expect(socketFloor, 'sockets not carved — no nose ridge between the orbits').toBeLessThan(noseFront - 0.2);
    // the eyeball seats INSIDE the socket: its center is behind the socket
    // rim (brow front) and its back is behind the socket floor
    expect(HUMANOID_EYE.z - HUMANOID_EYE.r).toBeLessThan(socketFloor);
    expect(HUMANOID_EYE.z).toBeLessThan(browFront);
    // the jawline narrows toward the chin (same loft, lower stations)
    const widthAt = (y0: number, y1: number): number => {
      let w = 0;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y >= y0 && y <= y1) w = Math.max(w, Math.abs(pos.getX(i)));
      }
      return w;
    };
    expect(widthAt(-0.55, -0.35), 'no jaw taper — the chin is as wide as the cheeks').toBeLessThan(widthAt(-0.05, 0.25) * 0.65);
  });

  it('serpent: hinged gape with a dark gullet and large tusks', () => {
    const group = buildHeadForm('serpent', SKIN, TOOTH);
    const jawGroup = group.getObjectByName('jawGroup');
    expect(jawGroup, 'serpent missing hinged jaw').toBeTruthy();
    expect(jawGroup!.rotation.x, 'serpent jaw must swing visibly open').toBeGreaterThan(0.4);
    expect(group.getObjectByName('gullet'), 'open maw needs the dark gullet').toBeTruthy();
    const teeth = meshes(group).filter((m) => m.name.startsWith('tooth'));
    expect(teeth.length, 'serpent needs its tusks').toBeGreaterThanOrEqual(6);
  });
});
