$file = 'F:\Repos\Aralia\AGENTS.md'
$content = [System.IO.File]::ReadAllText($file)

$insertAfter = "3. roadmap/workflow docs when the task touches unfinished or planned capability"
$insertBefore = "## Risk Priorities"

$newSection = @"
3. roadmap/workflow docs when the task touches unfinished or planned capability
4. the MemPalace memory system (see below)

## MemPalace (AI Memory System)

This project has a local, persistent AI memory system called **MemPalace**. It contains 143,000+ searchable text chunks ("drawers") from:

1. The entire Aralia codebase (source, docs, game data, config)
2. All past Claude Code conversation transcripts
3. All past OpenAI Codex CLI session transcripts

### How to query it

**Via MCP (Claude Code):** The MCP server is already configured. Use the ``mempalace`` tool to search for past decisions, code context, or conversation history.

**Via CLI:**
``````
mempalace search "your query here"
``````

**Via Python:**
``````python
import chromadb
c = chromadb.PersistentClient(path="C:/Users/Gambit/.mempalace/palace")
col = c.get_collection("mempalace_drawers")
results = col.query(query_texts=["your query"], n_results=5)
``````

### When to use it

- **Cold starts**: Before building something new, search the palace for prior discussions or decisions about that system.
- **Debugging**: Search for past conversations where a similar issue was discussed or resolved.
- **Architecture questions**: Query for past rationale behind design choices.
- **Continuity**: When picking up work another agent started, search for their session context.

### Keeping it updated

After significant project changes, re-mine to index new files (already-filed files are skipped automatically):
``````
mempalace mine F:\Repos\Aralia
``````

### Palace location

- Config: ``F:\Repos\Aralia\mempalace.yaml``
- Database: ``C:\Users\Gambit\.mempalace\palace``
- Wing: ``aralia`` (single wing covering the whole project)

## Risk Priorities
"@

$content = $content.Replace($insertAfter + "`r`n`r`n" + $insertBefore, $newSection)
if ($content -notmatch 'MemPalace') {
    $content = $content.Replace($insertAfter + "`n`n" + $insertBefore, $newSection)
}
[System.IO.File]::WriteAllText($file, $content)
Write-Host "Done - checking result:"
(Get-Content $file | Select-String "MemPalace").Count
