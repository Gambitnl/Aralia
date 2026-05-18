# Codex Desktop Terminal Environment Learnings

Identity & Environment Checklist
- Agent ID: codex-desktop-terminal
- Host/Tool (terminal, VS Code extension, etc.): Codex desktop app shared workspace terminal
- Shell: powershell (Windows PowerShell 5.1)
- Working directory / repo root: F:\Repos\Aralia
- Config or tool rules path: AGENTS.md; .agent/rules/
- Environment learnings file path: .agent/rules/environment-learnings/codex-desktop-terminal.md
- Verification steps used: confirmed session context reports Codex desktop app, PowerShell shell, and Aralia repo root.

## PowerShell Issues Seen In This Environment

### Codex Desktop Can Accumulate Too Many Unified Exec Processes

During the spell mechanics closure phase, repeated parallel `exec_command`
inspection batches triggered warnings such as `The maximum number of unified
exec processes you can keep open is 60 and you currently have 62 processes
open.` The commands had mostly finished quickly, but the session still counted
many processes while they were awaiting polling or cleanup.

This repeated after context compaction when a three-command orientation read was
started in parallel while the session was still at the 60-process warning
threshold. Process regression: once this warning appears, even small parallel
read batches should be avoided until known returned sessions have been polled
and closed.

Safer pattern:
- Keep inspection batches smaller when many commands have already been run in
  the same thread.
- Prefer one focused command for related measurements instead of launching five
  separate `Measure-Object` processes.
- Immediately poll every returned session with `write_stdin` before launching
  another parallel batch.
- After the warning appears, use short sequential commands only; do not use
  `multi_tool_use.parallel` for shell reads until the live session count is
  known to be stable again.
- Treat repeat warnings as a process regression because the goal requires
  between-batch checkpoints, but those checkpoints should not flood the terminal
  process table.

### Nested `powershell -Command` Strips Or Reinterprets `$` Variables

When the Codex desktop `exec_command` call runs a command that itself starts with
`powershell -NoLogo -Command "..."`, unescaped PowerShell variables inside the
inner command can be consumed before the intended command runs. This showed up
while splitting spell mechanics review shards: `$span`, `$prop`, and `$_.level`
were stripped, producing parser errors such as `Missing variable name after
foreach`.

Safer pattern:
- Escape every PowerShell variable in the nested command with a backtick, such as
  `` `$span `` and `` `$_ ``.
- Keep the nested command short when possible.
- For larger data rewrites, prefer a small script file or another simple,
  reviewable execution path instead of a dense one-liner.

### JavaScript One-Liners Through Nested PowerShell Lose Their Quoting

Large `node -e` commands are fragile when passed through nested PowerShell
quoting. In this environment, JavaScript string quotes were stripped before Node
received the code, turning `require("fs")` into `require(fs)` and causing Node
syntax errors.

Safer pattern:
- Do not rely on dense `node -e` payloads for multi-step JSON rewrites.
- If a Node helper is needed, put it in a small temporary script or an existing
  project script, run it directly, then remove the temporary file.
- If staying in PowerShell, use native PowerShell JSON commands and escape `$`
  variables explicitly.

### Ripgrep Alternation Can Be Parsed As A PowerShell Pipeline

Patterns containing `|` can be interpreted as PowerShell pipelines when quoting
gets lost across nested command layers. This caused searches like
`MANUAL_REVIEW|ManualReview|loadManualReview` to attempt to execute
`ManualReview` as a command.

The same failure repeated during the spell level 4 mechanics pass with a search
pattern containing `on_start_turn|on_enter_area|first_per_turn`. PowerShell
attempted to run `on_enter_area` as a command and returned
`'on_enter_area' is not recognized as an internal or external command`.

The same failure repeated again while inspecting the level 4 manual-review
packet with `resolutionStatus|appendManualFindings|Manual`. PowerShell tried to
run `appendManualFindings` as a command before `rg` saw the full search pattern.

Another related quoting failure appeared with an `rg -n "bucketId"` search where
the nested quote layer was lost and PowerShell reported `The string is missing
the terminator: "`. Treat nested quoted `rg` commands as suspect when the command
already lives inside `powershell -NoLogo -Command "..."`.

Safer pattern:
- Prefer `Select-String -Pattern 'a','b','c'` for simple multi-pattern searches
  when nested PowerShell quoting is already involved.
