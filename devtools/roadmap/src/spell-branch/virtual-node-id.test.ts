import { describe, it, expect } from 'vitest';
import {
  axisNodeId,
  valueNodeId,
  showSpellsNodeId,
  entryNodeId,
  isVirtualNodeId,
  parseVirtualNodeId,
  choicesFromVirtualNodeId,
} from './virtual-node-id';

describe('axisNodeId', () => {
  it('encodes a top-level axis node', () => {
    expect(axisNodeId('class')).toBe('$spell:axis:class');
  });
  it('encodes a nested axis node (after a value choice)', () => {
    expect(axisNodeId('level', [{ axisId: 'class', value: 'Wizard' }]))
      .toBe('$spell:v:class=Wizard:axis:level');
  });
});

describe('valueNodeId', () => {
  it('encodes a value node', () => {
    expect(valueNodeId([{ axisId: 'class', value: 'Wizard' }]))
      .toBe('$spell:v:class=Wizard');
  });
  it('sorts choices so order does not matter', () => {
    const choices = [{ axisId: 'level', value: '3' }, { axisId: 'class', value: 'Wizard' }];
    expect(valueNodeId(choices)).toBe('$spell:v:class=Wizard:level=3');
  });
});

describe('showSpellsNodeId', () => {
  it('encodes show-spells under a path', () => {
    expect(showSpellsNodeId([{ axisId: 'class', value: 'Wizard' }]))
      .toBe('$spell:v:class=Wizard:show');
  });
});

describe('entryNodeId', () => {
  it('encodes a spell entry node', () => {
    expect(entryNodeId([{ axisId: 'class', value: 'Wizard' }], 'fireball'))
      .toBe('$spell:v:class=Wizard:entry:fireball');
  });
});

describe('isVirtualNodeId', () => {
  it('returns true for virtual ids', () => {
    expect(isVirtualNodeId('$spell:axis:class')).toBe(true);
  });
  it('returns false for real roadmap ids', () => {
    expect(isVirtualNodeId('pillar_spells')).toBe(false);
  });
});

describe('parseVirtualNodeId', () => {
  it('parses axis node', () => {
    expect(parseVirtualNodeId('$spell:axis:class')).toEqual({ kind: 'axis', axisId: 'class', choices: [] });
  });
  it('parses value node', () => {
    expect(parseVirtualNodeId('$spell:v:class=Wizard')).toEqual({
      kind: 'value',
      choices: [{ axisId: 'class', value: 'Wizard' }],
    });
  });
  it('parses nested axis node', () => {
    expect(parseVirtualNodeId('$spell:v:class=Wizard:axis:level')).toEqual({
      kind: 'axis',
      axisId: 'level',
      choices: [{ axisId: 'class', value: 'Wizard' }],
    });
  });
  it('parses show-spells node', () => {
    expect(parseVirtualNodeId('$spell:v:class=Wizard:show')).toEqual({
      kind: 'show-spells',
      choices: [{ axisId: 'class', value: 'Wizard' }],
    });
  });
  it('parses entry node', () => {
    expect(parseVirtualNodeId('$spell:v:class=Wizard:entry:fireball')).toEqual({
      kind: 'entry',
      spellId: 'fireball',
      choices: [{ axisId: 'class', value: 'Wizard' }],
    });
  });
});

describe('choicesFromVirtualNodeId', () => {
  it('extracts choices from a value node id', () => {
    const id = '$spell:v:class=Wizard:level=3';
    expect(choicesFromVirtualNodeId(id)).toEqual([
      { axisId: 'class', value: 'Wizard' },
      { axisId: 'level', value: '3' },
    ]);
  });
  it('returns empty array for top-level axis', () => {
    expect(choicesFromVirtualNodeId('$spell:axis:class')).toEqual([]);
  });
});
