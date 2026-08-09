# Outcome Contract: preventing dev-server restarts caused by build-tool config dependencies

## 1. Purpose

A developer's dev server restarts every time they edit an ordinary source file, because that
file is reachable from the build tool's configuration module and is therefore treated as a
configuration dependency. Each restart destroys long-lived server-side state (terminal
sessions, socket connections, pooled handles) and interrupts work. The skill exists to make
the developer understand why this happens and to get their project to a state where editing
that file no longer restarts the server, while the file's functionality inside the server's
request handling continues to work unchanged.

## 2. Success

Observable from the outside, after the skill has been applied:

- Editing the previously-offending file produces no dev-server restart and no loss of
  server-side state; at most the normal, non-restart update behavior occurs.
- One restart immediately after the config file itself is edited is expected and acceptable;
  the verification is done on edits made *after* that restart settles.
- The functionality that the file provides to the server (route/request handling) still works
  identically — same responses, same behavior, no runtime resolution errors.
- The developer can tell, from the explanation given, which files are and aren't subject to
  this watching, including files reached indirectly through other imports.
- If the situation does not actually match the diagnosis, the developer is told that, rather
  than having an unnecessary change made.

## 3. Qualities ranked

1. **Correct diagnosis before action.** The whole value depends on identifying that the
   restart is caused by config-dependency watching, and that the module in question is only
   needed at request time rather than at configuration/startup time. Acting on a
   misdiagnosis changes working code for no benefit.
2. **Behavioral preservation.** The fix must not alter what the server does. A silenced
   restart with a broken or intermittently failing route is a worse outcome than the original
   problem.
3. **Verifiability.** The result must be checkable by the developer with a concrete
   observation, and the expected one-off restart must be called out so a correct fix isn't
   mistaken for a failed one.
4. **Explanation of the underlying mechanism.** The owner cares that the developer learns the
   general rule (config-reachable files are watched; watching is transitive; this is distinct
   from browser-side hot updates) so they can recognize and handle recurrences themselves.
5. **Minimality and low cost.** The change should be confined to the config file and its
   handler(s), and should not introduce meaningful runtime overhead or restructuring beyond
   what removing the dependency requires.
6. **Consistency with the project's existing conventions** in the config file, so the result
   reads as if it had always been written that way.

## 4. Hard constraints

- The end state must genuinely remove the file from the config's dependency graph — not
  merely suppress, filter, or ignore the restart symptom. (The owner's requirement is
  specifically that the dependency relationship no longer exists, which constrains the class
  of acceptable methods: the module must be loaded lazily at request time rather than at
  configuration load time. The exact syntax and structure used to achieve this is not part of
  the requirement.)
- The technique is only valid for modules whose values are needed at request-handling time.
  Anything the configuration itself needs while being constructed must remain a normal
  eager dependency.
- Any handler converted to load its dependency lazily must be made capable of awaiting that
  load, and must remain compatible with the server's handler contract.
- Module resolution must succeed at runtime in the dev-server environment — the reference to
  the deferred module has to match the resolution conventions already in use in that config.
- Transitive reachability must be accounted for: relocating one import is insufficient if the
  file is still reachable through another chain.
- The verification step is part of the deliverable, not optional; the developer must be given
  the before/after signal to look for, including the expected single restart from editing the
  config itself.
- Repeated request handling must not pay a significant repeated cost for the deferred load;
  relying on the runtime's module caching is acceptable and expected.

## 5. Must never

- Leave the server's behavior changed, broken, or failing on some requests.
- Claim success without a stated way to observe it, or report the unavoidable
  config-edit restart as evidence that the fix failed or as evidence that it worked.
- Address the symptom by disabling watching wholesale, muting logs, or otherwise degrading
  the dev server's legitimate reload behavior for other files.
- Defer a module that the configuration genuinely needs during its own construction, thereby
  producing an invalid or non-deterministic configuration.
- Perform sweeping refactors of the config, the target file, or unrelated code under cover of
  this fix.
- Present the change as affecting browser-side hot-update behavior, or otherwise conflate the
  two mechanisms.
- Apply the change when the reported restarts have a different cause.

## 6. Activation boundary

**Should trigger when** a developer is working on a project whose dev server restarts on
changes to a file, and the evidence points at the build tool's configuration dependency
graph: restart messages naming a source file rather than the config; edits to a utility or
logic file killing the dev server or the stateful processes attached to it; or a file that is
imported eagerly by the config yet only actually used inside request handling. It also
applies when the developer asks why config-reachable files are watched or how to opt a file
out of that watching.

**Must stay silent when** the restarts or reloads have another cause (config file itself
edited, watcher/env/plugin configuration, dependency installs, process crashes); when the
concern is browser-side hot module updates or client build behavior; when the module in
question is required while the configuration is being built; when the project does not use a
build tool with this configuration-dependency watching behavior; or when the topic is general
dev-server performance rather than this specific restart cause.
