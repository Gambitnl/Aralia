#!/usr/bin/env bash

# This script prepares a newly created Aralia Codespace.
#
# GitHub runs it after mounting the repository. It installs the locked Node
# dependency tree and the pinned Python client required by Hero Lab. It does
# not run builds, generators, or remote model calls, so creating a Codespace
# cannot mutate game data or consume Hugging Face quota.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# npm ci follows package-lock.json exactly and refuses dependency drift. Audit
# reporting is left to Aralia's normal quality workflow rather than slowing
# every Codespace creation with a second registry pass.
npm ci --no-audit --no-fund

# Install the authenticated Gradio client in the non-root Codespaces account.
# Python dependencies remain separate from Aralia's browser/runtime bundle.
python -m pip install --user --disable-pip-version-check --requirement .devcontainer/requirements.txt

# Git preserves the executable bit, but chmod also repairs archives or Windows
# checkouts that arrived without it before being copied into a container.
chmod +x .devcontainer/post-create.sh .devcontainer/post-start.sh tools/creatureHero/run-hero-job.sh

# All generated Hero Lab candidates and server logs stay in ignored scratch
# storage until the operator deliberately promotes a reviewed asset.
mkdir -p .agent/scratch/codespaces .agent/scratch/hero-lab/jobs

printf '%s\n' 'Aralia Codespace dependencies are ready.'
