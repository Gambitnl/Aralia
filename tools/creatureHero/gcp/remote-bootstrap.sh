#!/usr/bin/env bash
# Runs ON the GPU VM. Expects HF_TOKEN in the environment (passed by
# gcp-convert.sh at invocation — never baked into this file).
set -euo pipefail

[ -n "${HF_TOKEN:-}" ] || { echo "HF_TOKEN not passed to the VM" >&2; exit 1; }

# newer DLVM images ship no conda — ensure python 3.12 (the MS wheels are cp312).
# Ubuntu 24.04 has 3.12 natively; 22.04 needs deadsnakes.
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
if ! command -v python3.12 > /dev/null; then
  sudo add-apt-repository -y ppa:deadsnakes/ppa > /dev/null
  sudo apt-get update -qq
fi
sudo apt-get install -y -qq python3.12 python3.12-venv python3.12-dev git-lfs > /dev/null

python3.12 -m venv "$HOME/trellis-env"
source "$HOME/trellis-env/bin/activate"
pip install -q --upgrade pip

git clone --depth 1 https://huggingface.co/spaces/microsoft/TRELLIS.2 /tmp/trellis2-space
echo "installing requirements (torch cu130 + prebuilt extension wheels)…"
pip install -q -r /tmp/trellis2-space/requirements.txt

cd /tmp/trellis2-space
PYTHONPATH=/tmp/trellis2-space python /tmp/run_trellis2.py
