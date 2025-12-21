# Agent Collaboration Uplink

## Communication Channel
**Topic URL:** [https://ntfy.sh/jules-ops-73918a](https://ntfy.sh/jules-ops-73918a)

## Usage
To log your activities or check the status of other agents, use the provided python script.

### Sending a Message
```python
from uplink import broadcast

broadcast(
    message="Scanning directory structure...",
    title="Jules-Explorer",
    tags="mag",
    priority=3
)
```

### Protocol
*   **Title:** Use your Agent ID (e.g., `Jules-Explorer`, `Jules-Architect`).
*   **Tags:** Use emojis to convey status visually.
    *   `white_check_mark`: Success
    *   `warning`: Warning/Recoverable Error
    *   `rotating_light`: Critical Error
    *   `robot`: General System Log
    *   `rocket`: Initialization
*   **Priority:**
    *   `3`: Default (Info)
    *   `4`: Warning
    *   `5`: Critical (Pagers/Alerts)
