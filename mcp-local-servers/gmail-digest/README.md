Gmail Digest Agent (Local)
==========================

Runs every 15 minutes, skims unread mail, discards junk, summarizes important messages, and records results for fast recall. Messages remain unread by default.

Setup
-----

1) Create a Google OAuth client (Desktop) and download credentials.json.
2) Place it at mcp-local-servers/gmail-digest/.secrets/credentials.json.
3) Copy .env.example to .env and adjust if needed.
4) Install and authenticate:

    cd mcp-local-servers/gmail-digest
    npm i
    npm run auth  # open URL, paste code

Run
---

    npm run once   # one pass now
    npm run start  # every 15 minutes

Query & Learning
----------------

    npm run query -- --since 2025-08-01 --from ishaan --text Chastain
    npm run query -- allow ishaan@omnara.com
    npm run query -- block news@newsletter.com

Data
----

- JSONL files under data/email-digests/: conversation-digest-YYYY-MM-DD.jsonl.
- preferences.json and history.json live next to the data directory.

Notes
-----

- Default scope is read-only. If you later enable labeling, switch scope to gmail.modify and re-auth.
- LLM summaries are off by default; set DIGEST_USE_LLM=true and provide OPENAI_API_KEY to enable.