- If using `rg`, keep the command at one shell layer and single-quote the pattern:
  `rg -n 'MANUAL_REVIEW|ManualReview|loadManualReview' scripts\file.ts`.
- When the quoting layer still misbehaves, avoid regex alternation entirely and
  use repeated `rg -e pattern1 -e pattern2 -e pattern3 ...` arguments.

Process regression:
- This issue repeated during the level 5 spell mechanics pass when a nested
  `rg -n -e '\"type\":  \"conditional\"' ...` search lost quoting and reached
  ripgrep as malformed regex text. The safer rule is to avoid nested `rg`
  searches containing escaped quote-heavy JSON snippets; use `Select-String
  -SimpleMatch` with a single shell layer, or inspect the specific validator
  file directly.
- This issue repeated again at the start of the level 6 spell mechanics pass
  with `rg -n "process\.argv|level|start|count|slice" ...`. The `|` characters
  were interpreted before ripgrep received the pattern, causing PowerShell to
  try to run `level` as a command. The safer rule is to use repeated `rg -e`
  arguments or inspect the known script directly when searching for several
  terms from Codex Desktop.
- This issue repeated during the level 6 Investiture packet when nested
  `rg` searches used alternation such as `"movementType": "speed_change"|...`
  and `"type": "MOVEMENT"|...`. One command failed in PowerShell with
  `The string is missing the terminator: '`, and another reached ripgrep as a
  malformed regex with `error: unrecognized escape sequence`. Treat quote-heavy
  JSON searches with alternation as unsafe in this runtime; use separate
  `rg -e` arguments, `Select-String -SimpleMatch`, or inspect known files
  directly.
- The level 6 Investiture packet then repeated the same failure with
  `Select-String -SimpleMatch` because the nested PowerShell command still
  contained single-quoted, backslash-escaped JSON snippets. PowerShell does not
  use backslash as a quote escape, so it reported `The string is missing the
  terminator: '`. Safer pattern: avoid quote-heavy JSON snippets in one-line
  nested PowerShell entirely; search for bare field names or inspect targeted
  files with `Get-Content`.
- This issue repeated during the level 7 packet when an `rg` search mixed
  multiple JSON field names with `|` alternation inside a nested PowerShell
  command. PowerShell split the pattern and tried to run `grantedActions` as a
  command. Safer pattern: use repeated `rg -e` arguments for each field name, or
  inspect targeted template files directly when searching JSON schema examples.
- A follow-up level 7 search still failed when quote-heavy JSON text was passed
  through `rg -e` inside nested PowerShell, producing an `unrecognized escape
  sequence` regex parse error. Safer pattern: do not search for quoted JSON
  fragments from nested one-liners; search bare tokens such as `SUMMONING` or
  read the specific files directly.
- This issue repeated again during a template-location lookup when `rg
  'template|schema'` was run through the Codex Desktop PowerShell layer. The
  alternation pipe was interpreted as a command separator and PowerShell tried
  to run `schema` as a command. Process regression: the documented no-pipe
  search rule was not followed. Safer pattern: use `rg -e template -e schema`
  or two separate searches.
- This issue repeated again during the spell mechanics action-phase sweep when
  `rg --files ... | rg -e 'bucket|BUCKET|schema|SCHEMA|actionable|ACTIONABLE'`
  was run through the Codex Desktop PowerShell layer. PowerShell split the
  alternation and tried to run `BUCKET` as a command. Process regression: the
  documented no-pipe alternation rule was not followed. Safer pattern: avoid
  piping into an alternation search; use a single `rg` with repeated `-e`
  patterns, or list files first and inspect specific known paths.
- This issue repeated during the cantrip sound-emission closure packet when an
  `rg` search tried to match JSON field names containing spaces. The quoting
  layer split the pattern and passed `Source` as a path, producing `rg: Source:
  The system cannot find the file specified`. Process regression: quote-heavy
  field-name searches are still unsafe in this runtime. Safer pattern: use a
  tiny Node helper to inspect JSON templates, or search for bare tokens with
  `Select-String` when spaces and punctuation are involved.
- This issue repeated during the spell mechanics closure phase when two exact
  finding ids were combined with `|` in one `rg -e` pattern. PowerShell treated
  the pipe as syntax before ripgrep could search and returned `The filename,
  directory name, or volume label syntax is incorrect.` Process regression: even
  finding-id searches must use separate `rg -e` arguments or separate commands
  when more than one id is needed.
