# IMPORTANT: Actual Database Schema vs Documentation

## ⚠️ SCHEMA CONFUSION WARNING ⚠️

There is a significant mismatch between the proposed schema in project documentation and the actual implemented schema in the Cloudflare D1 database.

## ACTUAL SCHEMA (What's Really in the Database)

As verified from Cloudflare Dashboard on 2025-07-28:

```sql
CREATE TABLE instruction_sets (
    instruction_id INTEGER PRIMARY KEY,  -- NOT 'id'
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    version TEXT DEFAULT '1.0.0',
    is_active BOOLEAN,                  -- NOT 'active'
    created_at DATETIME,
    updated_at DATETIME
);
```

## INCORRECT REFERENCES TO AVOID

### ❌ NEVER USE THESE:
1. **Table name `instructions`** - Does not exist! Use `instruction_sets`
2. **Column `id`** - Does not exist! Use `instruction_id`
3. **Column `active`** - Does not exist! Use `is_active`
4. **Column `instruction_key`** - Does not exist! Use `name`

### ❌ INCORRECT SQL (Will Fail):
```sql
-- These will all fail:
SELECT * FROM instructions WHERE id = 1;
UPDATE instructions SET active = 1;
SELECT * FROM instruction_sets WHERE id = 1;
SELECT * FROM instruction_sets WHERE active = 1;
```

### ✅ CORRECT SQL:
```sql
-- Use these instead:
SELECT * FROM instruction_sets WHERE instruction_id = 1;
UPDATE instruction_sets SET is_active = 1;
SELECT * FROM instruction_sets WHERE name = 'startup-core';
SELECT * FROM instruction_sets WHERE is_active = 1;
```

## Where the Confusion Came From

1. **Project Documentation** (`/.project/tasks/current/TASK-2025-008-create-instruction-tables.md`)
   - Proposed using `id` as primary key
   - This was never implemented as specified

2. **AI Assumptions**
   - Claude assumed standard naming conventions
   - Referenced non-existent `instructions` table

3. **No Single Source of Truth**
   - Schema documentation didn't match implementation
   - Multiple conflicting references in codebase

## Action Items

1. **Update all project documentation** to reflect actual schema
2. **Add database schema validation** to prevent drift
3. **Create migration** if we want to standardize column names
4. **Update all code references** to use correct table/column names

## Remember

**ALWAYS verify against the actual database schema in Cloudflare Dashboard before making SQL queries or schema assumptions!**

Last verified: 2025-07-28