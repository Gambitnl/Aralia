import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import {
  buildSpellFieldInventory,
  createSpellFieldInventorySummary,
  querySpellFieldInventory,
  type SpellFieldInventory,
} from '../spellFieldInventory';
import { toProjectDisplayName, projectSlugFromNorthStarPath, toProjectSlug, stripMarkdownInline } from './utils';

export const devHubApiManager = () => ({
  name: 'devhub-api-manager',
  configureServer(server: any) {
    let spellFieldInventoryCache: SpellFieldInventory | null = null;
    let spellFieldInventoryLoadedAt = 0;

    const getSpellFieldInventory = (forceRefresh = false): SpellFieldInventory => {
      const now = Date.now();
      const cacheIsFresh = spellFieldInventoryCache && (now - spellFieldInventoryLoadedAt) < 15_000;
      if (!forceRefresh && cacheIsFresh) {
        return spellFieldInventoryCache;
      }

      spellFieldInventoryCache = buildSpellFieldInventory();
      spellFieldInventoryLoadedAt = now;
      return spellFieldInventoryCache;
    };

    type ProjectDocRole = {
      key: string;
      token: string;
      label: string;
      fileName: string;
      required: boolean;
    };

    type ProjectDocSignal = ProjectDocRole & {
      exists: boolean;
      href: string;
      size: number;
      updatedAt: string | null;
      declaredUpdated: string;
      freshness: string;
      freshnessLabel: string;
    };

    type ProjectTrackerMetadata = {
      category?: string;
      project?: string;
      status?: string;
      confidence?: string;
      evidence?: string;
      gapSignal?: string;
      protocol?: string;
      nextStep?: string;
    };

    type WorkflowGapSummary = {
      href: string;
      totalCount: number;
      activeCount: number;
      blockingCount: number;
      highSeverityCount: number;
      lastUpdated: string;
      activeGaps: Array<{
        id: string;
        status: string;
        severity: string;
        area: string;
        issue: string;
        testimonies: number;
        nextAction: string;
        owner: string;
        lastUpdated: string;
      }>;
    };

    const projectDocRoles: ProjectDocRole[] = [
      { key: 'northStar', token: 'N', label: 'North Star', fileName: 'NORTH_STAR.md', required: true },
      { key: 'tracker', token: 'T', label: 'Tracker', fileName: 'TRACKER.md', required: true },
      { key: 'gaps', token: 'G', label: 'Gaps', fileName: 'GAPS.md', required: true },
      { key: 'agentPrompt', token: 'A', label: 'Agent Prompt', fileName: 'COLD_START_AGENT_PROMPT.md', required: true },
      { key: 'decisions', token: 'D', label: 'Decisions', fileName: 'DECISIONS.md', required: false },
      { key: 'proof', token: 'P', label: 'Proof', fileName: 'AUDIT_OR_PROOF.md', required: false },
      { key: 'runbook', token: 'R', label: 'Runbook', fileName: 'RUNBOOK.md', required: false },
    ];

    // ============================================================================
    // Project Tracker Card Source
    // ============================================================================
    // This section is the single source for the project dashboard and project
    // detail API data. It reads each project folder directly and returns a strict
    // docSet schema, so the browser can show when project files exist and whether
    // their written Last updated dates line up with the North Star.
    // ============================================================================
    const readProjectTrackerMetadata = (projectsDir: string, projectDirs: string[]) => {
      // Keep PROJECT_TRACKER.md as registry fallback data, not as the canonical
      // source for the cards. The per-project folder owns live card state.
      const folderSet = new Set(projectDirs);
      const trackerPath = path.join(projectsDir, 'PROJECT_TRACKER.md');
      const trackerContent = fs.existsSync(trackerPath)
        ? fs.readFileSync(trackerPath, 'utf-8')
        : '';
      const nameBySlug = new Map<string, string>();

      for (const slug of projectDirs) {
        nameBySlug.set(slug, toProjectDisplayName(slug));
      }

      for (const line of trackerContent.split(/\r?\n/)) {
        const northStarMatch = line.match(/^\|\s*([^|]+?)\s*\|\s*\[[^\]]+\]\(([^)]+NORTH_STAR\.md)\)\s*\|/i);
        if (!northStarMatch) continue;
        const slug = projectSlugFromNorthStarPath(northStarMatch[2]);
        if (slug && folderSet.has(slug)) {
          nameBySlug.set(slug, stripMarkdownInline(northStarMatch[1]));
        }
      }

      const labelToSlug = new Map<string, string>();
      for (const [slug, name] of nameBySlug.entries()) {
        labelToSlug.set(toProjectSlug(name), slug);
        labelToSlug.set(toProjectSlug(slug), slug);
      }

      const trackerBySlug = new Map<string, ProjectTrackerMetadata>();
      let currentCategory = 'Project Tracker';
      for (const rawLine of trackerContent.split(/\r?\n/)) {
        const heading = rawLine.match(/^##\s+(.+)$/);
        if (heading) {
          currentCategory = stripMarkdownInline(heading[1].replace(/\s*\([^)]*\)\s*$/, ''));
          continue;
        }

        if (!rawLine.startsWith('|')) continue;
        const cells = rawLine.split('|').slice(1, -1).map((cell) => cell.trim());
        if (cells.length < 7) continue;
        if (/^-+$/.test(cells[0].replace(/\s/g, '')) || /^project$/i.test(stripMarkdownInline(cells[0]))) continue;

        const explicitSlug = cells.map(projectSlugFromNorthStarPath).find(Boolean) as string | undefined;
        const projectName = stripMarkdownInline(cells[0]);
        const slug = explicitSlug || labelToSlug.get(toProjectSlug(projectName)) || toProjectSlug(projectName);
        if (!folderSet.has(slug) || trackerBySlug.has(slug)) continue;

        trackerBySlug.set(slug, {
          category: currentCategory,
          project: projectName,
          status: stripMarkdownInline(cells[2]),
          confidence: stripMarkdownInline(cells[3]),
          evidence: stripMarkdownInline(cells[4]),
          gapSignal: stripMarkdownInline(cells[5]),
          protocol: stripMarkdownInline(cells[1]),
          nextStep: stripMarkdownInline(cells[6]),
        });
      }

      return { trackerBySlug, nameBySlug };
    };

    const markdownField = (content: string, label: string) => {
      // Read simple "Label: value" fields from project markdown. The project docs
      // stay human-readable, while the dashboard can still compute live status.
      const match = content.match(new RegExp('^\\s*' + label + '\\s*:\\s*(.+)$', 'im'));
      return match ? stripMarkdownInline(match[1]).trim() : '';
    };

    const markdownSectionFields = (content: string, headingName: string) => {
      // Agents fill dashboard-facing values in a named markdown section. This
      // parser lets the dashboard read those explicit fields first, while older
      // projects can still fall back to inferred values until they are upgraded.
      const fields: Record<string, string> = {};
      const lines = content.split(/\r?\n/);
      const headingPattern = new RegExp('^##\\s+' + headingName + '\\s*$', 'i');
      const startIndex = lines.findIndex((line) => headingPattern.test(stripMarkdownInline(line).trim()));
      if (startIndex < 0) return fields;

      for (const line of lines.slice(startIndex + 1)) {
        if (/^##\s+/.test(line)) break;
        const match = line.match(/^\s*([^:]+?)\s*:\s*(.+)\s*$/);
        if (!match) continue;
        const key = toProjectSlug(match[1]).replace(/-/g, '');
        fields[key] = stripMarkdownInline(match[2]).trim();
      }

      return fields;
    };

    const readProjectCardJson = (projectDir: string) => {
      // PROJECT_CARD.json remains a backward-compatible override, but markdown
      // schema fields are preferred because they keep dashboard state inside the
      // human-readable living project docs.
      const cardPath = path.join(projectDir, 'PROJECT_CARD.json');
      if (!fs.existsSync(cardPath)) return {};
      try {
        return JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
      } catch {
        return {};
      }
    };

    const projectCardSchemaField = (schema: Record<string, any>, ...keys: string[]) => {
      // Markdown schema keys are normalized to lowercase words, while older JSON
      // overrides used camelCase. This helper lets both contracts work during the
      // migration instead of forcing every project to change at once.
      for (const key of keys) {
        const value = schema[key];
        if (Array.isArray(value)) return value.join(', ');
        if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
      }
      return '';
    };

    const normalizeProjectDate = (value: string) => {
      // Written project dates are more durable than filesystem modification times,
      // which can change during Git operations or generated rewrites.
      const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    };

    const readOptionalProjectText = (projectDir: string, fileName: string) => {
      // Missing files are allowed while projects are being upgraded into the full
      // living-project protocol shape.
      const filePath = path.join(projectDir, fileName);
      if (!fs.existsSync(filePath)) return '';
      return fs.readFileSync(filePath, 'utf-8');
    };

    const projectTitleFromDocs = (slug: string, northStarContent: string, trackerContent: string) => {
      // Prefer the project's own heading because it is what a cold-start agent
      // sees first when opening the project folder.
      const heading = northStarContent.match(/^#\s+(.+)$/m) || trackerContent.match(/^#\s+(.+)$/m);
      if (!heading) return toProjectDisplayName(slug);
      return stripMarkdownInline(heading[1])
        .replace(/\s+North Star$/i, '')
        .replace(/\s+Living Tracker$/i, '')
        .replace(/\s+Tracker$/i, '')
        .replace(/\s+Gaps?$/i, '')
        .trim() || toProjectDisplayName(slug);
    };

    const firstProjectParagraph = (content: string, headingName: string) => {
      // Use a concise North Star paragraph as fallback card text when no explicit
      // tracker next action exists.
      const lines = content.split(/\r?\n/);
      const headingPattern = new RegExp('^##\\s+' + headingName + '\\s*$', 'i');
      const startIndex = lines.findIndex((line) => headingPattern.test(stripMarkdownInline(line).trim()));
      if (startIndex < 0) return '';

      const collected: string[] = [];
      for (const line of lines.slice(startIndex + 1)) {
        if (/^##\s+/.test(line)) break;
        const cleanLine = stripMarkdownInline(line.replace(/^[-*]\s+/, '').trim());
        if (!cleanLine && collected.length) break;
        if (cleanLine) collected.push(cleanLine);
      }

      return collected.join(' ').trim();
    };

    const nextStepFromTracker = (trackerContent: string) => {
      // The active task queue is the strongest source for the next visible
      // dashboard action.
      for (const line of trackerContent.split(/\r?\n/)) {
        if (!line.startsWith('|')) continue;
        const cells = line.split('|').slice(1, -1).map((cell) => stripMarkdownInline(cell).trim()).filter(Boolean);
        if (cells.length < 3) continue;
        const joined = cells.join(' ').toLowerCase();
        if (!/\b(active|pending|planned|blocked)\b/.test(joined)) continue;
        if (/\b(done|complete|closed)\b/.test(joined)) continue;

        const descriptiveCell = cells.find((cell) => {
          const lower = cell.toLowerCase();
          return !/^t\d+/i.test(cell) && !/^(active|pending|planned|blocked)$/i.test(lower) && cell.length > 8;
        });
        if (descriptiveCell) return descriptiveCell;
      }

      return '';
    };

    const readProjectDocSignal = (projectDir: string, slug: string, role: ProjectDocRole, northStarDate: string): ProjectDocSignal => {
      // Each token reports both existence and freshness. Required files drive the
      // complete/current counts; optional files are shown so agents know whether
      // agent prompts, decisions, proof, or runbook docs exist for the project.
      const filePath = path.join(projectDir, role.fileName);
      const exists = fs.existsSync(filePath);
      const content = exists ? fs.readFileSync(filePath, 'utf-8') : '';
      const stat = exists ? fs.statSync(filePath) : null;
      const declaredUpdated = normalizeProjectDate(markdownField(content, 'Last updated'));
      let freshness = exists ? 'undated' : 'missing';
      let freshnessLabel = exists ? 'exists, but has no Last updated date' : 'missing';

      if (exists && declaredUpdated && northStarDate) {
        if (declaredUpdated === northStarDate) {
          freshness = 'current';
          freshnessLabel = 'updated with North Star';
        } else if (declaredUpdated > northStarDate) {
          freshness = 'ahead';
          freshnessLabel = 'newer than North Star';
        } else {
          freshness = 'stale';
          freshnessLabel = 'older than North Star';
        }
      } else if (exists && declaredUpdated) {
        freshness = 'dated';
        freshnessLabel = 'dated, but North Star date is missing';
      }

      return {
        ...role,
        exists,
        href: '/Aralia/docs/projects/' + slug + '/' + role.fileName,
        size: stat?.size || 0,
        updatedAt: stat ? stat.mtime.toISOString() : null,
        declaredUpdated,
        freshness,
        freshnessLabel,
      };
    };

    const gapSignalFromGaps = (gapsContent: string, gapsFileExists: boolean) => {
      // Keep the row compact while still summarizing the live project gap file.
      if (!gapsFileExists) return 'GAPS.md missing';
      const gapRows = gapsContent.split(/\r?\n/).filter((line) => /^\|\s*G\d+/i.test(line));
      const openRows = gapRows.filter((line) => /\b(open|active|pending|blocked)\b/i.test(stripMarkdownInline(line)));
      if (openRows.length) return String(openRows.length) + ' open gap' + (openRows.length === 1 ? '' : 's');
      if (gapRows.length) return String(gapRows.length) + ' tracked gap' + (gapRows.length === 1 ? '' : 's');
      return 'GAPS.md present';
    };

    const readWorkflowGapSummary = (): WorkflowGapSummary => {
      // Workflow gaps are process-health issues, not project blockers. The
      // dashboard reads this central file so dispatchers can notice unclear
      // agent instructions before sending more iteration agents into projects.
      const workflowGapPath = path.resolve(
        process.cwd(),
        'docs',
        'agent-workflows',
        'living-project-task-protocol',
        'WORKFLOW_GAPS.md',
      );
      const href = '/Aralia/docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md';
      const emptySummary: WorkflowGapSummary = {
        href,
        totalCount: 0,
        activeCount: 0,
        blockingCount: 0,
        highSeverityCount: 0,
        lastUpdated: '',
        activeGaps: [],
      };

      if (!fs.existsSync(workflowGapPath)) return emptySummary;

      const content = fs.readFileSync(workflowGapPath, 'utf-8');
      const lastUpdated = normalizeProjectDate(markdownField(content, 'Last updated'));
      const gaps = content.split(/\r?\n/).flatMap((line) => {
        if (!/^\|\s*WFG-\d+/i.test(line)) return [];
        const cells = line.split('|').slice(1, -1).map((cell) => stripMarkdownInline(cell).trim());
        if (cells.length < 9) return [];
        const testimonies = Number(cells[5].replace(/[^\d]/g, '')) || 0;
        return [{
          id: cells[0],
          status: cells[1],
          severity: cells[2],
          area: cells[3],
          issue: cells[4],
          testimonies,
          nextAction: cells[6],
          owner: cells[7],
          lastUpdated: cells[8],
        }];
      });
      const activeGaps = gaps.filter((gap) => !/\b(resolved|closed|superseded|rejected)\b/i.test(gap.status));
      const severeGaps = activeGaps.filter((gap) => /\b(high|blocking|critical)\b/i.test(gap.severity));

      return {
        href,
        totalCount: gaps.length,
        activeCount: activeGaps.length,
        blockingCount: activeGaps.filter((gap) => /\b(blocking|critical)\b/i.test(gap.severity)).length,
        highSeverityCount: severeGaps.length,
        lastUpdated,
        activeGaps: activeGaps.slice(0, 5),
      };
    };

    const buildProjectDashboardCard = (projectsDir: string, slug: string, trackerFallback: ProjectTrackerMetadata = {}) => {
      // This is the canonical project-card builder. Dashboard and detail routes
      // both use it so shared UI cards stay aligned.
      const projectDir = path.join(projectsDir, slug);
      const northStarContent = readOptionalProjectText(projectDir, 'NORTH_STAR.md');
      const trackerContent = readOptionalProjectText(projectDir, 'TRACKER.md');
      const gapsContent = readOptionalProjectText(projectDir, 'GAPS.md');
      const dashboardSchema = {
        ...readProjectCardJson(projectDir),
        ...markdownSectionFields(trackerContent, 'Dashboard Card Schema'),
        ...markdownSectionFields(northStarContent, 'Dashboard Card Schema'),
      };
      const northStarDate = normalizeProjectDate(markdownField(northStarContent, 'Last updated'));
      const docSet = projectDocRoles.map((role) => readProjectDocSignal(projectDir, slug, role, northStarDate));
      const docs = Object.fromEntries(docSet.map((doc) => [doc.key, doc]));
      const requiredDocs = docSet.filter((doc) => doc.required);
      const docsComplete = requiredDocs.every((doc) => doc.exists);
      const docsCurrent = requiredDocs.every((doc) => doc.exists && ['current', 'dated'].includes(doc.freshness));
      const staleDocs = docSet.filter((doc) => doc.exists && ['stale', 'ahead', 'undated'].includes(doc.freshness));
      const purpose = firstProjectParagraph(northStarContent, 'Purpose');
      const resumePath = firstProjectParagraph(northStarContent, 'Resume Path');
      const trackerNextStep = nextStepFromTracker(trackerContent);

      return {
        slug,
        name: projectCardSchemaField(dashboardSchema, 'project') || trackerFallback.project || projectTitleFromDocs(slug, northStarContent, trackerContent),
        category: projectCardSchemaField(dashboardSchema, 'category') || trackerFallback.category || 'Unregistered Project Folder',
        status: projectCardSchemaField(dashboardSchema, 'status') || markdownField(northStarContent, 'Status') || markdownField(trackerContent, 'Status') || trackerFallback.status || 'tracked',
        confidence: projectCardSchemaField(dashboardSchema, 'confidence') || trackerFallback.confidence || 'unknown',
        evidence: projectCardSchemaField(dashboardSchema, 'evidence') || trackerFallback.evidence || 'docs/projects/' + slug,
        gapSignal: projectCardSchemaField(dashboardSchema, 'gapsignal', 'gapSignal') || gapSignalFromGaps(gapsContent, Boolean(docs.gaps?.exists)) || trackerFallback.gapSignal || 'See project gap file',
        protocol: projectCardSchemaField(dashboardSchema, 'protocol') || trackerFallback.protocol || (docsComplete ? 'living project doc set' : 'incomplete project doc set'),
        nextStep: projectCardSchemaField(dashboardSchema, 'nextstep', 'nextStep') || trackerNextStep || resumePath || purpose || trackerFallback.nextStep || 'Add next action to TRACKER.md',
        requiredVerification: projectCardSchemaField(dashboardSchema, 'requiredverification', 'requiredVerification'),
        completedVerification: projectCardSchemaField(dashboardSchema, 'completedverification', 'completedVerification'),
        lastProof: projectCardSchemaField(dashboardSchema, 'lastproof', 'lastProof'),
        workflowGapsReviewed: projectCardSchemaField(dashboardSchema, 'workflowgapsreviewed', 'workflowGapsReviewed'),
        dashboardSchemaPresent: Object.keys(dashboardSchema).length > 0,
        docsComplete,
        docsCurrent,
        staleDocCount: staleDocs.length,
        docSet,
        docs,
        links: Object.fromEntries(docSet.map((doc) => [doc.key, doc.href])),
      };
    };

    server.middlewares.use((req: any, res: any, next: any) => {
      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      const urlPath = parsedUrl.pathname;

      if (urlPath === '/api/projects/dashboard') {
        try {
          const projectsDir = path.resolve(process.cwd(), 'docs', 'projects');
          const projectDirs = fs.existsSync(projectsDir)
            ? fs.readdirSync(projectsDir, { withFileTypes: true })
              .filter((entry: any) => entry.isDirectory())
              .map((entry: any) => entry.name)
              .sort((a: string, b: string) => a.localeCompare(b))
            : [];
          const { trackerBySlug } = readProjectTrackerMetadata(projectsDir, projectDirs);
          const projects = projectDirs.map((slug: string) => buildProjectDashboardCard(
            projectsDir,
            slug,
            trackerBySlug.get(slug) || {},
          ));
          const countBy = (key: string) => projects.reduce((acc: Record<string, number>, project: any) => {
            const value = String(project[key] || 'unknown');
            acc[value] = (acc[value] || 0) + 1;
            return acc;
          }, {});

          json({
            generatedAt: new Date().toISOString(),
            projectCount: projects.length,
            docsCompleteCount: projects.filter((project: any) => project.docsComplete).length,
            docsCurrentCount: projects.filter((project: any) => project.docsCurrent).length,
            workflowGaps: readWorkflowGapSummary(),
            statusCounts: countBy('status'),
            categoryCounts: countBy('category'),
            projects,
          });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (urlPath === '/api/projects/detail') {
        try {
          const projectSlug = String(parsedUrl.searchParams.get('project') || '').trim();
          if (!/^[a-zA-Z0-9_-]+$/.test(projectSlug)) {
            json({ error: 'Invalid project slug.' }, 400);
            return;
          }

          const projectsRoot = path.resolve(process.cwd(), 'docs', 'projects');
          const projectDir = path.resolve(projectsRoot, projectSlug);
          if (!projectDir.startsWith(projectsRoot) || !fs.existsSync(projectDir)) {
            json({ error: 'Project not found.' }, 404);
            return;
          }

          const projectDirs = fs.existsSync(projectsRoot)
            ? fs.readdirSync(projectsRoot, { withFileTypes: true })
              .filter((entry: any) => entry.isDirectory())
              .map((entry: any) => entry.name)
            : [];
          const { trackerBySlug } = readProjectTrackerMetadata(projectsRoot, projectDirs);
          const projectCard = buildProjectDashboardCard(projectsRoot, projectSlug, trackerBySlug.get(projectSlug) || {});
          const docSet = projectCard.docSet.map((doc) => ({
            ...doc,
            content: doc.exists ? fs.readFileSync(path.join(projectDir, doc.fileName), 'utf-8') : '',
          }));

          json({
            ...projectCard,
            docSet,
            docs: Object.fromEntries(docSet.map((doc) => [doc.key, doc])),
          });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }
      if (urlPath === '/api/spells/field-inventory/summary') {
        try {
          const forceRefresh = parsedUrl.searchParams.get('refresh') === '1';
          const inventory = getSpellFieldInventory(forceRefresh);
          const summary = createSpellFieldInventorySummary(inventory);
          json(summary);
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (urlPath === '/api/spells/field-inventory/query') {
        try {
          const forceRefresh = parsedUrl.searchParams.get('refresh') === '1';
          const inventory = getSpellFieldInventory(forceRefresh);
          const levelParam = parsedUrl.searchParams.get('level');
          const level = levelParam !== null && levelParam !== '' ? Number(levelParam) : undefined;
          const query = querySpellFieldInventory(inventory, {
            fieldPath: parsedUrl.searchParams.get('fieldPath') ?? '',
            value: parsedUrl.searchParams.get('value') ?? '',
            level: Number.isFinite(level as number) ? level : undefined,
            includeFreeText: parsedUrl.searchParams.get('includeFreeText') === '1',
            limit: Number(parsedUrl.searchParams.get('limit') ?? 200),
          });
          json(query);
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (req.url === '/api/test') {
        exec('npx vitest run', { cwd: process.cwd(), timeout: 120000, windowsHide: true }, (_error: any) => {
          try {
            const resultsPath = path.resolve(process.cwd(), 'vitest-results.json');
            if (fs.existsSync(resultsPath)) {
              const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
              json(results);
            } else {
              json({ error: 'No vitest-results.json produced' });
            }
          } catch (e) {
            json({ error: 'Parse failed', message: String(e) });
          }
        });
        return;
      }

      if (req.url === '/api/ci/status') {
        exec(
          'gh run list --limit 5 --json status,conclusion,name,createdAt,headBranch,databaseId',
          { cwd: process.cwd(), timeout: 10000, windowsHide: true },
          (_error: any, stdout: string) => {
            if (_error) { json({ error: 'gh CLI unavailable' }); return; }
            try { json({ runs: JSON.parse(stdout.trim()) }); }
            catch { json({ error: 'Parse failed' }); }
          }
        );
        return;
      }

      if (req.url === '/api/health/env') {
        json({ rDrive: fs.existsSync('R:\\AraliaV4\\Aralia') });
        return;
      }

      if (req.url === '/api/agent/config') {
        try {
          const agentDir = path.resolve(process.cwd(), '.agent');
          const readMdFiles = (sub: string) => {
            const dir = path.join(agentDir, sub);
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir, { withFileTypes: true })
              .filter((d: any) => d.isFile() && d.name.endsWith('.md'))
              .map((d: any) => {
                const item: any = { name: d.name.replace('.md', ''), path: `.agent/${sub}/${d.name}` };
                try {
                  const content = fs.readFileSync(path.join(dir, d.name), 'utf-8');
                  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                  if (fm) {
                    const block = fm[1].replace(/\r/g, '');
                    const chainMatch = block.match(/^chain:\s*(.+)$/m);
                    const viaMatch = block.match(/^chain_via:\s*(.+)$/m);
                    const orderMatch = block.match(/^chain_order:\s*(\d+)$/m);
                    if (chainMatch) item.chain = chainMatch[1].trim();
                    if (viaMatch) item.chainVia = viaMatch[1].trim();
                    if (orderMatch) item.chainOrder = parseInt(orderMatch[1], 10);
                  }
                } catch (_) { /* ignore read errors */ }
                return item;
              });
          };
          const chainConfigPath = path.join(agentDir, 'tidy-up-chain.json');
          const chainConfig = fs.existsSync(chainConfigPath)
            ? JSON.parse(fs.readFileSync(chainConfigPath, 'utf-8'))
            : { extras: [], skills: [] };
          const skillsInTidyUp: string[] = chainConfig.skills || [];
          const skillsDir = path.join(agentDir, 'skills');
          const skills = fs.existsSync(skillsDir)
            ? fs.readdirSync(skillsDir, { withFileTypes: true })
              .filter((d: any) => d.isDirectory())
              .map((d: any) => {
                const item: any = { name: d.name, path: `.agent/skills/${d.name}/SKILL.md` };
                if (skillsInTidyUp.includes(d.name)) { item.chain = 'tidy-up'; item.chainVia = 'session-ritual'; }
                return item;
              })
            : [];
          const claudeCmdsDir = path.resolve(process.cwd(), '.claude/commands');
          const conductorCommands = fs.existsSync(claudeCmdsDir)
            ? fs.readdirSync(claudeCmdsDir, { withFileTypes: true })
              .filter((d: any) => d.isFile() && d.name.startsWith('conductor-') && d.name.endsWith('.md'))
              .map((d: any) => ({ name: d.name.replace('.md', ''), path: `.claude/commands/${d.name}`, source: 'claude' }))
            : [];
          const allWorkflows = readMdFiles('workflows');
          const trackWorkflows = allWorkflows
            .filter((w: any) => w.name.startsWith('track-'))
            .map((w: any) => ({ ...w, source: 'agent' }));
          const workflows = allWorkflows.filter((w: any) => !w.name.startsWith('track-'));
          const conductor = [...conductorCommands, ...trackWorkflows];
          const chainExtras = (chainConfig.extras || []).map((e: any) => ({
            ...e,
            chain: 'tidy-up',
          }));
          json({ rules: readMdFiles('rules'), skills, workflows: [...workflows, ...chainExtras], conductor });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (urlPath === '/api/docs/list') {
        try {
          const rootDir = process.cwd();
          const results: any[] = [];
          
          const scan = (dir: string) => {
            const list = fs.readdirSync(dir, { withFileTypes: true });
            for (const file of list) {
              const fullPath = path.join(dir, file.name);
              const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
              
              if (file.isDirectory()) {
                if (
                  file.name === 'node_modules' ||
                  file.name === '.git' ||
                  file.name === 'dist' ||
                  file.name === 'public' ||
                  file.name === '.tmp' ||
                  file.name === 'vendor' ||
                  file.name === '.gemini' ||
                  file.name === '.jules' ||
                  file.name === '.antigravitycli' ||
                  file.name === '.claude' ||
                  file.name === '.cursor' ||
                  file.name === '.codex' ||
                  file.name === '.symphony' ||
                  file.name === 'artifacts'
                ) {
                  continue;
                }
                scan(fullPath);
              } else if (file.isFile() && file.name.endsWith('.md')) {
                try {
                  const content = fs.readFileSync(fullPath, 'utf-8');
                  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                  const metadata: any = {
                    title: file.name.replace('.md', ''),
                    category: 'other',
                    status: 'not started',
                    lastReviewed: '',
                    notes: ''
                  };
                  
                  if (fmMatch) {
                    const block = fmMatch[1].replace(/\r/g, '');
                    const titleMatch = block.match(/^title:\s*\"?([^\"]+)\"?$/m);
                    const catMatch = block.match(/^category:\s*(.+)$/m);
                    const statusMatch = block.match(/^status:\s*(.+)$/m);
                    const reviewedMatch = block.match(/^lastReviewed:\s*(.+)$/m);
                    const notesMatch = block.match(/^notes:\s*(.+)$/m);
                    
                    if (titleMatch) metadata.title = titleMatch[1].trim();
                    if (catMatch) metadata.category = catMatch[1].trim();
                    if (statusMatch) metadata.status = statusMatch[1].trim();
                    if (reviewedMatch) metadata.lastReviewed = reviewedMatch[1].trim();
                    if (notesMatch) metadata.notes = notesMatch[1].trim();
                  } else {
                    if (relPath.startsWith('docs/tasks/')) {
                      metadata.category = 'work-item';
                    } else if (relPath.startsWith('docs/guides/')) {
                      metadata.category = 'workflow';
                    } else if (relPath.startsWith('docs/archive/')) {
                      metadata.category = 'archive';
                    } else if (relPath.startsWith('docs/registry/')) {
                      metadata.category = 'registry';
                    } else if (relPath.includes('README.md')) {
                      metadata.category = 'index';
                    }
                  }
                  
                  const stats = fs.statSync(fullPath);
                  results.push({
                    path: relPath,
                    name: file.name,
                    size: stats.size,
                    mtime: stats.mtime,
                    metadata
                  });
                } catch (_) {
                  results.push({
                    path: relPath,
                    name: file.name,
                    size: 0,
                    metadata: { title: file.name.replace('.md', ''), category: 'other', status: 'not started' }
                  });
                }
              }
            }
          };
          
          scan(rootDir);
          json({ files: results });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (urlPath === '/api/docs/read') {
        try {
          const relPath = parsedUrl.searchParams.get('path');
          if (!relPath || !relPath.endsWith('.md')) {
            json({ error: 'Invalid path' }, 400);
            return;
          }
          const safePath = path.resolve(process.cwd(), relPath);
          if (!safePath.startsWith(process.cwd())) {
            json({ error: 'Access denied' }, 403);
            return;
          }
          if (!fs.existsSync(safePath)) {
            json({ error: 'File not found' }, 404);
            return;
          }
          const raw = fs.readFileSync(safePath, 'utf-8');
          const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
          const metadata: any = {
            title: path.basename(relPath, '.md'),
            category: 'other',
            status: 'not started',
            lastReviewed: '',
            notes: ''
          };
          let body = raw;
          
          if (fmMatch) {
            body = fmMatch[2];
            const block = fmMatch[1].replace(/\r/g, '');
            const titleMatch = block.match(/^title:\s*\"?([^\"]+)\"?$/m);
            const catMatch = block.match(/^category:\s*(.+)$/m);
            const statusMatch = block.match(/^status:\s*(.+)$/m);
            const reviewedMatch = block.match(/^lastReviewed:\s*(.+)$/m);
            const notesMatch = block.match(/^notes:\s*(.+)$/m);
            
            if (titleMatch) metadata.title = titleMatch[1].trim();
            if (catMatch) metadata.category = catMatch[1].trim();
            if (statusMatch) metadata.status = statusMatch[1].trim();
            if (reviewedMatch) metadata.lastReviewed = reviewedMatch[1].trim();
            if (notesMatch) metadata.notes = notesMatch[1].trim();
          }
          
          json({ path: relPath, metadata, body });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (urlPath === '/api/docs/write' && req.method === 'POST') {
        let bodyAccumulator = '';
        req.on('data', (chunk: any) => { bodyAccumulator += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(bodyAccumulator);
            const { path: relPath, metadata, body } = data;
            
            if (!relPath || !relPath.endsWith('.md')) {
              json({ error: 'Invalid path' }, 400);
              return;
            }
            const safePath = path.resolve(process.cwd(), relPath);
            if (!safePath.startsWith(process.cwd())) {
              json({ error: 'Access denied' }, 403);
              return;
            }
            
            const frontmatterLines = [
              '---',
              `title: "${metadata.title || path.basename(relPath, '.md')}"`,
              `category: "${metadata.category || 'other'}"`,
              `status: "${metadata.status || 'not started'}"`,
              `lastReviewed: "${metadata.lastReviewed || ''}"`,
              `notes: "${(metadata.notes || '')
                .replace(/\\/g, '\\\\')
                .replace(/\"/g, '\\"')}"`,
              '---',
              ''
            ];
            const fullContent = frontmatterLines.join('\n') + body;
            
            fs.writeFileSync(safePath, fullContent, 'utf-8');
            
            try {
              const ledgerPath = path.resolve(process.cwd(), 'docs/registry/@DOC-REVIEW-LEDGER.md');
              if (fs.existsSync(ledgerPath)) {
                let ledgerContent = fs.readFileSync(ledgerPath, 'utf-8');
                const escapedPath = relPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const rowRegex = new RegExp(`\\|\\s*\`?${escapedPath}\`?\\s*\\|`, 'i');
                if (rowRegex.test(ledgerContent)) {
                  const lines = ledgerContent.split(/\r?\n/);
                  const updatedLines = lines.map(line => {
                    if (rowRegex.test(line)) {
                      return `| \`${relPath}\` | \`${metadata.category}\` | \`${metadata.status}\` | \`updated\` | ${metadata.notes || 'Updated via Doc Library Tool.'} |`;
                    }
                    return line;
                  });
                  fs.writeFileSync(ledgerPath, updatedLines.join('\n'), 'utf-8');
                } else {
                  ledgerContent += `\n| \`${relPath}\` | \`${metadata.category}\` | \`${metadata.status}\` | \`keep in place\` | ${metadata.notes || 'Registered via Doc Library Tool.'} |`;
                  fs.writeFileSync(ledgerPath, ledgerContent, 'utf-8');
                }
              }
            } catch (e) {
              console.warn('[Doc Library] Ledger sync failed:', e);
            }
            
            json({ success: true });
          } catch (e) {
            json({ error: String(e) }, 500);
          }
        });
        return;
      }

      if (urlPath === '/api/docs/delete' && req.method === 'POST') {
        let bodyAccumulator = '';
        req.on('data', (chunk: any) => { bodyAccumulator += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(bodyAccumulator);
            const { path: relPath, action, justification } = data;
            
            if (!relPath || !relPath.endsWith('.md')) {
              json({ error: 'Invalid path' }, 400);
              return;
            }
            const safePath = path.resolve(process.cwd(), relPath);
            if (!safePath.startsWith(process.cwd())) {
              json({ error: 'Access denied' }, 403);
              return;
            }
            if (!fs.existsSync(safePath)) {
              json({ error: 'File not found' }, 404);
              return;
            }
            
            try {
              const ledgerPath = path.resolve(process.cwd(), 'docs/registry/@DOC-REVIEW-LEDGER.md');
              if (fs.existsSync(ledgerPath)) {
                let ledgerContent = fs.readFileSync(ledgerPath, 'utf-8');
                const escapedPath = relPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const rowRegex = new RegExp(`\\|\\s*\`?${escapedPath}\`?\\s*\\|`, 'i');
                const disp = action === 'retire' ? 'retire' : 'delete';
                if (rowRegex.test(ledgerContent)) {
                  const lines = ledgerContent.split(/\r?\n/);
                  const updatedLines = lines.map(line => {
                    if (rowRegex.test(line)) {
                      return `| \`${relPath}\` | \`deleted\` | \`archived\` | \`${disp}\` | Justification: ${justification || 'Deleted via Doc Library Tool.'} |`;
                    }
                    return line;
                  });
                  fs.writeFileSync(ledgerPath, updatedLines.join('\n'), 'utf-8');
                } else {
                  ledgerContent += `\n| \`${relPath}\` | \`deleted\` | \`archived\` | \`${disp}\` | Justification: ${justification || 'Deleted via Doc Library Tool.'} |`;
                  fs.writeFileSync(ledgerPath, ledgerContent, 'utf-8');
                }
              }
            } catch (e) {
              console.warn('[Doc Library] Ledger delete-sync failed:', e);
            }
            
            if (action === 'retire') {
              const dirName = path.dirname(safePath);
              const baseName = path.basename(safePath, '.md');
              const retiredPath = path.join(dirName, `${baseName}~.md`);
              
              fs.renameSync(safePath, retiredPath);
              
              try {
                let content = fs.readFileSync(retiredPath, 'utf-8');
                const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
                if (fmMatch) {
                  let block = fmMatch[1].replace(/\r/g, '');
                  if (block.match(/^status:\s*(.+)$/m)) {
                    block = block.replace(/^status:\s*(.+)$/m, 'status: "archived"');
                  } else {
                    block += '\nstatus: "archived"';
                  }
                  const fullContent = `---\n${block}\n---\n${fmMatch[2]}`;
                  fs.writeFileSync(retiredPath, fullContent, 'utf-8');
                }
              } catch (_) {}
              
              json({ success: true, action: 'retired', newPath: path.relative(process.cwd(), retiredPath).replace(/\\/g, '/') });
            } else {
              fs.unlinkSync(safePath);
              json({ success: true, action: 'deleted' });
            }
          } catch (e) {
            json({ error: String(e) }, 500);
          }
        });
        return;
      }

      next();
    });
  }
});
