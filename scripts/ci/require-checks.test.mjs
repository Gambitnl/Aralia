import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {requireChecks} from './require-checks.mjs';
test('any non-success mandatory lane blocks publication', () => {
  const jobs=Object.fromEntries(['policy','typecheck','build','lint','validate','test','node-tests'].map(name=>[name,{result:'success'}]));
  requireChecks(jobs);
  for (const name of Object.keys(jobs)) for (const result of ['failure','skipped','cancelled']) {
    assert.throws(()=>requireChecks({...jobs,[name]:{result}}),new RegExp(`${name}: ${result}`));
  }
  assert.throws(()=>requireChecks({}),/No mandatory/);
});
test('Pages has no standalone publication trigger and waits for mandatory CI', () => {
  const ci=fs.readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8');
  const deploy=fs.readFileSync(new URL('../../.github/workflows/deploy.yml',import.meta.url),'utf8');
  assert.match(ci,/needs: \[policy, typecheck, build, lint, validate, test, node-tests\]/);
  assert.match(ci,/needs: \[required, build\]/);
  assert.match(deploy,/workflow_call:/); assert.doesNotMatch(deploy,/^  (?:push|workflow_dispatch):/m);
  assert.match(deploy,/test "\$current" = "\$GITHUB_SHA"/);
});
