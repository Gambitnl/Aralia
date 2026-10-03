/**
 * Restore CI repair through Jules' documented API with visible HTTP failures.
 * Only a current same-repository PR can request a repair. Jules creates a review
 * PR; it never receives authority to merge, deploy, or rewrite the failed branch.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function findRepairPullRequest(run, repository, get) {
  const association = run.pull_requests?.find(pr => pr.head?.repo?.id === run.repository?.id) || run.pull_requests?.[0];
  if (association) return get(`pulls/${association.number}`);
  // GitHub sometimes omits PR associations in workflow_run payloads. Resolve
  // the branch through the API, then apply the same repository and exact-tip
  // checks below; an absent association must not silently disable repair.
  const owner = repository.split('/')[0];
  for (let page = 1; page <= 20; page++) {
    const pulls = await get(`pulls?state=open&head=${encodeURIComponent(owner + ':' + run.head_branch)}&per_page=100&page=${page}`);
    const current = pulls.find(pr => pr.head?.sha === run.head_sha && pr.head?.repo?.full_name === repository);
    if (current) return current;
    if (pulls.length < 100) return undefined;
  }
  throw new Error('PR lookup exceeded bounded pagination; no repair was created.');
}

export function prepareRepair(run, pr, repository) {
  if (run.conclusion !== 'failure' || run.event !== 'pull_request' || run.path !== '.github/workflows/ci.yml') return { skipped: 'Only failed application PR CI is eligible.' };
  if (!pr || pr.state !== 'open' || pr.head.repo?.full_name !== repository) return { skipped: 'The PR is closed, missing, or from a fork.' };
  if (pr.head.sha !== run.head_sha || pr.head.ref !== run.head_branch) return { skipped: 'The failure belongs to a superseded PR tip.' };
  if (pr.title.startsWith('[CI repair]')) return { skipped: 'Repair PRs do not launch another repair.' };
  const title = `[CI repair] ${repository}@${run.head_sha.slice(0, 12)}`;
  return { title, sourceContext: { source: `sources/github/${repository}`, githubRepoContext: { startingBranch: pr.head.ref } }, requirePlanApproval: false, automationMode: 'AUTO_CREATE_PR',
    prompt: `Repair the failed application CI at ${run.html_url}.\nChecked source commit: ${run.head_sha}.\nSource PR: #${pr.number}.\nCreate a separate PR with title beginning ${JSON.stringify(title)}; preserve the failed PR branch.\nInspect the logs and make bounded fixes that preserve behavior and unfinished intent. Keep dependency manifests and their lockfiles consistent; compiler caches remain ignored. Run the affected tests and the required CI checks. Do not merge, deploy, force-push, remove features, or weaken assertions to make checks pass. The owner reviews the repair PR.` };
}

export async function submitRepair(payload, key, fetcher = fetch) {
  if (!key) throw new Error('JULES_API_KEY is not configured.');
  const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };
  // A queued rerun of the same failed tip must recover the existing session,
  // rather than spend quota on another identical repair. POST is never retried
  // after an uncertain network failure; the next run checks this list first.
  let token = '';
  for (let page = 0; page < 20; page++) {
    const response = await fetcher(`https://jules.googleapis.com/v1alpha/sessions?pageSize=100${token ? '&pageToken=' + encodeURIComponent(token) : ''}`, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Jules session lookup failed (HTTP ${response.status}).`);
    const data = await response.json();
    const existing = data.sessions?.find(session => session.title === payload.title);
    if (existing) {
      if (!/^sessions\/[a-zA-Z0-9_-]+$/.test(existing.name || '')) throw new Error('Existing Jules session has no valid receipt.');
      return { name: existing.name, reused: true };
    }
    token = data.nextPageToken;
    if (!token) break;
    if (page === 19) throw new Error('Jules session lookup exceeded its bounded pagination; no repair was created.');
  }
  const response = await fetcher('https://jules.googleapis.com/v1alpha/sessions', { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Jules repair creation failed (HTTP ${response.status}).`);
  const data = await response.json();
  if (!/^sessions\/[a-zA-Z0-9_-]+$/.test(data.name || '')) throw new Error('Jules did not return a valid session receipt.');
  return { name: data.name, reused: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^\d+$/.test(process.env.REPAIR_RUN_ID || '')) throw new Error('A repository and numeric failed CI run ID are required.');
  const get = async route => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${route}`, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`GitHub repair context lookup failed (HTTP ${response.status}).`);
    return response.json();
  };
  const run = await get(`actions/runs/${process.env.REPAIR_RUN_ID}`);
  const pr = run.event === 'pull_request' ? await findRepairPullRequest(run, repository, get) : undefined;
  const payload = prepareRepair(run, pr, repository);
  const receipt = payload.skipped ? payload : process.env.APPLY_REPAIR === 'true'
    ? await submitRepair(payload, process.env.JULES_API_KEY) : { dryRun: true, title: payload.title, startingBranch: payload.sourceContext.githubRepoContext.startingBranch };
  console.log(JSON.stringify(receipt));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### CI repair receipt\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\`\n`);
}
