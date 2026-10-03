/**
 * Scout checks real three-way merges of PR tips, including renames and binaries.
 * Git writes disposable merge objects, never the working tree, index, or a branch.
 * Comments ask contributors to preserve both intentions rather than revert a file.
 */
import { spawnSync } from 'node:child_process';

export function gitCommand(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (![0, 1].includes(result.status)) throw new Error(`Git inspection failed (${result.status}): ${result.stderr}`);
  return result;
}

export function mergeConflicts(left, right, git = gitCommand) {
  if (![left, right].every(sha => /^[a-f0-9]{40,64}$/.test(sha))) throw new Error('Scout needs verified commit IDs.');
  const result = git(['merge-tree', '--write-tree', '--name-only', '--no-messages', '-z', left, right]);
  const [tree, ...names] = result.stdout.split('\0');
  if (!/^[a-f0-9]{40,64}$/.test(tree)) throw new Error('Git did not return a merge tree.');
  return { conflicted: result.status === 1, files: [...new Set(names.filter(Boolean))] };
}

export function conflictComment(left, right, result) {
  const marker = `<!-- aralia-scout:${left.number}:${right.number} -->`;
  const commits = `Checked tips: \`${left.head.sha}\` and \`${right.head.sha}\`.`;
  if (!result.conflicted) return `${marker}\nThe previously reported conflict with PR #${left.number} no longer reproduces in Git's three-way merge.\n\n${commits}\n\nApplication checks and human review still apply.`;
  const files = result.files.length ? result.files.map(file => `- ${JSON.stringify(file)}`).join('\n') : '- Git reported a merge conflict without a single file path; inspect its merge diagnostics.';
  return `${marker}\n⚠️ **Merge coordination needed with PR #${left.number}**\n\nGit's three-way merge reports conflicts at these checked tips:\n\n${files}\n\n${commits}\n\nReview both PRs' intent and agree how to combine the changes. Preserve useful work on both sides; overlapping work does not establish priority and does not justify reverting an entire file. Rebase or resolve the agreed changes on your own branch, then rerun CI. Scout's simulation does not merge or modify either PR.`;
}

export async function runScout({ github, context, git = gitCommand }) {
  const { owner, repo } = context.repo;
  const prs = await github.paginate(github.rest.pulls.list, { owner, repo, state: 'open', per_page: 100 });
  if (prs.length < 2) return { pullRequests: prs.length, comparisons: 0, conflicts: 0 };
  // Git sees every changed file; unlike REST patch pages, this has no 100/300-file
  // ceiling. The fetched tips must still match the API snapshot before inspection.
  for (const pr of prs) {
    if (!Number.isSafeInteger(pr.number) || pr.number < 1) throw new Error('Invalid PR number.');
  }
  for (let i = 0; i < prs.length; i += 20) {
    const result = git(['fetch', '--no-tags', 'origin', ...prs.slice(i, i + 20).map(pr => `+refs/pull/${pr.number}/head:refs/remotes/aralia-scout/${pr.number}`)]);
    if (result.status) throw new Error(`Scout could not fetch PR tips: ${result.stderr}`);
  }
  const current = prs.filter(pr => git(['rev-parse', `refs/remotes/aralia-scout/${pr.number}`]).stdout.trim() === pr.head.sha).sort((a, b) => a.number - b.number);
  let comparisons = 0, conflicts = 0;
  const comments = new Map();
  for (let i = 0; i < current.length; i++) for (let j = i + 1; j < current.length; j++) {
    const left = current[i], right = current[j];
    const result = mergeConflicts(left.head.sha, right.head.sha, git);
    comparisons++;
    if (result.conflicted) conflicts++;
    if (!comments.has(right.number)) comments.set(right.number, await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: right.number, per_page: 100 }));
    const marker = `<!-- aralia-scout:${left.number}:${right.number} -->`;
    const previous = comments.get(right.number).find(comment => comment.user?.login === 'github-actions[bot]' && comment.body?.includes(marker));
    if (!result.conflicted && !previous) continue;
    const body = conflictComment(left, right, result);
    if (previous && previous.body !== body) await github.rest.issues.updateComment({ owner, repo, comment_id: previous.id, body });
    else if (!previous) await github.rest.issues.createComment({ owner, repo, issue_number: right.number, body });
  }
  return { pullRequests: prs.length, skippedChangedTips: prs.length - current.length, comparisons, conflicts };
}
