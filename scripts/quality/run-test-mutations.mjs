/**
 * Run Stryker in disposable sandboxes with a separately installed toolchain.
 * The game checkout and its dependency manifests are never mutated. Each report
 * names its source scope; this command does not invent a repository-wide score.
 * Existing assertion audits decide what to inspect, not what to remove.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileWithRetry } from '../writeWithRetry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const output = path.resolve(root, '.agent/scratch/test-value-audit');
const toolchain = path.resolve(output, 'toolchain/node_modules');
const defaultTargets = [
  'src/utils/core/timeUtils.ts',
  'src/utils/core/securityUtils.ts',
  // Vite requires literal glob arguments. Keep its loader declarations outside
  // instrumentation while mutating matching, missing-entry detection and output.
  'src/utils/validation/raceSyncAuditor.ts:148-327',
  'src/utils/random/seededRandom.ts',
  'src/services/geminiService.ts',
  'src/services/landmarkService.ts',
  'src/services/worldSim/index.ts',
  'src/systems/companions/BanterManager.ts',
];
const targets = args.length ? args : defaultTargets;
// The whole-suite baseline is measured separately. Mutation execution uses
// the existing module suites so unrelated UI flakes cannot invalidate it.
const testScope = [
  'src/utils/core/__tests__/timeUtils.test.ts',
  'src/utils/core/__tests__/securityUtils*.test.ts',
  'src/utils/securityUtils.test.ts',
  'src/utils/validation/__tests__/raceSyncAuditor.test.ts',
  'src/utils/random/__tests__/*.test.ts',
  'src/services/__tests__/geminiService*.test.ts',
  'src/services/__tests__/prompt_inspector.test.ts',
  'src/services/__tests__/EntityResolutionIntegration.test.ts',
  'src/services/__tests__/monsterId.test.ts',
  'src/services/__tests__/landmarkService*.test.ts',
  'src/services/worldSim/__tests__/*.test.ts',
  'src/systems/companions/__tests__/BanterManager.test.ts',
];
// Explicit targets may narrow this campaign. A new module needs its own
// reviewed test selection before this runner can claim to measure it.
const stripRange = target => target.replace(/:\d+(?::\d+)?-\d+(?::\d+)?$/, "");
const supported = new Set(defaultTargets.map(stripRange));
for (const target of targets) {
  const source = stripRange(target);
  if (!supported.has(source)) throw new Error(`No reviewed test scope for production target: ${target}`);
  const resolved = path.resolve(root, source);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(resolved).isFile()
    || /\.(test|spec)(-d)?\./.test(relative)) throw new Error(`Invalid production target: ${target}`);
}
fs.mkdirSync(output, { recursive: true });
await writeFileWithRetry(path.resolve(output, 'mutation-vitest.config.ts'), [
  '// Instrumentation overhead gets an audit-only timeout; CI limits are intact.',
  "import base from '../../../vitest.config';",
  `const include = ${JSON.stringify(testScope)};`,
  'export default {...base,test:{...base.test,projects:undefined,include,testTimeout:60000,hookTimeout:60000}};',
  '',
].join('\n'));
const config = {
  testRunner: 'vitest',
  plugins: [path.resolve(toolchain, '@stryker-mutator/vitest-runner/dist/src/index.js')],
  vitest: { configFile: '.agent/scratch/test-value-audit/mutation-vitest.config.ts', related: false },
  mutate: targets, inPlace: false, concurrency: 2, dryRunTimeoutMinutes: 30,
  timeoutMS: 2000, timeoutFactor: 1.5,
  incremental: true, incrementalFile: path.resolve(output, 'mutation-incremental.json'),
  // Static initializers require the complete related suite for every mutant.
  // Keep those explicitly Ignored in the report; the executable behavior score
  // must never be presented as a score for these constants or the whole repo.
  ignoreStatic: true,
  tempDirName: path.resolve(output, 'stryker-sandboxes'),
  cleanTempDir: true,
  // Copy source and canonical fixtures only. The test runner links installed
  // dependencies; artwork, operator state and recovery copies stay outside.
  ignorePatterns: ['**', '!src/**', '!public/**', '!scripts/ci/**',
    '!vitest.config.ts', '!tsconfig*.json', '!package.json', '!package-lock.json',
    '!.agent/scratch/test-value-audit/mutation-vitest.config.ts',
    '**/*.{png,jpg,jpeg,webp,gif,glb,gltf,blend,zip,7z,mp4,pdf}'],
  reporters: ['progress', 'clear-text', 'json', 'html'],
  jsonReporter: { fileName: path.resolve(output, 'mutation.json') },
  htmlReporter: { fileName: path.resolve(output, 'mutation.html') },
  thresholds: { high: 80, low: 60, break: 0 },
};
const configFile = path.resolve(output, 'stryker.config.json');
await writeFileWithRetry(configFile, JSON.stringify(config, null, 2));
await writeFileWithRetry(path.resolve(output, 'mutation-scope.json'), JSON.stringify({
  targets, testScope, toolVersion: '10.0.0', testRunnerVersion: '4.1.10', allRepositoryMutants: false,
  note: 'Existing named module suites test generated executable mutants in these modules; other repository suites are not part of the score. Static mutants are explicitly Ignored. The race loader glob declarations are outside its named range. All tracked test files receive the separate source audit.'
}, null, 2));
const child = spawn(process.execPath, [path.resolve(toolchain, '@stryker-mutator/core/bin/stryker.js'), 'run', configFile], {
  cwd: root, stdio: 'inherit', env: { ...process.env,
    AGORA_AGENT_ID: process.env.AGORA_AGENT_ID ?? `mutation-audit-${process.pid}` }
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
