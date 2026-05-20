# Local LLM Model Routing — Reference

Recommendation spec for routing Aralia's Ollama tasks across a small fleet of
local models on a 32 GB RAM / RTX 2070 SUPER 8 GB box. Treated as the source
of truth for the model router implemented under `src/services/ollama/`.

> Captured 2026-05-19. Update this doc when the routing table, default params,
> or model lineup changes.

---

## Guiding principles

Model choice should be driven less by benchmark scores and more by runtime
behavior. For Aralia we want models that are:

- Fast enough for repeated calls during play
- Good at short, flavorful prose
- Reliable with structured JSON
- Not too "helpful assistant" in tone
- Not constantly overthinking
- Able to summarize conversation state cleanly

**Do not use one model for all of this.** Use a small router with 2–4 local
models, each handling a category they're best suited for.

---

## Model stack

| Role | Model | Use it for |
|---|---|---|
| Main gameplay brain | `granite4.1:8b-q4_K_M` | Oracle responses, situation analysis, social outcome framing, structured guidance |
| Fast utility model | `granite4.1:3b-q6_K` *or* `phi4-mini:3.8b-q4_K_M` | Names, loot dressing, tile details, short summaries, quick suggestions |
| Narrative / dialogue model | `adi0adi/ollama_stheno-8b_v3.1_q6k` | Companion banter, NPC replies, gossip, emotional reactions |
| Fallback general model | `qwen3:8b-q4_K_M` *or* `llama3.1:8b-instruct-q4_K_M` | General-purpose testing baseline |
| Optional richer model | `qwen3.5:9b-q4_K_M` | Better "smart" generation, but close to VRAM comfort limit |

**Why this split:** Granite/Qwen/Llama are better behaved for instructions and
JSON. Stheno-like RP models are better for in-character flavor. Mixing those
responsibilities gives better game output than trying to force one model to be
both a prose gremlin and a rules clerk.

### Models to pull first

```sh
ollama pull granite4.1:8b-q4_K_M
ollama pull granite4.1:3b-q6_K
ollama pull qwen3:8b-q4_K_M
ollama pull phi4-mini:3.8b-q4_K_M
ollama pull adi0adi/ollama_stheno-8b_v3.1_q6k
```

Optional:

```sh
ollama pull qwen3.5:9b-q4_K_M
ollama pull gemma3:4b-it-q4_K_M
```

### Model notes

- **`granite4.1:8b-q4_K_M`** — 5.3 GB, text-only, 128K advertised context. Better
  practical VRAM headroom than Qwen3.5 9B. Granite 4.1's improved tool calling,
  instruction following, and chat capabilities are exactly what we want for
  game-state-aware outputs.
- **`granite4.1:3b-q6_K`** — 2.8 GB, text-only, 128K advertised context. The
  boring-but-useful workhorse. Use for high-volume calls where style matters
  less than speed and format obedience.
- **`phi4-mini:3.8b-q4_K_M`** — 2.5 GB, 128K advertised context. Solid small
  utility model supporting reasoning, math, multilingual, and function calling.
- **`qwen3:8b-q4_K_M`** — 5.2 GB, text input, 40K advertised context. Good
  general baseline; supports tool/thinking features in the Qwen3 family.
- **`qwen3.5:9b-q4_K_M`** — 6.6 GB, 9.65B params, text/image input. Smartest
  candidate that's still *probably* comfortable on 8 GB VRAM. Closer to the
  edge — test latency before making it the always-on default.
- **`adi0adi/ollama_stheno-8b_v3.1_q6k`** — community roleplay model. Directly
  relevant for companion banter and NPC dialogue, but **do not trust it for
  mechanical decisions or oracle logic**.

---

## Task → model routing table

| Aralia task | Best model type | Recommended model |
|---|---|---|
| Companion banter | Roleplay/prose | `adi0adi/ollama_stheno-8b_v3.1_q6k` |
| Escalation-mode companion banter | Roleplay/prose + strict safety rails | `adi0adi/ollama_stheno-8b_v3.1_q6k`, with state limits |
| Conversation continuation | Roleplay/prose | Stheno, or `qwen3:8b-q4_K_M` if Stheno gets too purple |
| Conversation summarization | Structured utility | `granite4.1:3b-q6_K` |
| Companion reactions to events | Fast prose | Stheno or `phi4-mini:3.8b-q4_K_M` |
| NPC responses to player actions | Roleplay/prose | Stheno |
| Gossip generation | Roleplay/prose | Stheno |
| Location descriptions | Prose | Stheno, `qwen3.5:9b-q4_K_M`, or `qwen3:8b-q4_K_M` |
| Encounter descriptions | Prose + consistency | `qwen3:8b-q4_K_M` or Stheno |
| Tile inspection details | Fast utility | `granite4.1:3b-q6_K` |
| Harvest/loot generation | Structured utility | `granite4.1:3b-q6_K` |
| Custom action suggestions | Instruction-following | `granite4.1:8b-q4_K_M` |
| Social check outcomes | Structured + prose | `granite4.1:8b-q4_K_M` |
| Oracle responses | Strict structured output | `granite4.1:8b-q4_K_M` |
| Character name generation | Fast utility | `phi4-mini:3.8b-q4_K_M` or Granite 3B |
| Situation analysis / guidance | Smart instruction model | `granite4.1:8b-q4_K_M` or `qwen3:8b-q4_K_M` |

