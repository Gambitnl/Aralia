#!/usr/bin/env npx tsx
/**
 * @file scripts/audits/racialSpellParserAudit.ts
 * Build a reproducible diff between race trait text and parser-emitted race spell grants.
 *
 * Usage:
 *   npx tsx scripts/audits/racialSpellParserAudit.ts [optional-output-path]
 */

import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { buildRacialTraitLibrary } from '../../src/data/races/racialTraits';
import { Race } from '../../src/types';

type AnyModule = Record<string, unknown>;

type RaceLike = Race;

const RACE_FILE_GUARD = /^([A-Za-z0-9_]+)_DATA$/;

const normalizeSpellToken = (rawName: string): string => {
  const withLinks = rawName
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\*\*|\*/g, '')
    .replace(/[’']/g, '')
    .replace(/[\u2013\u2014]/g, '-');

  return withLinks
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const isRaceCandidate = (value: unknown): value is RaceLike => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    Array.isArray((obj as { traits?: unknown }).traits)
  );
};

const parseCandidateSignals = (trait: string) => {
  const cantripMatches = [...trait.matchAll(/you know the ([a-z0-9_' -]+?) cantrip\b/gi)] as RegExpMatchArray[];
  const learnMatches = [...trait.matchAll(/(?:at|starting at|from|when you reach)\s+(\d+)(?:st|nd|rd|th)?\s+level[^.]*?\s(?:you can|you)\s+(?:learn|know|can cast)\s+(?:the\s+)?([a-z0-9_' -]+?)(?:\s+spell\b|$)/gi)] as RegExpMatchArray[];
  const leveledMatches = [...trait.matchAll(/starting at (\d+)(?:st|nd|rd|th)? level(?: and for higher levels)?[,;:]?\s*you can (?:also )?cast (?:the )?([a-z0-9_' -]+?) spell\b/gi)] as RegExpMatchArray[];
  const anyCastMatches = [...trait.matchAll(/cast (?:the )?([a-z0-9_' -]+?) spell\b/gi)] as RegExpMatchArray[];

  const extract = (match: RegExpMatchArray) => {
    const idx = match[1] ? 1 : (match[2] ? 2 : 0);
    const raw = match[idx] || '';

    return raw
      .split(/\s*(?:,|;|\band\b)\s*/i)
      .map(token => normalizeSpellToken(token))
      .map(token => token.trim())
      .filter(token => token.length > 1)
      .filter(token => ![
        'a',
        'an',
        'the',
        'it',
        'them',
        'these',
        'those',
        'that',
        'either',
        'either/or',
        'any',
        'all',
        'allows',
        'allot',
        'one',
        'two',
        'three',
        'four',
        'five',
        'other',
        'another',
        'you',
        'spell',
      ].includes(token));
  };

  const extracted = [...cantripMatches, ...learnMatches, ...leveledMatches, ...anyCastMatches].flatMap(extract);

  return {
    totalParserSignals: cantripMatches.length + learnMatches.length + leveledMatches.length + anyCastMatches.length,
    extractedTokens: Array.from(new Set(extracted)),
    extractedTokenCount: extracted.length,
  };
};

const isLikelySpellHintLine = (trait: string): boolean => {
  const lower = trait.toLowerCase();
  return /you know the .* cantrip\b/i.test(lower)
    || /\b(?:at|starting at|from|when you reach)\s+\d+(?:st|nd|rd|th)?\s+level[^.]*?\s(?:you can|you)\s+(?:learn|know|can cast)\s/i.test(lower)
    || /starting at\s+\d+(?:st|nd|rd|th)?\s+level(?: and for higher levels)?[,;:]?\s*you can\s+(?:also\s+)?cast\s/i.test(lower)
    || /\bcast\s+(?:the\s+)?[a-z0-9_' -]+\s+spell\b/i.test(lower);
};

const isMarksPattern = (trait: string): boolean => {
  return /spells of the mark|mark of .* spells/i.test(trait);
};

const isOpenChoiceCantripPattern = (trait: string): boolean => {
  return /you know one cantrip/i.test(trait) && /(of your choice|cantrip list|of choice)/i.test(trait);
};

const normalizeRaceFiles = async (): Promise<Record<string, RaceLike>> => {
  const racesDir = path.join(process.cwd(), 'src', 'data', 'races');
  const files = (await fs.readdir(racesDir)).filter((name) => name.endsWith('.ts') && name !== 'index.ts' && name !== 'raceGroups.ts');
  const races: Record<string, RaceLike> = {};

  for (const file of files) {
    const imported = (await import(pathToFileURL(path.join(racesDir, file)).href)) as AnyModule;
    for (const [name, value] of Object.entries(imported)) {
      if (!RACE_FILE_GUARD.test(name) || !isRaceCandidate(value)) {
        continue;
      }
      races[(value as RaceLike).id] = value as RaceLike;
    }
  }

  return races;
};

const main = async () => {
  // The default output destination is now AUDIT_OR_PROOF.md in the racial-mechanics project folder.
  const outputPath = process.argv[2] || path.join('docs', 'projects', 'racial-mechanics', 'AUDIT_OR_PROOF.md');
  const races = await normalizeRaceFiles();
  const entries = Object.values(races).sort((a, b) => a.name.localeCompare(b.name));
  const library = buildRacialTraitLibrary(races);

  const report: string[] = [];
  report.push('# Racial Spell Parser Audit');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');
  report.push(`Races scanned: ${entries.length}`);

  const inScopeRows: string[] = [];
  const markRows: string[] = [];
  const cantripChoiceRows: string[] = [];

  let hintLinesTotal = 0;

  for (const race of entries) {
    const spellTraits = library.byRaceId[race.id]?.filter(trait => trait.type === 'spell') ?? [];
    const spellIds = new Set(spellTraits.map((trait) => trait.spellId));
    const knownSpellIds = new Set((race.knownSpells ?? []).map(spell => normalizeSpellToken(spell.spellId)));
    const textDerived = [...spellIds].filter(spellId => !knownSpellIds.has(spellId));

    const parsedTraitLines = race.traits
      .map((trait) => {
        const parsed = parseCandidateSignals(trait);
        return { trait, parsed, isHint: isLikelySpellHintLine(trait) };
      });

    const candidateLines = parsedTraitLines.filter(({ isHint }) => isHint);

    const markLines = parsedTraitLines.filter(({ trait, parsed }) => (
      isMarksPattern(trait) && parsed.totalParserSignals === 0 && !candidateLines.some((line) => line.trait === trait)
    ));

    const cantripChoiceLines = parsedTraitLines.filter(({ trait, parsed }) => (
      isOpenChoiceCantripPattern(trait) && parsed.totalParserSignals === 0 && !candidateLines.some((line) => line.trait === trait)
    ));

    const allHintLines = [
      ...candidateLines,
      ...markLines,
      ...cantripChoiceLines,
    ];

    if (allHintLines.length === 0) {
      continue;
    }

    hintLinesTotal += allHintLines.length;

    const inScopeLines = candidateLines.filter(({ trait, parsed }) => {
      const line = trait.toLowerCase();
      return !isMarksPattern(line) && !isOpenChoiceCantripPattern(line) && parsed.totalParserSignals === 0;
    });

    if (markLines.length > 0) {
      markRows.push(`## ${race.id} (${race.name})`);
      markRows.push(...markLines.map(({ trait }) => `- [deferred: Spells of the Mark] ${trait}`));
      markRows.push('');
    }

    if (cantripChoiceLines.length > 0) {
      cantripChoiceRows.push(`## ${race.id} (${race.name})`);
      cantripChoiceRows.push(...cantripChoiceLines.map(({ trait }) => `- [deferred: open cantrip choice] ${trait}`));
      cantripChoiceRows.push('');
    }

    if (candidateLines.length === 0) {
      continue;
    }

    if (inScopeLines.length > 0) {
      inScopeRows.push(`## ${race.id} (${race.name})`);
      inScopeRows.push(`- Known spells in data: ${knownSpellIds.size}`);
      inScopeRows.push(`- Parser spell traits discovered: ${spellTraits.length}`);
      inScopeRows.push(`- Text-derived spell traits: ${textDerived.length}`);
      inScopeRows.push(`- flagged lines: ${inScopeLines.length}`);
      inScopeLines.forEach(({ trait, parsed }) => {
        inScopeRows.push(`  - [no-parser-match] ${trait}`);
        if (parsed.extractedTokenCount > 0) {
          inScopeRows.push(`    - detected tokens: ${parsed.extractedTokens.join(', ')}`);
        }
      });
      inScopeRows.push('');
    }
  }

  const countInScope = inScopeRows.filter((line) => line.startsWith('## ')).length;
  report.push(`Flagged in-scope races: ${countInScope}`);
  const inScopeLineCount = inScopeRows.reduce((count, line) => count + (line.startsWith('  - [no-parser-match]') ? 1 : 0), 0);
  report.push(`Total in-scope flagged lines: ${inScopeLineCount}`);
  report.push(`Total hint lines observed: ${hintLinesTotal}`);
  report.push('');

  if (inScopeRows.length > 0) {
    report.push('## In-scope parser gaps (requires parser updates)');
    report.push(...inScopeRows);
  } else {
    report.push('## In-scope parser gaps (requires parser updates)');
    report.push('None detected by current rule set.');
    report.push('');
  }

  if (markRows.length > 0) {
    report.push('## Deferred pattern: Spells of the Mark / table grants');
    report.push(...markRows);
  }

  if (cantripChoiceRows.length > 0) {
    report.push('## Deferred pattern: open cantrip choice phrasing');
    report.push(...cantripChoiceRows);
  }

  await fs.writeFile(outputPath, report.join('\n'));
  console.log(`Wrote racial parser audit report to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
