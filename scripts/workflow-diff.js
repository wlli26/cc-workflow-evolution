/**
 * workflow-diff.js
 * Determines whether a new summarization is warranted.
 * Exit code 0 = should update, non-zero = skip.
 *
 * Checks:
 *   1. New message count >= MIN_NEW_MESSAGES (default 5)
 *   2. Content hash differs from last snapshot
 *   3. Time since last successful generation >= MIN_INTERVAL (default 600s)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIN_NEW_MESSAGES = parseInt(process.env.WORKFLOW_MIN_NEW_MESSAGES || '5', 10);
const MIN_INTERVAL = parseInt(process.env.WORKFLOW_MIN_INTERVAL || '600', 10) * 1000; // ms

function hash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

/**
 * @param {string} stateDir - .claude-workflows/state/
 * @param {Array} currentMessages - parsed messages from session
 * @param {object} [options]
 * @param {boolean} [options.force] - skip all checks
 * @returns {{ shouldUpdate: boolean, reason: string }}
 */
function shouldUpdate(stateDir, currentMessages, options = {}) {
  if (options.force) return { shouldUpdate: true, reason: 'force flag set' };

  const snapshotPath = path.join(stateDir, 'last-snapshot.json');

  // If no previous snapshot, always update
  if (!fs.existsSync(snapshotPath)) {
    return { shouldUpdate: true, reason: 'no previous snapshot' };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  } catch {
    return { shouldUpdate: true, reason: 'snapshot unreadable' };
  }

  // Check 1: new message count
  const prevCount = snapshot.message_count || 0;
  const newCount = currentMessages.length - prevCount;
  if (newCount < MIN_NEW_MESSAGES) {
    return { shouldUpdate: false, reason: `only ${newCount} new messages (need ${MIN_NEW_MESSAGES})` };
  }

  // Check 2: content hash
  const currentHash = hash(currentMessages);
  if (currentHash === snapshot.hash) {
    return { shouldUpdate: false, reason: 'content hash unchanged' };
  }

  // Check 3: time interval
  const lastTime = snapshot.timestamp ? new Date(snapshot.timestamp).getTime() : 0;
  const elapsed = Date.now() - lastTime;
  if (elapsed < MIN_INTERVAL) {
    const remaining = Math.ceil((MIN_INTERVAL - elapsed) / 1000);
    return { shouldUpdate: false, reason: `last update ${Math.floor(elapsed / 1000)}s ago (min ${MIN_INTERVAL / 1000}s, wait ${remaining}s)` };
  }

  return { shouldUpdate: true, reason: `${newCount} new messages, hash changed, interval ok` };
}

/**
 * Save snapshot after successful generation.
 */
function saveSnapshot(stateDir, currentMessages) {
  const snapshotPath = path.join(stateDir, 'last-snapshot.json');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify({
    message_count: currentMessages.length,
    hash: hash(currentMessages),
    timestamp: new Date().toISOString()
  }, null, 2), 'utf8');
}

module.exports = { shouldUpdate, saveSnapshot };

// CLI mode: node workflow-diff.js <stateDir> <messagesJsonPath>
if (require.main === module) {
  const stateDir = process.argv[2];
  const messagesPath = process.argv[3];
  if (!stateDir || !messagesPath) {
    console.error('Usage: node workflow-diff.js <stateDir> <messagesJsonPath>');
    process.exit(2);
  }
  const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
  const result = shouldUpdate(stateDir, messages);
  console.log(result.reason);
  process.exit(result.shouldUpdate ? 0 : 1);
}
