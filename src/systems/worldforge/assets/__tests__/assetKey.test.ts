/**
 * @file assetKey.test.ts — semantic asset key parsing + content addressing.
 *
 * Spec: docs/projects/worldforge/SPEC.md §7. Asset keys are semantic and
 * slash-delimited (`texture/wall/plaster/weathered/temperate`). The first
 * segment is the KIND; the second is the SUBJECT; the rest are descriptors.
 * The content address is FNV-1a of the canonical key (so the cache is
 * content-addressed and a future worker/WASM port reproduces it).
 */
import { describe, it, expect } from 'vitest';
import { parseAssetKey, canonicalizeAssetKey, assetAddress } from '../assetKey';

describe('parseAssetKey', () => {
  it('splits kind / subject / descriptors from a slash-delimited key', () => {
    const parsed = parseAssetKey('texture/wall/plaster/weathered/temperate');
    expect(parsed.kind).toBe('texture');
    expect(parsed.subject).toBe('wall');
    expect(parsed.descriptors).toEqual(['plaster', 'weathered', 'temperate']);
  });

  it('accepts a key with no descriptors', () => {
    const parsed = parseAssetKey('heraldry/state-17');
    expect(parsed.kind).toBe('heraldry');
    expect(parsed.subject).toBe('state-17');
    expect(parsed.descriptors).toEqual([]);
  });

  it('throws on an empty key', () => {
    expect(() => parseAssetKey('')).toThrow();
  });

  it('throws when the kind segment alone is given (no subject)', () => {
    expect(() => parseAssetKey('texture')).toThrow();
  });
});

describe('canonicalizeAssetKey', () => {
  it('lowercases and trims surrounding/segment whitespace', () => {
    expect(canonicalizeAssetKey('  Texture/Wall/ Plaster ')).toBe('texture/wall/plaster');
  });

  it('collapses repeated and trailing slashes', () => {
    expect(canonicalizeAssetKey('texture//wall/')).toBe('texture/wall');
  });
});

describe('assetAddress', () => {
  it('is stable for keys that canonicalize to the same value', () => {
    expect(assetAddress('Texture/Wall/Plaster')).toBe(assetAddress('texture//wall/plaster/'));
  });

  it('differs for different keys', () => {
    expect(assetAddress('texture/wall/plaster')).not.toBe(assetAddress('texture/wall/stone'));
  });

  it('is a hex string (the content address used as the cache key)', () => {
    expect(assetAddress('texture/wall/plaster')).toMatch(/^[0-9a-f]{8}$/);
  });
});
