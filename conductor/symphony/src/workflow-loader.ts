// ============================================================================
// Workflow Loader
// ============================================================================
// Reads WORKFLOW.md, splits YAML front matter from the Markdown prompt body,
// and returns a WorkflowDefinition.
//
// Based on SPEC Sections 5.1 and 5.2:
// - If file starts with "---", parse lines until next "---" as YAML.
// - Remaining lines become the prompt body.
// - YAML front matter MUST decode to a map/object.
// - Prompt body is trimmed before use.
// ============================================================================

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import type { WorkflowDefinition, RawWorkflowConfig } from './types.js';
import { WorkflowError } from './types.js';

// ---------------------------------------------------------------------------
// Path resolution (Section 5.1)
// ---------------------------------------------------------------------------

/**
 * Resolve the workflow file path.
 * 1. If an explicit path is provided, use it.
 * 2. Otherwise default to WORKFLOW.md in the current working directory.
 */
export function resolveWorkflowPath(explicitPath?: string): string {
  if (explicitPath) {
    return resolve(explicitPath);
  }
  return resolve(process.cwd(), 'WORKFLOW.md');
}

// ---------------------------------------------------------------------------
// Workflow file parsing
// ---------------------------------------------------------------------------

/**
 * Load and parse a WORKFLOW.md file into a WorkflowDefinition.
 *
 * Throws WorkflowError with appropriate codes:
 * - missing_workflow_file: file doesn't exist or can't be read
 * - workflow_parse_error: YAML parsing failed
 * - workflow_front_matter_not_a_map: front matter wasn't a map/object
 */
export async function loadWorkflow(
  filePath: string
): Promise<WorkflowDefinition> {
  // Check file exists before trying to read
  if (!existsSync(filePath)) {
    throw new WorkflowError(
      'missing_workflow_file',
      `Workflow file not found: ${filePath}`
    );
  }

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new WorkflowError(
      'missing_workflow_file',
      `Cannot read workflow file: ${filePath} — ${(err as Error).message}`
    );
  }

  return parseWorkflowContent(content);
}

/**
 * Parse raw WORKFLOW.md content into a WorkflowDefinition.
 * Exported separately for testing without filesystem.
 */
export function parseWorkflowContent(content: string): WorkflowDefinition {
  const lines = content.split('\n');

  // If file doesn't start with "---", treat entire content as prompt body
  // with empty config
  if (!lines[0]?.trim().startsWith('---')) {
    return {
      config: {},
      promptTemplate: content.trim(),
    };
  }

  // Find the closing "---" delimiter for front matter
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === '---') {
      closingIndex = i;
      break;
    }
  }

  // If no closing delimiter, treat as parse error
  if (closingIndex === -1) {
    throw new WorkflowError(
      'workflow_parse_error',
      'YAML front matter opened with "---" but never closed'
    );
  }

  // Extract YAML content between the delimiters
  const yamlContent = lines.slice(1, closingIndex).join('\n');

  // Parse YAML front matter
  let config: unknown;
  try {
    config = yaml.load(yamlContent);
  } catch (err) {
    throw new WorkflowError(
      'workflow_parse_error',
      `Invalid YAML in front matter: ${(err as Error).message}`
    );
  }

  // If YAML is empty, treat as empty config
  if (config === undefined || config === null) {
    config = {};
  }

  // Front matter MUST be a map/object
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new WorkflowError(
      'workflow_front_matter_not_a_map',
      `Front matter must be a YAML map/object, got: ${typeof config}`
    );
  }

  // Extract prompt body (everything after closing "---"), trimmed
  const promptTemplate = lines
    .slice(closingIndex + 1)
    .join('\n')
    .trim();

  return {
    config: config as RawWorkflowConfig,
    promptTemplate,
  };
}
