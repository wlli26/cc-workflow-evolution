/**
 * session-parser.js
 * Shared session parsing logic extracted from cc-hello.
 * Locates the latest Claude Code session JSONL and extracts structured messages.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Strip system tags
function stripSystemTags(text) {
  text = text.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi, '');
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '');
  text = text.replace(/<command-name>[\s\S]*?<\/command-name>/gi, '');
  text = text.replace(/<command-message>[\s\S]*?<\/command-message>/gi, '');
  text = text.replace(/<command-args>[\s\S]*?<\/command-args>/gi, '');
  text = text.replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/gi, '');
  text = text.replace(/<[^>]+>/g, '');
  return text.trim();
}

const RELEVANT_TOOLS = new Set([
  'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
  'NotebookEdit', 'Agent', 'AskUserQuestion'
]);

function summarizeToolInput(toolName, input) {
  if (toolName === 'Read') return { file: input.file_path };
  if (toolName === 'Write') return { file: input.file_path };
  if (toolName === 'Edit') return { file: input.file_path };
  if (toolName === 'Bash') return { command: (input.command || '').slice(0, 80) };
  if (toolName === 'Grep') return { pattern: input.pattern, path: input.path };
  if (toolName === 'Glob') return { pattern: input.pattern };
  return input;
}

/**
 * Locate the project's session directory and find the latest JSONL.
 * @param {string} cwd - project root
 * @returns {string|null} absolute path to the latest jsonl, or null
 */
function findLatestSessionFile(cwd) {
  const userProfile = process.env.USERPROFILE || os.homedir();
  let p = cwd.replace(/\\/g, '/');
  p = p.replace(/^([a-zA-Z]):\//, (_, drive) => drive.toUpperCase() + '--');
  p = p.replace(/^\/([a-zA-Z])\//, (_, drive) => drive.toUpperCase() + '--');
  p = p.replace(/\//g, '-');
  const projectDir = path.join(userProfile, '.claude', 'projects', p);

  if (!fs.existsSync(projectDir)) return null;

  const jsonlFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
  if (jsonlFiles.length === 0) return null;

  const latest = jsonlFiles
    .map(f => ({ f, mtime: fs.statSync(path.join(projectDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].f;

  return path.join(projectDir, latest);
}

/**
 * Parse a session JSONL file into structured messages.
 * @param {string} filePath - path to .jsonl
 * @returns {Array} messages array
 */
function parseSessionMessages(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const messages = [];

  lines.forEach(line => {
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'user' && obj.type !== 'assistant') return;

      const role = obj.type === 'user' ? 'user' : 'assistant';
      const msg = obj.message;
      const entry = { role, content: [] };

      if (!msg.content) return;

      if (typeof msg.content === 'string') {
        const cleaned = stripSystemTags(msg.content);
        if (cleaned) entry.content.push({ type: 'text', text: cleaned });
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach(c => {
          if (c.type === 'text') {
            const cleaned = stripSystemTags(c.text);
            if (cleaned) entry.content.push({ type: 'text', text: cleaned });
          } else if (c.type === 'tool_use') {
            if (!RELEVANT_TOOLS.has(c.name)) return;
            entry.content.push({ type: 'tool_use', name: c.name, input: summarizeToolInput(c.name, c.input || {}) });
          } else if (c.type === 'tool_result') {
            let resultText = '';
            if (typeof c.content === 'string') {
              resultText = c.content;
            } else if (Array.isArray(c.content)) {
              resultText = c.content.filter(x => x.type === 'text').map(x => x.text).join('\n');
            }
            resultText = stripSystemTags(resultText).slice(0, 500);
            if (/^(Task|Updated task|Set model|Installed|Done\.|Summary)/i.test(resultText)) return;
            if (resultText) entry.content.push({ type: 'tool_result', text: resultText });
          }
        });
      }

      if (entry.content.length > 0) messages.push(entry);
    } catch (e) {}
  });

  return messages;
}

module.exports = { findLatestSessionFile, parseSessionMessages, stripSystemTags };