- This issue repeated during the target-count scaling pass when a search for
  the quoted JSON key `"maxTargets":` lost its intended quoting and left `:` as
  a path-like token. Ripgrep returned `rg: :: The filename, directory name, or
  volume label syntax is incorrect.` Safer pattern: search for the bare token
  `maxTargets`, then inspect nearby lines with `Get-Content`, instead of using
  quote-plus-colon JSON fragments in `rg` one-liners.
- This issue repeated again in the level-3 target-count pass when an `rg -e`
  search tried to include escaped quoted JSON fragments such as `\"targeting\"`.
  Ripgrep received a malformed regex and returned `regex parse error: unclosed
  group`. Safer pattern: avoid escaped quoted JSON fragments in `rg` from Codex
  Desktop; search for bare keys or read the known JSON files directly.
- This issue repeated during the Absorb Elements mechanics slice when an `rg`
  search used one alternation pattern,
  `on_attack_hit_or_miss|ConditionalEnding|conditionalEndings`. PowerShell
  split the pipe and tried to execute `ConditionalEnding` as a command. Process
  regression: this runtime already documents that pipe alternation is unsafe.
  Safer pattern: use separate `rg -e on_attack_hit_or_miss -e ConditionalEnding
  -e conditionalEndings ...` arguments or run separate searches.
- This issue repeated during the Prayer of Healing target-participation slice
  when an `rg` search used `perTargetChoice|targetCluster|areaTargetSelection`
  as a single pattern. PowerShell split the pipe and tried to execute
  `targetCluster` as a command. Process regression: the documented no-pipe
  search rule was not followed. Safer pattern: use separate `rg -e
  perTargetChoice -e targetCluster -e areaTargetSelection ...` arguments.
- This issue repeated during the Phantom Steed conditional-ending slice when an
  `rg` search used `endCleanup|aftermath|grace|dismount|fade|...` as a single
  pattern. PowerShell split the pipe and tried to execute `aftermath` as a
  command. Process regression: the documented no-pipe search rule was not
  followed. Safer pattern: use repeated `rg -e endCleanup -e aftermath -e grace
  -e dismount -e fade ...` arguments or inspect the specific files directly.

### Nested PowerShell Commands Still Need Escaped Local Variables

The `$` variable stripping issue repeated during report inspection when this
shape was used inside a nested command:

`$r = Get-Content ... | ConvertFrom-Json; $r.rows | ...`

The outer PowerShell layer stripped `$r`, leaving a command that began with `=`
and later attempted to run `.rows` as a command.

Safer pattern:
- Escape local PowerShell variables inside nested commands, such as `` `$r `` and
  `` `$_ ``.
- If several local variables are needed, prefer a short script file or split the
  inspection into simpler commands.

### Nested Node Expressions Are Also Quote-Fragile

The same nested-shell problem repeated during the save-cover packet when this
shape was attempted:

`powershell -NoLogo -Command "node -p \"Object.keys(require('./path.json'))\""`

PowerShell consumed the inner quoting and tried to execute `require` as a
PowerShell command instead of passing it to Node.

Safer pattern:
- Do not run quote-heavy `node -p` or `node -e` snippets through nested
  PowerShell.
- Use a small temporary `.cjs` helper with comments, run it with `node`, then
  delete it after validation.
- Treat any recurrence as a process regression because this runtime already has
  a documented safer helper-script pattern.

### Windows PowerShell `Set-Content -Encoding UTF8` Can Add A BOM

Windows PowerShell 5.1 writes UTF-8 files with a leading byte-order mark when
using `Set-Content -Encoding UTF8`. Node's `JSON.parse` does not accept that
hidden character at the start of a JSON file. This broke the spell mechanics
discovery gate after creating split manual-review override shards with
PowerShell JSON commands.

Safer pattern:
- For persistent JSON that Node will parse, prefer a writer that emits UTF-8
  without BOM, or make the reader explicitly strip a leading `\uFEFF`.
- After using PowerShell to create JSON files, immediately rerun the relevant
  Node parser or validation gate instead of assuming the file encoding is safe.

### Broad `Select-String` Searches Over Spell JSON Can Flood Output

Searching all spell JSON files for a broad token such as `MOVEMENT` matched
common nested fields like `movementType` in nearly every effect, producing a
massive, low-signal terminal output during the level 5 mechanics pass.

