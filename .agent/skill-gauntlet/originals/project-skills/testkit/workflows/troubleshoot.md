# Testkit: troubleshoot

Use with the superpowers:systematic-debugging skill — this file is the
browser-evidence half; that skill owns the hypothesis loop.

Input needed from the user (ask if missing): the URL or phase where the bug
shows, and what "broken" looks like.

## Checklist

1. Ensure the dev server is running (SKILL.md ground rule 1).
2. `new_page` (or `select_page`) to the target URL. Reproduce from a fresh
   navigation so the console buffer is fresh.
3. `list_console_messages` — record every error/warning verbatim.
4. `list_network_requests` — flag failed requests, 4xx/5xx, and missing chunks.
   `get_network_request` on anything suspicious.
5. Probe app state with `evaluate_script` (read-only probes; do not patch the
   page to "fix" it — fixes go in source).
6. Reproduce the interaction with `click` / `type_text` / `press_key`, watching
   the console between steps to bracket exactly which action triggers the error.
7. Suspected memory leak: `take_heapsnapshot` before and after the interaction,
   compare retained sizes, name the biggest growers.
8. `take_screenshot` of the broken state (fallbacks per ground rule 3).

## Output

Report: reproduction steps, verbatim error(s), the narrowed trigger, network
evidence, and the screenshot. Then hand back to systematic-debugging for root
cause — do not jump to a patch from symptoms alone.
