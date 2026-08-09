"""The 10 gauntlet units. Paths point at the frozen originals snapshot."""
O = r"F:\Repos\Aralia\.agent\skill-gauntlet\originals"
REPO = r"F:\Repos\Aralia"

UNITS = {
    "vite-dynamic-import-config-deps": {
        "kind": "skill", "src": O + r"\user-skills\vite-dynamic-import-config-deps",
        "scope": "user", "live": r"C:\Users\Gambit\.claude\skills\vite-dynamic-import-config-deps",
        "evidence": [],
    },
    "codex-wtWaitFor-polling": {
        "kind": "skill", "src": O + r"\user-skills\codex-wtWaitFor-polling",
        "scope": "user", "live": r"C:\Users\Gambit\.claude\skills\codex-wtWaitFor-polling",
        "evidence": [],
    },
    "interview": {
        "kind": "command", "src": O + r"\project-commands\interview.md",
        "scope": "project-command", "live": REPO + r"\.claude\commands\interview.md",
        "evidence": [],
    },
    "ralph-loop": {
        "kind": "command", "src": O + r"\project-commands\ralph-loop.md",
        "scope": "project-command", "live": REPO + r"\.claude\commands\ralph-loop.md",
        "evidence": [],
    },
    "pickle-rick": {
        "kind": "command", "src": O + r"\project-commands\pickle-rick.md",
        "scope": "project-command", "live": REPO + r"\.claude\commands\pickle-rick.md",
        "evidence": [],
    },
    "conductor": {
        "kind": "command-family",
        "src": [O + r"\project-commands\conductor-setup.md", O + r"\project-commands\conductor-newtrack.md",
                O + r"\project-commands\conductor-implement.md", O + r"\project-commands\conductor-status.md",
                O + r"\project-commands\conductor-revert.md"],
        "scope": "project-command", "live": REPO + r"\.claude\commands",
        "evidence": ["FACT: the repo F:\\Repos\\Aralia contains NO conductor/ directory. The command family appears never adopted in this project."],
    },
    "gemini-interactions-api": {
        "kind": "skill", "src": O + r"\project-skills\gemini-interactions-api",
        "scope": "project", "live": REPO + r"\.claude\skills\gemini-interactions-api",
        "evidence": ["FACT: the live SKILL.md frontmatter contains 'disabled: true', yet the skill still surfaces in sessions."],
    },
    "aralia-roadmap-node-authoring": {
        "kind": "skill", "src": O + r"\project-skills\aralia-roadmap-node-authoring",
        "scope": "project", "live": REPO + r"\.claude\skills\aralia-roadmap-node-authoring",
        "evidence": ["Read-only context in the real repo: F:\\Repos\\Aralia\\public\\planmap\\ (the plan-map the skill feeds)."],
    },
    "agora-coordination": {
        "kind": "skill", "src": O + r"\project-skills\agora-coordination",
        "scope": "project", "live": REPO + r"\.claude\skills\agora-coordination",
        "evidence": ["Read-only context in the real repo: F:\\Repos\\Aralia\\tools\\agora\\AGENT.md, PROTOCOL.md, ORCHESTRATOR.md, client.mjs (the daemon protocol the skill fronts)."],
    },
    "testkit": {
        "kind": "skill", "src": O + r"\project-skills\testkit",
        "scope": "project", "live": REPO + r"\.claude\skills\testkit",
        "evidence": ["The skill's own workflows/ dir (troubleshoot.md, perf.md, smoke.md) is part of the skill.",
                      "FACT: it drives the chrome-devtools MCP against a live dev server; evals must therefore use sandboxed fixtures, not the live game."],
    },
}
