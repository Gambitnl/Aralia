import { describe, it, expect } from 'vitest';
import { computeVirtualLayout } from './SpellGraphOverlay';

describe('computeVirtualLayout', () => {
  it('returns empty array when no nodes', () => {
    const result = computeVirtualLayout({
      nodes: [],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });
    expect(result).toEqual([]);
  });

  it('places a single depth-1 node to the right of center for side=1', () => {
    const result = computeVirtualLayout({
      nodes: [{ id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: false }],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });
    expect(result).toHaveLength(1);
    expect(result[0].x).toBeGreaterThan(500);
    expect(result[0].id).toBe('$spell:axis:class');
    expect(result[0].width).toBe(288);
    expect(result[0].height).toBe(72);
  });

  it('places a single depth-1 node to the left of center for side=-1', () => {
    const result = computeVirtualLayout({
      nodes: [{ id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: false }],
      projectCenterX: 500,
      projectCenterY: 500,
      side: -1,
    });
    expect(result[0].x).toBeLessThan(500);
  });

  it('centers parent on children Y-range', () => {
    const result = computeVirtualLayout({
      nodes: [
        { id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: true },
        { id: '$spell:v:class=Wizard', depth: 2, parentId: '$spell:axis:class', label: 'Wizard [42]', hasChildren: false },
        { id: '$spell:v:class=Sorcerer', depth: 2, parentId: '$spell:axis:class', label: 'Sorcerer [38]', hasChildren: false },
      ],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });
    const axis = result.find((n) => n.id === '$spell:axis:class')!;
    const wizard = result.find((n) => n.id === '$spell:v:class=Wizard')!;
    const sorcerer = result.find((n) => n.id === '$spell:v:class=Sorcerer')!;
    // Parent should be centered between its two children
    const childMidY = (wizard.y + sorcerer.y) / 2;
    expect(Math.abs(axis.y - childMidY)).toBeLessThan(5);
  });

  it('increases X with depth for side=1', () => {
    const result = computeVirtualLayout({
      nodes: [
        { id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: true },
        { id: '$spell:v:class=Wizard', depth: 2, parentId: '$spell:axis:class', label: 'Wizard', hasChildren: false },
      ],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });
    const d1 = result.find((n) => n.depth === 1)!;
    const d2 = result.find((n) => n.depth === 2)!;
    expect(d2.x).toBeGreaterThan(d1.x);
  });
});
