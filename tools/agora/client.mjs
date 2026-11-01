// Stable Agora entry: existing worker commands and orchestrator imports keep
// this path. Implementation edits belong in client-runtime.mjs and become
// visible only after an explicit, validated client-release.mjs publication.
// Never retry a command error: the first attempt may already have changed board state.
// Recovery flags must never reach an older runtime that interprets them as a
// no-positional unlock. Refuse before delegation rather than releasing all locks.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPublishedClient } from './client-release.mjs';

const runtime = await loadPublishedClient();
export const {
  renameTargetOf, everTracked, fileFacts, dirtyInWorktree,
  agentRegistryKeys, gapRegistryVocabulary, gapRegistryProjects,
  classificationForSurface, gapTokens, gapOverlap, findNearDuplicateGaps,
} = runtime;

export const supportsLockRecovery=()=>typeof runtime.supportsLockRecovery==='function'&&runtime.supportsLockRecovery()===true;
export async function run(argv,options){
  if(argv.some(arg=>typeof arg==='string'&&/^--(?:restore|revert|expect-current|lock-id)(?:=|$)/.test(arg))&&!supportsLockRecovery())return {code:1,lines:['Recovery refused before delegation: selected client release lacks guarded lock recovery. Ask the tooling owner to publish tested support; no command was run.'],stderrLines:[]};
  return runtime.run(argv,options);
}

export function isMainModule() {
  return Boolean(process.argv[1])
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  const options = {};
  if (argv[0] === 'watch') {
    let stop = null;
    options.watchOpts = { onReady: (value) => { stop = value; } };
    process.on('SIGINT', () => {
      if (stop) stop();
      else process.exit(0);
    });
  }
  run(argv, options).then((result) => {
    for (const line of result.lines) console.log(line);
    for (const line of result.stderrLines || []) console.error(line);
    process.exitCode = result.code || 0;
  }).catch((error) => {
    console.error('Agora command failed; it was not retried: ' + error.message);
    process.exitCode = 1;
  });
}
