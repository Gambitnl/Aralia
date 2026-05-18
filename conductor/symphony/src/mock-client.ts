import type { Issue } from './types.js';
import { Logger } from './logger.js';

export class MockClient {
  private log: Logger;
  private issues: Map<string, Issue>;
  private activeStates: string[];
  private terminalStates: string[];

  constructor(opts: {
    activeStates: string[];
    terminalStates: string[];
    logger: Logger;
  }) {
    this.log = opts.logger.child({ component: 'mock_tracker' });
    this.activeStates = opts.activeStates;
    this.terminalStates = opts.terminalStates;
    this.issues = new Map();

    // Initialize with some mock issues
    this.seedMockIssues();
  }

  private seedMockIssues() {
    const now = new Date();
    this.issues.set('mock-1', {
      id: 'mock-1',
      identifier: 'MOCK-1',
      title: 'Fix the hyperspace drive',
      description: 'The drive is making a weird noise.',
      priority: 1,
      state: 'Todo',
      branchName: null,
      url: 'https://mock.tracker/MOCK-1',
      labels: ['bug', 'critical'],
      blockedBy: [],
      createdAt: now,
      updatedAt: now,
    });

    this.issues.set('mock-2', {
      id: 'mock-2',
      identifier: 'MOCK-2',
      title: 'Upgrade reactor shielding',
      description: 'Need more shielding for the new core.',
      priority: 2,
      state: 'Todo',
      branchName: null,
      url: 'https://mock.tracker/MOCK-2',
      labels: ['enhancement'],
      blockedBy: [{ id: 'mock-1', identifier: 'MOCK-1', state: 'Todo' }],
      createdAt: now,
      updatedAt: now,
    });
  }

  async fetchCandidateIssues(): Promise<Issue[]> {
    this.log.debug('Fetching mock candidate issues');
    return Array.from(this.issues.values()).filter(issue =>
      this.activeStates.includes(issue.state)
    );
  }

  async fetchIssueStatesByIds(
    issueIds: string[]
  ): Promise<{ id: string; identifier: string; state: string }[]> {
    this.log.debug('Fetching mock issue states', { count: issueIds.length });
    const states: { id: string; identifier: string; state: string }[] = [];
    
    for (const id of issueIds) {
      const issue = this.issues.get(id);
      if (issue) {
        states.push({
          id: issue.id,
          identifier: issue.identifier,
          state: issue.state,
        });
      }
    }
    return states;
  }

  async fetchTerminalIssues(): Promise<{ id: string; identifier: string }[]> {
    this.log.debug('Fetching mock terminal issues');
    return Array.from(this.issues.values())
      .filter(issue => this.terminalStates.includes(issue.state))
      .map(issue => ({
        id: issue.id,
        identifier: issue.identifier,
      }));
  }

  // Helper method for testing to simulate state changes
  updateIssueState(id: string, newState: string) {
    const issue = this.issues.get(id);
    if (issue) {
      issue.state = newState;
      issue.updatedAt = new Date();
      this.log.info('Mock issue state updated', { id, newState });
    }
  }

  updateConfig(opts: {
    activeStates: string[];
    terminalStates: string[];
  }): void {
    this.activeStates = opts.activeStates;
    this.terminalStates = opts.terminalStates;
  }
}
