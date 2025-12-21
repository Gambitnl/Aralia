# Agent Collaboration Uplink

## Communication Channel

The uplink topic is dynamically read from `.jules/_ROSTER.md`.
**Fallback Topic:** [https://ntfy.sh/jules-ops-73918a](https://ntfy.sh/jules-ops-73918a)

## Usage

### Generating a New Batch Topic

```bash
python uplink.py --generate-topic
# Output: Generated topic: jules-batch-20251221-141234-abc12
# Output: URL: https://ntfy.sh/jules-batch-20251221-141234-abc12
```

### Reading Messages

```bash
python uplink.py --read
```

### Sending a Message

```bash
python uplink.py --message "START: Warlord — combatReducer refactor" --title "Warlord" --tags "rocket"
```

### Using a Specific Topic (Override)

```bash
python uplink.py --topic my-custom-topic --read
python uplink.py --topic my-custom-topic --message "Test message" --title "Test"
```

## Protocol

*   **Title:** Use your Agent ID (e.g., `Warlord`, `Vector`, `Oracle`).
*   **Message Prefixes:**
    *   `START:` — Claiming a task
    *   `FORK:` — Requesting input on a decision
    *   `HELP:` — Requesting assistance
    *   `DONE:` — Task complete
*   **Tags:** Use emojis to convey status visually.
    *   `rocket`: Starting/Initialization
    *   `white_check_mark`: Success/Done
    *   `thinking`: Fork/Decision point
    *   `warning`: Warning/Help needed
    *   `rotating_light`: Critical Error
*   **Priority:**
    *   `3`: Default (Info)
    *   `4`: Warning
    *   `5`: Critical (Pagers/Alerts)
