# AntiGravity Environment Learnings

Identity & Environment Checklist
- Agent ID: codex-antigravity
- Host/Tool (terminal, VS Code extension, etc.): AntiGravity IDE
- Shell: powershell
- Working directory / repo root: F:\Repos\Aralia
- Config or tool rules path: .agent/rules/
- Environment learnings file path: .agent/rules/environment-learnings/codex-antigravity.md
- Verification steps used: The current active agent is AntiGravity.

## Common Errors & Quirks

### PowerShell Special Characters in Native Commands
When passing inline parameters to native commands like `git` through PowerShell, special characters like `{}` (e.g., `@{3.hours.ago}`) will cause a parser error because PowerShell attempts to evaluate them as a hash literal or script block before passing them to the native executable.

Example Error:
```text
At line:1 char:12
+ git diff @{3.hours.ago}
+            ~
The hash literal was incomplete.
```

**Solution:** Always enclose arguments containing `{}` or other PowerShell special characters in quotation marks to ensure they are passed as literal strings.

```powershell
# Bad
git diff @{3.hours.ago}

# Good
git diff "@{3.hours.ago}"
```
