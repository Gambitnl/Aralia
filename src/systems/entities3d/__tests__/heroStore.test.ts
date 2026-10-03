/**
 * @file heroStore.test.ts — hero-artifact store for the creature hero pipeline.
 * Covers the on-disk layout (hero.json per entry), read/write round-trips,
 * and the stage gate that stops a later stage running before an earlier one.
 * Node-only module under test: every test works in its own temp directory.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { HeroRecord } from '../library/heroStore';
import {
  heroDir,
  readHero,
  writeHero,
  STAGE_ARTIFACTS,
  assertStage,
} from '../library/heroStore';

/** Run a function that should throw and hand back the error for exact checks. */
function grabError(fn: () => void): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error('expected the call to throw, but it did not');
}

/** A record with every field filled in, for round-trip checks. */
function fullRecord(entryId: string): HeroRecord {
  return {
    entryId,
    prompt: 'a moss-covered troll with a lantern',
    stages: {
      reference: { at: '2026-07-22T10:00:00.000Z', note: 'first pass' },
      master: { at: '2026-07-22T11:00:00.000Z' },
      hero: { at: '2026-07-22T12:00:00.000Z', note: 'decimated' },
    },
    triangles: { master: 120_000, hero: 8_000 },
    status: 'approved',
  };
}

describe('heroStore', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-store-'));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('heroDir joins the base directory and the entry id', () => {
    expect(heroDir(baseDir, 'troll')).toBe(path.join(baseDir, 'troll'));
  });

  it('writeHero creates the entry directory and hero.json', () => {
    writeHero(baseDir, { entryId: 'troll', stages: {}, status: 'generated' });
    const dir = path.join(baseDir, 'troll');
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, 'hero.json'))).toBe(true);
  });

  it('writeHero writes 2-space JSON with a trailing newline', () => {
    const record: HeroRecord = { entryId: 'troll', stages: {}, status: 'generated' };
    writeHero(baseDir, record);
    const text = fs.readFileSync(path.join(baseDir, 'troll', 'hero.json'), 'utf8');
    expect(text).toBe(JSON.stringify(record, null, 2) + '\n');
  });

  it('readHero round-trips a record with every field filled in', () => {
    const record = fullRecord('troll');
    writeHero(baseDir, record);
    expect(readHero(baseDir, 'troll')).toEqual(record);
  });

  it('readHero returns null when the entry directory does not exist', () => {
    expect(readHero(baseDir, 'nobody')).toBeNull();
  });

  it('readHero returns null when the directory exists but hero.json is missing', () => {
    fs.mkdirSync(path.join(baseDir, 'troll'), { recursive: true });
    expect(readHero(baseDir, 'troll')).toBeNull();
  });

  it('STAGE_ARTIFACTS names the file each gated stage must produce', () => {
    expect(STAGE_ARTIFACTS).toEqual({ reference: 'reference.png', master: 'master.glb' });
  });

  it('assertStage throws the exact message when there is no record at all', () => {
    const err = grabError(() => assertStage(baseDir, 'troll', 'reference'));
    expect(err.message).toBe(
      'stage "reference" artifact missing for troll — run the earlier stage first'
    );
  });

  it('assertStage throws when the record lists the stage but the artifact file is missing', () => {
    writeHero(baseDir, {
      entryId: 'troll',
      stages: { reference: { at: '2026-07-22T10:00:00.000Z' } },
      status: 'generated',
    });
    const err = grabError(() => assertStage(baseDir, 'troll', 'reference'));
    expect(err.message).toBe(
      'stage "reference" artifact missing for troll — run the earlier stage first'
    );
  });

  it('assertStage throws when the artifact exists but the record lacks the stage', () => {
    writeHero(baseDir, { entryId: 'troll', stages: {}, status: 'generated' });
    fs.writeFileSync(path.join(baseDir, 'troll', 'reference.png'), 'not really a png');
    const err = grabError(() => assertStage(baseDir, 'troll', 'reference'));
    expect(err.message).toBe(
      'stage "reference" artifact missing for troll — run the earlier stage first'
    );
  });

  it('assertStage names the requested stage and entry in the master-stage message', () => {
    const err = grabError(() => assertStage(baseDir, 'wyvern', 'master'));
    expect(err.message).toBe(
      'stage "master" artifact missing for wyvern — run the earlier stage first'
    );
  });

  it('assertStage passes silently when the record stage and the artifact both exist', () => {
    writeHero(baseDir, {
      entryId: 'troll',
      stages: { reference: { at: '2026-07-22T10:00:00.000Z' } },
      status: 'generated',
    });
    fs.writeFileSync(path.join(baseDir, 'troll', 'reference.png'), 'not really a png');
    expect(() => assertStage(baseDir, 'troll', 'reference')).not.toThrow();
  });

  it('assertStage passes for the master stage when master.glb and the record entry exist', () => {
    writeHero(baseDir, {
      entryId: 'troll',
      stages: {
        reference: { at: '2026-07-22T10:00:00.000Z' },
        master: { at: '2026-07-22T11:00:00.000Z' },
      },
      status: 'generated',
    });
    fs.writeFileSync(path.join(baseDir, 'troll', 'master.glb'), 'not really a glb');
    expect(() => assertStage(baseDir, 'troll', 'master')).not.toThrow();
  });
});
