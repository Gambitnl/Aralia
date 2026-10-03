// tools/agora/seatNames.test.mjs
// The seat-name suggester, and the rules it shares with the store.
//   node --test "tools/agora/*.test.mjs"
//
// WHAT THIS PROTECTS. `tools/agora/seat-names.ts` draws seat names from the
// game's own racial name generator, then filters them through the SAME rules
// the store enforces. The whole value of that is the word "same": if the
// suggester ever grows its own copy of the rule list, it will drift, and it
// will start offering names the store refuses — or worse, names the store
// accepts that break a rule the store forgot.
//
// So these tests check the shared definition and the end-to-end output, not the
// generator's taste in names.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertSeatName, seatIdFor, SEAT_NAME_FORBIDDEN, SEAT_NAME_RE } from './store.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('the naming rules are exported, so nothing has to copy them', () => {
  // They lived inside the store's closure until 2026-09-08. A suggester could
  // only have applied them by duplicating the list, which is how two checks
  // that are supposed to agree stop agreeing.
  assert.ok(SEAT_NAME_RE instanceof RegExp);
  assert.ok(Array.isArray(SEAT_NAME_FORBIDDEN));
  assert.ok(SEAT_NAME_FORBIDDEN.length >= 26, 'the refused list should not shrink silently');
  assert.equal(typeof assertSeatName, 'function');
  assert.equal(seatIdFor('thornwake'), 'seat-thornwake');
});

test('the rules refuse a job name and a model name, and accept a plain one', () => {
  assert.equal(assertSeatName('doralon').ok, true);
  assert.equal(assertSeatName('coldhillse').ok, true);

  const job = assertSeatName('lead-reviewer');
  assert.equal(job.ok, false);
  assert.match(job.error, /names a job or a model/);

  const model = assertSeatName('haiku-two');
  assert.equal(model.ok, false);
  assert.match(model.error, /names a job or a model/);

  // A capital is NORMALIZED, not refused. A person typing the name the way it
  // reads in the world should get the seat, not an error message about case.
  const capital = assertSeatName('Doralon');
  assert.equal(capital.ok, true);
  assert.equal(capital.name, 'doralon', 'the stored name is always lowercase');
  assert.equal(assertSeatName('  Doralon  ').name, 'doralon', 'stray spaces are trimmed');

  // Shape rules that DO refuse: a space inside, and nothing at all.
  assert.equal(assertSeatName('dor alon').ok, false, 'a space inside is refused');
  assert.equal(assertSeatName('').ok, false, 'an empty name is refused');
  assert.equal(assertSeatName('-doralon').ok, false, 'a leading hyphen is refused');
});

test('every suggested name obeys the store rules and is not a live entity', () => {
  // A fixed seed makes this repeatable. The generator draws from the global
  // Math.random, so the tool swaps it the same way the game's own burg namer
  // does — this asserts that seeding actually works, not only that it runs.
  const run = () => execFileSync(
    process.execPath,
    [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      path.join(REPO, 'tools', 'agora', 'seat-names.ts'),
      '--count', '10', '--seed', 'seat-name-test'],
    { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 },
  );

  let out;
  try {
    out = run();
  } catch (e) {
    // tsx missing or a data file moved should FAIL LOUDLY here. A skipped test
    // would let the suggester rot while the suite stayed green.
    assert.fail('the suggester did not run: ' + (e.stderr || e.message));
  }

  const names = out.trim().split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);
  assert.ok(names.length >= 5, `expected several names, got ${names.length}`);

  for (const name of names) {
    const checked = assertSeatName(name);
    assert.equal(checked.ok, true, `the suggester offered "${name}", which the store refuses: ${checked.error}`);
  }

  // Names alive in the world data must never be offered. These are real values
  // read from src/data on 2026-09-08.
  const live = ['bahamut', 'moradin', 'pelor', 'lolth', 'tiamat', 'vecna', 'kord', 'torog'];
  for (const name of names) {
    assert.ok(!live.includes(name), `"${name}" is a live deity and must not be a seat`);
  }

  // The same seed gives the same names, or the tool cannot be used to reproduce
  // a decision about who a seat is.
  const again = run().trim().split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);
  assert.deepEqual(again, names, 'the same seed must give the same names');
});

// ---------------------------------------------------------------------------
// The two constraints from design doc section 69 that this file used to leave
// unproven (added 2026-09-09, task agora-8148.6).
// ---------------------------------------------------------------------------

const NAME_BASES_TS = path.join(REPO, 'src', 'systems', 'worldforge', 'fmg', 'name-bases.ts');

/** The base names in getNameBases() order, read from the source of truth.
 *  Read textually on purpose: the test is a .mjs run by node --test, and
 *  importing a .ts module would mean a second tsx process for one array. */
function baseNamesInOrder() {
  const text = fs.readFileSync(NAME_BASES_TS, 'utf8');
  return [...text.matchAll(/^\s*name:\s*"([^"]+)"/gm)].map((m) => m[1]);
}

