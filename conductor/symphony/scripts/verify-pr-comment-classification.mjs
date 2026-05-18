import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizePullRequestFeedback } from '../dist/task-intake.js';

// This verifier protects PR comments as a safe Jules feedback channel. Other
// agents can leave review comments on the same PR, so Symphony must not treat
// every comment as a course correction for Jules.

const summary = summarizePullRequestFeedback({
  comments: [
    {
      author: { login: 'gemini-code-assist[bot]' },
      body: 'Consider simplifying this component.',
      url: 'https://github.com/example/aralia/pull/5#issuecomment-1',
      createdAt: '2026-05-17T09:00:00Z',
    },
    {
      author: { login: 'Gambit' },
      body: '[Jules feedback]\nPlease repair the failing quality scan and keep the declared write scope unchanged.',
      url: 'https://github.com/example/aralia/pull/5#issuecomment-2',
      createdAt: '2026-05-17T09:10:00Z',
    },
  ],
  reviews: [
    {
      author: { login: 'scout-reviewer[bot]' },
      body: 'Out-of-scope file needs owner disposition.',
      url: 'https://github.com/example/aralia/pull/5#pullrequestreview-1',
      state: 'COMMENTED',
      submittedAt: '2026-05-17T09:05:00Z',
    },
    {
      author: { login: 'github-actions' },
      body: '⚠️ **Potential Conflict Detected by Scout**\n\nYour PR modifies `src/hooks/combat/useTargetValidator.ts` at lines that overlap with **PR #879** (RECORDER).\n\n**Recommended Actions:**\n1. ❌ Revert your changes to `src/hooks/combat/useTargetValidator.ts`',
      url: 'https://github.com/example/aralia/pull/5#issuecomment-3',
      createdAt: '2026-05-17T09:15:00Z',
    },
  ],
});

assert.equal(summary.totalComments, 4);
assert.equal(summary.julesFeedback.length, 1);
assert.equal(summary.julesFeedback[0].author, 'Gambit');
assert.match(summary.julesFeedback[0].body, /repair the failing quality scan/);
assert.equal(summary.scoutConflictComments.length, 1);
assert.equal(summary.scoutConflictComments[0].conflictFile, 'src/hooks/combat/useTargetValidator.ts');
assert.equal(summary.scoutConflictComments[0].priorityPullRequest, 879);
assert.equal(summary.externalReviewComments.length, 2);
assert(summary.externalReviewComments.some(comment => comment.author === 'gemini-code-assist[bot]'));
assert(summary.externalReviewComments.some(comment => comment.author === 'scout-reviewer[bot]'));
assert.match(summary.summary, /1 Jules feedback/);
assert.match(summary.summary, /1 Scout conflict/);
assert.match(summary.summary, /2 external review/);

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /function renderPullRequestFeedbackSummary/);
assert.match(dashboard, /Jules feedback comments/);
assert.match(dashboard, /Scout conflict comments/);
assert.match(dashboard, /External review comments/);
assert.match(dashboard, /Only explicitly marked feedback is treated as Jules course correction/);
