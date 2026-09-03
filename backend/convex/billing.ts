import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import {
  DEFAULT_PLAN_ID,
  isSubscriptionActive,
  quotaForPlan,
} from './plans';

/**
 * After Stripe webhooks update subscription status, sync plan + quota on the user.
 */
export const syncEntitlements = internalMutation({
  args: {
    workosId: v.string(),
    status: v.string(),
    plan: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isSubscriptionActive(args.status)) {
      return null;
    }

    const plan = args.plan ?? DEFAULT_PLAN_ID;
    const weightedTokenLimit = quotaForPlan(plan);
    const now = Date.now();

    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();

    if (sub && sub.plan !== plan) {
      await ctx.db.patch(sub._id, { plan, updatedAt: now });
    }

    const usage = await ctx.db
      .query('usage')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();

    if (!usage) {
      await ctx.db.insert('usage', {
        workosId: args.workosId,
        usagePeriodStart: now,
        weightedTokensUsed: 0,
        weightedTokenLimit,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        updatedAt: now,
      });
      return null;
    }

    if (usage.weightedTokenLimit !== weightedTokenLimit) {
      await ctx.db.patch(usage._id, {
        weightedTokenLimit,
        updatedAt: now,
      });
    }

    return null;
  },
});