/** race -> {index, baseName}, as the suggester itself resolves it today. */
function suggesterBases() {
  const out = execFileSync(
    process.execPath,
    [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      path.join(REPO, 'tools', 'agora', 'seat-names.ts'), '--bases'],
    { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 },
  );
  return out.trim().split(/\r?\n/).map((line) => {
    const [race, index, baseName] = line.split('\t');
    return { race, index: Number(index), baseName };
  });
}

test('the eleven fantasy bases are pinned by NAME, and no real-world culture can drift in', () => {
  // Section 69: 'The thirty-two real-world culture bases are deliberately
  // excluded: a seat named from the Nordic or Japanese base would read as a
  // real person's name, and a lasting identity must not be mistaken for one.'
  //
  // seat-names.ts used to hold the raw indices 32-42, so an insertion or a
  // reorder in name-bases.ts would have shifted the whole table down into the
  // real-world block and the tool would have kept running, quietly offering
  // Nordic and Japanese names. Nothing failed. This is that missing failure.
  const bases = baseNamesInOrder();
  assert.ok(bases.length >= 43, `expected the full base list, got ${bases.length}`);

  const rows = suggesterBases();
  assert.equal(rows.length, 11, 'eleven fantasy bases, no more and no fewer');

  assert.deepEqual(
    rows.map((r) => r.race),
    ['human', 'elven', 'dark-elven', 'dwarven', 'goblin', 'orc', 'giant',
      'draconic', 'arachnid', 'serpent', 'levantine'],
    'the race keys are the draw order, so a change here changes every seeded draw',
  );

  assert.deepEqual(
    rows.map((r) => r.baseName),
    ['Human Generic', 'Elven', 'Dark Elven', 'Dwarven', 'Goblin', 'Orc', 'Giant',
      'Draconic', 'Arachnid', 'Serpents', 'Levantine'],
    'the eleven fantasy bases named in design doc section 69',
  );

  // The pin itself: every index the tool uses today is the index that base name
  // actually sits at. Move a base and the tool moves with it.
  for (const row of rows) {
    assert.equal(
      bases[row.index], row.baseName,
      `race "${row.race}" resolves to index ${row.index}, which is "${bases[row.index]}", not "${row.baseName}"`,
    );
    assert.equal(bases.indexOf(row.baseName), row.index, `"${row.baseName}" must resolve by name`);
  }

  // And the constraint stated the other way round: not one of the thirty-two
  // real-world cultures may be reachable from a seat draw.
  const REAL_WORLD = ['German', 'English', 'French', 'Italian', 'Castillian', 'Ruthenian',
    'Nordic', 'Greek', 'Roman', 'Finnic', 'Korean', 'Chinese', 'Japanese', 'Portuguese',
    'Nahuatl', 'Hungarian', 'Turkish', 'Berber', 'Arabic', 'Inuit', 'Basque', 'Nigerian',
    'Celtic', 'Mesopotamian', 'Iranian', 'Hawaiian', 'Karnataka', 'Quechua', 'Swahili',
    'Vietnamese', 'Cantonese', 'Mongolian'];
  assert.equal(REAL_WORLD.length, 32, 'section 69 counts thirty-two real-world bases');
  for (const row of rows) {
    assert.ok(
      !REAL_WORLD.includes(row.baseName),
      `"${row.baseName}" is a real-world culture and must never name a seat`,
    );
  }
  // Every one of them is still present in name-bases.ts, so this is an
  // exclusion, not a list that quietly stopped matching anything.
  for (const culture of REAL_WORLD) {
    assert.ok(bases.includes(culture), `"${culture}" left name-bases.ts; the exclusion list is stale`);
  }
});

test('a draw never repeats itself', () => {
  // Section 69: 'Uniqueness within the draw, so a batch never repeats itself'.
  // seat-names.ts keeps a seen Set; until now nothing asserted it worked.
  const draw = (args) => execFileSync(
    process.execPath,
    [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      path.join(REPO, 'tools', 'agora', 'seat-names.ts'), ...args],
    { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 },
  ).trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);

  const mixed = draw(['--count', '24', '--seed', 'seat-name-uniqueness']);
  assert.ok(mixed.length >= 5, `expected several names, got ${mixed.length}`);
  assert.equal(new Set(mixed).size, mixed.length, `a batch repeated itself: ${mixed.join(' ')}`);

  // One race, drawn deep, is the case that actually collides, so it is the one
  // that proves the Set rather than assuming it. Measured 2026-09-09 with the
  // seen Set removed: goblin --count 60 returns 58 distinct names of 60, and
  // this assertion fails. A mixed draw of that size still returned 60 of 60,
  // which is why the case above alone would prove nothing.
  const single = draw(['--race', 'goblin', '--count', '60', '--seed', 'dup-probe']);
  assert.equal(single.length, 60, `expected 60 goblin names, got ${single.length}`);
  assert.equal(new Set(single).size, single.length, `a single-race batch repeated itself: ${single.join(' ')}`);
});
