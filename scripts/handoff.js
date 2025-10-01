#!/usr/bin/env node
/*
  Update HANDOFF.md with a timestamped entry and lightweight context.

  Usage examples:
    npm run handoff -- --status "Deploying" --next "Verify login" --notes "ALLOWED_ORIGINS updated"
    node scripts/handoff.js --status "Green" --next "MCP validate" --notes ""

  Flags:
    --status <text>    Short current status
    --next <text>      Next steps (one-liner)
    --notes <text>     Optional notes
*/

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function arg(k) {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function sh(cmd, opts = {}) {
  try {
    return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', ...opts }).trim();
  } catch {
    return '';
  }
}

const status = arg('--status') || 'Working';
const next = arg('--next') || 'Continue deployment validation and login test';
const notes = arg('--notes') || '';
const updateCurrent = process.argv.includes('--update-current');

const ts = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
const rootCommit = sh('git rev-parse --short HEAD');
const hostedCommit = sh('git -C .cache-voygent-hosted rev-parse --short HEAD');

const handoffPath = path.join(process.cwd(), 'HANDOFF.md');
if (!fs.existsSync(handoffPath)) {
  console.error('HANDOFF.md not found at repo root.');
  process.exit(1);
}

let md = fs.readFileSync(handoffPath, 'utf8');

// Ensure a Handoff Log section exists
if (!md.includes('\n## Handoff Log')) {
  const headerIdx = md.indexOf('\n');
  const insertAt = headerIdx === -1 ? md.length : headerIdx + 1;
  const pre = md.slice(0, insertAt);
  const post = md.slice(insertAt);
  md = `${pre}\n## Handoff Log\n\n${post}`;
}

// Build entry
const entryLines = [];
entryLines.push(`### ${ts}`);
entryLines.push(`- Status: ${status}`);
entryLines.push(`- Next: ${next}`);
if (notes) entryLines.push(`- Notes: ${notes}`);
if (hostedCommit) entryLines.push(`- voygent-hosted commit: ${hostedCommit}`);
else if (rootCommit) entryLines.push(`- repo commit: ${rootCommit}`);
entryLines.push('');
const entry = entryLines.join('\n');

// Insert entry right after the Handoff Log header
const logHeader = '\n## Handoff Log';
const logIdx = md.indexOf(logHeader);
const logStart = logIdx + logHeader.length;
// Find the position after the header line-breaks
const afterHeaderIdx = md.indexOf('\n', logStart) + 1;
const before = md.slice(0, afterHeaderIdx);
const after = md.slice(afterHeaderIdx);
const updated = `${before}${entry}${after}`;

fs.writeFileSync(handoffPath, updated, 'utf8');
console.log('HANDOFF.md updated with new entry at', ts);

// Optionally also update the Current Status summary bullet
if (updateCurrent) {
  let doc = fs.readFileSync(handoffPath, 'utf8');
  const header = '\n## Current Status';
  const idx = doc.indexOf(header);
  if (idx !== -1) {
    const sectionStart = idx + header.length;
    const nextHeaderIdx = doc.indexOf('\n## ', sectionStart + 1);
    const sectionEnd = nextHeaderIdx === -1 ? doc.length : nextHeaderIdx;
    const before = doc.slice(0, sectionStart);
    const section = doc.slice(sectionStart, sectionEnd);
    const after = doc.slice(sectionEnd);

    const lines = section.split('\n');
    const bullet = `\n- Current status: ${status} (${ts})`;
    let found = false;
    const rewritten = lines
      .map((ln) => {
        if (ln.trim().startsWith('- Current status:')) {
          found = true;
          return bullet;
        }
        return ln;
      })
      .join('\n');

    const newSection = found ? rewritten : bullet + '\n' + rewritten;
    const newDoc = before + newSection + after;
    fs.writeFileSync(handoffPath, newDoc, 'utf8');
    console.log('HANDOFF.md Current Status updated');
  } else {
    console.warn('No "## Current Status" section found; skipped summary update.');
  }
}
