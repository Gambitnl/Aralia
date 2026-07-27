/**
 * @file segmentCollar.test.ts — junction blend collars in the segment
 * renderer (slice 1). Spec: docs/superpowers/specs/2026-07-23-junction-blend-design.md.
 */
import { describe, it, expect } from 'vitest';
import { Box3, Group, Vector3 } from 'three';
import { createSegmentBody } from '../three/segmentBody';

const OPTS = { renderMode: 'solid' as const, colorHex: '#7a4a3a', accentHex: '#d98e3a', outlineThickness: 0.01 };

function collarGroup(root: Group, id: string): Group | undefined {
  let found: Group | undefined;
  root.traverse((o) => {
    if (o.name === `seg:${id}`) found = o as Group;
  });
  return found;
}

describe('segment renderer collar()', () => {
  it('builds a skirt at the root whose size tracks limbR + reach', () => {
    const body = createSegmentBody(OPTS);
    body.beginFrame();
    body.sink.collar!('leg0L.collar', 1, 0.8, 0.2, 0, -1, 0, 0.1, 0.12);
    body.finishFrame();
    const group = collarGroup(body.root, 'leg0L.collar');
    expect(group).toBeTruthy();
    group!.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(group!);
    const size = bounds.getSize(new Vector3());
    // radially: at most ~2 × (limbR + reach) wide, and wider than the limb alone
    expect(Math.max(size.x, size.z)).toBeLessThanOrEqual((0.1 + 0.12) * 2 + 0.02);
    expect(Math.max(size.x, size.z)).toBeGreaterThan(0.1 * 2);
    // sits on the root
    const center = bounds.getCenter(new Vector3());
    expect(center.x).toBeCloseTo(1, 1);
    expect(center.z).toBeCloseTo(0.2, 1);
    expect(body.triangles()).toBeGreaterThan(0);
    body.dispose();
  });

  it('follows the root joint on later frames', () => {
    const body = createSegmentBody(OPTS);
    body.beginFrame();
    body.sink.collar!('armX.collar', 0, 1, 0, 0, -1, 0, 0.06, 0.08);
    body.finishFrame();
    body.beginFrame();
    body.sink.collar!('armX.collar', 0.5, 1.2, -0.3, 0, -1, 0, 0.06, 0.08);
    body.finishFrame();
    const group = collarGroup(body.root, 'armX.collar')!;
    expect(group.position.x).toBeCloseTo(0.5, 6);
    expect(group.position.y).toBeCloseTo(1.2, 6);
    expect(group.position.z).toBeCloseTo(-0.3, 6);
    body.dispose();
  });

  it('is absent in wireframe mode', () => {
    const body = createSegmentBody({ ...OPTS, renderMode: 'wireframe' });
    expect(body.sink.collar).toBeUndefined();
    body.dispose();
  });

  it('hides a collar not re-emitted this frame', () => {
    const body = createSegmentBody(OPTS);
    body.beginFrame();
    body.sink.collar!('t0.collar', 0, 1, 0, 0, -1, 0, 0.05, 0.06);
    body.finishFrame();
    body.beginFrame();
    body.finishFrame();
    const group = collarGroup(body.root, 't0.collar')!;
    expect(group.visible).toBe(false);
    body.dispose();
  });
});
