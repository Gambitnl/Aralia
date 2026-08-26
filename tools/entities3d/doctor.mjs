#!/usr/bin/env node
/**
 * @file doctor.mjs — verifies every external tool the entity pipeline
 * (tools/entities3d, tools/rigbench, tools/creatureGate) binds to on this
 * machine, against the manifest at tools/entities3d/toolchain.json.
 *
 * WHY THIS EXISTS. The pipeline resolves Blender, system Chrome, ffmpeg and
 * a system Python by drive probes and hard-coded fallback paths scattered
 * across half a dozen scripts (see rigBaseMeshes.mjs, rigbench.mjs,
 * captureLib.mjs, wave-gif.mjs, partGate.mjs). A missing tool used to surface
 * as a spawnSync ENOENT or a silent black-frame render deep inside whatever
 * script happened to need it first. This script checks every binding up
 * front, in one place, and names exactly what is missing and how to fix it.
 *
 * Run: node tools/entities3d/doctor.mjs
 * Exit code: 0 if every REQUIRED check passes, 1 otherwise.
 * Optional checks (required: false in the manifest, e.g. ffmpeg, dev-server
 * reachability) are reported but never fail the run.
 *
 * The manifest (toolchain.json) is data, not code: adding/removing a tool
 * binding means editing the JSON, not this script, as long as the kind
 * already has a checker below.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const MANIFEST_PATH = path.join(HERE, 'toolchain.json');

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`doctor: manifest not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    console.error(`doctor: manifest at ${MANIFEST_PATH} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Checkers. Each returns { ok: boolean, detail: string }.
// ---------------------------------------------------------------------------

function checkDriveProbeExe(check) {
  const envOverride = check.envOverride && process.env[check.envOverride];
  if (envOverride) {
    if (existsSync(envOverride)) return { ok: true, detail: `${check.envOverride}=${envOverride}` };
    return { ok: false, detail: `${check.envOverride} is set but points at a missing file: ${envOverride}` };
  }
  const { drives, vendorSuffix, versionDirPattern, exeName } = check.probe;
  const pattern = new RegExp(versionDirPattern);
  for (const drive of drives) {
    const vendor = `${drive}:\\${vendorSuffix}`;
    if (!existsSync(vendor)) continue;
    let entries;
    try {
      entries = readdirSync(vendor);
    } catch {
      continue;
    }
    const versions = entries
      .filter((d) => pattern.test(d) && existsSync(path.join(vendor, d, exeName)))
      .sort((a, b) => parseFloat(b.slice(8)) - parseFloat(a.slice(8)));
    if (versions.length) return { ok: true, detail: path.join(vendor, versions[0], exeName) };
  }
  return { ok: false, detail: `not found on drives [${drives.join(', ')}] under "...\\${vendorSuffix}\\<Version>\\${exeName}", and ${check.envOverride || '(no env override configured)'} is not set` };
}

function checkBinaryPath(check) {
  const p = (check.envOverride && process.env[check.envOverride]) || check.path;
  if (existsSync(p)) return { ok: true, detail: p };
  const via = check.envOverride && process.env[check.envOverride] ? `${check.envOverride}=${p}` : `default path ${p}`;
  return { ok: false, detail: `not found (${via})` };
}

function checkNodeModule(check) {
  const pkgJson = path.join(ROOT, 'node_modules', check.module, 'package.json');
  if (existsSync(pkgJson)) return { ok: true, detail: `node_modules/${check.module}` };
  return { ok: false, detail: `node_modules/${check.module} not found — run npm install` };
}

function checkPythonModules(check) {
  const cmd = check.command || 'python';
  const probe = `import sys, importlib\nmissing = []\nfor m in ${JSON.stringify(check.modules)}:\n    try:\n        importlib.import_module(m)\n    except Exception as e:\n        missing.append(m + ': ' + str(e))\nif missing:\n    print('MISSING: ' + ' | '.join(missing))\n    sys.exit(1)\nprint('OK')\n`;
  const r = spawnSync(cmd, ['-c', probe], { encoding: 'utf8', timeout: 15_000 });
  if (r.error) {
    return { ok: false, detail: `\`${cmd}\` not runnable: ${r.error.message}` };
  }
  if (r.status !== 0) {
    const out = (r.stdout || '').trim() || (r.stderr || '').trim() || `exit ${r.status}`;
    return { ok: false, detail: out };
  }
  return { ok: true, detail: `${cmd} has [${check.modules.join(', ')}]` };
}

async function checkHttpPort(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(check.url, { signal: controller.signal });
    clearTimeout(timer);
    return { ok: true, detail: `${check.url} -> HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, detail: `${check.url} unreachable: ${err.message}` };
  }
}

const CHECKERS = {
  'drive-probe-exe': checkDriveProbeExe,
  'binary-path': checkBinaryPath,
  'node-module': checkNodeModule,
  'python-modules': checkPythonModules,
  'http-port': checkHttpPort,
};

// ---------------------------------------------------------------------------

async function main() {
  const manifest = loadManifest();
  const checks = manifest.checks || [];
  console.log(`toolchain doctor — ${manifest.repo || '(repo unset)'} — ${checks.length} check(s) from ${path.relative(ROOT, MANIFEST_PATH)}`);
  console.log('');

  const failures = [];
  const optionalFailures = [];

  for (const check of checks) {
    const checker = CHECKERS[check.kind];
    if (!checker) {
      failures.push(check.id);
      console.log(`FAIL  ${check.id} — unknown check kind "${check.kind}" (doctor.mjs has no checker for it)`);
      continue;
    }
    let result;
    try {
      result = await checker(check);
    } catch (err) {
      result = { ok: false, detail: `checker threw: ${err.message}` };
    }
    const required = check.required !== false; // default true
    const label = check.label || check.id;
    if (result.ok) {
      console.log(`OK    ${check.id}${label !== check.id ? ` (${label})` : ''} — ${result.detail}`);
    } else if (required) {
      failures.push(check.id);
      console.log(`FAIL  ${check.id}${label !== check.id ? ` (${label})` : ''} — ${result.detail}`);
      if (check.installHint) console.log(`      hint: ${check.installHint}`);
      if (check.usedBy?.length) console.log(`      used by: ${check.usedBy.join(', ')}`);
    } else {
      optionalFailures.push(check.id);
      console.log(`WARN  ${check.id}${label !== check.id ? ` (${label})` : ''} — ${result.detail} (optional, not failing)`);
      if (check.installHint) console.log(`      hint: ${check.installHint}`);
    }
  }

  console.log('');
  if (failures.length) {
    console.log(`DOCTOR FAILED: missing/broken required tool(s): ${failures.join(', ')}`);
    if (optionalFailures.length) console.log(`(also unreachable/optional: ${optionalFailures.join(', ')})`);
    process.exitCode = 1;
  } else {
    console.log(`DOCTOR OK: all ${checks.length - optionalFailures.length} required check(s) passed${optionalFailures.length ? ` (${optionalFailures.length} optional unreachable: ${optionalFailures.join(', ')})` : ''}.`);
    process.exitCode = 0;
  }
}

main();
