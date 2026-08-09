# Outcome Contract: keeping ordinary source edits from restarting a dev server

## 1. Purpose

A developer edits what they consider an ordinary source file and the dev server performs a
full restart of its process — not a reload, not a re-evaluation of one module, but a teardown
and relaunch. It happens because the file is reachable from the build tool's configuration
module, and the tool watches everything the configuration depends on. Because the process is
replaced, whatever it was holding — in memory, or open over the wire — goes with it, and the
developer loses their place.

The skill exists so the developer understands why the tool treats that file as a configuration
dependency, and so the project reaches a state where editing that file no longer restarts the
server, with the file's role in the server's request handling unchanged.

## 2. Success

Observable from the outside, after the skill has been applied:

- Editing the previously-offending file causes no server restart and no loss of server-held
  state. The tool may report a non-restart update, or report nothing at all — silence is an
  equally correct result, not a failed observation.
- Editing the configuration itself still restarts the server once. That restart is expected;
  the check above is made on edits after it has settled.
- The file is genuinely absent from the configuration's dependency graph: the restart stops
  because the dependency is gone, not because the signal was hidden.
- What the file does for the server is unchanged — same responses, no new runtime errors, no
  requests that fail only some of the time.
- The developer can say which files the tool watches this way and which it does not, including
  files reached only through a chain of imports, and can tell this server-side watching apart
  from the tool's browser-facing update mechanism.
- That explanation is anchored in the build tool's own documentation of this behavior, and the
  developer is left holding a pointer to it.

## 3. Qualities ranked

1. **Behavioral preservation.** The server must keep doing exactly what it did. A quiet
   watcher bought with a broken or flaky route has not solved the developer's problem.
2. **Explanation of the mechanism.** A co-equal deliverable with the fix, not a garnish: the
   developer should leave able to recognize the same situation elsewhere and handle it
   themselves, which means understanding the rule, its transitivity, and its distinctness from
   browser-side hot updates.
3. **Verifiability.** The result must be checkable by the developer through a concrete
   observation, with the expected one-off restart called out so a correct fix is not mistaken
   for a failed one.
4. **Applied only where it applies.** The premise — that this tool restarts on configuration
   dependency changes, and that this file is why — has to hold before anything is changed.
   Acting on a misreading edits working code for nothing.
5. **Minimality and low cost.** The change should be no larger than removing the dependency
   requires, with a blast radius bounded to what that removal touches.
6. **Consistency with the project's existing conventions**, so the result does not read as
   foreign to the code around it.

## 4. Hard constraints

- **The end state is the requirement:** the file is no longer part of the configuration's
  dependency graph, and editing it no longer restarts the server. Suppressing, filtering,
  ignoring, or muting the restart does not satisfy this — the dependency relationship itself
  must be gone. How that end state is reached is not part of the requirement.
- Only files whose values the configuration does not need while constructing itself are
  eligible. Anything the configuration reads or calls in order to produce itself must remain a
  normal, eagerly-resolved dependency.
- Transitive reachability counts. The file must be unreachable from the configuration through
  every chain, not only through the one that was most visible.
- Whatever changes, the server's request handling must keep working: every module it needs must
  still resolve at runtime, and if the approach alters a handler's shape or timing, that handler
  must remain compatible with the server's handler interface.
- The verification is part of the deliverable, not optional. The developer must be told what to
  look for before, what to look for after, and that editing the configuration itself accounts
  for one restart.
- The explanation must be grounded in the tool's documented behavior rather than asserted, and
  must leave the developer with the reference.
- The diagnosis must be established before any change: that this tool restarts on configuration
  dependency changes, and that this file is the cause. If it does not hold, say so instead of
  changing working code.

*Note, not a constraint:* whatever approach is taken is expected to add no meaningful
per-request overhead. An approach that would measurably slow request handling is a reason to
reconsider the approach, not a threshold the result is tested against.

## 5. Must never

- Leave the server's behavior changed, broken, or failing on some requests.
- Claim success with no stated way to observe it, or present the configuration-edit restart as
  evidence that the fix failed.
- Buy the quiet by disabling watching, excluding the file from the watcher, or muting the log —
  degrading the dev server's legitimate reload behavior for everything else.
- Apply this to a value the configuration itself needs while being constructed, producing an
  invalid or order-dependent configuration.
- Restructure the configuration, the target file, or unrelated code beyond what removing the
  dependency requires.
- Present the change as affecting browser-side hot updates, or blur the two mechanisms together.
- Apply the change when the restarts have a different cause.

## 6. Activation boundary

**Should trigger when** a dev server restarts on edits to a file the developer regards as
ordinary source, and the configuration's dependency graph is the plausible route — the tool
names that file as the reason it is restarting, or the file is pulled in by the configuration
yet only exercised while requests are being handled. It also applies when the developer asks
why editing such a file restarts the server, or how to get a file out of the watched set.

**Must stay silent when** the restart has another cause: the configuration itself was edited,
watcher/environment/plugin settings, a dependency install, a crash. Also when the subject is
browser-side hot updates or client build output; when the configuration needs the module's
value in order to construct itself; when the tool does not watch its configuration's
dependencies at all; or when the question is dev-server speed in general.
