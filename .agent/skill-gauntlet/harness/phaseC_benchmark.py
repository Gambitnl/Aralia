#!/usr/bin/env python3
"""Phase C: independent benchmark design from the frozen contract only.
Phase D: independent benchmark audit, fix, freeze, split iteration/sealed."""
import os, sys, shutil, json
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import runner
from units import UNITS

G = r"F:\Repos\Aralia\.agent\skill-gauntlet"

DESIGN = """You are an independent benchmark designer. You have NOT seen the skill implementation you are benchmarking — only its outcome contract, in `contract.md`. Do not guess or reconstruct implementation details; test outcomes.

Design a benchmark of exactly 8 tasks for a Claude Code agent, testing the full contract: ordinary use, difficult situations, edge cases, realistic variations, and the activation boundary (include at least 1 task where the capability must correctly stay silent / not fire). Tasks must be executable by a headless coding agent inside an empty sandbox git repo with standard file tools and NO network, NO live services, NO MCP servers, NO running dev processes. When a task needs an environment (config files, a small repo, logs, a transcript), specify every fixture file inline. The contestant also runs NON-INTERACTIVELY: no human can answer questions mid-run, so a task may test how well the agent elicits or proceeds without answers, but must not require live human replies to be completable.

Write `benchmark.json` in your working directory:
{
  "tasks": [
    {
      "id": "T1",
      "kind": "ordinary|hard|edge|variation|activation-negative",
      "prompt": "<exact text the contestant agent receives — realistic user phrasing, no mention of skills, benchmarks, or evaluation>",
      "fixtures": {"relative/path.ext": "<full file content>", ...},
      "packet": {
        "situation": "<what the user asked, restated for a judge>",
        "contract_extract": "<the parts of the contract that bear on this task>",
        "invariants": ["<objective facts a correct result must satisfy>"],
        "priorities": "<which qualities dominate when results differ>",
        "disqualifiers": ["<failures that void an answer>"]
      }
    }, ...
  ]
}

Rules:
- Realistic: prompts a real user in a real repo would plausibly type.
- Solvable: a strong agent with the right knowledge can succeed inside the sandbox; nothing requires live infrastructure.
- No leakage: packets describe success, never a gold answer to copy, and never wording that fingerprints any particular implementation.
- Where multiple good answers exist, the packet defines success criteria, not one blessed output.
- Fixtures must be complete and internally consistent.
Write ONLY benchmark.json (valid JSON, no markdown fences)."""

BENCH_AUDIT = """You are an independent benchmark auditor. `contract.md` is a frozen outcome contract; `benchmark.json` is a proposed 8-task benchmark for it (fixtures + judge packets).

Audit for: coverage gaps against the contract, unrealistic tasks, unsolvable-in-sandbox tasks (they run with no network, no live services, no MCP), leakage of gold answers into packets, redundant tasks, leading or biased judging criteria, and any accidental bias toward one hypothetical implementation style.

Fix what you find DIRECTLY: write `benchmark-fixed.json` (same schema, still exactly 8 tasks, replace or repair weak tasks) and `bench-audit.md` listing each finding and what you changed. Write ONLY those two files."""


def design(uid):
    out = os.path.join(G, "skills", uid, "bench")
    os.makedirs(out, exist_ok=True)
    contract = os.path.join(G, "skills", uid, "contract", "FROZEN-contract.md")
    sb = runner.new_sandbox("bench-" + uid[:18])
    shutil.copy(contract, os.path.join(sb, "contract.md"))
    runner.run("claude-opus-5", DESIGN, sb, os.path.join(out, "design-run.json"),
               max_turns=30, timeout=1800)
    bj = os.path.join(sb, "benchmark.json")
    if not os.path.exists(bj):
        return uid, "NO-BENCH"
    shutil.copy(bj, os.path.join(out, "benchmark-draft.json"))
    # audit stage
    sb2 = runner.new_sandbox("baud-" + uid[:18])
    shutil.copy(contract, os.path.join(sb2, "contract.md"))
    shutil.copy(bj, os.path.join(sb2, "benchmark.json"))
    runner.run("claude-opus-5", BENCH_AUDIT, sb2, os.path.join(out, "audit-run.json"),
               max_turns=30, timeout=1800)
    fixed = os.path.join(sb2, "benchmark-fixed.json")
    if os.path.exists(os.path.join(sb2, "bench-audit.md")):
        shutil.copy(os.path.join(sb2, "bench-audit.md"), out)
    final = fixed if os.path.exists(fixed) else bj
    try:
        tasks = json.load(open(final, encoding="utf-8"))["tasks"]
    except Exception as e:
        return uid, f"BAD-JSON: {e}"
    # split: sealed = 3 tasks spread across kinds (indices 2,5,7 after sort stability)
    sealed_ids = [t["id"] for t in tasks[2::3]][:3]
    it_dir, sl_dir = os.path.join(out, "iteration"), os.path.join(out, "sealed")
    os.makedirs(it_dir, exist_ok=True); os.makedirs(sl_dir, exist_ok=True)
    for t in tasks:
        d = sl_dir if t["id"] in sealed_ids else it_dir
        json.dump(t, open(os.path.join(d, t["id"] + ".json"), "w", encoding="utf-8"), indent=2)
    json.dump({"frozen": True, "iteration": [t["id"] for t in tasks if t["id"] not in sealed_ids],
               "sealed_count": len(sealed_ids),
               "kinds": {t["id"]: t.get("kind") for t in tasks}},
              open(os.path.join(out, "FROZEN-benchmark-manifest.json"), "w"), indent=2)
    return uid, "FROZEN(%d iter/%d sealed)" % (len(tasks) - len(sealed_ids), len(sealed_ids))


if __name__ == "__main__":
    todo = sys.argv[1:] or list(UNITS)
    with ThreadPoolExecutor(max_workers=3) as ex:
        for uid, status in ex.map(design, todo):
            print(json.dumps({"unit": uid, "bench": status}))
