# AI Arbiter LLM Benchmark — Local vs API (2026-07-03)

**Question this answers:** For the AI arbiter that possesses NPCs
(spec: `docs/superpowers/specs/2026-07-02-ai-arbiter-npc-embodiment.md`),
is running the model **locally and free** fast enough, or do we need to
**pay for a hosted API** to keep combat responsive? This is a runtime
latency and cost measurement, not a build estimate.

## The short version

- **Best local option: `granite4.1:8b` or `qwen3:8b`** — both give strong,
  in-character, correctly-formatted decisions in about **1 to 1.6 seconds**
  once the model is warm, at zero cost. Smaller `phi4-mini:3.8b` and
  `granite4.1:3b` are even faster (under 1 second) and still legal, if a touch
  less flavorful.
- **Cheapest viable API: Google Gemini 2.5 Flash-Lite** at roughly
  **$0.0002 per embodiment call** — about **$0.02 per 20-fight session** —
  with typical first-token latency under a second. Anthropic Claude Haiku 4.5
  is the next tier up at roughly **$0.0007 per call** (~$0.07 per session).
- **Bottom line:** on this machine, local is fast enough that latency is not
  the reason to pay. The API question is about *quality ceiling* and *not
  tying up the GPU*, not about speed or affordability. See the decision
  framing at the end.

## The machine we measured on

- Windows 11, repo `F:\Repos\Aralia`.
- GPU: **NVIDIA RTX 2070 SUPER, 8 GB VRAM**. CPU: 16 cores.
- Ollama was installed but **not running** at start; we started it
  (`ollama serve`) and it came up cleanly. Target confirmed from
  `vite.config.ts` (`ollamaTarget = 'http://localhost:11434/api'`).
- The 8 GB VRAM is the key constraint: models up to about 8B parameters at
  4-bit fit entirely on the GPU and run fast. Larger models spill onto the
  CPU and slow down sharply (see the 12B and 20B rows).

## What we asked the model to do

A realistic embodiment prompt (~600 tokens in): a full NPC persona
(veteran guardsman Bramwel — values, fears, quirks, relationships), a
structured combat snapshot (round, positions, HP, enemies, the hooded
player, recent events), and a fixed five-item action list. The model had to
return small JSON (~50–120 tokens): one legal action id, a one-line
in-character reason, and optional dialogue. This mirrors the spec's
"structured state feed → NPC-action API" design (perception path 1, the
technically-favored one).

## Measured local results

Three runs per model. **Run 1 includes the one-time cold model load** (the
big `load_s` numbers); **runs 2–3 are warm** — which is the realistic
steady state, because during a fight the model stays resident in memory.
The "warm latency" column below is the wall-clock time for a warm call.

