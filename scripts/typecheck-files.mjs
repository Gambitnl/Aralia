#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

/**
 * This file type-checks a named set of files instead of the whole repository.
 *
 * Agents call it through `npm run typecheck:files -- <path> [<path>...]` when they
 * need compiler proof for the handful of files a task touched. A full
 * `tsc --noEmit -p tsconfig.json` compiles every source file in `src`, which on a
 * shared checkout under multi-agent load has been measured at ten to thirty minutes
 * (workflow gap WF-G114). This script keeps the repository's own compiler options by
 * generating a throwaway tsconfig that `extends` the real one, narrows `include` to
 * the requested files plus their `.d.ts` twins, and reports only the diagnostics that
 * land inside those files.
 *
 * The narrowing is a reporting scope, not a correctness claim: TypeScript still loads
 * every module the requested files import, so a genuine error in a requested file is
 * still found. What the script does not do is re-report the repository's pre-existing
 * debt in unrelated files, which is exactly the noise the full compile buried agents in.
 *
 * Called by: the `typecheck:files` package script, `AGENTS.md` Required Tooling,
 *   `tools/agora/AGENT.md`, and `public/agent-docs/workflows/test-ts.md`
 * Depends on: the installed TypeScript compiler at `node_modules/typescript/lib/tsc.js`
 *   and the tsconfig selected with `--project` (default `tsconfig.json`)
 */

// ============================================================================
// Layout constants
// ============================================================================
// The generated config lives under `.agent/scratch/`, the repository's ignored
// throwaway area, so a crashed run never leaves a tracked file behind. Its depth
// matters: every path written into it is expressed relative to that directory.
// ============================================================================
const REPO_ROOT = process.cwd();
const TEMP_CONFIG_DIR = path.join(REPO_ROOT, '.agent', 'scratch', 'typecheck-files');
const DEFAULT_PROJECT = 'tsconfig.json';
const TYPESCRIPT_ENTRY = path.join('node_modules', 'typescript', 'lib', 'tsc.js');

// TypeScript reports source files with forward slashes even on Windows, while
// `path` helpers produce backslashes there. Every comparison in this file happens on
// the normalized form so a Windows agent and a POSIX agent match the same diagnostics.
function slashPath(value) {
    return String(value).replace(/\\/g, '/');
}

// ============================================================================
// Argument parsing
// ============================================================================
// Options stay deliberately few. `--project` retargets the base tsconfig for callers
// working inside an alternate compilation root, and `--keep` preserves the generated
// config so a confused diagnostic can be reproduced by hand.
// ============================================================================
function parseArgs(argv) {
    const files = [];
    let project = DEFAULT_PROJECT;
    let keep = false;
    let help = false;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') {
            help = true;
        } else if (arg === '--keep') {
            keep = true;
        } else if (arg === '--project' || arg === '-p') {
            index += 1;
            project = argv[index];
        } else if (arg.startsWith('--project=')) {
            project = arg.slice('--project='.length);
        } else if (arg.startsWith('-')) {
            throw new Error(`Unknown option: ${arg}`);
        } else {
            files.push(arg);
        }
    }

    return { files, project, keep, help };
}

const USAGE = `Usage: npm run typecheck:files -- <path> [<path>...]

Type-checks only the named files against the repository tsconfig and prints only
the diagnostics that land inside them. Exits non-zero when any are found.

Options:
  --project, -p <tsconfig>  Base config to extend (default: tsconfig.json)
  --keep                    Keep the generated temp tsconfig for inspection
  --help, -h                Show this message
`;

// ============================================================================
// Input resolution
// ============================================================================
// A caller may pass repo-relative paths, absolute paths, or Windows backslash paths.
// All three collapse to one repo-relative slash form, which is both what the
// generated config needs and what the diagnostic filter compares against.
// ============================================================================
function resolveTargets(inputs) {
    const resolved = [];
    const missing = [];
    const seen = new Set();

    for (const input of inputs) {
        const absolute = path.resolve(REPO_ROOT, input);
        const relative = slashPath(path.relative(REPO_ROOT, absolute));
        if (!fs.existsSync(absolute)) {
            missing.push(input);
            continue;
        }
        if (seen.has(relative)) continue;
        seen.add(relative);
        resolved.push({ absolute, relative });
    }

    return { resolved, missing };
}

