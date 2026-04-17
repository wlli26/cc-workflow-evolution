#!/usr/bin/env node

/**
 * uninstall.js
 * Removes cc-workflow-evolution:
 *   1. Remove scripts from ~/.claude/extensions/workflow-evolution/
 *   2. Remove workflow.md from ~/.claude/commands/
 *   3. Remove PostToolUse hook from ~/.claude/settings.json
 *   Note: .claude-workflows/ in project dirs is preserved by default.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const home = process.env.USERPROFILE || os.homedir();
const claudeDir = path.join(home, '.claude');
const commandsDir = path.join(claudeDir, 'commands');
const extDir = path.join(claudeDir, 'extensions', 'workflow-evolution');
const settingsPath = path.join(claudeDir, 'settings.json');

// Remove extension scripts
if (fs.existsSync(extDir)) {
  fs.rmSync(extDir, { recursive: true, force: true });
  console.log(`Removed: ${extDir}`);
}

// Remove command
const cmdFile = path.join(commandsDir, 'workflow.md');
if (fs.existsSync(cmdFile)) {
  fs.unlinkSync(cmdFile);
  console.log(`Removed: ${cmdFile}`);
}

// Remove PostToolUse hook
try {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (settings.hooks && Array.isArray(settings.hooks.PostToolUse)) {
    const before = settings.hooks.PostToolUse.length;
    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(h => {
      const cmd = h.command || (h.hooks && h.hooks[0] && h.hooks[0].command) || '';
      return !cmd.includes('workflow-counter.js');
    });
    if (settings.hooks.PostToolUse.length < before) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log('PostToolUse hook removed from settings.json.');
    }
  }
} catch {}

console.log('\nUninstalled cc-workflow-evolution.');
console.log('Note: .claude-workflows/ directories in your projects are preserved.');
console.log('Delete them manually if no longer needed.');
