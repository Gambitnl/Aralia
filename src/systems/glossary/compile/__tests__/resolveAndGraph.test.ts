import { describe, expect, it } from 'vitest';
import { buildResolveContext } from '../resolve';
import { buildGraph } from '../graph';
import type { GlossaryDoc } from '../../contentModel';

interface BundleEntryLike {
  id: string;
  title: string;
  category: string;
  aliases?: string[];
  seeAlso?: string[];
  filePath?: string;
  hasSpellJson?: boolean;
  subEntries?: BundleEntryLike[];
}

const BUNDLE: BundleEntryLike[] = [
  {
    id: 'rage',
    title: 'Rage',
    category: 'Rules Glossary',
    aliases: ['raging'],
    seeAlso: ['reckless_attack'],
    filePath: '/data/glossary/entries/rules/rage.json',
  },
  {
    id: 'reckless_attack',
    title: 'Reckless Attack',
    category: 'Rules Glossary',
    filePath: '/data/glossary/entries/rules/reckless_attack.json',
  },
  {
    id: 'fireball',
    title: 'Fireball',
    category: 'Spells',
    hasSpellJson: true,
  },
  {
    // grouping/container node: no filePath, has children
    id: 'equipment',
    title: 'Equipment',
    category: 'Equipment',
    subEntries: [
      {
        id: 'longsword',
        title: 'Longsword',
        category: 'Equipment',
        filePath: '/data/glossary/entries/equipment/longsword.json',
      },
    ],
  },
];

describe('buildResolveContext', () => {
  const ctx = buildResolveContext(BUNDLE);

  it('resolves an entry id to an entry ref', () => {
    expect(ctx.resolve('rage')).toEqual({ id: 'rage', kind: 'entry' });
  });

  it('resolves aliases (normalized) to the canonical id', () => {
    expect(ctx.resolve('raging')).toEqual({ id: 'rage', kind: 'entry' });
  });

  it('resolves spells with spell JSON to a spell ref', () => {
    expect(ctx.resolve('fireball')).toEqual({ id: 'fireball', kind: 'spell' });
  });

  it('does not resolve grouping nodes without renderable content', () => {
    expect(ctx.resolve('equipment')).toBeNull();
  });

  it('resolves nested subEntries', () => {
    expect(ctx.resolve('longsword')).toEqual({ id: 'longsword', kind: 'entry' });
  });

  it('does not resolve unknown tokens', () => {
    expect(ctx.resolve('made_up')).toBeNull();
  });
});

describe('buildGraph', () => {
  const docs: GlossaryDoc[] = [
    {
      id: 'rage',
      title: 'Rage',
      category: 'Rules Glossary',
      excerpt: '',
      schemaVersion: 1,
      blocks: [
        {
          kind: 'paragraph',
          text: [
            { kind: 'text', text: 'See ' },
            {
              kind: 'termLink',
              ref: { id: 'reckless_attack', kind: 'entry' },
              display: 'Reckless Attack',
            },
          ],
        },
      ],
    },
    {
      id: 'reckless_attack',
      title: 'Reckless Attack',
      category: 'Rules Glossary',
      excerpt: '',
      schemaVersion: 1,
      blocks: [],
    },
  ];

  const graph = buildGraph({ bundle: BUNDLE, docs });

  it('records inline term links as outbound edges', () => {
    expect(graph.outbound['rage']).toContainEqual({
      id: 'reckless_attack',
      via: 'inline',
    });
  });

  it('records seeAlso as outbound edges', () => {
    expect(graph.outbound['rage']).toContainEqual({
      id: 'reckless_attack',
      via: 'seeAlso',
    });
  });

  it('precomputes inbound edges (Referenced By)', () => {
    expect(graph.inbound['reckless_attack']).toContainEqual({
      id: 'rage',
      via: 'inline',
    });
  });

  it('flags grouping nodes and renderability on nodes', () => {
    expect(graph.nodes['equipment']).toMatchObject({
      renderable: false,
      isGroupingNode: true,
    });
    expect(graph.nodes['rage']).toMatchObject({
      renderable: true,
      isGroupingNode: false,
    });
  });
});