// A hand-written declaration sitting next to an implementation file participates in
// that file's types, so it joins the compilation whenever it exists. Missing twins are
// the normal case and are silently skipped.
function declarationTwins(targets) {
    const twins = [];
    const known = new Set(targets.map((target) => target.relative));

    for (const target of targets) {
        const twin = target.absolute.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/i, '.d.ts');
        if (twin === target.absolute) continue;
        const relative = slashPath(path.relative(REPO_ROOT, twin));
        if (known.has(relative)) continue;
        if (!fs.existsSync(twin)) continue;
        known.add(relative);
        twins.push({ absolute: twin, relative });
    }

    return twins;
}

// ============================================================================
// Generated project
// ============================================================================
// `extends` keeps every compiler option the repository already agreed on, including
// its `paths` aliases, which TypeScript resolves relative to the base config's own
// directory rather than the generated one. Only three things are overridden:
//   - `include`, narrowed to the requested files (paths are relative to this file)
//   - `exclude`, emptied so a base exclusion such as `**/*.test-d.ts` cannot silently
//     drop a file the caller explicitly asked about
//   - `skipLibCheck`, asserted rather than assumed, because declaration-file checking
//     across `node_modules` is the single largest cost in a scoped run
// ============================================================================
function writeTempProject(projectPath, targets) {
    fs.mkdirSync(TEMP_CONFIG_DIR, { recursive: true });

    const configPath = path.join(
        TEMP_CONFIG_DIR,
        `tsconfig.scoped.${process.pid}.${Date.now()}.json`,
    );
    const fromTempDir = (absolute) => slashPath(path.relative(TEMP_CONFIG_DIR, absolute));

    const config = {
        extends: fromTempDir(path.resolve(REPO_ROOT, projectPath)),
        compilerOptions: {
            skipLibCheck: true,
            noEmit: true,
        },
        // WF-G114 follow-on (2026-09-09): narrowing `include` to the targets also
        // dropped the ambient declarations the full project relies on, so every
        // .test.tsx reported phantom `toBeInTheDocument` errors (jest-dom
        // matchers are declared through src/test/setup.ts, not through `types`).
        // Ambient .d.ts files under src/ and the vitest setup file join every
        // scoped compile; diagnostics are still filtered to the requested files.
        include: [
            ...targets.map((target) => fromTempDir(target.absolute)),
            fromTempDir(path.resolve(REPO_ROOT, 'src', '**', '*.d.ts')),
            ...(fs.existsSync(path.resolve(REPO_ROOT, 'src', 'test', 'setup.ts'))
                ? [fromTempDir(path.resolve(REPO_ROOT, 'src', 'test', 'setup.ts'))]
                : []),
        ],
        exclude: [],
    };

    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return configPath;
}