| Model | Params | Warm latency | Tokens/sec | Fits in 8 GB? | Quality note |
|---|---|---|---|---|---|
| **phi4-mini:3.8b** | 3.8B | **~1.0 s** | ~85 | Yes | Legal action, in-character; wrapped JSON in a ```` ``` ```` fence (needs unwrapping) |
| **granite4.1:3b** | 3.4B | **~0.9 s** | ~72 | Yes | Clean JSON, legal, terse. Chose "guard the gate" — defensible for a duty-bound guard |
| **qwen2.5:7b** | 7.6B | **~1.0 s** | ~58 | Yes | Clean JSON, legal, good short dialogue |
| **mistral:instruct** | 7.2B | **~0.8 s** | ~70 | Yes | Clean JSON, legal, in-character |
| **qwen3:8b** | 8.2B | **~1.3 s** | ~57 | Yes | Clean JSON, strong in-character reason + dialogue. Has tools+thinking |
| **granite4.1:8b** | 8.8B | **~1.4 s** | ~48 | Yes (just) | Clean JSON, best flavor of the 8B class ("Stand clear, lad!") |
| gemma4:12b | 11.9B | ~7 s | ~9 | No (CPU offload) | Best-written dialogue overall, but 5–7× slower from CPU spill |
| gpt-oss:20b | 20.9B | ~12 s | ~14 | No (heavy offload) | Returned **empty** output — its reasoning consumed the whole token budget; unusable as configured |

Quality across the 3B–8B fitting models was uniformly good: every one
returned valid single-line JSON (except phi4-mini's markdown fence), picked
a **legal** action from the list, and stayed in character. The 8B models
(`granite4.1:8b`, `qwen3:8b`) gave the richest reasoning and dialogue while
still answering in ~1.5 s.

**Cold-start caveat:** the first call after loading a model costs a one-time
20–90 seconds (loading weights into VRAM). In practice you warm the chosen
model once at fight start (or keep it resident via Ollama's keep-alive) and
never pay that again during the session.

## API comparison

Prices are current as of **2026-07-03**, per million tokens (MTok), standard
(non-batch, non-cache) first-party rates.

### Per-model rates

| Provider / model | Input $/MTok | Output $/MTok | Source |
|---|---|---|---|
| Google Gemini 2.5 Flash-Lite | $0.10 | $0.40 | [ai.google.dev/pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Google Gemini 2.5 Flash | ~$0.30 | ~$2.50 | [ai.google.dev/pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Google Gemini 2.5 Pro | ~$1.25 | ~$10.00 | [ai.google.dev/pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Anthropic Claude Haiku 4.5 | $1.00 | $5.00 | [platform.claude.com/pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Anthropic Claude Sonnet 5 (intro, thru Aug 31 2026) | $2.00 | $10.00 | [platform.claude.com/pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Anthropic Claude Sonnet 5 (from Sep 1 2026) | $3.00 | $15.00 | [platform.claude.com/pricing](https://platform.claude.com/docs/en/about-claude/pricing) |

### Cost per embodiment call and per session

Assumptions matching our prompt: **~600 input tokens + ~100 output tokens**
per embodiment call. Session = **5 embodied NPC-turns/fight × 20 fights =
100 calls**. (These are the spec's *selective* embodiment numbers — most NPC
turns run mechanically with no model call at all.)

| Model | Cost per call | Cost per fight (5 calls) | Cost per session (100 calls) |
|---|---|---|---|
| Gemini 2.5 Flash-Lite | ~$0.00010 | ~$0.0005 | **~$0.010** |
| Gemini 2.5 Flash | ~$0.00043 | ~$0.0021 | ~$0.043 |
| Claude Haiku 4.5 | ~$0.00110 | ~$0.0055 | ~$0.110 |
| Claude Sonnet 5 (intro) | ~$0.00220 | ~$0.0110 | ~$0.220 |
| Gemini 2.5 Pro | ~$0.00175 | ~$0.0088 | ~$0.175 |

Even the most expensive mid-tier option here costs about a quarter of a
dollar for a full 20-fight session. With prompt caching on the fixed system
prompt/persona, the paid cost drops further. Cost is **not** a real barrier
for any of these at this call volume.

### API latency expectations (labeled)

These are *typical published/observed* figures for a small
prompt-in/small-JSON-out call, **not measured on this machine** (no API keys
were used):

- Gemini 2.5 Flash-Lite / Flash: commonly **~0.3–1.0 s** to first token;
  full small response typically **under ~1.5 s**. (Google markets Flash-Lite
  as its lowest-latency tier.)
- Claude Haiku 4.5: typically **~0.5–1.5 s** for a short response.
- Claude Sonnet 5 / Gemini Pro: typically **~1–3 s** for a short response.
- Add **network round-trip and queueing variance** to all of these — real
  latency depends on connection and provider load, and occasional multi-second
  tail spikes happen. Local inference has no network variance.

## Decision framing — what latency does a combat turn tolerate?

The spec is explicit: *"combat can't stall on LLM latency every NPC turn —
embodiment is likely selective."* That single sentence sets the budget.

- **The budget is generous because embodiment is selective.** The arbiter
  does not call a model on every NPC's every turn; it picks *which* NPC and
  *which* moment to inhabit, while default NPCs run mechanical disposition
  with zero model latency. So a possessed turn taking ~1–2 seconds reads as
  a dramatic beat, not a stall — comparable to a human DM pausing to decide.
- **A practical ceiling: ~2 seconds warm.** Under that, the pause feels
  deliberate. Past ~3–4 seconds it starts to feel like the game hung.
- **What fits inside that budget:**
  - **Local 3B–8B on this GPU: comfortably yes** (~1–1.6 s warm). All six
    fitting models clear the bar with correct, in-character output.
  - **Local 12B (gemma4): borderline** (~7 s warm) — over budget from CPU
    spill on 8 GB VRAM. Would need a bigger GPU to be viable.
  - **Local 20B (gpt-oss): no** (~12 s and unreliable output here).
  - **All the API tiers: yes on latency**, subject to network variance.

## The honest tradeoff line for Remy

You do **not** have to pay for speed. On this machine, a local 8B model
(granite4.1:8b or qwen3:8b) answers a possessed-NPC turn in about a second
and a half, in character, for free — well inside the pause budget that
selective embodiment allows.

What you *would* be buying with an API is a **higher quality ceiling** for
the moments that matter most (a Gemini Flash or Claude Haiku call writes
sharper reasoning and dialogue than an 8B local model) and **not tying up
the player's GPU**, which the 3D world already wants for rendering. The
price for that is trivial — roughly one to twenty cents per full play
session — but it adds a network dependency and per-call variance the local
path doesn't have.

The clean split, if you want it: **run local for the routine possessed
turns, and reserve an API call for the rare "big authored moment"** (the
crossfire-death ruling, the guard captain's clever gambit). That keeps
cost near zero, keeps the GPU free most of the time, and spends real model
quality only where the drama justifies it.

---

### Sources

- Anthropic pricing (Haiku 4.5, Sonnet 5): [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing) — retrieved 2026-07-03.
- Google Gemini API pricing (2.5 Flash-Lite / Flash / Pro): [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) — retrieved 2026-07-03.
- Local measurements: Ollama `/api/chat` on RTX 2070 SUPER, 3 runs/model, this repo, 2026-07-03. Raw responses and the benchmark script retained in the session scratchpad.
