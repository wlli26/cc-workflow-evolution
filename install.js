#!/usr/bin/env node

/**
 * install.js
 * Installs cc-workflow-evolution:
 *   1. Copy scripts to ~/.claude/extensions/workflow-evolution/
 *   2. Copy workflow.md to ~/.claude/commands/
 *   3. Register PostToolUse hook in ~/.claude/settings.json (idempotent)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const home = process.env.USERPROFILE || os.homedir();
const claudeDir = path.join(home, '.claude');
const commandsDir = path.join(claudeDir, 'commands');
const extDir = path.join(claudeDir, 'extensions', 'workflow-evolution');
const settingsPath = path.join(claudeDir, 'settings.json');

// Ensure directories
[commandsDir, extDir].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// Copy scripts
const srcScripts = path.join(__dirname, 'scripts');
const scriptFiles = ['workflow.js', 'workflow-counter.js', 'workflow-diff.js', 'session-parser.js'];
scriptFiles.forEach(f => {
  fs.copyFileSync(path.join(srcScripts, f), path.join(extDir, f));
});

// Copy command
fs.copyFileSync(
  path.join(__dirname, 'commands', 'workflow.md'),
  path.join(commandsDir, 'workflow.md')
);

// Register PostToolUse hook (idempotent)
let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch {}

if (!settings.hooks) settings.hooks = {};
if (!Array.isArray(settings.hooks.PostToolUse)) settings.hooks.PostToolUse = [];

const hookMarker = 'workflow-counter.js';
const alreadyInstalled = settings.hooks.PostToolUse.some(h => {
  const cmd = h.command || (h.hooks && h.hooks[0] && h.hooks[0].command) || '';
  return cmd.includes(hookMarker);
});

if (!alreadyInstalled) {
  const counterScript = path.join(extDir, 'workflow-counter.js').replace(/\\/g, '/');
  settings.hooks.PostToolUse.push({
    matcher: "",
    hooks: [{
      type: "command",
      command: `node "${counterScript}"`
    }]
  });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  console.log('PostToolUse hook registered.');
} else {
  console.log('PostToolUse hook already registered (skipped).');
}

// Inject guidance into project-level CLAUDE.md (idempotent)
const projectClaude = path.join(process.cwd(), 'CLAUDE.md');
const guidanceBlock = fs.readFileSync(path.join(__dirname, 'templates', 'CLAUDE-workflow.md'), 'utf8');
const guidanceMarker = 'Workflow Capture Guidance';

if (!fs.existsSync(projectClaude)) {
  fs.writeFileSync(projectClaude, guidanceBlock.trim() + '\n', 'utf8');
  console.log(`Created ${projectClaude} with workflow guidance.`);
} else {
  const content = fs.readFileSync(projectClaude, 'utf8');
  if (!content.includes(guidanceMarker)) {
    fs.appendFileSync(projectClaude, '\n' + guidanceBlock.trim() + '\n', 'utf8');
    console.log(`Appended workflow guidance to ${projectClaude}.`);
  } else {
    console.log('CLAUDE.md already contains workflow guidance (skipped).');
  }
}

console.log('\nInstalled cc-workflow-evolution:');
console.log(`  Scripts: ${extDir}`);
console.log(`  Command: ${path.join(commandsDir, 'workflow.md')}`);
console.log(`  Guidance: ${projectClaude}`);
console.log('\nRequired env vars in ~/.claude/settings.json -> env:');
console.log('  SILICONFLOW_API_KEY, SILICONFLOW_BASE_URL, SILICONFLOW_MODEL');
console.log('\nRestart Claude Code, then type /workflow to use.');
