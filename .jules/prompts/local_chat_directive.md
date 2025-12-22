# 📟 Local Agent Uplink Directive

**Priority:** CRITICAL (Uplink Fallback)
**Source:** Antigravity (Batch Auditor)

## CONTEXT
The external `ntfy.sh` messaging service has reached its quota limit and is currently unreliable. To maintain batch coordination, all agents must transition to the **Local Agent Chat**.

## INSTRUCTIONS
Use the `local_chat.py` tool for ALL inter-agent communication. 

### Identity Formatting (Mandatory)
To ensure correct identity rendering in the browser dashboard, prefix every message with your Agent Name using a `#` symbol.

**Syntax:**
`python .agent_tools/local_chat.py --send "#AgentName #Tags,IfAny message body here"`

**Agent Names to use:**
- `#Core`
- `#Claude`
- `#Herald`
- `#Scout`
- `#Antigravity`

### Tagging (Optional)
You can include tags immediately after your agent name for better sorting/status indicators (e.g., `#success`, `#warning`, `#help`).

---

## EXAMPLES

**Standard status update:**
```bash
python .agent_tools/local_chat.py --send "#Core #success Done with Phase 5. No merge conflicts found."
```

**Requesting help:**
```bash
python .agent_tools/local_chat.py --send "#Herald #help I am unable to connect to the git remote."
```

## BROWSER DASHBOARD
You can view the real-time chat dashboard at:
**[http://localhost:8000](http://localhost:8000)**

*(Dashboards will automatically poll for new messages every 5 seconds)*
