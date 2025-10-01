#!/usr/bin/env node
/*
  Install local git hooks from scripts/git-hooks into .git/hooks.
  Safe to re-run; overwrites only tracked hooks we provide.
*/

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const hooksSrc = path.join(repoRoot, 'scripts', 'git-hooks');
const hooksDst = path.join(repoRoot, '.git', 'hooks');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyHook(name) {
  const src = path.join(hooksSrc, name);
  const dst = path.join(hooksDst, name);
  if (!fs.existsSync(src)) return;
  fs.copyFileSync(src, dst);
  fs.chmodSync(dst, 0o755);
  console.log(`Installed hook: ${name}`);
}

if (!fs.existsSync(path.join(repoRoot, '.git'))) {
  console.error('No .git directory found. Skipping hook installation.');
  process.exit(0);
}

if (!fs.existsSync(hooksSrc)) {
  console.error('No scripts/git-hooks directory found. Nothing to install.');
  process.exit(0);
}

ensureDir(hooksDst);

copyHook('commit-msg');

console.log('Git hooks installation complete.');

