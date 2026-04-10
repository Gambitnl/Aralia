import { describe, it, expect } from 'vitest';
import { computeVirtualLayout } from './SpellGraphOverlay';
import { BRANCH_ROW_GAP, BRANCH_MIN_HEIGHT } from '../components/debug/roadmap/constants';

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

  it('sibling Y does not shift when one sibling gains children', () => {
    // Before: two axis nodes, no children
    const before = computeVirtualLayout({
      nodes: [
        { id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: false },
        { id: '$spell:axis:level', depth: 1, parentId: 'pillar_spells', label: 'Level', hasChildren: false },
      ],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });

    // After: class gains two children (user clicked it to expand)
    const after = computeVirtualLayout({
      nodes: [
        { id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: true },
        { id: '$spell:axis:level', depth: 1, parentId: 'pillar_spells', label: 'Level', hasChildren: false },
        { id: '$spell:v:class=Wizard', depth: 2, parentId: '$spell:axis:class', label: 'Wizard', hasChildren: false },
        { id: '$spell:v:class=Sorcerer', depth: 2, parentId: '$spell:axis:class', label: 'Sorcerer', hasChildren: false },
      ],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });

    const levelBefore = before.find((n) => n.id === '$spell:axis:level')!;
    const levelAfter = after.find((n) => n.id === '$spell:axis:level')!;

    // Level should not have moved — only class and its new children changed
    expect(levelAfter.y).toBe(levelBefore.y);
  });

  it('depth-2 children from two expanded siblings do not overlap', () => {
    // Class has 2 children, Level has 2 children.
    // Without overlap resolution, Level's children are centred on Level's Y
    // which puts them right on top of Class's lower child.
    const result = computeVirtualLayout({
      nodes: [
        { id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: true },
        { id: '$spell:axis:level', depth: 1, parentId: 'pillar_spells', label: 'Level', hasChildren: true },
        { id: '$spell:v:class=Sorcerer', depth: 2, parentId: '$spell:axis:class', label: 'Sorcerer', hasChildren: false },
        { id: '$spell:v:class=Wizard', depth: 2, parentId: '$spell:axis:class', label: 'Wizard', hasChildren: false },
        { id: '$spell:v:level=1', depth: 2, parentId: '$spell:axis:level', label: 'Level 1', hasChildren: false },
        { id: '$spell:v:level=2', depth: 2, parentId: '$spell:axis:level', label: 'Level 2', hasChildren: false },
      ],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });

    const d2 = result
      .filter((n) => n.depth === 2)
      .sort((a, b) => a.y - b.y);

    for (let i = 1; i < d2.length; i++) {
      const prev = d2[i - 1];
      const curr = d2[i];
      expect(curr.y, `${curr.id} overlaps with ${prev.id}`).toBeGreaterThanOrEqual(
        prev.y + BRANCH_MIN_HEIGHT + BRANCH_ROW_GAP
      );
    }
  });

  it('all children of one parent appear as a block above all children of the next parent', () => {
    // Class has 3 children, Level has 2 children.
    // With a node-by-node push, Level's first child ends up sandwiched between
    // Class's second and third child — interleaved.
    // With group-level resolution every Class child must be above every Level child.
    const result = computeVirtualLayout({
      nodes: [
        { id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: true },
        { id: '$spell:axis:level', depth: 1, parentId: 'pillar_spells', label: 'Level', hasChildren: true },
        { id: '$spell:v:class=Bard',     depth: 2, parentId: '$spell:axis:class', label: 'Bard',    hasChildren: false },
        { id: '$spell:v:class=Sorcerer', depth: 2, parentId: '$spell:axis:class', label: 'Sorcerer', hasChildren: false },
        { id: '$spell:v:class=Wizard',   depth: 2, parentId: '$spell:axis:class', label: 'Wizard',  hasChildren: false },
        { id: '$spell:v:level=1', depth: 2, parentId: '$spell:axis:level', label: 'Level 1', hasChildren: false },
        { id: '$spell:v:level=2', depth: 2, parentId: '$spell:axis:level', label: 'Level 2', hasChildren: false },
      ],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });

    const classNodes = result.filter((n) => n.parentId === '$spell:axis:class');
    const levelNodes = result.filter((n) => n.parentId === '$spell:axis:level');

    const classBottom = Math.max(...classNodes.map((n) => n.y + n.height));
    const levelTop    = Math.min(...levelNodes.map((n) => n.y));

    expect(levelTop, 'Level children should start below the last Class child').toBeGreaterThanOrEqual(
      classBottom + BRANCH_ROW_GAP
    );
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
