// ============================================================================
// Mock Codex App-Server
// ============================================================================
// This tiny process pretends to be Codex app-server for local Symphony testing.
// Symphony launches it from an issue workspace, sends JSON-RPC messages through
// stdin, and expects one JSON response per stdout line. It lets us verify the
// orchestrator and tracker loop without spending real model tokens or letting a
// live agent edit the repo.
// ============================================================================

import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let threadIdCount = 1;
let turnIdCount = 1;
let serverRequestId = 10_000;
const pendingApprovals = new Map();

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    
    // Handle dashboard approval responses for optional approval-bridge smoke
    // tests. Real Codex app-server sends server-initiated approval requests;
    // this mock can do the same when MOCK_REQUIRE_APPROVAL=1 so Symphony's
    // browser buttons can be tested without spending model tokens.
    if (msg.id !== undefined && !msg.method && pendingApprovals.has(msg.id)) {
      const pending = pendingApprovals.get(msg.id);
      pendingApprovals.delete(msg.id);
      completeTurn(pending.threadId, pending.turnId);
      return;
    }

    // Handle RPC Requests
    if (msg.method && msg.id !== undefined) {
      if (msg.method === 'initialize') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {}
        }) + '\n');
      } else if (msg.method === 'thread/start') {
        const currentThreadId = `mock-thread-${threadIdCount++}`;
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            thread: { id: currentThreadId },
            cwd: msg.params?.cwd ?? process.cwd(),
            approvalPolicy: msg.params?.approvalPolicy ?? null,
            approvalsReviewer: 'user',
            model: 'mock',
            modelProvider: 'mock',
            sandbox: { type: 'workspaceWrite', networkAccess: false }
          }
        }) + '\n');
      } else if (msg.method === 'thread/create') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { thread_id: `mock-thread-${threadIdCount++}` }
        }) + '\n');
      } else if (msg.method === 'turn/start') {
        const currentTurnId = `mock-turn-${turnIdCount++}`;
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            turn: {
              id: currentTurnId,
              status: 'inProgress',
              items: []
            }
          }
        }) + '\n');

        const currentThreadId = msg.params?.threadId ?? msg.params?.thread_id ?? 'mock-thread';

        if (process.env.MOCK_REQUIRE_APPROVAL === '1') {
          const approvalId = serverRequestId++;
          pendingApprovals.set(approvalId, { threadId: currentThreadId, turnId: currentTurnId });

          setTimeout(() => {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: approvalId,
              method: 'item/commandExecution/requestApproval',
              params: {
                threadId: currentThreadId,
                turnId: currentTurnId,
                itemId: `mock-approval-${currentTurnId}`,
                startedAtMs: Date.now(),
                reason: 'Mock approval bridge smoke test.',
                command: 'echo approval bridge smoke test',
                cwd: process.cwd(),
                commandActions: [{ type: 'unknown', command: 'echo approval bridge smoke test' }]
              }
            }) + '\n');
          }, 200);
        } else {
          // Simulate some work then finish
          setTimeout(() => completeTurn(currentThreadId, currentTurnId), 1000);
        }
      } else {
        // Echo back a generic success for other requests
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {}
        }) + '\n');
      }
    }
  } catch (e) {
    // Ignore invalid JSON lines
  }
});

function completeTurn(threadId, turnId) {
  // Send a notification that the turn is complete. This mirrors the real
  // app-server's lifecycle event closely enough for Symphony to reconcile a
  // successful turn after an approval decision.
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'turn/completed',
    params: {
      threadId,
      turn: {
        id: turnId,
        status: 'completed',
        items: []
      }
    }
  }) + '\n');
}
