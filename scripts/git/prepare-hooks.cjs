#!/usr/bin/env node

/*
 * WF-G76: npm `prepare` wrapper. Runs the hook installer best-effort on every
 * `npm install` so fresh clones get the GG-117 snapshot guard (and pre-push
 * policy) without anyone remembering `hooks:install`. Never fails the install:
 * sandboxes without git, read-only checkouts, or --ignore-scripts setups must
 * not break; they just stay unguarded (documented residual).
 */

try {
  require('./install-pre-push-hook.cjs');
} catch (e) {
  console.warn(`[prepare] hook install skipped: ${e.message}`);
}
process.exit(0);
