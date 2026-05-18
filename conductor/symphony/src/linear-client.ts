// ============================================================================
// Linear Client — Issue Tracker Adapter
// ============================================================================
// GraphQL client for the Linear issue tracker, implementing the three
// required tracker operations from SPEC Section 11.
//
// Handles:
// - Candidate issue fetching with pagination (Section 11.2)
// - Issue state refresh by IDs (reconciliation)
// - Terminal-state issue fetching (startup cleanup)
// - Normalization to the domain Issue model (Section 11.3)
// ============================================================================

import type { Issue, BlockerRef } from './types.js';
import { TrackerError } from './types.js';
import { Logger } from './logger.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PAGE_SIZE = 50;
const NETWORK_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// GraphQL query fragments
// ---------------------------------------------------------------------------

/**
 * Shared fields for issue normalization.
 * Kept as a fragment-like string to avoid duplication across queries.
 */
const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  priority
  url
  branchName
  createdAt
  updatedAt
  state {
    name
  }
  labels {
    nodes {
      name
    }
  }
  inverseRelations {
    nodes {
      type
      issue {
        id
        identifier
        state {
          name
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch candidate issues for a project, paginated */
const CANDIDATE_ISSUES_QUERY = `
  query CandidateIssues($projectSlug: String!, $stateNames: [String!]!, $after: String) {
    issues(
      filter: {
        project: { slugId: { eq: $projectSlug } }
        state: { name: { in: $stateNames } }
      }
      first: ${PAGE_SIZE}
      after: $after
    ) {
      nodes {
        ${ISSUE_FIELDS}
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/** Fetch one issue state by ID for reconciliation.
 * Linear's public GraphQL API accepts issue(id), while the earlier bulk
 * nodes(ids) query returns a validation error in this workspace. Reconciliation
 * usually checks only the currently running issues, so issuing one small query
 * per running issue preserves behavior without inventing a broader tracker API.
 */
const ISSUE_STATE_BY_ID_QUERY = `
  query IssueState($id: String!) {
    issue(id: $id) {
      id
      identifier
      state {
        name
      }
    }
  }
`;

/** Fetch issues in terminal states (for startup cleanup) */
const TERMINAL_ISSUES_QUERY = `
  query TerminalIssues($projectSlug: String!, $stateNames: [String!]!, $after: String) {
    issues(
      filter: {
        project: { slugId: { eq: $projectSlug } }
        state: { name: { in: $stateNames } }
      }
      first: ${PAGE_SIZE}
      after: $after
    ) {
      nodes {
        id
        identifier
        state {
          name
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/** Find the configured Linear project so dashboard-created tasks can be filed
 * into the same project the polling loop already watches. The project owns the
 * team id required by issueCreate, so the dashboard does not need the user to
 * understand Linear team/project internals before starting a Jules task.
 */
const PROJECT_FOR_CREATE_QUERY = `
  query ProjectForCreate($projectSlug: String!) {
    projects(filter: { slugId: { eq: $projectSlug } }, first: 1) {
      nodes {
        id
        name
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    }
  }
`;

/** Create one tracking issue for a dashboard task draft. The resulting issue is
 * still just normal Linear data; Symphony's poller can claim it later and run a
 * foreman worker using the same prompt contract as hand-written issues.
 */
const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        ${ISSUE_FIELDS}
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Linear Client
// ---------------------------------------------------------------------------
export class LinearClient {
  private endpoint: string;
  private apiKey: string;
  private projectSlug: string;
  private activeStates: string[];
  private terminalStates: string[];
  private log: Logger;

  constructor(opts: {
    endpoint: string;
    apiKey: string;
    projectSlug: string;
    activeStates: string[];
    terminalStates: string[];
    logger: Logger;
  }) {
    this.endpoint = opts.endpoint;
    this.apiKey = opts.apiKey;
    this.projectSlug = opts.projectSlug;
    this.activeStates = opts.activeStates;
    this.terminalStates = opts.terminalStates;
    this.log = opts.logger.child({ component: 'linear' });
  }

  // -------------------------------------------------------------------------
  // 11.1 — Required operation #1: fetch candidate issues
  // -------------------------------------------------------------------------

  /**
   * Fetch all issues in active states for the configured project.
   * Handles pagination automatically.
   */
  async fetchCandidateIssues(): Promise<Issue[]> {
    this.log.debug('Fetching candidate issues', {
      projectSlug: this.projectSlug,
      activeStates: this.activeStates.join(','),
    });

    const allIssues: Issue[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const variables: Record<string, unknown> = {
        projectSlug: this.projectSlug,
        stateNames: this.activeStates,
      };
      if (cursor) variables.after = cursor;

      const data = await this.executeQuery(CANDIDATE_ISSUES_QUERY, variables);
      const issuesPayload = data?.issues;

      if (!issuesPayload?.nodes) {
        throw new TrackerError(
          'linear_unknown_payload',
          'Unexpected response shape from Linear candidate issues query'
        );
      }

      for (const node of issuesPayload.nodes) {
        allIssues.push(normalizeIssue(node));
      }

      hasNextPage = issuesPayload.pageInfo?.hasNextPage ?? false;
      if (hasNextPage) {
        cursor = issuesPayload.pageInfo?.endCursor;
        if (!cursor) {
          throw new TrackerError(
            'linear_missing_end_cursor',
            'Linear pagination: hasNextPage=true but endCursor is missing'
          );
        }
      }
    }

    this.log.info('Fetched candidate issues', { count: allIssues.length });
    return allIssues;
  }

  // -------------------------------------------------------------------------
  // 11.1 — Required operation #2: fetch issue states by IDs
  // -------------------------------------------------------------------------

  /**
   * Fetch current states for specific issue IDs (for reconciliation).
   * Returns minimal issue objects with id, identifier, and state.
   */
  async fetchIssueStatesByIds(
    issueIds: string[]
  ): Promise<{ id: string; identifier: string; state: string }[]> {
    if (issueIds.length === 0) return [];

    this.log.debug('Fetching issue states', { count: issueIds.length });

    const states: { id: string; identifier: string; state: string }[] = [];

    for (const id of issueIds) {
      const data = await this.executeQuery(ISSUE_STATE_BY_ID_QUERY, { id });
      const issue = data?.issue;

      // Deleted or inaccessible issues are ignored here. Reconciliation will
      // keep the worker running until a later poll proves the issue is no
      // longer active, which is safer than aborting on a transient missing row.
      if (!issue?.id || !issue?.state) continue;

      states.push({
        id: issue.id as string,
        identifier: (issue.identifier as string) ?? '',
        state: ((issue.state as Record<string, string>)?.name as string) ?? '',
      });
    }

    return states;
  }

  // -------------------------------------------------------------------------
  // 11.1 — Required operation #3: fetch terminal-state issues
  // -------------------------------------------------------------------------

  /**
   * Fetch issues in terminal states for startup cleanup.
   * Returns identifiers of issues that should have their workspaces cleaned.
   */
  async fetchTerminalIssues(): Promise<
    { id: string; identifier: string }[]
  > {
    if (this.terminalStates.length === 0) return [];

    this.log.debug('Fetching terminal issues for cleanup');

    const allIssues: { id: string; identifier: string }[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const variables: Record<string, unknown> = {
        projectSlug: this.projectSlug,
        stateNames: this.terminalStates,
      };
      if (cursor) variables.after = cursor;

      const data = await this.executeQuery(TERMINAL_ISSUES_QUERY, variables);
      const issuesPayload = data?.issues;

      if (!issuesPayload?.nodes) {
        throw new TrackerError(
          'linear_unknown_payload',
          'Unexpected response from Linear terminal issues query'
        );
      }

      for (const node of issuesPayload.nodes) {
        allIssues.push({
          id: node.id,
          identifier: node.identifier,
        });
      }

      hasNextPage = issuesPayload.pageInfo?.hasNextPage ?? false;
      if (hasNextPage) {
        cursor = issuesPayload.pageInfo?.endCursor;
        if (!cursor) {
          throw new TrackerError(
            'linear_missing_end_cursor',
            'Linear pagination: hasNextPage=true but endCursor is missing'
          );
        }
      }
    }

    this.log.info('Fetched terminal issues', { count: allIssues.length });
    return allIssues;
  }

  // -------------------------------------------------------------------------
  // Dashboard task intake — create a tracked issue from a local draft
  // -------------------------------------------------------------------------

  async createProjectIssue(input: {
    title: string;
    description: string;
  }): Promise<Issue> {
    const title = input.title.trim();
    const description = input.description.trim();

    if (!title) {
      throw new TrackerError('linear_api_request', 'Linear issue title is required');
    }

    // Dashboard-created issues are the first irreversible bridge out of the
    // local draft queue. Validate local Linear configuration before any network
    // call so missing credentials or project routing appear as clear blockers
    // instead of vague API failures.
    if (!this.apiKey.trim()) {
      throw new TrackerError(
        'missing_tracker_api_key',
        'Linear API key is missing. Set tracker.api_key or LINEAR_API_KEY before creating dashboard tasks.'
      );
    }

    if (!this.projectSlug.trim()) {
      throw new TrackerError(
        'missing_tracker_project_slug',
        'Linear project slug is missing. Set tracker.project_slug before creating dashboard tasks.'
      );
    }

    const projectData = await this.executeQuery(PROJECT_FOR_CREATE_QUERY, {
      projectSlug: this.projectSlug,
    });
    const project = projectData?.projects?.nodes?.[0];
    const team = project?.teams?.nodes?.[0];

    if (!project?.id || !team?.id) {
      throw new TrackerError(
        'linear_unknown_payload',
        `Could not resolve Linear project/team for project slug ${this.projectSlug}`
      );
    }

    const data = await this.executeQuery(CREATE_ISSUE_MUTATION, {
      input: {
        title,
        description,
        teamId: team.id,
        projectId: project.id,
      },
    });
    const payload = data?.issueCreate;

    if (!payload?.success || !payload.issue) {
      throw new TrackerError(
        'linear_unknown_payload',
        'Linear issueCreate did not return a created issue'
      );
    }

    this.log.info('Created Linear tracking issue from dashboard draft', {
      identifier: payload.issue.identifier,
      projectSlug: this.projectSlug,
    });

    return normalizeIssue(payload.issue);
  }

  // -------------------------------------------------------------------------
  // GraphQL execution
  // -------------------------------------------------------------------------

  /**
   * Execute a GraphQL query against the Linear API.
   * Handles auth, timeouts, and error normalization.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeQuery(query: string, variables: Record<string, unknown>): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.apiKey,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new TrackerError(
          'linear_api_status',
          `Linear API returned status ${response.status}: ${response.statusText}`
        );
      }

      const json = await response.json();

      // Check for GraphQL-level errors
      if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
        const messages = json.errors
          .map((e: { message: string }) => e.message)
          .join('; ');
        throw new TrackerError(
          'linear_graphql_errors',
          `Linear GraphQL errors: ${messages}`
        );
      }

      return json.data;
    } catch (err) {
      if (err instanceof TrackerError) throw err;

      const error = err as Error;
      if (error.name === 'AbortError') {
        throw new TrackerError(
          'linear_api_request',
          `Linear API request timed out after ${NETWORK_TIMEOUT_MS}ms`
        );
      }

      throw new TrackerError(
        'linear_api_request',
        `Linear API request failed: ${error.message}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Update config at runtime (for dynamic reload) */
  updateConfig(opts: {
    endpoint: string;
    apiKey: string;
    projectSlug: string;
    activeStates: string[];
    terminalStates: string[];
  }): void {
    this.endpoint = opts.endpoint;
    this.apiKey = opts.apiKey;
    this.projectSlug = opts.projectSlug;
    this.activeStates = opts.activeStates;
    this.terminalStates = opts.terminalStates;
  }
}

// ---------------------------------------------------------------------------
// Issue normalization (Section 11.3)
// ---------------------------------------------------------------------------

/**
 * Normalize a raw Linear API issue node into the domain Issue model.
 * - labels → lowercase strings
 * - blocked_by → derived from inverse relations where type is "blocks"
 * - priority → integer only (non-integers become null)
 * - timestamps → parsed from ISO-8601
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeIssue(raw: any): Issue {
  // Extract labels, normalized to lowercase
  const labels: string[] = (raw.labels?.nodes ?? []).map(
    (l: { name: string }) => l.name.toLowerCase()
  );

  // Extract blockers from inverse relations where relation type is "blocks"
  const blockedBy: BlockerRef[] = (raw.inverseRelations?.nodes ?? [])
    .filter((rel: { type: string }) => rel.type === 'blocks')
    .map((rel: { issue: { id: string; identifier: string; state?: { name: string } } }) => ({
      id: rel.issue?.id ?? null,
      identifier: rel.issue?.identifier ?? null,
      state: rel.issue?.state?.name ?? null,
    }));

  // Priority: integer only, non-integers become null
  let priority: number | null = null;
  if (typeof raw.priority === 'number' && Number.isInteger(raw.priority)) {
    priority = raw.priority;
  }

  return {
    id: raw.id,
    identifier: raw.identifier,
    title: raw.title ?? '',
    description: raw.description ?? null,
    priority,
    state: raw.state?.name ?? '',
    branchName: raw.branchName ?? null,
    url: raw.url ?? null,
    labels,
    blockedBy,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
  };
}
