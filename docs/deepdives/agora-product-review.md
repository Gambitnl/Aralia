# Deepdive: Agora product outcomes against workflow-gap closure

Board task: `agora-db57` (standalone research publication). Peer-review corrections: `agora-437d.3` in campaign `agora-437d`.
Written: 2026-10-22 by `codex-agora-review-01a162fe`.
Agent: `43af7c58-ef1f-4a5e-b313-f6f43e48f837`.
Session: `01a162fe-eb70-7f82-8e76-3382093c2852`.
Verified: 2026-10-22 against the local register, selected implementation paths, and the focused checks recorded below. Live behavior coverage is limited as stated below.

Read-only research. No source file was changed. Publication adds this report and its index entry only.

Planning surfaces: Plan Map topics `master-orchestrator`, `agora-operator-dashboard`, `agora-fleet-coordination`, and `co-orchestration-pipeline` in [topics.json](../../public/planmap/topics.json); the [workflow-gap register and both archives](../../tools/agora/WORKFLOW_GAPS.md); the [Agora design spec](../superpowers/specs/2026-06-27-agora-agent-coordination-design.md); and the [planning-stack ownership rules](../../tools/agora/PLANNING-STACK.md).

This report records findings and recommendations. It is not an approved roadmap, implementation brief, or owner acceptance of Agora.

Related reviews: [Claude's Agora system review](../architecture/agora-system-review.md) and [Gemini Argon's product-coherence findings](../architecture/product-coherence-and-agora-findings.md). Each author owns their report; the three reports provide different views of the same review boundary.

