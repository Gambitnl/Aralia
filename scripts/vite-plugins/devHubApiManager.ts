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
import { buildDocUsage } from './docUsage/buildDocUsage';

/**
 * This file adds local-only API routes to the Vite development server.
 *
 * The Dev Hub browser pages call these routes to read project documentation,
 * spell inventories, GitHub status, and editable markdown files without adding
 * a separate database. The project dashboard routes below read docs/projects
 * directly and return small status signals that shared browser components turn
 * into visual cards.
 */
let _docUsageCache: { generatedAt: string; payload: unknown } | null = null;
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
      repoPath: string;
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
      { key: 'decisions', token: 'D', label: 'Decisions', fileName: 'DECISIONS.md', required: true },
      { key: 'proof', token: 'P', label: 'Proof', fileName: 'AUDIT_OR_PROOF.md', required: true },
      { key: 'runbook', token: 'R', label: 'Runbook', fileName: 'RUNBOOK.md', required: true },
    ];

    const subprojectDocRole: ProjectDocRole = {
      key: 'subprojects',
      token: 'S',
      label: 'Subprojects',
      fileName: 'SUBPROJECTS.md',
      required: true,
    };

    const requiredProjectSchemaFields = [
      'schemaversion',
      'project',
      'slug',
      'category',
      'maincategory',
      'subcategory',
      'status',
      'lastupdated',
      'confidence',
      'evidence',
      'gapsignal',
      'protocol',
      'nextstep',
      'agentcomments',
      'requireddocs',
      'optionaldocs',
      'requiredverification',
      'completedverification',
      'lastproof',
      'workflowgapsreviewed',
      'compactionstatus',
      'lifecyclestatus',
      'deprecationconfidence',
      'deprecationreason',
      'canonicalowner',
      'humandecisionrequired',
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
      // It accepts both the newer "Label: value" block and the older two-column
      // markdown table form used by some living-project North Stars.
      const fields: Record<string, string> = {};
      const lines = content.split(/\r?\n/);
      const headingPattern = new RegExp('^##\\s+' + headingName + '\\s*$', 'i');
      const startIndex = lines.findIndex((line) => headingPattern.test(stripMarkdownInline(line).trim()));
      if (startIndex < 0) return fields;

      for (const line of lines.slice(startIndex + 1)) {
        if (/^##\s+/.test(line)) break;
        const match = line.match(/^\s*([^:]+?)\s*:\s*(.+)\s*$/);
        if (match) {
          const key = toProjectSlug(match[1]).replace(/-/g, '');
          fields[key] = stripMarkdownInline(match[2]).trim();
          continue;
        }

        const tableCells = line.split('|').slice(1, -1).map((cell) => cell.trim());
        if (tableCells.length < 2) continue;
        if (/^-+$/.test(tableCells[0].replace(/\s/g, '')) || /^field$/i.test(stripMarkdownInline(tableCells[0]))) continue;
        const key = toProjectSlug(tableCells[0]).replace(/-/g, '');
        fields[key] = stripMarkdownInline(tableCells.slice(1).join(' | ')).trim();
      }

      return fields;
    };

    const markdownTableRows = (content: string, requiredHeader: string) => {
      // Parent-project registries store their lane data in ordinary markdown
      // tables. This parser intentionally handles only simple pipe tables so
      // SUBPROJECTS.md remains readable and editable by humans instead of
      // becoming a hidden JSON source.
      const rows: Array<Record<string, string>> = [];
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const headerLine = lines[i];
        if (!headerLine.trim().startsWith('|') || !headerLine.toLowerCase().includes(requiredHeader.toLowerCase())) continue;

        const separatorLine = lines[i + 1] || '';
        if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separatorLine)) continue;

        const headers = headerLine.split('|').slice(1, -1).map((cell) => stripMarkdownInline(cell).trim());
        for (const line of lines.slice(i + 2)) {
          if (!line.trim().startsWith('|')) break;
          const cells = line.split('|').slice(1, -1).map((cell) => stripMarkdownInline(cell).trim());
          if (cells.length < headers.length) continue;
          rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
        }
        break;
      }

      return rows;
    };

    const subprojectsFromMarkdown = (content: string) => {
      // The live project detail UI needs real lane objects, not just the raw
      // SUBPROJECTS.md document card. Keep the markdown table as source of truth
      // and translate it into the small shape shared by project_ui.js. When a
      // child lane points at its own NORTH_STAR.md, read that packet's
      // frontmatter too so the parent dashboard shows the child project's
      // iteration/pass state instead of leaving every row as "not recorded."
      return markdownTableRows(content, 'Subproject ID').map((row) => {
        const id = row['Subproject ID'] || '';
        const setupPath = row['Project setup'] || '';
        const setupAbsPath = setupPath ? path.resolve(process.cwd(), setupPath) : '';
        const setupContent = setupAbsPath && fs.existsSync(setupAbsPath)
          ? fs.readFileSync(setupAbsPath, 'utf-8')
          : '';
        const setupSchema = setupContent ? markdownFrontmatterFields(setupContent) : {};
        return {
          id,
          name: projectCardSchemaField(setupSchema, 'project') || toProjectDisplayName(id || 'unnamed-subproject'),
          setupPath,
          status: projectCardSchemaField(setupSchema, 'status') || row.Status || '',
          relationship: projectCardSchemaField(setupSchema, 'relationship') || row.Relationship || '',
          scope: row.Scope || '',
          evidence: projectCardSchemaField(setupSchema, 'evidence') || row['Existing project/task evidence'] || '',
          currentGapIds: row['Current gap IDs'] || '',
          nextAction: projectCardSchemaField(setupSchema, 'nextstep', 'nextStep') || row['Next high-impact slice'] || '',
          proof: projectCardSchemaField(setupSchema, 'requiredverification', 'requiredVerification') || row['Proof boundary'] || '',
          notes: row.Notes || '',
          iteration: Number(projectCardSchemaField(setupSchema, 'iteration') || 0),
          activeAgent: projectCardSchemaField(setupSchema, 'activeagent', 'activeAgent'),
          agentPassStatus: projectCardSchemaField(setupSchema, 'agentpassstatus', 'agentPassStatus'),
          agentPassStartedAt: projectCardSchemaField(setupSchema, 'agentpassstartedat', 'agentPassStartedAt'),
          agentPassEndedAt: projectCardSchemaField(setupSchema, 'agentpassendedat', 'agentPassEndedAt'),
        };
      });
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

    const markdownFrontmatterFields = (content: string) => {
      // YAML frontmatter is the preferred project schema because it gives agents
      // explicit fields to maintain and gives the dashboard stable keys to read.
      // This lightweight parser intentionally supports the simple scalar and
      // list shapes used by PROJECT_CARD_SCHEMA.md instead of trying to become a
      // full YAML engine.
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) return {};
      const fields: Record<string, any> = {};
      const lines = match[1].split(/\r?\n/);
      let activeListKey = '';

      for (const line of lines) {
        const listItem = line.match(/^\s*-\s+(.+)\s*$/);
        if (listItem && activeListKey) {
          fields[activeListKey] = [...(fields[activeListKey] || []), stripMarkdownInline(listItem[1]).replace(/^["']|["']$/g, '')];
          continue;
        }

        const scalar = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)\s*$/);
        if (!scalar) continue;
        activeListKey = '';
        const key = scalar[1].toLowerCase().replace(/[^a-z0-9]+/g, '');
        const rawValue = scalar[2].trim();
        if (!rawValue) {
          fields[key] = [];
          activeListKey = key;
          continue;
        }

        fields[key] = stripMarkdownInline(rawValue).replace(/^["']|["']$/g, '');
      }

      return fields;
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

    const projectCardSchemaList = (schema: Record<string, any>, ...keys: string[]) => {
      // Required/optional docs are list-shaped in frontmatter but may still be
      // comma-separated strings in legacy markdown or JSON. Normalize both so
      // doc coverage can be compared consistently.
      const value = projectCardSchemaField(schema, ...keys);
      return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
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

    const readJsonRequestBody = (req: any): Promise<any> => {
      // Vite's dev middleware does not parse JSON bodies for us. This helper
      // keeps write endpoints local and explicit so the project viewer can save
      // markdown without introducing a broader server framework.
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf-8');
          if (body.length > 2_000_000) {
            reject(new Error('Request body is too large.'));
          }
        });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (error) {
            reject(error);
          }
        });
        req.on('error', reject);
      });
    };

    const resolveProjectDocWritePath = (repoPath: string) => {
      // Live editing is intentionally limited to living-project markdown files.
      // This prevents the browser viewer from becoming a general filesystem
      // editor while still allowing agents/users to update project docs directly.
      const normalizedRepoPath = String(repoPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!/^docs\/projects\/[a-zA-Z0-9_-]+\/[A-Z0-9_/-]+\.md$/i.test(normalizedRepoPath)) {
        throw new Error('Only docs/projects/<project>/<file>.md can be edited from the project viewer.');
      }

      const projectsRoot = path.resolve(process.cwd(), 'docs', 'projects');
      const targetPath = path.resolve(process.cwd(), normalizedRepoPath);
      if (!targetPath.startsWith(projectsRoot + path.sep)) {
        throw new Error('Project doc path escaped docs/projects.');
      }

      return { normalizedRepoPath, targetPath };
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

    const requiredReviewBriefFromDocs = (
      northStarContent: string,
      trackerContent: string,
      gapsContent: string,
    ) => {
      // Review-required projects need more than a terse next-step sentence.
      // Agents can add a small markdown section named "Required Review Brief";
      // the dashboard turns that section into a decision panel with options.
      const fields = {
        ...markdownSectionFields(gapsContent, 'Required Review Brief'),
        ...markdownSectionFields(trackerContent, 'Required Review Brief'),
        ...markdownSectionFields(northStarContent, 'Required Review Brief'),
      };
      const options = ['optiona', 'optionb', 'optionc']
        .map((key) => projectCardSchemaField(fields, key))
        .filter(Boolean);

      return {
        title: projectCardSchemaField(fields, 'title') || '',
        question: projectCardSchemaField(fields, 'question') || '',
        issue: projectCardSchemaField(fields, 'issue') || '',
        currentBehavior: projectCardSchemaField(fields, 'currentbehavior') || '',
        whyBlocked: projectCardSchemaField(fields, 'whyblocked') || '',
        options,
        evidence: projectCardSchemaField(fields, 'evidence') || '',
        decisionOwner: projectCardSchemaField(fields, 'decisionowner') || '',
        proofAfterDecision: projectCardSchemaField(fields, 'proofafterdecision') || '',
      };
    };

    const markdownSectionContent = (content: string, headingName: string) => {
      // Small table-driven project features use named markdown sections so the
      // dashboard can render them without requiring a database. This helper
      // extracts one section body and stops at the next second-level heading.
      const lines = content.split(/\r?\n/);
      const headingPattern = new RegExp('^##\\s+' + headingName + '\\s*$', 'i');
      const startIndex = lines.findIndex((line) => headingPattern.test(stripMarkdownInline(line).trim()));
      if (startIndex < 0) return '';
      const body: string[] = [];
      for (const line of lines.slice(startIndex + 1)) {
        if (/^##\s+/.test(line)) break;
        body.push(line);
      }
      return body.join('\n').trim();
    };

    const decisionVisualizationsFromDocs = (
      northStarContent: string,
      trackerContent: string,
      gapsContent: string,
    ) => {
      // Decision visualizations are isolated "this is what I mean" pages for
      // choices a human has to make. Agents register them in a compact markdown
      // table so project detail pages can link to the examples directly.
      const sections = [northStarContent, trackerContent, gapsContent]
        .map((content) => markdownSectionContent(content, 'Decision Visualizations'))
        .filter(Boolean);

      return sections.flatMap((section) => section.split(/\r?\n/).flatMap((line) => {
        if (!line.startsWith('|')) return [];
        const rawCells = line.split('|').slice(1, -1).map((cell) => cell.trim());
        const cells = rawCells.map((cell) => stripMarkdownInline(cell).trim());
        if (cells.length < 5 || /^-+$/.test(cells.join('')) || /^decision$/i.test(cells[0])) return [];
        const visualHref = rawCells[2].match(/\(([^)]+)\)/)?.[1] || cells[2] || '';
        return [{
          decision: cells[0] || 'Unnamed decision',
          status: cells[1] || 'draft',
          href: visualHref,
          summary: cells[3] || '',
          owner: cells[4] || '',
        }];
      }));
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

    const iterationFromAgentPrompt = (agentPromptContent: string) => {
      // The cold-start prompt is the handoff packet agents read before an
      // iteration pass. Prefer the YAML handoff header because it is the stable
      // machine-readable index, then fall back to the Markdown handoff block so
      // older or partially edited packets remain visible.
      const promptSchema = markdownFrontmatterFields(agentPromptContent);
      const frontmatterIteration = Number(projectCardSchemaField(promptSchema, 'iteration'));
      if (Number.isFinite(frontmatterIteration) && frontmatterIteration > 0) return frontmatterIteration;
      const match = agentPromptContent.match(/^Iteration:\s*(\d+)/im);
      return match ? Number(match[1]) : 0;
    };

    const iterationAgentsFromPrompt = (agentPromptContent: string, iteration: number) => {
      // The workflow only recently started asking agents to identify their
      // runtime surface. Until a long-lived ledger exists, expose the current
      // handoff identity as a one-row table so the UI has a stable shape and
      // missing agent identity stays visible instead of being hidden.
      const ledgerRows = agentPromptContent.split(/\r?\n/).flatMap((line) => {
        if (!/^\|\s*\d+\s*\|/.test(line)) return [];
        const cells = line.split('|').slice(1, -1).map((cell) => stripMarkdownInline(cell).trim());
        if (cells.length < 6) return [];
        return [{
          iteration: Number(cells[0]) || 0,
          agent: cells[1] || 'Not recorded',
          surface: cells[2] || 'Not recorded',
          certainty: cells[3] || 'unknown',
          date: cells[4] || '',
          source: cells[5] || 'COLD_START_AGENT_PROMPT.md',
        }];
      }).filter((row) => row.iteration > 0);

      if (ledgerRows.length) return ledgerRows;

      const identityBlock = (agentPromptContent.match(/^Agent identity \/ runtime:\s*([\s\S]*?)(?:\n##|\n---END|\n\n[A-Z][^\n]*:|$)/im)?.[1] || '').trim();
      const compactIdentity = identityBlock
        .split(/\r?\n/)
        .map((line) => stripMarkdownInline(line.replace(/^[-*]\s+/, '').trim()))
        .filter(Boolean)
        .join(' ');

      if (!iteration) return [];

      return [{
        iteration,
        agent: compactIdentity || 'Not recorded',
        surface: compactIdentity || 'Not recorded',
        certainty: compactIdentity ? 'recorded in handoff' : 'missing',
        source: 'COLD_START_AGENT_PROMPT.md',
      }];
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
        repoPath: 'docs/projects/' + slug + '/' + role.fileName,
        size: stat?.size || 0,
        updatedAt: stat ? stat.mtime.toISOString() : null,
        declaredUpdated,
        freshness,
        freshnessLabel,
      };
    };

    const gapSignalFromGaps = (gapsContent: string, gapsFileExists: boolean) => {
      // Keep the row compact while still summarizing the live project gap file.
      // Prefer the YAML gap registry header because it lets the dashboard read
      // rows with project-prefixed IDs without guessing from freeform markdown.
      if (!gapsFileExists) return 'GAPS.md missing';
      const gapSchema = markdownFrontmatterFields(gapsContent);
      const openGapCount = Number(projectCardSchemaField(gapSchema, 'opengapcount'));
      const gapCount = Number(projectCardSchemaField(gapSchema, 'gapcount'));
      if (Number.isFinite(openGapCount) && Number.isFinite(gapCount)) {
        return String(openGapCount) + ' open / ' + String(gapCount) + ' total project gap' + (gapCount === 1 ? '' : 's');
      }
      if (Number.isFinite(openGapCount)) return String(openGapCount) + ' open project gap' + (openGapCount === 1 ? '' : 's');
      if (Number.isFinite(gapCount)) return String(gapCount) + ' tracked project gap' + (gapCount === 1 ? '' : 's');
      // Some older gap files use project-prefixed IDs such as OLL-G1,
      // WSS-005, or CMA-G19 instead of plain G1. Treat any markdown table row
      // after the header as a countable gap so the UI does not under-report
      // compact registries while they are being migrated.
      const gapRows = markdownSectionContent(gapsContent, 'Gap Log').split(/\r?\n/).filter((line) => {
        if (!line.startsWith('|')) return false;
        const cells = line.split('|').slice(1, -1).map((cell) => stripMarkdownInline(cell).trim());
        if (cells.length < 4) return false;
        if (/^gap id$/i.test(cells[0]) || /^id$/i.test(cells[0]) || /^-+$/.test(cells[0].replace(/\s/g, ''))) return false;
        return Boolean(cells[0]);
      });
      const openRows = gapRows.filter((line) => /\b(open|active|pending|blocked|not_started|in_progress|waiting|needs_validation|untriaged|routed|review-required|design_decision_deferred)\b/i.test(stripMarkdownInline(line)));
      if (gapRows.length) return String(openRows.length) + ' open / ' + String(gapRows.length) + ' total project gap' + (gapRows.length === 1 ? '' : 's');
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
      const agentPromptContent = readOptionalProjectText(projectDir, 'COLD_START_AGENT_PROMPT.md');
      const iteration = iterationFromAgentPrompt(agentPromptContent);
      const iterationAgents = iterationAgentsFromPrompt(agentPromptContent, iteration);
      // The YAML badge needs a stricter signal than the general dashboard
      // schema. Legacy markdown sections and PROJECT_CARD.json still power the
      // card, but only frontmatter should count as "yaml" for the visible chip.
      const frontmatterSchema = {
        ...markdownFrontmatterFields(trackerContent),
        ...markdownFrontmatterFields(northStarContent),
      };
      const dashboardSchema = {
        ...readProjectCardJson(projectDir),
        ...markdownSectionFields(trackerContent, 'Dashboard Card Schema'),
        ...markdownSectionFields(northStarContent, 'Dashboard Card Schema'),
        ...frontmatterSchema,
      };
      const northStarDate = normalizeProjectDate(markdownField(northStarContent, 'Last updated'));
      const projectMode = projectCardSchemaField(dashboardSchema, 'projectmode', 'projectMode') || 'single';
      const declaredRequiredDocs = projectCardSchemaList(dashboardSchema, 'requireddocs', 'requiredDocs');
      const usesSubprojects = projectMode === 'parent_with_subprojects' || declaredRequiredDocs.includes('SUBPROJECTS.md');
      const activeDocRoles = usesSubprojects ? [...projectDocRoles, subprojectDocRole] : projectDocRoles;
      const docSet = activeDocRoles.map((role) => readProjectDocSignal(projectDir, slug, role, northStarDate));
      const docs = Object.fromEntries(docSet.map((doc) => [doc.key, doc]));
      const declaredDocDates = docSet.map((doc) => doc.declaredUpdated).filter(Boolean).sort();
      const inferredLastUpdated = declaredDocDates[declaredDocDates.length - 1] || northStarDate;
      const schemaKeys = new Set(Object.keys(dashboardSchema));
      const missingSchemaFields = requiredProjectSchemaFields.filter((field) => !schemaKeys.has(field));
      const schemaStatus = !schemaKeys.size ? 'inferred' : missingSchemaFields.length ? 'partial' : 'valid';
      // A project earns the green YAML chip only when frontmatter covers every
      // field listed as required by PROJECT_CARD_SCHEMA.md. Missing fields stay
      // visible so future agents can fix the project docs instead of guessing.
      const yamlSchemaKeys = new Set(Object.keys(frontmatterSchema));
      const missingYamlSchemaFields = requiredProjectSchemaFields.filter((field) => !yamlSchemaKeys.has(field));
      const yamlStatus = missingYamlSchemaFields.length ? 'not-yaml' : 'yaml';
      const declaredOptionalDocs = projectCardSchemaList(dashboardSchema, 'optionaldocs', 'optionalDocs');
      const requiredDocNames = declaredRequiredDocs.length ? declaredRequiredDocs : activeDocRoles.map((role) => role.fileName);
      const missingDeclaredDocs = requiredDocNames
        .filter((fileName) => /\.md$/i.test(fileName))
        .filter((fileName) => !fs.existsSync(path.join(projectDir, fileName)));
      const dirtySchemaDates = ['lastupdated', 'workflowgapsreviewed', 'lastproof']
        .filter((field) => {
          const value = projectCardSchemaField(dashboardSchema, field);
          return value && !/^\d{4}-\d{2}-\d{2}$/.test(value);
        });
      const schemaWarnings = [
        ...(!schemaKeys.size ? ['schema frontmatter/section missing'] : []),
        ...(missingDeclaredDocs.length ? ['required docs missing'] : []),
        ...(dirtySchemaDates.length ? ['dirty machine date fields: ' + dirtySchemaDates.join(', ')] : []),
      ];
      const requiredDocs = docSet.filter((doc) => doc.required);
      const docsComplete = requiredDocs.every((doc) => doc.exists);
      const docsCurrent = requiredDocs.every((doc) => doc.exists && doc.freshness === 'current');
      const staleDocs = docSet.filter((doc) => doc.exists && ['stale', 'ahead', 'undated'].includes(doc.freshness));
      const purpose = firstProjectParagraph(northStarContent, 'Purpose');
      const resumePath = firstProjectParagraph(northStarContent, 'Resume Path');
      const trackerNextStep = nextStepFromTracker(trackerContent);
      const requiredReviewBrief = requiredReviewBriefFromDocs(northStarContent, trackerContent, gapsContent);
      const decisionVisualizations = decisionVisualizationsFromDocs(northStarContent, trackerContent, gapsContent);
      const subprojectsContent = usesSubprojects ? readOptionalProjectText(projectDir, 'SUBPROJECTS.md') : '';
      const subprojectRegistrySchema = subprojectsContent ? markdownFrontmatterFields(subprojectsContent) : {};
      const subprojects = subprojectsFromMarkdown(subprojectsContent);

      return {
        slug,
        name: projectCardSchemaField(dashboardSchema, 'project') || trackerFallback.project || projectTitleFromDocs(slug, northStarContent, trackerContent),
        category: projectCardSchemaField(dashboardSchema, 'category') || trackerFallback.category || 'Unregistered Project Folder',
        mainCategory: projectCardSchemaField(dashboardSchema, 'maincategory', 'mainCategory'),
        subcategory: projectCardSchemaField(dashboardSchema, 'subcategory'),
        status: projectCardSchemaField(dashboardSchema, 'status') || markdownField(northStarContent, 'Status') || markdownField(trackerContent, 'Status') || trackerFallback.status || 'tracked',
        lastUpdated: projectCardSchemaField(dashboardSchema, 'lastupdated', 'lastUpdated') || inferredLastUpdated || '',
        confidence: projectCardSchemaField(dashboardSchema, 'confidence') || trackerFallback.confidence || 'unknown',
        evidence: projectCardSchemaField(dashboardSchema, 'evidence') || trackerFallback.evidence || 'docs/projects/' + slug,
        gapSignal: gapSignalFromGaps(gapsContent, Boolean(docs.gaps?.exists)) || projectCardSchemaField(dashboardSchema, 'gapsignal', 'gapSignal') || trackerFallback.gapSignal || 'See project gap file',
        protocol: projectCardSchemaField(dashboardSchema, 'protocol') || trackerFallback.protocol || (docsComplete ? 'living project doc set' : 'incomplete project doc set'),
        nextStep: projectCardSchemaField(dashboardSchema, 'nextstep', 'nextStep') || trackerNextStep || resumePath || purpose || trackerFallback.nextStep || 'Add next action to TRACKER.md',
        projectMode,
        subprojectTracker: projectCardSchemaField(dashboardSchema, 'subprojecttracker', 'subprojectTracker') || (usesSubprojects ? `docs/projects/${slug}/SUBPROJECTS.md` : ''),
        subprojectCount: Number(projectCardSchemaField(dashboardSchema, 'subprojectcount', 'subprojectCount') || subprojects.length || 0),
        subprojectSignal: projectCardSchemaField(dashboardSchema, 'subprojectsignal', 'subprojectSignal') || (subprojects.length ? `${subprojects.length} subproject lanes tracked` : ''),
        highestPrioritySubproject: projectCardSchemaField(subprojectRegistrySchema, 'highestpriority', 'highestPriority') || '',
        subprojectProofFreshness: projectCardSchemaField(subprojectRegistrySchema, 'prooffreshness', 'proofFreshness') || '',
        subprojects,
        iteration,
        iterationLabel: iteration > 0 ? `Iteration ${iteration}` : 'Iteration not recorded',
        iterationAgents,
        requiredVerification: projectCardSchemaField(dashboardSchema, 'requiredverification', 'requiredVerification'),
        completedVerification: projectCardSchemaField(dashboardSchema, 'completedverification', 'completedVerification'),
        lastProof: projectCardSchemaField(dashboardSchema, 'lastproof', 'lastProof'),
        workflowGapsReviewed: projectCardSchemaField(dashboardSchema, 'workflowgapsreviewed', 'workflowGapsReviewed'),
        agentComments: projectCardSchemaField(dashboardSchema, 'agentcomments', 'agentComments'),
        activeAgent: projectCardSchemaField(dashboardSchema, 'activeagent', 'activeAgent'),
        agentPassStatus: projectCardSchemaField(dashboardSchema, 'agentpassstatus', 'agentPassStatus'),
        agentPassStartedAt: projectCardSchemaField(dashboardSchema, 'agentpassstartedat', 'agentPassStartedAt'),
        agentPassEndedAt: projectCardSchemaField(dashboardSchema, 'agentpassendedat', 'agentPassEndedAt'),
        requiredDocs: declaredRequiredDocs.join(', '),
        optionalDocs: declaredOptionalDocs.join(', '),
        compactionStatus: projectCardSchemaField(dashboardSchema, 'compactionstatus', 'compactionStatus'),
        lifecycleStatus: projectCardSchemaField(dashboardSchema, 'lifecyclestatus', 'lifecycleStatus') || 'active',
        deprecationConfidence: projectCardSchemaField(dashboardSchema, 'deprecationconfidence', 'deprecationConfidence') || 'none',
        deprecationReason: projectCardSchemaField(dashboardSchema, 'deprecationreason', 'deprecationReason'),
        canonicalOwner: projectCardSchemaField(dashboardSchema, 'canonicalowner', 'canonicalOwner'),
        humanDecisionRequired: projectCardSchemaField(dashboardSchema, 'humandecisionrequired', 'humanDecisionRequired') || 'no',
        requiredReviewBrief,
        decisionVisualizations,
        dashboardSchemaPresent: schemaKeys.size > 0,
        schemaStatus,
        missingSchemaFields,
        yamlSchemaPresent: yamlSchemaKeys.size > 0,
        yamlStatus,
        missingYamlSchemaFields,
        schemaWarnings,
        declaredRequiredDocs,
        declaredOptionalDocs,
        missingDeclaredDocs,
        canonicalDocCoverageStatus: missingDeclaredDocs.length ? 'missing_required' : 'complete',
        docsComplete,
        docsCurrent,
        staleDocCount: staleDocs.length,
        docSet,
        docs,
        links: Object.fromEntries(docSet.map((doc) => [doc.key, doc.href])),
      };
    };

    server.middlewares.use(async (req: any, res: any, next: any) => {
      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      const urlPath = parsedUrl.pathname;

      if (urlPath === '/api/projects/doc' && req.method === 'POST') {
        try {
          const body = await readJsonRequestBody(req);
          const { normalizedRepoPath, targetPath } = resolveProjectDocWritePath(body.path);
          const content = String(body.content ?? '');

          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, content, 'utf-8');
          const stat = fs.statSync(targetPath);

          json({
            ok: true,
            path: normalizedRepoPath,
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
          });
        } catch (e) {
          json({ error: String(e) }, 400);
        }
        return;
      }

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
          const iterationCounts = projects.map((project: any) => Number(project.iteration || 0)).filter((count: number) => Number.isFinite(count));
          const iterationCountTotal = iterationCounts.reduce((sum: number, count: number) => sum + count, 0);
          const iterationRecordedCount = iterationCounts.filter((count: number) => count > 0).length;

          json({
            generatedAt: new Date().toISOString(),
            projectCount: projects.length,
            docsCompleteCount: projects.filter((project: any) => project.docsComplete).length,
            docsCurrentCount: projects.filter((project: any) => project.docsCurrent).length,
            iterationCountTotal,
            iterationCountMax: iterationCounts.length ? Math.max(...iterationCounts) : 0,
            iterationCountAverage: iterationRecordedCount ? iterationCountTotal / iterationRecordedCount : 0,
            iterationRecordedCount,
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

      // ============================================================================
      // Ollama Dashboard Status Probe Routes
      // ============================================================================
      // This section provides server-side capability to audit the local Ollama
      // installation, process execution state, active ports, memory usage,
      // loaded model parameters, and recent console log outputs.
      // These routes are leveraged by the local Ollama dashboard to poll status.
      // ============================================================================

      // Probe Ollama Process: Audit whether the server process is currently running,
      // and read its active RAM size, handle counts, and path configuration.
      if (urlPath === '/api/ollama-check/process') {
        // Query process list via PowerShell as a native Windows check.
        exec('powershell -NoLogo -Command "Get-Process ollama -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, CPU, WorkingSet, Handles, NPM, PM, Path | ConvertTo-Json -Compress"', (err, stdout) => {
          if (err || !stdout.trim()) {
            // Process not found or PowerShell returned empty output.
            json({ running: false });
          } else {
            try {
              // Parse process metrics returned from PowerShell.
              json({ running: true, process: JSON.parse(stdout.trim()) });
            } catch (e) {
              // Handle JSON parsing edge cases or multiple returned process instances.
              json({ running: true, raw: stdout.trim() });
            }
          }
        });
        return;
      }

      // Probe Ollama Port: Read active TCP connections bound to the default Ollama
      // port 11434 to check for open sockets and client connections.
      if (urlPath === '/api/ollama-check/port') {
        // Run network inspection command using native Windows PowerShell commands.
        exec('powershell -NoLogo -Command "Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess | ConvertTo-Json -Compress"', (err, stdout) => {
          if (err || !stdout.trim()) {
            // No sockets open on this port.
            json({ connections: [] });
          } else {
            try {
              // Parse network status records. Convert single-object outputs into arrays.
              const parsed = JSON.parse(stdout.trim());
              const connections = Array.isArray(parsed) ? parsed : [parsed];
              json({ connections });
            } catch (e) {
              json({ connections: [], raw: stdout.trim() });
            }
          }
        });
        return;
      }

      // Probe Loaded Models: Reach out to the local Ollama API to see if any
      // language model weights are currently resident in CPU/GPU memory.
      if (urlPath === '/api/ollama-check/models') {
        // Make request directly to Ollama's active model API endpoint.
        fetch('http://localhost:11434/api/ps')
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            // Return model details indicating a responsive service.
            json({ offline: false, ...data });
          })
          .catch(err => {
            // Service is unreachable or returned an error state.
            json({ offline: true, error: err.message });
          });
        return;
      }

      // Read Log Output: Extract the tail of the local log files to see
      // active API queries, engine load times, and error indicators.
      // Supports "?type=app" (app.log) or "?type=server" (server.log).
      if (urlPath === '/api/ollama-check/logs') {
        try {
          const logType = parsedUrl.searchParams.get('type') === 'server' ? 'server' : 'app';
          const filename = logType === 'server' ? 'server.log' : 'app.log';
          
          // Resolve target path in user's AppData directory on Windows.
          const logPath = path.join(process.env.LOCALAPPDATA || '', 'Ollama', filename);
          if (!fs.existsSync(logPath)) {
            // Log file not created yet (e.g. fresh installation).
            json({ exists: false, lines: [], type: logType });
            return;
          }
          
          // Read log file tail using raw Node fs functions to avoid locking the file.
          const stat = fs.statSync(logPath);
          const fd = fs.openSync(logPath, 'r');
          const maxBytes = 128 * 1024; // Read last 128KB of the log.
          const readSize = Math.min(maxBytes, stat.size);
          const buffer = Buffer.alloc(readSize);
          fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
          fs.closeSync(fd);
          
          // Format raw bytes and split into lines, filtering out empty entries.
          const logContent = buffer.toString('utf8');
          const lines = logContent.split(/\r?\n/).filter(line => line.trim().length > 0);
          
          // Return the last 50 lines of logs.
          json({ exists: true, path: logPath, lines: lines.slice(-50), type: logType });
        } catch (e: any) {
          // Error opening log file or parsing file descriptor (e.g. permission issues).
          json({ exists: false, error: e.message });
        }
        return;
      }

      // Live URL inventory — a real filesystem scan for the URL Directory page.
      // The page renders an instant build-time list (import.meta.glob + routes.ts),
      // then calls this so a "Rescan" button can pick up HTML pages or phases
      // added/removed on disk WITHOUT a rebuild. Parsing source here (rather than
      // importing the TS) keeps this server-side and dependency-free.
      if (urlPath === '/api/dev/url-inventory') {
        try {
          const root = process.cwd();
          const base = '/Aralia/';

          // 1. In-app phase routes: GamePhase enum members + clean-slug overrides.
          const coreSrc = fs.readFileSync(path.resolve(root, 'src/types/core.ts'), 'utf-8');
          const enumBody = coreSrc.match(/export enum GamePhase\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
          const phaseNames = enumBody
            .split(/\r?\n/)
            .map((line) => line.replace(/\/\/.*$/, '').trim()) // strip line comments
            .map((line) => line.match(/^([A-Z][A-Z0-9_]*)\s*(?:=|,|$)/)?.[1])
            .filter((name): name is string => Boolean(name));

          const routesSrc = fs.readFileSync(path.resolve(root, 'src/routes.ts'), 'utf-8');
          const overrides: Record<string, string> = {};
          for (const m of routesSrc.matchAll(/\[GamePhase\.([A-Z0-9_]+)\]:\s*'([^']+)'/g)) {
            overrides[m[1]] = m[2];
          }
          const phaseRoutes = phaseNames.map((name) => {
            const slug = overrides[name] ?? name.toLowerCase();
            return { label: name, slug, url: `${base}?phase=${slug}`, clean: name in overrides };
          });

          // 2. Standalone HTML pages — real directory listings.
          const globHtml = (dir: string, tag: string) => {
            const abs = path.resolve(root, dir);
            if (!fs.existsSync(abs)) return [];
            return fs
              .readdirSync(abs)
              .filter((f: string) => f.endsWith('.html'))
              .sort()
              .map((f: string) => ({
                tag,
                label: f.replace(/\.html$/, '').replace(/[_-]/g, ' '),
                file: `${dir}/${f}`,
                url: `${base}${dir}/${f}`,
              }));
          };
          // Load standalone HTML pages located in the misc/ directory.
          const miscPages = [
            ...globHtml('misc', 'misc'),
            // Manually register the Ollama diagnostics dashboard page since it resides
            // in its own dedicated subfolder under tools/ rather than misc/ root.
            ...(fs.existsSync(path.resolve(root, 'tools/ollama/index.html'))
              ? [{ tag: 'tool', label: 'Ollama dashboard', file: 'tools/ollama/index.html', url: `${base}tools/ollama/index.html` }]
              : [])
          ];
          // Load standalone roadmap HTML pages.
          const roadmapPages = globHtml('devtools/roadmap', 'roadmap');

          // 3. Deep-link flags handled outside the phase system.
          const flags = [
            {
              label: 'World Map / World Generation',
              url: `${base}?worldmap=1`,
              note: '?worldmap=1  (alias: ?view=worldgen)',
            },
          ];

          json({
            scannedAt: new Date().toISOString(),
            counts: {
              phases: phaseRoutes.length,
              pages: miscPages.length + roadmapPages.length,
              flags: flags.length,
            },
            rootApp: [{ label: 'Main Game', url: base }],
            phaseRoutes,
            flags,
            miscPages,
            roadmapPages,
          });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
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

      if (urlPath === '/api/docs/usage') {
        try {
          const refresh = /[?&]refresh=1\b/.test(req.url || '');
          if (refresh || !_docUsageCache) {
            const payload = buildDocUsage(process.cwd());
            _docUsageCache = { generatedAt: payload.generatedAt, payload };
          }
          json(_docUsageCache.payload);
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
