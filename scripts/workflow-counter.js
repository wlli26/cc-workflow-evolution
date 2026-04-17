/**
 * workflow-counter.js
 * PostToolUse Hook: increments a counter on each tool call,
 * triggers workflow.js in detached mode when threshold is reached.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const THRESHOLD = parseInt(process.env.WORKFLOW_THRESHOLD || '15', 10);

// cwd is passed as first arg by the hook
const cwd = process.argv[2] || process.cwd();
const workflowDir = path.join(cwd, '.claude-workflows');
const stateDir = path.join(workflowDir, 'state');
const counterFile = path.join(stateDir, 'counter.txt');

// Ensure state dir
fs.mkdirSync(stateDir, { recursive: true });

// Read and increment
let counter = 0;
try {
  counter = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10) || 0;
} catch {}
counter += 1;
fs.writeFileSync(counterFile, String(counter), 'utf8');

// Check threshold
if (counter % THRESHOLD === 0) {
  const workflowScript = path.join(__dirname, 'workflow.js');
  const child = spawn(process.execPath, [workflowScript, cwd], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  });
  child.unref();
}
