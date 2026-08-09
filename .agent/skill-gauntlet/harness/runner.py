#!/usr/bin/env python3
"""Gauntlet runner: fresh, isolated, model-pinned headless claude runs.

Every contestant, extractor, auditor, designer, and judge is one call to run().
Isolation: private CLAUDE_CONFIG_DIR (auth only), sandbox cwd outside the
Aralia repo with its own .git so project-scope walking stops there.
"""
import json, os, shutil, subprocess, sys, time, uuid

GAUNTLET = r"F:\Repos\Aralia\.agent\skill-gauntlet"
SANDBOX_ROOT = r"G:\Temp\skill-gauntlet"
CFG_CLEAN = os.path.join(GAUNTLET, "harness", "cfg-clean")


def new_sandbox(tag):
    d = os.path.join(SANDBOX_ROOT, f"{tag}-{uuid.uuid4().hex[:8]}")
    os.makedirs(d)
    subprocess.run(["git", "init", "-q"], cwd=d, check=True)
    return d


def install_skill(sandbox, skill_src, name=None, as_command=False):
    """Copy a skill dir (or a single command .md) into the sandbox project scope."""
    if as_command:
        dst = os.path.join(sandbox, ".claude", "commands")
        os.makedirs(dst, exist_ok=True)
        shutil.copy(skill_src, dst)
    else:
        dst = os.path.join(sandbox, ".claude", "skills", name or os.path.basename(skill_src))
        shutil.copytree(skill_src, dst)


def run(model, prompt, cwd, out_json, max_turns=16, timeout=1200, cfg=None, extra_args=None):
    """Run one fresh claude -p process. Returns parsed result dict."""
    cfg = cfg or CFG_CLEAN
    env = dict(os.environ)
    env["CLAUDE_CONFIG_DIR"] = cfg
    env.pop("CLAUDECODE", None)
    claude = shutil.which("claude") or "claude"
    cmd = [claude, "-p", prompt, "--model", model, "--output-format", "json",
           "--max-turns", str(max_turns), "--dangerously-skip-permissions"]
    if extra_args:
        cmd += extra_args
    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True,
                           text=True, encoding="utf-8", errors="replace", timeout=timeout)
        raw = p.stdout
    except subprocess.TimeoutExpired:
        raw = ""
    rec = {"model_requested": model, "cwd": cwd, "elapsed_s": round(time.time() - t0, 1)}
    try:
        d = json.loads(raw[raw.index("{"):])
        rec.update({
            "result": d.get("result"),
            "is_error": d.get("is_error"),
            "num_turns": d.get("num_turns"),
            "cost_usd": d.get("total_cost_usd"),
            "models_used": {k: v.get("canonicalModel") for k, v in d.get("modelUsage", {}).items()},
            "session_id": d.get("session_id"),
        })
        main = [v for k, v in rec["models_used"].items() if not k.startswith("claude-haiku")]
        rec["model_verified"] = (model in rec["models_used"]) or (model in main)
    except Exception as e:
        rec.update({"result": None, "is_error": True, "error": f"parse: {e}", "raw_tail": raw[-2000:]})
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(rec, f, indent=2)
    return rec


if __name__ == "__main__":
    # CLI: runner.py <model> <prompt-file> <cwd> <out-json> [max_turns]
    model, pf, cwd, out = sys.argv[1:5]
    mt = int(sys.argv[5]) if len(sys.argv) > 5 else 16
    prompt = open(pf, encoding="utf-8").read()
    r = run(model, prompt, cwd, out, max_turns=mt)
    print(json.dumps({k: r.get(k) for k in ("model_verified", "is_error", "num_turns", "cost_usd", "elapsed_s")}))