Safer pattern:
- Search specific files first when looking for examples.
- Use narrower keys or line filters, such as a known spell id plus the field of
  interest, before widening to the whole corpus.
- Keep `-Context` small or omit it on corpus-wide searches, then inspect only
  the few concrete files that match.
- This issue repeated during the target-willingness action phase when a
  `Select-String` over a full manual-review shard included `resolutionStatus`
  as one of the patterns and returned more than a thousand low-signal lines.
  Process regression: the documented narrow-search rule was not followed. Safer
  pattern: inspect the exact spell/finding object with a JSON reader or search
  only for the unique finding id first.
- This issue repeated again during mechanics-closure report inspection when an
  `rg` search included the broad token `actionable_open` across the whole
  manual-review override tree. The command returned a large low-signal result
  instead of the two deferred-flavor rows being investigated. Process
  regression: broad status tokens should not be searched across all shards.
  Safer pattern: inspect the generated bucket file first, then search only for
  the exact finding ids that need action.

### Do Not Pipe Directly After A Nested `foreach` Statement

A Codex Desktop PowerShell inspection tried to emit objects from nested
`foreach` statements and then pipe the statement directly into `Format-List`.
PowerShell rejected the command with `An empty pipe element is not allowed`.

Safer pattern:
- Assign nested loop output to a variable first, then pipe that variable to
  formatting commands.
- For anything more complex than a quick inspection, use a small temporary
  helper script rather than compressing nested loops and formatting into one
  terminal line.

### Quote-Heavy `Select-String -Pattern` Commands Can Lose Their Terminator

During the spell mechanics closure pass, a `Select-String` command tried to mix
single quotes, escaped double quotes, and regex alternatives while searching for
Damage Type audit code. PowerShell rejected the command with `The string is
missing the terminator: "`.

This repeated during the Heroism follow-up sampling pass when an `rg` pattern
embedded Markdown backticks and pipe characters inside a PowerShell double-quoted
string. PowerShell rejected the command with the same missing-terminator error.
Process regression: table-pattern searches need to avoid backtick-heavy regex
inside PowerShell strings.

Safer pattern:
- Prefer `rg -n -e "pattern"` for simple source searches.
- When several alternatives are needed, pass them as separate `rg -e` patterns
  instead of packing quote-heavy regex into `Select-String -Pattern`.
- For Markdown tables, search a simple unique token first, such as
  `actionable_open`, then inspect the nearby lines with `Get-Content` or a
  small helper script instead of putting table punctuation into the search
  pattern.
- Treat repeat failures here as a process regression because this runtime already
  has documented quote-fragility issues.

### PowerShell Does Not Expand Native Globs For `rg` Path Arguments

During the spell mechanics closure pass, a command used
`docs\tasks\spells\mechanics-discovery\manual-review-overrides\level-4*.json`
as a path argument to `rg`. In this Windows PowerShell runtime, the glob was not
expanded before invoking `rg`, so ripgrep treated the literal `*` path as
invalid and returned `The filename, directory name, or volume label syntax is
incorrect.`

This repeated during the Tiny Servant multi-target scaling review when a command
used `public\data\spells\level-*` as an `rg` path argument. PowerShell again
passed the literal `*` path to ripgrep, producing the same filename/directory
error. Process regression: this was already documented and should be treated as
an active command constraint, not only as a note.

This repeated again during the Death Ward mechanics slice when a command used
`public\data\spells\level-*\death-ward.json` as an `rg` path argument. The
runtime produced the same invalid filename/directory error. Process regression:
the known native-glob limitation was not applied before launching the command.

This repeated again during the Polymorph conditional-ending slice when a command
used `docs\tasks\spells\mechanics-discovery\manual-review-overrides\level-4*`
as an `rg` path argument. Ripgrep received the literal wildcard path and
returned the same invalid filename/directory error. Process regression: the
known native-glob limitation was not applied; use `rg -g` or file discovery
before searching level-filtered shards.

Safer pattern:
- Search the containing directory with an exact finding id, for example
  `rg -n -C 3 -e "spell-id::bucket-id" docs\tasks\spells\mechanics-discovery\manual-review-overrides`.
- If file filtering is necessary, use `rg -g "level-4*.json" -n -e "pattern"
  <directory>` so ripgrep owns the glob instead of relying on PowerShell path
  expansion.
