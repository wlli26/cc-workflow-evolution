/**
 * workflow.js (SiliconFlow Summarizer Validation Version)
 *
 * Main logic:
 *   1. Parse current session messages
 *   2. Run diff check (skip if not enough changes)
 *   3. Call SiliconFlow API to summarize
 *   4. Write versioned results to .claude-workflows/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { findLatestSessionFile, parseSessionMessages } = require('./session-parser');
const { shouldUpdate, saveSnapshot } = require('./workflow-diff');

// --- Config from env ---
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const SILICONFLOW_BASE_URL = process.env.SILICONFLOW_BASE_URL;
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL;
const SUMMARY_MAX_INPUT_CHARS = parseInt(process.env.SUMMARY_MAX_INPUT_CHARS || '200000', 10);
const SUMMARY_LANGUAGE = process.env.SUMMARY_LANGUAGE || 'zh-CN';

// Parse args: skip flags like --force
const cwd = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : process.cwd();
const workflowDir = path.join(cwd, '.claude-workflows');
const stateDir = path.join(workflowDir, 'state');

// --- Helpers ---

function ensureDirs() {
  fs.mkdirSync(stateDir, { recursive: true });
}

/** Get next version number by scanning existing summary-v*.json files */
function getNextVersion() {
  if (!fs.existsSync(workflowDir)) return 1;
  const files = fs.readdirSync(workflowDir).filter(f => /^summary-v\d+\.json$/.test(f));
  if (files.length === 0) return 1;
  const versions = files.map(f => parseInt(f.match(/summary-v(\d+)\.json/)[1], 10));
  return Math.max(...versions) + 1;
}

/** Compress messages into a compact text representation */
function compressMessages(messages) {
  const lines = [];
  messages.forEach((m, i) => {
    const prefix = m.role === 'user' ? 'U' : 'A';
    m.content.forEach(c => {
      if (c.type === 'text') {
        lines.push(`${prefix}: ${c.text}`);
      } else if (c.type === 'tool_use') {
        lines.push(`TOOL_USE(name=${c.name},input=${JSON.stringify(c.input)})`);
      } else if (c.type === 'tool_result') {
        lines.push(`TOOL_RESULT: ${c.text}`);
      }
    });
  });
  let text = lines.join('\n');
  if (text.length > SUMMARY_MAX_INPUT_CHARS) {
    text = text.slice(0, SUMMARY_MAX_INPUT_CHARS) + '\n...[truncated]';
  }
  return text;
}

/** Build the system prompt */
function buildSystemPrompt() {
  const lang = SUMMARY_LANGUAGE === 'zh-CN' ? '中文' : 'English';
  return `你是一个严格的对话总结器。请用${lang}对以下 Claude Code 对话历史进行结构化总结。

注意：重点总结本轮对话的新增内容，避免重复历史版本已有的信息。

输出必须严格遵循以下 Markdown 格式：

# Conversation Summary

## Goal
- 本次对话的主要任务目标

## What was done
- 完成了哪些具体工作（按时间顺序）

## Key decisions
- 做出了哪些关键决策或选择

## Tools used (high level)
- 列出使用的工具及用途概要

## Files touched / artifacts
- 涉及的文件和产出物

## Open questions / next steps
- 遗留问题和后续待办

请严格按照以上格式输出，不要添加额外章节。`;
}

/** Call SiliconFlow API (OpenAI-compatible) */
function callSiliconFlowSummarizer(compressedText) {
  return new Promise((resolve, reject) => {
    if (!SILICONFLOW_API_KEY || !SILICONFLOW_BASE_URL || !SILICONFLOW_MODEL) {
      return reject(new Error(
        'Missing required env vars: SILICONFLOW_API_KEY, SILICONFLOW_BASE_URL, SILICONFLOW_MODEL'
      ));
    }

    const url = new URL(SILICONFLOW_BASE_URL.replace(/\/+$/, '') + '/chat/completions');
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const body = JSON.stringify({
      model: SILICONFLOW_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: compressedText }
      ],
      temperature: 0.2
    });

    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`API returned ${res.statusCode}: ${data.slice(0, 500)}`));
        }
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content
            || json.choices?.[0]?.text
            || json.output?.text;
          if (!content) return reject(new Error('No content in API response'));
          resolve(content);
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Write versioned summary results */
function writeResults(version, summaryMd, messageCount, startTime) {
  const timestamp = new Date().toISOString();
  const elapsed = Date.now() - startTime;

  const latestJson = {
    version,
    timestamp,
    provider: 'siliconflow',
    model: SILICONFLOW_MODEL,
    message_count: messageCount,
    elapsed_ms: elapsed,
    summary_md: summaryMd
  };

  // summary-latest.json (overwrite)
  fs.writeFileSync(path.join(workflowDir, 'summary-latest.json'), JSON.stringify(latestJson, null, 2), 'utf8');

  // summary-latest.md (overwrite)
  fs.writeFileSync(path.join(workflowDir, 'summary-latest.md'), summaryMd, 'utf8');

  // summary-v{n}.json (new version archive)
  fs.writeFileSync(path.join(workflowDir, `summary-v${version}.json`), JSON.stringify(latestJson, null, 2), 'utf8');

  // summary-history.jsonl (append)
  const historyLine = JSON.stringify({
    version,
    timestamp,
    model: SILICONFLOW_MODEL,
    message_count: messageCount,
    elapsed_ms: elapsed
  });
  fs.appendFileSync(path.join(workflowDir, 'summary-history.jsonl'), historyLine + '\n', 'utf8');
}

// --- Main ---
async function main() {
  const startTime = Date.now();
  ensureDirs();

  // 1. Find and parse session
  const sessionFile = findLatestSessionFile(cwd);
  if (!sessionFile) {
    console.log('No session file found.');
    process.exit(1);
  }

  const messages = parseSessionMessages(sessionFile);
  if (messages.length === 0) {
    console.log('No messages found in session.');
    process.exit(1);
  }

  // 2. Diff check
  const force = process.argv.includes('--force');
  const diffResult = shouldUpdate(stateDir, messages, { force });
  if (!diffResult.shouldUpdate) {
    console.log(`No significant changes, skipping. (${diffResult.reason})`);
    process.exit(0);
  }
  console.log(`Diff check passed: ${diffResult.reason}`);

  // 3. Compress messages
  const compressedText = compressMessages(messages);
  console.log(`Compressed ${messages.length} messages (${compressedText.length} chars)`);

  // 4. Call SiliconFlow
  console.log(`Calling SiliconFlow API (model: ${SILICONFLOW_MODEL})...`);
  let summaryMd;
  try {
    summaryMd = await callSiliconFlowSummarizer(compressedText);
  } catch (err) {
    const errorInfo = { timestamp: new Date().toISOString(), error: err.message };
    fs.writeFileSync(path.join(workflowDir, 'error.json'), JSON.stringify(errorInfo, null, 2), 'utf8');
    console.error(`API call failed: ${err.message}`);
    process.exit(1);
  }

  // 5. Write results
  const version = getNextVersion();
  writeResults(version, summaryMd, messages.length, startTime);

  // 6. Update snapshot
  saveSnapshot(stateDir, messages);

  console.log(`Summary v${version} generated successfully.`);
  console.log(`  Latest: ${path.join(workflowDir, 'summary-latest.md')}`);
  console.log(`  Archive: ${path.join(workflowDir, `summary-v${version}.json`)}`);
}

main().catch(err => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
