import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This verifier protects the dashboard-first workflow from a subtle human-use
// failure: live refreshes must not replace the task decision controls while an
// operator is trying to click them. The dashboard can still refresh manually,
// but automatic updates need to respect the visible decision surface.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');

assert.match(dashboardSource, /TASK_INTAKE_INTERACTION_HOLD_MS/);
assert.match(dashboardSource, /taskIntakeInteractionHoldUntil/);
assert.match(dashboardSource, /pointerover', holdTaskIntakeAutoRefresh/);
assert.match(dashboardSource, /pointerdown', holdTaskIntakeAutoRefresh/);
assert.match(dashboardSource, /focusin', holdTaskIntakeAutoRefresh/);
assert.match(dashboardSource, /function holdTaskIntakeAutoRefresh/);
assert.match(dashboardSource, /function isTaskIntakeInteractionActive/);
assert.match(dashboardSource, /function shouldHoldTaskIntakeAutoRefresh/);
assert.match(dashboardSource, /options\.skipIfEditing && shouldHoldTaskIntakeAutoRefresh\(\)/);
assert.match(dashboardSource, /data-current-foreman-action="true"/);
assert.match(dashboardSource, /\[data-current-foreman-action="true"\]/);
assert.match(dashboardSource, /<a data-current-foreman-action="true"/);
assert.match(dashboardSource, /if \(taskIntakeRoot\.innerHTML === nextHtml\) return/);
