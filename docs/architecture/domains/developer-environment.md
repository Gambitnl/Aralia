# Developer environment

Verified: 2026-08-21

Aralia supports local Windows development and GitHub Codespaces. Both run the
same Vite application and dev-only Hero Lab API. Codespaces is an optional
development workspace. It does not replace GitHub Pages for public deployment
or Hugging Face for TRELLIS model generation.

## Codespaces setup

The repository configuration is in `.devcontainer/`. A new Codespace uses Node
22 and Python 3.11, installs dependencies from `package-lock.json`, installs the
pinned Gradio client, starts Vite on port 3000, and forwards that port privately.

Before creating the Codespace, add a Codespaces secret named `HF_TOKEN` and
grant it access to the Aralia repository. The secret must be a Hugging Face token
that can call the hosted `microsoft/TRELLIS.2` Space. The name does not start with
`VITE_`, so Vite does not copy it into browser code.

Create the Codespace from GitHub using **Code -> Codespaces -> New with options**.
The advanced creation screen shows the recommended `HF_TOKEN` secret when it is
not already associated with the repository. After startup, open forwarded port
3000 and navigate to `/Aralia/misc/design.html?step=herolab`.

GitHub reads this configuration from the branch used to create the Codespace.
Local configuration changes therefore become available only after they are
committed and pushed to that branch.

## Hero Lab execution boundary

Windows uses `tools/creatureHero/run-hero-job.ps1` and reads the token from
Windows Credential Manager. Linux and Codespaces use
`tools/creatureHero/run-hero-job.sh` and read GitHub's injected `HF_TOKEN`
environment variable. Both launch the same `convert.py` and `optimize.mjs`
pipeline, restrict candidate files to `.agent/scratch/hero-lab/jobs`, and leave
promotion as a separate confirmed action.

Codespaces does not need a GPU. It sends the reference image to the hosted
TRELLIS Space, downloads the master GLB, and performs Aralia's triangle-budget
optimization on the Codespaces CPU.
