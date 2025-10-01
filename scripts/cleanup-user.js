#!/usr/bin/env node
/**
 * Cleanup a single LibreChat user and related documents from MongoDB.
 *
 * Usage examples:
 *   node scripts/cleanup-user.js --uri "<MONGODB_URI>" --db test --email "user@example.com" --dry-run
 *   node scripts/cleanup-user.js --uri "<MONGODB_URI>" --db test --email "user@example.com" --confirm
 *
 * You can also set MONGODB_URI as an environment variable and omit --uri.
 *
 * Notes:
 * - This script only touches collections if they exist in the target DB.
 * - Start with --dry-run to see counts before deleting. Use --confirm to execute.
 */

/* eslint-disable no-console */
const { MongoClient, ObjectId } = require('mongodb');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--confirm') args.confirm = true;
    else if (a === '--uri') args.uri = argv[++i];
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--email') args.email = argv[++i];
  }
  return args;
}

function printHelp() {
  console.log(`\nUsage:\n  node scripts/cleanup-user.js --uri "<MONGODB_URI>" --db <dbName> --email <email> [--dry-run|--confirm]\n\nOptions:\n  --uri      MongoDB connection string (or set env MONGODB_URI)\n  --db       Database name (e.g., test, librechat)\n  --email    Target user email\n  --dry-run  Show counts only (default)\n  --confirm  Perform deletions\n`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return printHelp();

  const uri = args.uri || process.env.MONGODB_URI;
  const dbName = args.db;
  const email = (args.email || '').toLowerCase();
  const confirm = Boolean(args.confirm);
  const dryRun = !confirm; // default to dry-run unless --confirm

  if (!uri || !dbName || !email) {
    console.error('Missing required params.');
    printHelp();
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      console.log(`No user found for email: ${email}`);
      return;
    }

    const uid = user._id instanceof ObjectId ? user._id : new ObjectId(user._id);
    console.log(`Target user _id: ${uid.toString()} | email: ${email}`);

    // Discover existing collections to avoid errors
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

    // Candidate deletions (only executed if collection exists)
    const tasks = [
      { col: 'sessions', query: { user: uid } },
      { col: 'tokens', query: { userId: uid } },
      { col: 'balances', query: { user: uid } },
      { col: 'presets', query: { user: uid } },
      { col: 'transactions', query: { user: uid } },
      { col: 'conversations', query: { user: uid } },
      { col: 'messages', query: { user: uid } },
      { col: 'files', query: { user: uid } },
      { col: 'toolcalls', query: { user: uid } },
      { col: 'sharedlinks', query: { user: uid } },
      { col: 'keys', query: { $or: [{ user: uid }, { userId: uid }] } },
      { col: 'pluginauths', query: { user: uid } },
      // common variations; will be skipped if not present
      { col: 'pluginAuths', query: { user: uid } },
      { col: 'plugin_auths', query: { user: uid } },
    ].filter((t) => existing.has(t.col));

    // Report counts
    let totalMatches = 0;
    for (const t of tasks) {
      const n = await db.collection(t.col).countDocuments(t.query);
      totalMatches += n;
      console.log(`${dryRun ? '[would delete]' : '[delete target]'} ${t.col}: ${n}`);
    }

    const userExists = existing.has('users');
    if (!userExists) {
      console.warn('Collection `users` not found; aborting.');
      return;
    }

    console.log(`${dryRun ? '\nDry-run complete.' : '\nProceeding with deletions...'} Total matches: ${totalMatches}`);

    if (dryRun) {
      console.log(`\nTo execute, re-run with --confirm`);
      return;
    }

    // Execute deletions
    for (const t of tasks) {
      const res = await db.collection(t.col).deleteMany(t.query);
      console.log(`[deleted] ${t.col}: ${res.deletedCount || 0}`);
    }

    const userRes = await db.collection('users').deleteOne({ _id: uid });
    console.log(`[deleted] users: ${userRes.deletedCount || 0}`);

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

main();