**Opinionated summary:**
> Use Stheno for voices. Use Granite for judgment. Use Phi / Granite 3B for
> chores. Use Qwen as the fallback when the others misbehave.

---

## Rules for game integration

### Do not let the LLM decide hard game facts directly

Bad:

> "Does the player succeed at persuading the guard?"

Better:

1. Game engine computes roll, DC, modifiers, faction state
2. LLM receives the result
3. LLM writes the outcome text

Example payload to the LLM:

```json
{
  "check_type": "persuasion",
  "actor": "player",
  "target": "gate guard",
  "roll_total": 17,
  "dc": 15,
  "result": "success",
  "guard_disposition": "suspicious but tired",
  "allowed_outcomes": [
    "guard lets player pass",
    "guard asks for a minor favor",
    "guard gives a warning"
  ],
  "forbidden_outcomes": [
    "guard joins party",
    "guard gives rare item",
    "guard reveals secret plot"
  ]
}
```

The model generates flavor only. This keeps Aralia from becoming a slot
machine with a thesaurus.

### Separate "state" from "style"

Do not feed the entire world into the model. Feed compact state:

```json
{
  "scene": "Rainy market outside the north gate",
  "npc": {
    "name": "Marek",
    "role": "gate guard",
    "mood": "tired, suspicious",
    "secret": "owes money to the butcher"
  },
  "player_action": "offers to help find the missing caravan",
  "recent_events": [
    "player insulted the mayor",
    "bandits attacked the west road yesterday"
  ],
  "style": {
    "tone": "grounded low fantasy",
    "length": "1-2 sentences",
    "avoid": ["modern slang", "lore dumps", "quest marker language"]
  }
}
```

---

## Default model parameters

### Dialogue / banter / gossip

```json
{
  "temperature": 0.8,
  "top_p": 0.9,
  "repeat_penalty": 1.08,
  "num_ctx": 4096,
  "num_predict": 80
}
```

### Location / encounter descriptions

```json
{
  "temperature": 0.75,
  "top_p": 0.9,
  "repeat_penalty": 1.08,
  "num_ctx": 4096,
  "num_predict": 180
}
```

### Summaries, loot, oracle, social outcomes, JSON

```json
{
  "temperature": 0.2,
  "top_p": 0.8,
  "repeat_penalty": 1.05,
  "num_ctx": 4096,
  "num_predict": 160
}
```

**Context window:** start at 4K. Ollama's current defaults are 4K for GPUs
below 24 GiB VRAM, 32K for 24–48 GiB, 256K for 48 GiB+. An 8 GB card is
firmly in the 4K-first category.

---

## Structured outputs

For any player-facing mechanic, use JSON schema. Ollama supports structured
outputs by passing a JSON schema in the `format` field, and its docs recommend
also including the schema in the prompt to ground the model's response.

Example schema for an NPC reaction:

```json
{
  "type": "object",
  "properties": {
    "visible_text": {
      "type": "string",
      "description": "The line shown to the player."
    },
    "npc_mood_delta": {
      "type": "integer",
      "minimum": -3,
      "maximum": 3
    },
    "relationship_flag": {
      "type": "string",
      "enum": ["none", "trust_up", "trust_down", "fear_up", "respect_up"]
    },
    "followup_hook": {
      "type": "string"
    }
  },
  "required": [
    "visible_text",
    "npc_mood_delta",
    "relationship_flag",
    "followup_hook"
  ]
}
```

Use schemas especially for:

- Social check outcomes
- Harvest / loot generation
- Oracle responses
- Companion escalation
- Custom action suggestions
- Situation guidance

For pure banter, freeform is fine. **For anything that touches mechanics,
use a schema.**

---

## Runtime architecture

### Keep one main model loaded

