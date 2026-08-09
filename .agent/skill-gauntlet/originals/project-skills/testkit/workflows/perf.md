# Testkit: perf

Measure one named surface. Ask the user which if not given. Canonical surfaces
and how to reach them:

| Surface | URL |
|---------|-----|
| atlas | `?phase=worldforge` |
| world3d | `?phase=world3d` |
| combat | `?dummy=1&dev_combat=1` (fresh page/context; one-shot per session) |
| townpreview | wf-town3d design preview |

## Checklist

1. Ensure the dev server is running; open the surface in a fresh page and wait
   for its rendered-ready marker. This warm-up is not part of the measurement.
2. For a load trace, call `performance_start_trace(reload=false, autoStop=false)`,
   then explicitly reload with `navigate_page(type=reload, timeout=120000)` and
   wait for the same rendered-ready marker before stopping. Do not use
   `performance_start_trace(reload=true)` on a heavy dev page: its fixed short
   navigation timeout can abort while leaving a polluted recording active.
   For an interaction trace, start without reload after the warm-up.
3. Drive the representative interaction (pan/zoom the atlas, run a combat
   round, walk the 3D scene) with `click` / `press_key`.
4. `performance_stop_trace`, then first reject a trace that contains multiple
   page navigations or unrelated HMR reloads. Treat that as churn evidence, not
   as a performance measurement. For a clean trace, run
   `performance_analyze_insight` on the insights
   the trace summary lists. Record: LCP (load traces), total long-task time,
   and the top insight findings.
5. Heap delta: `take_heapsnapshot` before the interaction and after; record
   both sizes in MB. Growth after the scene is settled = leak candidate.
6. 2D surfaces only (atlas, planmap, dev hub): run lighthouse_audit and record the category scores it returns (accessibility, best practices — it excludes performance scoring; performance numbers come from the trace in steps 2–5).
7. Write the numbers into the run JSON (shape in SKILL.md) at
   `.agent/testkit/last-perf.json`, then:
   `node tools/testkit/baseline.mjs .agent/testkit/last-perf.json`
8. Report the baseline diff output verbatim, plus your reading of the top
   insight. `--promote` only with user sign-off.

## Notes

- One surface per trace. Traces on the 3D world are heavy; keep interactions
  short (10–20 s).
- If a trace command aborts, stop and discard that recording before retrying;
  never append a second navigation to an unknown active trace.
- Do not run Lighthouse on WebGL surfaces; its metrics are meaningless there.
