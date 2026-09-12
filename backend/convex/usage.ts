import { internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import {
  DEFAULT_PLAN_ID,
  isSubscriptionActive,
  quotaForPlan,
} from './plans';

/** Default monthly weighted-token allowance (~10M). */
export const DEFAULT_WEIGHTED_TOKEN_LIMIT = quotaForPlan(DEFAULT_PLAN_ID);

/** Billing period length: 30 days. */
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function periodExpired(usagePeriodStart: number, now: number): boolean {
  return now - usagePeriodStart >= PERIOD_MS;
}

function snapshotFromRow(
  row: {
    usagePeriodStart: number;
    weightedTokensUsed: number;
    weightedTokenLimit: number;
  } | null,
  now: number
) {
  if (!row || periodExpired(row.usagePeriodStart, now)) {
    return {
      weightedTokensUsed: 0,
      weightedTokenLimit: row?.weightedTokenLimit ?? DEFAULT_WEIGHTED_TOKEN_LIMIT,
      usagePeriodStart: now,
    };
  }
  return {
    weightedTokensUsed: row.weightedTokensUsed,
    weightedTokenLimit: row.weightedTokenLimit,
    usagePeriodStart: row.usagePeriodStart,
  };
}

/**
 * Gate before calling Luna: subscription must be active and usage under limit.
 */
export const assertCanUseAI = internalQuery({
  args: { workosId: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      weightedTokensUsed: v.number(),
      weightedTokenLimit: v.number(),
      usagePeriodStart: v.number(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.string(),
      code: v.union(
        v.literal('subscription_required'),
        v.literal('usage_limit_reached')
      ),
      weightedTokensUsed: v.number(),
      weightedTokenLimit: v.number(),
      usagePeriodStart: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const now = Date.now();

    let sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();

    // Fallback: subscription row may exist by email without workosId (email checkout / webhook lag)
    if (!sub) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
        .first();
      if (user?.email) {
        sub = await ctx.db
          .query('subscriptions')
          .withIndex('by_email', (q) => q.eq('email', user.email))
          .first();
      }
    }

    const row = await ctx.db
      .query('usage')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();

    const snap = snapshotFromRow(row, now);

    if (!sub || !isSubscriptionActive(sub.status)) {
      return {
        ok: false as const,
        reason: 'Subscription required',
        code: 'subscription_required' as const,
        ...snap,
      };
    }

    if (snap.weightedTokensUsed >= snap.weightedTokenLimit) {
      return {
        ok: false as const,
        reason: 'Monthly usage limit reached',
        code: 'usage_limit_reached' as const,
        ...snap,
      };
    }

    return {
      ok: true as const,
      ...snap,
    };
  },
});

/**
 * Record token usage after a completed (or finished streaming) response.
 * Creates the usage row if missing, and resets the period if expired.
 */
export const addUsage = internalMutation({
  args: {
    workosId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    weightedTokens: v.number(),
  },
  returns: v.object({
    weightedTokensUsed: v.number(),
    weightedTokenLimit: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('usage')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();

    if (!existing) {
      const weightedTokensUsed = Math.max(0, args.weightedTokens);
      await ctx.db.insert('usage', {
        workosId: args.workosId,
        usagePeriodStart: now,
        weightedTokensUsed,
        weightedTokenLimit: DEFAULT_WEIGHTED_TOKEN_LIMIT,
        inputTokensUsed: Math.max(0, args.inputTokens),
        outputTokensUsed: Math.max(0, args.outputTokens),
        updatedAt: now,
      });
      return {
        weightedTokensUsed,
        weightedTokenLimit: DEFAULT_WEIGHTED_TOKEN_LIMIT,
      };
    }

    const reset = periodExpired(existing.usagePeriodStart, now);
    const nextUsed = reset
      ? Math.max(0, args.weightedTokens)
      : existing.weightedTokensUsed + Math.max(0, args.weightedTokens);
    const nextInput = reset
      ? Math.max(0, args.inputTokens)
      : (existing.inputTokensUsed ?? 0) + Math.max(0, args.inputTokens);
    const nextOutput = reset
      ? Math.max(0, args.outputTokens)
      : (existing.outputTokensUsed ?? 0) + Math.max(0, args.outputTokens);

    await ctx.db.patch(existing._id, {
      usagePeriodStart: reset ? now : existing.usagePeriodStart,
      weightedTokensUsed: nextUsed,
      inputTokensUsed: nextInput,
      outputTokensUsed: nextOutput,
      updatedAt: now,
    });

    return {
      weightedTokensUsed: nextUsed,
      weightedTokenLimit: existing.weightedTokenLimit,
    };
  },
});

/** Public: current authenticated user's quota snapshot (for Settings UI). */
export const getMyUsage = query({
  args: {},
  returns: v.union(
    v.object({
      weightedTokensUsed: v.number(),
      weightedTokenLimit: v.number(),
      usagePeriodStart: v.number(),
      remaining: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const workosId = identity.subject;
    const now = Date.now();
    const row = await ctx.db
      .query('usage')
      .withIndex('by_workos_id', (q) => q.eq('workosId', workosId))
      .first();

    const snap = snapshotFromRow(row, now);
    return {
      ...snap,
      remaining: Math.max(0, snap.weightedTokenLimit - snap.weightedTokensUsed),
    };
  },
});