- Treat repeat failures here as a process regression because this runtime now
  has a documented native-glob limitation.

### Process Regression: Nested `foreach` Output Was Piped Again

During the spell mechanics closure phase after the schema modularization
checkpoint, a command again piped directly after nested `foreach` statements
while scanning manual-review overrides. PowerShell rejected it with
`An empty pipe element is not allowed.` This failure mode was already documented
for Codex Desktop, so the repeat is a process regression rather than a new
environment discovery.

Safer pattern:
- Assign nested-loop output to a variable first, for example `$rows = foreach
  (...) { ... }`, then pipe `$rows` to `Select-Object` or `Format-List`.
- Prefer this pattern for any manual-review JSON scan that needs nested file and
  property loops.

This repeated again during the end-cleanup consequence batch when counting
regenerated `conditional_ending` and `aftermath_or_memory` rows. The command
ended a nested `foreach` block and immediately piped it to `Format-Table`,
producing the same `An empty pipe element is not allowed` parser error. Process
regression: this failure mode was already documented and the safe variable-first
pattern should have been used before launching the command.

This repeated again during the glyph placement/trigger lifetime batch while
counting regenerated bucket summaries. The command ended a `foreach` block and
immediately piped it to `Format-Table`, producing the same parser error. Process
regression: use `$rows = foreach (...) { ... }` first, then pipe `$rows`.

### Process Regression: Broad Field Search Flooded Output Again

During the Suggestion conditional-ending review, a plain `rg -n -e
"\"sustainCost\"" public\data\spells` scan produced hundreds of matches and a
large truncated output block. The command did not fail, but it repeated the
known broad-output failure mode: the result was too noisy to guide the next
edit safely.

Safer pattern:
- When checking whether a field is widespread, count first with a narrow helper
  or `rg --count-matches` instead of printing every match.
- If examples are needed, cap them through a variable assignment and
  `Select-Object -First N`, or search one concrete spell file at a time.
- Treat repeated broad scans as process regressions because they slow the
  mechanics closure pass and obscure the relevant spell row.

### Process Regression: Markdown Backtick In Double-Quoted Search Pattern

During the Suggestion handoff update, an `rg` command included a Markdown
backtick inside a PowerShell double-quoted pattern while searching for
`conditional_ending`. PowerShell treated the backtick as an escape and reported
`The string is missing the terminator: "`. This repeats the already-known
quote-fragility pattern for Markdown/table searches.

Safer pattern:
- Search for a simple token without Markdown punctuation, such as
  `conditional_ending` without surrounding backticks.
- If Markdown punctuation is required, inspect the file with `Get-Content`
  slices instead of embedding backticks in a quoted search pattern.

### Mixed Directory And Hidden-Path `rg` Searches Can Fail Opaquely

During the spell mechanics closure pass, an `rg` command mixed multiple
mechanics-discovery directories with a specific hidden `.agent\...json` report
path in one invocation. Windows returned `The filename, directory name, or
volume label syntax is incorrect.` The same exact finding-id searches succeeded
when split into separate directory searches and a separate `.agent` file search.

Safer pattern:
- Keep exact finding-id searches scoped to one directory group or one concrete
  file at a time.
- Search generated docs and hidden `.agent` machine reports as separate commands.
- If this repeats, treat it as a process regression and split the command rather
  than trying to compress all report surfaces into one `rg` invocation.

### Process Regression: Parallel PowerShell Reads Can Linger As Open Exec Sessions

During the spell mechanics closure handoff update, multiple parallel read-only
PowerShell commands (`Get-Content`, `Select-String`, and line-count checks)
remained open past their short yield window and returned session ids instead of
immediate output. This contributed to the Codex Desktop unified exec process
limit warnings. The commands eventually drained cleanly, but the pattern is a
poor fit for this runtime when the thread is already near the process ceiling.

Safer pattern:
- Avoid `multi_tool_use.parallel` for routine PowerShell file reads in this
  thread while process-count warnings are active.
- Prefer one short command at a time with a longer yield window, then wait for it
  to exit before launching the next command.
- If a command returns a session id, drain it immediately with `write_stdin`
  before continuing.
- Treat repeated lingering read sessions as a process regression, not merely as
  harmless latency.

### Process Regression: Overpacked `rg` Pattern List Broke Quoting