The three authors agreed a [prioritized implementation plan](../architecture/agora-system-review.md#agreed-implementation-plan) through Agora. It records owners, dependencies, acceptance checks, and owner decisions. It remains a proposal awaiting implementation authorization.

## 1. Verdict

Agora has already identified and repaired much of the friction described in the initial chat assessment. That assessment did not first reconcile its recommendations with the full gap history and overstated missing capability. The more defensible remaining concerns are recovery of uncertain command outcomes, discovery of resolved history, and measurement of the complete coordination experience. Extending an existing check that refuses another holder's write broadens current protection. Requiring every editor to hold a live self-owned lock changes the current policy.

The planning surfaces contain strategic Agora work, but the inspected records do not provide one maintained assessment of whether the complete product meets its intended outcomes. Individual repair closure supplies evidence toward that assessment; it does not establish the whole experience by itself.

Recommended next decision: choose whether to maintain Agora product outcomes in the existing Plan Map, supported by a living product brief and explicit end-to-end review criteria.

## 2. Inventory

| Record or entry point | Role in this review |
|---|---|
| [WORKFLOW_GAPS.md](../../tools/agora/WORKFLOW_GAPS.md) | Full repair history, including both resolved archives. |
| [gapIndex.mjs](../../tools/agora/gapIndex.mjs) and [its tests](../../tools/agora/gapIndex.test.mjs) | Native first-table indexing contract and deliberate archive exclusion. |
| [client-runtime.mjs](../../tools/agora/client-runtime.mjs) | Identity scope, HTTP requests, contextual guidance, gap search, and operation-specific recovery. |
| [client.mjs](../../tools/agora/client.mjs) and [client-release.mjs](../../tools/agora/client-release.mjs) | Stable entry, immutable publication, and no automatic runtime retry. |
| [server.mjs](../../tools/agora/server.mjs) and [store.mjs](../../tools/agora/store.mjs) | Coordination APIs, task transitions, result evidence, persistence, and health telemetry. |
| [lockGuard.mjs](../../tools/agora/lockGuard.mjs) | Selected writing-tool checks and explicit offline permission behavior. |
| [visualAcceptance.mjs](../../tools/agora/visualAcceptance.mjs) | Separate build and visual-review task contracts. |
| [validate-planmap.mjs](../../tools/agora/validate-planmap.mjs) and [planmap-reconcile-lib.mjs](../../tools/agora/planmap-reconcile-lib.mjs) | Adoption checks, declared-symbol reachability, and completion projections. |
| [AGENT.md](../../tools/agora/AGENT.md), [ORCHESTRATOR.md](../../tools/agora/ORCHESTRATOR.md), and [PROTOCOL.md](../../tools/agora/PROTOCOL.md) | Existing worker, orchestration, and API guidance. |
| [TRAIL-OBSERVABILITY.md](../../tools/agora/TRAIL-OBSERVABILITY.md) | Proposed activity diagnostics and overhead acceptance criteria. |
| [topics.json](../../public/planmap/topics.json) and [PLANNING-STACK.md](../../tools/agora/PLANNING-STACK.md) | Existing strategic records and authority for curated product status. |

## 3. Findings

### F1. The register already covers the motivating failures

At the initial reconciliation pass, the reviewed file contained 353 unique gap entries, ending at WF-G356: 340 resolved, 10 duplicate, and 3 wont_fix. Its first table had 72 entries; the full-provenance archive had 219 and the legacy archive had 62. There were no open-status rows in that snapshot. These are historical counts of this file, not a reconstruction of every Agora record or a permanently current total.

Every entry was included in the inventory pass. Relevant evidence and closure notes were traced against selected implementation paths. The register snapshot SHA-256 was `3460a78881b9020395513fcd544d744c49e07583fefd952c1522b45924ce6100`; it was unchanged at the end of the reconciliation pass. The following table corrects the initial six recommendations.

The first column restates this author's six recommendations from the current Codex chat, session `01a162fe-eb70-7f82-8e76-3382093c2852`. That exchange was not a previously published specification or approved requirement. All six are reproduced here so readers can assess the reconciliation without access to the chat transcript.

| Initial recommendation | Already noticed and repaired | What remains, or needs a decision |
|---|---|---|
| Make the safe workflow easier to execute | Identity and onboarding: WF-G10, WF-G44, WF-G49, WF-G58, WF-G66, WF-G120, WF-G145, WF-G172, WF-G338, WF-G344, WF-G345. Renewal: WF-G19, WF-G21, WF-G69, WF-G75, WF-G91, WF-G110. Repairs include scoped credentials, unsafe-registration refusal, existing-identity reuse, pet substitution, bounded heartbeat helpers, and preservation of lock renewal periods. | Callers still preserve identity scope across processes and manage heartbeat bounds and retirement. No complete automatic session lifecycle was found. A wrapper is a usability proposal; its benefit has not been measured. |
| Recover uncertain command outcomes | WF-G245 explicitly recognizes that an error can occur after a successful mutation. WF-G240 and WF-G245 provide an immutable client and no automatic retry. WF-G180 and WF-G206 handle transient file operations; WF-G234 confirms exact stored results; WF-G322 adds file input. Some queue and orchestration operations have specific duplicate and resume handling. | No general mutation request ID, durable deduplication receipt, and outcome lookup was found in the inspected client, server, and store paths. Operation-specific safeguards must be preserved. |
| Protect writes at the point of editing | WF-G1 and WF-G20 protect destructive Git operations; WF-G40 normalizes reservation paths; WF-G122 fixes partial release; WF-G243 links interrupted work; WF-G260 adds guarded byte recovery; WF-G296, WF-G311, and WF-G331 clarify atomic and partial grants; WF-G297 adds queue notifications. | `checkAgoraLock` already refuses another holder's conflicting lock in selected writing tools. Extending that check to more supported edit paths broadens an existing rule; it is distinct from requiring a live self-owned lease for every write. The latter, with explicit solo and outage behavior, needs an owner decision. The current helper permits unlocked files and unreachable-daemon cases. A passive observer cannot prevent an edit or prove who made it. |
| Provide contextual guidance | WF-G35, WF-G38, and WF-G61 improve help and inspection; WF-G175 reconciles allowed commands; WF-G268 warns on uncovered claim paths; WF-G279 explains missing targets; WF-G302 gives role-appropriate campaign guidance; WF-G303 fixes offline help. | A wholesale absence of contextual guidance was an incorrect claim. Documentation length alone does not prove excessive effort. Shorter command output does not establish that the required source guides are short. Resolved-history search has a concrete limitation described in F2. |
| Separate task state from acceptance evidence | WF-G53 adds result disposition plus finding and evidence fields; WF-G150 limits premature completion projections; WF-G176 and WF-G186 add adoption; WF-G188 adds declared-symbol reachability; WF-G259 adds pending_restart; WF-G266 separates build and visual review; WF-G290 records partial rulings. | The distinction already exists. Coverage is bounded: adoption and reachability declarations are optional, static checks are not runtime proof, and WF-G266 excludes universal direct-HTTP completion enforcement and screenshot certification. They do not establish whole-product behavior, cumulative frame cost, or memory capacity. Decide which existing contracts should be required for which work. |
| Measure whether coordination earns its cost | WF-G147 adds event-loop and snapshot telemetry. WF-G111 records time spent disproving stale briefs; WF-G113 documents contention; WF-G297 records repeated lock conflicts. TRAIL-OBSERVABILITY proposes diagnostics and overhead gates. | No established measurement of overall onboarding effort, coordination effort, waiting, rework, and prevented failures was found. Operational diagnostics and individual incident evidence already exist. |

Closure notes are historical evidence, not an automatic statement about the current daemon. For example, WF-G297's October 9 pending-restart note is followed by an October 22 live-verification closure. Do not resurrect the earlier pending state without reading the later evidence.

### F2. Normal gap search excludes most recorded history

`gapIndex.mjs` documents and implements first-table-only parsing. `gapIndex.test.mjs`, test `gapIndex.workflowGaps: the real WORKFLOW_GAPS.md parses; archive rows are NOT indexed`, explicitly preserves archive exclusion.

Executing `parseGapsMarkdown` against the initial snapshot returned 72 rows and 0 open rows, while a complete gap-row inventory returned 353 rows. The remaining 281 entries are archived. `client-runtime.mjs` gap search uses GET `/gaps`; `--all` removes the open-status filter but does not expand the parser to include archives. WF-G200 duplicate refusal separately compares open rows only.

This is a documented search boundary, not evidence that the archive was accidentally deleted. A history-search mode could index resolved records for retrieval without making them active work or changing duplicate-refusal policy.

History-aware retrieval and archived-ID updates must remain supported if the archive later moves to a separate file. Such a split reduces rewritten bytes; no measurement in this review establishes that file size caused Windows sharing failures or that splitting the archive would eliminate them.

### F3. Whole-product direction exists across several records

The design spec contains a goal, non-goals, architecture, and later campaign trials. Plan Map contains strategic topics for master orchestration, the operator dashboard, fleet coordination, and the co-orchestration pipeline. It would be wrong to claim Agora has no product direction.

The records inspected do not form one current review of complete user and agent journeys with success criteria, fresh evidence, and a named reviewer. The workflow register's scope permits whole-system concerns; it does not require component-only gaps. The organizational need is an explicit product-outcome review practice and a clear home for its curated outcomes.

Candidate outcomes include safe fresh-agent onboarding, confident interruption recovery, discoverable prior repairs, trustworthy completion, and coordination benefits that justify their effort. These are proposals for owner review, not new approved requirements.

### F4. Verification supports local implementation claims only

During this chat's reconciliation pass, the following focused command passed 58 tests with no failures or skips:

```text
node --test --test-concurrency=1 tools/agora/client.identity.test.mjs tools/agora/client.onboard.test.mjs tools/agora/lockGuard.test.mjs tools/agora/client-release.test.mjs tools/agora/planmap-reconcile-lib.test.mjs tools/agora/validate-planmap.test.mjs
```

The checks include a successful mutation followed by a runtime error with no retry, immutable-client behavior under torn source, scoped identity behavior, offline write-guard permission, build-only completion projections, adoption validation, and declared-symbol reachability fixtures.

The subsequent cross-review with Claude and Gemini Argon ran `node --test tools/agora/server.gaps.test.mjs tools/agora/resolution.test.mjs tools/agora/lockGuard.test.mjs`: 23 tests passed, none failed or skipped. Those private fixtures verify concurrent gap intake, the external Git shim, and the current lock-guard behavior. The initial register hash and counts above remain historical: Claude filed WF-G357 during the peer review. No conclusion about that new dispatch defect's scope or repair is established by these 23 tests.

A read-only live health request returned `ok: true`, version `0.3.0`, and `gapsOpen: 0`. This was a point-in-time health check before the report-publication identity was registered. It does not prove every repair is deployed, every journey is usable, or all product outcomes are accepted. Selected implementation files are locally modified or untracked; this review does not establish delivery in the current committed HEAD, GitHub, or a fresh clone. Fixture clean-clone tests do not establish those distribution claims.

## 4. Decisions for Remy

| Decision | Options and costs | Recommendation |
|---|---|---|
| Where should whole-product outcomes live? | Maintain curated Agora outcomes in Plan Map with a living product brief; this requires explicit review ownership. A second status registry would add another editable status home and reconciliation burden. | Use existing Plan Map authority for status. Have the product brief link outcomes, success criteria, supporting WF gaps, evidence, and reviewer. Preserve existing strategic intent when deciding how to consolidate the view. |
| Should resolved repairs be searchable through normal tools? | Add an archive-aware reading mode, with parser/schema work and tests. Keep active intake separate. Continuing direct file searches needs no implementation but preserves discovery friction. | Add history retrieval without changing active-work or duplicate-refusal semantics. |
| Should mutations have general outcome recovery? | Add durable request receipts and lookup, with persistence, replay, and compatibility costs. Retain manual inspection, which avoids that implementation but leaves uncertainty with callers. | Scope a design for request receipts before considering automatic retries. |
| Which edit paths should check locks? | Extending peer-lock refusal to more supported tools broadens an existing guard. Requiring the editor's own live lock changes policy and needs explicit solo and outage behavior. A harness hook has limited coverage; a passive observer reports after the write. | Evaluate broader peer-conflict checks separately from the owner decision on mandatory self-owned locks. Preserve known scope and outage limits in any promise. |
| Should a session wrapper be built? | Run a bounded usability experiment and compare effort/errors with the current workflow, or keep current commands. A wrapper adds another maintained interface. | Measure a complete journey before committing to the interface change. |

## 5. Follow-up work filed on the board

| Task | Title | What it changes | Finding |
|---|---|---|---|
| `agora-db57` | Publish reconciled Agora product review for agent handoff | Adds this report and its entry in the deepdive index. | Preserves F1-F4 and the corrected assessment for other agents. |
| `agora-437d.3` | Apply peer review corrections to the Agora product deepdive | Adds sibling links, chat provenance, precise lock-policy distinctions, normalized IDs, and later verification limits. | Reconciles comments from Claude and Gemini Argon. The earlier dispatch packet `agora-437d.2` remains blocked as superseded. |

No implementation, new product-outcome, or roadmap-change tasks were created by this publication. The decisions above remain proposals; this report must not be used as evidence that they were approved or completed.

## 6. Workflow gaps filed on the board

None were filed during this documentation publication. Existing WF-G references above are historical records, not newly filed gaps. F2 and the other remaining concerns are research findings for reconciliation and owner prioritization; no new gap IDs or statuses are implied.

## 7. Filed artifacts

- This report: `docs/deepdives/agora-product-review.md`.
- Discovery entry: [docs/deepdives/README.md](README.md).
- No implementation, roadmap status, existing gap status, or memory record was changed.
