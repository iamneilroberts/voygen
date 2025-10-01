#!/usr/bin/env node
/*
  Append a simple entry to CHANGELOG.md under the Unreleased section.

  Usage:
    npm run changelog:add -- --type feat|fix|docs|chore --scope "voygent-hosted" --summary "Short description"
*/

const fs = require('fs');
const path = require('path');

function arg(k) {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const type = (arg('--type') || 'chore').toLowerCase();
const scope = arg('--scope') || '';
const summary = arg('--summary') || '';
const ts = new Date().toISOString().split('T')[0];

const file = path.join(process.cwd(), 'CHANGELOG.md');
if (!fs.existsSync(file)) {
  console.error('CHANGELOG.md not found at repo root');
  process.exit(1);
}

let md = fs.readFileSync(file, 'utf8');
if (!md.includes('\n## [Unreleased]')) {
  md = md.trimEnd() + '\n\n## [Unreleased]\n\n### Added\n\n### Changed\n\n### Fixed\n\n';
}

const sections = { feat: 'Added', fix: 'Fixed', docs: 'Changed', chore: 'Changed' };
const section = sections[type] || 'Changed';

const anchor = `\n### ${section}`;
const idx = md.indexOf(anchor);
if (idx === -1) {
  console.error(`Section ${section} missing under Unreleased.`);
  process.exit(1);
}

const insertAt = md.indexOf('\n', idx + anchor.length) + 1;
const bullet = `- ${scope ? `**${scope}:** ` : ''}${summary} (${ts})\n`;
md = md.slice(0, insertAt) + bullet + md.slice(insertAt);
fs.writeFileSync(file, md, 'utf8');
console.log('CHANGELOG.md updated:', bullet.trim());

