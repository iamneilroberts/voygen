import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';

export const recordUsageSchema = z.object({
  advisor_id: z.number().int().optional().describe('Numeric advisor_id (preferred)'),
  advisor_email: z.string().email().optional().describe('Advisor email; used to resolve/create advisor_id'),
  trip_id: z.number().int().optional().describe('Related trip_id (trips_v2)'),
  action: z.enum(['trip_created','trip_published','ai_request']).describe('Usage action'),
  model: z.string().optional().describe('Model name for ai_request'),
  tokens_in: z.number().int().optional().default(0),
  tokens_out: z.number().int().optional().default(0),
  cost_cents: z.number().int().optional().default(0),
  metadata: z.any().optional().describe('Arbitrary JSON metadata')
});

export const checkEntitlementSchema = z.object({
  advisor_id: z.number().int().optional(),
  advisor_email: z.string().email().optional(),
  action: z.enum(['trip_created','trip_published','ai_request']).describe('Action to check'),
});

async function resolveAdvisorId(db: D1Database, advisorId?: number, email?: string): Promise<number> {
  if (advisorId && Number.isFinite(advisorId)) return advisorId;
  if (!email) throw new Error('advisor_id or advisor_email is required');
  // Try lookup by email
  const row = await db.prepare(`SELECT advisor_id FROM advisors WHERE email = ?`).bind(email).first();
  if (row?.advisor_id) return row.advisor_id as number;
  // Insert if not exists
  await db.prepare(`INSERT INTO advisors (email, display_name, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`).bind(email, email.split('@')[0]).run();
  const created = await db.prepare(`SELECT advisor_id FROM advisors WHERE email = ?`).bind(email).first();
  if (!created?.advisor_id) throw new Error('Failed to create advisor');
  return created.advisor_id as number;
}

export async function handleRecordUsageEvent(params: unknown, env: Env) {
  const db: D1Database = env.DB as any;
  const parsed = recordUsageSchema.parse(params);
  const advisorId = await resolveAdvisorId(db, parsed.advisor_id, parsed.advisor_email);
  const metaStr = parsed.metadata ? JSON.stringify(parsed.metadata) : '{}';
  const result = await db.prepare(`
    INSERT INTO usage_events (
      advisor_id, trip_id, action, model, tokens_in, tokens_out, cost_cents, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    advisorId,
    parsed.trip_id ?? null,
    parsed.action,
    parsed.model ?? null,
    parsed.tokens_in ?? 0,
    parsed.tokens_out ?? 0,
    parsed.cost_cents ?? 0,
    metaStr
  ).run();
  const usageId = (result as any).lastRowId ?? null;
  const ym = (await db.prepare(`SELECT strftime('%Y-%m', CURRENT_TIMESTAMP) as ym`).first())?.ym as string;
  const rollup = await db.prepare(`SELECT * FROM usage_monthly_rollup WHERE advisor_id = ? AND year_month = ?`).bind(advisorId, ym).first();
  return { success: true, usage_id: usageId, advisor_id: advisorId, year_month: ym, rollup: rollup || null };
}

export async function handleCheckEntitlement(params: unknown, env: Env) {
  const db: D1Database = env.DB as any;
  const parsed = checkEntitlementSchema.parse(params);
  const advisorId = await resolveAdvisorId(db, parsed.advisor_id, parsed.advisor_email);
  const sub = await db.prepare(`
    SELECT tier, status, current_period_end FROM subscriptions WHERE advisor_id = ?
    ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 ELSE 3 END,
             COALESCE(current_period_end, CURRENT_TIMESTAMP) DESC
    LIMIT 1
  `).bind(advisorId).first();
  const tier = sub?.tier || 'free';
  const limits = await db.prepare(`SELECT * FROM subscription_tiers WHERE tier = ? AND active = 1`).bind(tier).first();
  if (!limits) throw new Error(`Tier not configured: ${tier}`);
  const nowIso = new Date().toISOString();
  const override = await db.prepare(`
    SELECT * FROM entitlement_overrides 
    WHERE advisor_id = ? AND (effective_from IS NULL OR effective_from <= ?)
                         AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY effective_from DESC
    LIMIT 1
  `).bind(advisorId, nowIso, nowIso).first();
  const maxTripsPerMonth = override?.max_trips_per_month ?? limits.max_trips_per_month;
  const maxPublished = override?.max_published ?? limits.max_published;
  const weeklyAI = override?.weekly_ai_requests ?? limits.weekly_ai_requests;
  const ym = (await db.prepare(`SELECT strftime('%Y-%m', CURRENT_TIMESTAMP) as ym`).first())?.ym as string;
  const rollup = await db.prepare(`SELECT * FROM usage_monthly_rollup WHERE advisor_id=? AND year_month=?`).bind(advisorId, ym).first();
  const monthTrips = rollup?.trips_created ?? 0;
  const monthPublished = rollup?.trips_published ?? 0;
  const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const weekly = await db.prepare(`SELECT COUNT(*) as cnt FROM usage_events WHERE advisor_id=? AND action='ai_request' AND created_at >= ?`).bind(advisorId, sevenDaysAgo).first();
  const weeklyAIUsed = weekly?.cnt ?? 0;
  let allowed = true; let remaining = 0;
  switch (parsed.action) {
    case 'trip_created': remaining = Math.max(0, Number(maxTripsPerMonth) - Number(monthTrips)); allowed = remaining > 0; break;
    case 'trip_published': {
      const maxPub = Number(maxPublished);
      if (maxPub >= 9999) { remaining = 999999; allowed = true; }
      else { remaining = Math.max(0, maxPub - Number(monthPublished)); allowed = remaining > 0; }
      break;
    }
    case 'ai_request': remaining = Math.max(0, Number(weeklyAI) - Number(weeklyAIUsed)); allowed = remaining > 0; break;
  }
  return {
    success: true,
    advisor_id: advisorId,
    tier,
    override_applied: !!override,
    limits: { max_trips_per_month: maxTripsPerMonth, max_published: maxPublished, weekly_ai_requests: weeklyAI },
    usage: { year_month: ym, trips_created: monthTrips, trips_published: monthPublished, weekly_ai_requests: weeklyAIUsed },
    check: parsed.action,
    allowed,
    remaining
  };
}

export function registerBillingTools(server: McpServer, getEnv: () => Env) {
  server.tool('record_usage_event', recordUsageSchema, async (input) => handleRecordUsageEvent(input, getEnv()));
  server.tool('check_entitlement', checkEntitlementSchema, async (input) => handleCheckEntitlement(input, getEnv()));
}
}