// ============================================================================
// Diagnostic partitioning
// ============================================================================
// `--pretty false` gives one diagnostic per line in the stable
// `path(line,col): error TSxxxx: message` form. Lines are sorted into three buckets:
// in-scope (a requested file), out-of-scope (an imported file's pre-existing debt),
// and configuration errors, which carry no file prefix and always fail the run.
// ============================================================================
function partitionDiagnostics(output, targets) {
    const inScopePaths = new Set(targets.map((target) => target.relative));
    const inScope = [];
    const outOfScope = [];
    const configErrors = [];

    for (const rawLine of String(output).split(/\r?\n/)) {
        const line = rawLine.replace(/\t/g, ' ').trimEnd();
        if (!/\berror TS\d+:/.test(line)) continue;

        const fileDiagnostic = line.match(/^(.*?)\((\d+),(\d+)\):\s*error TS\d+:/);
        if (!fileDiagnostic) {
            configErrors.push(line.trim());
            continue;
        }

        // WF-G134 (2026-09-09): a SYNTAX error anywhere in the program stops tsc
        // before the semantic pass, so every requested file then reports zero
        // errors. Filing that under "suppressed in imported files" turned the
        // whole command green for a day (a truncated GroundAgents.d.ts). A TS1xxx
        // diagnostic is therefore a configuration failure, whichever file owns it.
        const code = line.match(/error (TS\d+):/);
        if (code && /^TS1\d{3}$/.test(code[1])) {
          configErrors.push(`syntax error stops the semantic pass (WF-G134): ${line.trim()}`);
          continue;
        }
        const rawFilePath = fileDiagnostic[1].trim();
        const absolute = path.isAbsolute(rawFilePath)
            ? rawFilePath
            : path.resolve(REPO_ROOT, rawFilePath);
        const relative = slashPath(path.relative(REPO_ROOT, absolute));

        if (inScopePaths.has(relative)) {
            inScope.push(`${relative}${line.slice(fileDiagnostic[1].length)}`);
        } else {
            outOfScope.push(relative);
        }
    }

    return { inScope, outOfScope, configErrors };
}

function main() {
    let parsed;
    try {
        parsed = parseArgs(process.argv.slice(2));
    } catch (error) {
        process.stderr.write(`${error.message}\n\n${USAGE}`);
        return 2;
    }

    if (parsed.help || parsed.files.length === 0) {
        process.stdout.write(USAGE);
        return parsed.help ? 0 : 2;
    }

    const compiler = path.join(REPO_ROOT, TYPESCRIPT_ENTRY);
    if (!fs.existsSync(compiler)) {
        process.stderr.write(`TypeScript compiler not found at ${TYPESCRIPT_ENTRY}\n`);
        return 2;
    }

    const basePath = path.resolve(REPO_ROOT, parsed.project);
    if (!fs.existsSync(basePath)) {
        process.stderr.write(`Base tsconfig not found: ${parsed.project}\n`);
        return 2;
    }

    const { resolved, missing } = resolveTargets(parsed.files);
    if (missing.length > 0) {
        process.stderr.write(`No such file: ${missing.join(', ')}\n`);
        return 2;
    }

    const targets = [...resolved, ...declarationTwins(resolved)];
    const configPath = writeTempProject(parsed.project, targets);
    const startedAt = Date.now();

    const result = spawnSync(
        process.execPath,
        [compiler, '--noEmit', '--pretty', 'false', '-p', configPath],
        { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );

    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const combinedOutput = `${result.stdout ?? ''}${os.EOL}${result.stderr ?? ''}`;
    const { inScope, outOfScope, configErrors } = partitionDiagnostics(combinedOutput, targets);

    if (!parsed.keep) {
        fs.rmSync(configPath, { force: true });
    } else {
        process.stdout.write(`temp project kept at ${slashPath(path.relative(REPO_ROOT, configPath))}\n`);
    }

    for (const line of configErrors) {
        process.stdout.write(`${line}\n`);
    }
    for (const line of inScope) {
        process.stdout.write(`${line}\n`);
    }

    const scopeLabel = `${resolved.length} file${resolved.length === 1 ? '' : 's'}`;
    const suppressed = new Set(outOfScope).size;
    process.stdout.write(
        `typecheck:files - ${scopeLabel} in ${elapsedSeconds}s: ${inScope.length} error(s) in scope, ` +
        `${outOfScope.length} suppressed in ${suppressed} imported file(s)\n`,
    );

    if (result.error) {
        process.stderr.write(`Compiler failed to start: ${result.error.message}\n`);
        return 2;
    }

    // A non-zero compiler exit with no in-scope diagnostic means the failure came from
    // repository debt in imported files. That is not this run's answer, so the scoped
    // command stays green unless a configuration error made the whole run meaningless.
    if (configErrors.length > 0) return 2;
    return inScope.length > 0 ? 1 : 0;
}

process.exit(main());
