import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This verifier protects the human-facing Symphony README. The code now treats
// Symphony as a Jules delegation middleman, so the local docs must name the
// dashboard-first control surfaces instead of describing Symphony only as a
// generic autonomous implementation runner.

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

assert.match(readme, /Jules delegation middleman/);
assert.match(readme, /docs\/JULES_MIDDLEMAN_OPERATING_SPEC\.md/);
assert.match(readme, /docs\/SYMPHONY_MIDDLEMAN_ARCHITECTURE\.md/);
assert.match(readme, /high-level map of related\s+files, ownership boundaries, API surfaces, and verifier entry points/);
assert.match(readme, /full task and blocker\s+matrix/);
assert.match(readme, /dashboard-first control surface/);
assert.match(readme, /\/api\/v1\/task-drafts/);
assert.match(readme, /next_action/);
assert.match(readme, /conflict_watch/);
assert.match(readme, /worker_roster/);
assert.match(readme, /rate_limits/);
assert.match(readme, /model\/reasoning\s+assignment/);
assert.match(readme, /codex\.model/);
assert.match(readme, /codex\.reasoning_effort/);
assert.match(readme, /GitHub sync preflight/);
assert.match(readme, /Dashboard-only preflight inspection/);
assert.match(readme, /--dashboard-only/);
assert.match(readme, /without\s+claiming Linear issues, polling mock issues, or starting Codex workers/);