During the glyph placement/trigger lifetime batch, an `rg` command tried to
combine several read-only pattern checks for duration vocabulary in one line.
One pattern included an escaped quote and the resulting command was parsed as a
malformed regular expression, producing `regex parse error` and a backreference
warning. The command was read-only and did not affect files, but it repeated the
known pattern that dense `rg` one-liners are fragile in this PowerShell runtime.

Safer pattern:
- Use one simple `rg -n -e ...` search at a time when the pattern contains
  quotes, punctuation, or schema snippets.
- Avoid packing several quote-heavy patterns into one command just to save a
  process.
- If the first search fails, switch immediately to simpler literal tokens or
  `Select-String` against a known file instead of trying to repair the dense
  command in place.

### PowerShell Treats `@{u}` As A Hashtable Unless Quoted

During the GitHub sync preparation, a command used `git rev-parse
--abbrev-ref --symbolic-full-name @{u}` directly in PowerShell. PowerShell
parsed `@{u}` as an incomplete hashtable literal and failed with `Missing '='
operator after key in hash literal.`

Safer pattern:
- Quote the upstream shorthand as `'@{u}'` when passing it to Git from
  PowerShell.
- For quick sync checks, prefer `git status -sb` when the upstream name itself
  is not needed.
- Treat this as another argument-token escaping issue rather than retrying the
  same Git command unquoted.

### Windows PowerShell 5.1 Does Not Support `&&` Command Chaining

During Dependabot alert remediation, a combined git command used `&&` between
`git fetch`, `git switch`, and `git pull`. Windows PowerShell 5.1 rejected the
separator with `The token '&&' is not a valid statement separator in this
version.`

Safer pattern:
- Run dependent git commands as separate terminal calls in this runtime.
- If a compact command is truly needed, use explicit PowerShell control flow
  after checking `$LASTEXITCODE`, but prefer separate commands for readability.
- Treat repeat use of `&&` here as a process regression because this shell is
  Windows PowerShell 5.1, not PowerShell 7.

### Process Regression: Bare `|` In A Multi-Pattern `rg` Command Became A Pipeline

During PR #927 CI triage, a workflow search command included a pattern like
`GEMINI_CLI_TRUST_WORKSPACE|skip-trust|gemini-review|gemini` without isolating
that alternation from PowerShell. PowerShell treated part of the expression as
a pipeline command and reported `'skip-trust' is not recognized as an internal
or external command`.

Safer pattern:
- Do not put regex alternation directly in PowerShell command text.
- Use separate `rg -e token` arguments for each token, or run several simple
  searches one at a time.
- When the target is known, search only the concrete directory/file and avoid
  clever combined patterns.

### Process Regression: Repeated Bare `|` In `rg` Search During PR #927 Fixes

During the PR #927 merge-readiness fix pass, the same PowerShell failure mode
repeated while searching for `TargetConditionFilter`, `communicationPrerequisites`,
and `willing`. The command embedded `interface TargetConditionFilter|type
TargetConditionFilter|communicationPrerequisites|willing` in the shell text, so
PowerShell again split it as a pipeline and tried to execute
`communicationPrerequisites` as a command.

Safer pattern:
- Treat any remembered `rg` alternation habit as unsafe in this runtime.
- Use `rg -n -e "TargetConditionFilter" -e "communicationPrerequisites" -e
  "willing" <paths>` instead of a single alternation string.
- If this failure mode appears again in the same goal, stop and simplify the
  search command before continuing with CI work.

### Junction Cleanup: `Remove-Item` Failed On Linked `node_modules`

During PR #927 clean-worktree verification, a temporary worktree used a Windows
junction from `F:\Repos\Aralia-pr927-verify\node_modules` to the main repo's
`node_modules`. `git worktree remove --force` could not delete the worktree
while the junction existed, and `Remove-Item -LiteralPath ... -Force` on the
junction failed with `Object reference not set to an instance of an object`.

Safer pattern:
- For temporary verification worktrees that link `node_modules`, remove the
  junction before removing the worktree directory.
- If PowerShell `Remove-Item` fails on a junction, use an explicit `cmd /c
  rmdir "<junction path>"` only for that known temporary junction path, then
  return to PowerShell `Remove-Item -Recurse -Force` for the temp worktree.
- Never run recursive cleanup until the resolved temp worktree path has been
  checked against the intended temporary directory.