An 8 GB GPU cannot comfortably keep several 8B-ish models loaded at once. Use
one currently-active model and unload/swap as needed. Ollama's API supports
`keep_alive` — keep a model loaded, unload immediately with `0`, or use
durations like `10m`.

Suggested defaults:

```json
{
  "main_model": "granite4.1:8b-q4_K_M",
  "dialogue_model": "adi0adi/ollama_stheno-8b_v3.1_q6k",
  "utility_model": "granite4.1:3b-q6_K"
}
```

### Router pseudocode

```ts
function chooseModel(taskType: TaskType): string {
  if (DIALOGUE_TASKS.has(taskType)) return "adi0adi/ollama_stheno-8b_v3.1_q6k";
  if (JUDGMENT_TASKS.has(taskType)) return "granite4.1:8b-q4_K_M";
  if (UTILITY_TASKS.has(taskType)) return "granite4.1:3b-q6_K";
  return "qwen3:8b-q4_K_M"; // fallback
}
```

Dialogue tasks: `companion_banter`, `npc_dialogue`, `gossip`,
`emotional_reaction`, `conversation_continuation`.

Judgment tasks: `oracle`, `social_check`, `situation_analysis`,
`custom_action_suggestions`.

Utility tasks: `name_generation`, `tile_inspection`, `loot_dressing`,
`conversation_summary`, `harvest_generation`.

---

## Stylistic role of each model

### `granite4.1:8b-q4_K_M`

- **Best for:** structured outputs, oracle framing, player guidance,
  summaries, tool-like behavior, "what should happen next?" analysis
- **Weakness:** less flavorful than RP models; may sound assistant-like
  unless prompted tightly
- **Use when:** correctness matters

### `granite4.1:3b-q6_K`

- **Best for:** cheap repeated calls, short summaries, names, tile details,
  loot descriptions, classification, state compression
- **Weakness:** not as rich for dramatic dialogue
- **Use as:** Aralia's background clerk

### `adi0adi/ollama_stheno-8b_v3.1_q6k`

- **Best for:** banter, NPC speech, gossip, short character reactions,
  companion personality
- **Weakness:** community model; not ideal for rule logic; can overindulge
  prose if not capped
- **Use as:** Aralia's actor

### `qwen3:8b-q4_K_M`

- **Best for:** fallback general intelligence, mixed instruction/prose tasks,
  summarization, action suggestions
- **Weakness:** can be more "LLM assistant" than "game narrator"; thinking-mode
  behavior depends on client/settings. Ollama supports enabling, disabling, or
  hiding "thinking" for supported models — for runtime game output, **disable
  it.**

### `qwen3.5:9b-q4_K_M`

- **Best for:** richer general generation, smart descriptions, multimodal
  experiments, higher-quality summaries
- **Weakness:** 6.6 GB before runtime overhead, tight on 8 GB VRAM; thinking
  behavior may add latency
- **Use as:** a quality test, not your first production default

### `gemma3:4b-it-q4_K_M`

- **Best for:** lightweight text/image input, vision-adjacent inspection,
  small descriptive tasks
- 3.3 GB, text/image input, 128K advertised context
- **Use only if** Aralia starts passing screenshots, map images, item cards,
  or visual references into the local model

---

## Models to avoid for runtime

| Model | Reason |
|---|---|
| `deepseek-r1:*` | Better for deliberate reasoning than snappy gameplay; can overthink and add latency |
| `mistral-nemo:latest` | Interesting 12B model but 7.1 GB leaves little room on an 8 GB card |
| `rocinante-12b-v1.1:q4-k-m` | Good narrative candidate but 7.5 GB is too close to the ceiling |
| `qwen3.5:27b-*` | Starts at 17 GB for Q4_K_M — wrong hardware tier |
| `gemma4:26b` / 3rd-party 26B variants | Wrong hardware tier |

---

## First-pass test config

```json
{
  "dialogue": "adi0adi/ollama_stheno-8b_v3.1_q6k",
  "oracle_and_guidance": "granite4.1:8b-q4_K_M",
  "utility": "granite4.1:3b-q6_K",
  "fallback": "qwen3:8b-q4_K_M",
  "num_ctx": 4096
}
```

### A/B test method

Run 20 prompts per category. Score each model on:

1. Latency
2. In-character tone
3. Obeys world-state constraints
4. Avoids adding unsupported facts
5. JSON validity
6. Repetition
7. Player-facing quality

For Aralia specifically, **a slightly dumber but consistent 3B/8B router
beats a slow 12B/14B model** that makes the player wait. Local game AI lives
or dies on latency and constraint-following, not leaderboard vanity.
