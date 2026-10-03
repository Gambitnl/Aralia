/** Reject failures, skips and cancellations before the same build can deploy. */
export function requireChecks(jobs) {
  const failed = Object.entries(jobs).filter(([, job]) => job.result !== 'success');
  if (!Object.keys(jobs).length || failed.length) {
    throw new Error(failed.map(([name, job]) => `${name}: ${job.result}`).join('\n') || 'No mandatory checks were supplied.');
  }
}
if (process.env.RESULTS) {
  requireChecks(JSON.parse(process.env.RESULTS));
  console.log('All mandatory CI lanes passed for this commit.');
}
