import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const upsertByEmail = mutation({
  args: {
    email: v.string(),
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    priceId: v.optional(v.string()),
  },
  returns: v.id('subscriptions'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    const now = Date.now();

    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.stripeCustomerId !== undefined) patch.stripeCustomerId = args.stripeCustomerId;
    if (args.stripeSubscriptionId !== undefined) patch.stripeSubscriptionId = args.stripeSubscriptionId;
    if (args.currentPeriodEnd !== undefined) patch.currentPeriodEnd = args.currentPeriodEnd;
    if (args.priceId !== undefined) patch.priceId = args.priceId;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert('subscriptions', {
      workosId: undefined,
      email: args.email,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      status: args.status,
      currentPeriodEnd: args.currentPeriodEnd,
      priceId: args.priceId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('subscriptions'),
      _creationTime: v.number(),
      workosId: v.optional(v.string()),
      email: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      stripeSubscriptionId: v.optional(v.string()),
      status: v.string(),
      currentPeriodEnd: v.optional(v.number()),
      priceId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('subscriptions')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();
  },
});

export const upsertByWorkosId = mutation({
  args: {
    workosId: v.string(),
    email: v.optional(v.string()),
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    priceId: v.optional(v.string()),
  },
  returns: v.id('subscriptions'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();

    const now = Date.now();

    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.email !== undefined) patch.email = args.email;
    if (args.stripeCustomerId !== undefined) patch.stripeCustomerId = args.stripeCustomerId;
    if (args.stripeSubscriptionId !== undefined) patch.stripeSubscriptionId = args.stripeSubscriptionId;
    if (args.currentPeriodEnd !== undefined) patch.currentPeriodEnd = args.currentPeriodEnd;
    if (args.priceId !== undefined) patch.priceId = args.priceId;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert('subscriptions', {
      workosId: args.workosId,
      email: args.email,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      status: args.status,
      currentPeriodEnd: args.currentPeriodEnd,
      priceId: args.priceId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getByWorkosId = query({
  args: { workosId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('subscriptions'),
      _creationTime: v.number(),
      workosId: v.optional(v.string()),
      email: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      stripeSubscriptionId: v.optional(v.string()),
      status: v.string(),
      currentPeriodEnd: v.optional(v.number()),
      priceId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('subscriptions')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();
  },
});

// Update subscription by Stripe subscription id (used by webhooks when workosId/email missing)
export const updateByStripeSubscriptionId = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    priceId: v.optional(v.string()),
  },
  returns: v.union(v.id('subscriptions'), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_subscription_id', (q) =>
        q.eq('stripeSubscriptionId', args.stripeSubscriptionId)
      )
      .first();
    if (!existing) return null;
    const now = Date.now();
    const patch: Record<string, unknown> = { status: args.status, updatedAt: now };
    if (args.stripeCustomerId !== undefined) patch.stripeCustomerId = args.stripeCustomerId;
    if (args.currentPeriodEnd !== undefined) patch.currentPeriodEnd = args.currentPeriodEnd;
    if (args.priceId !== undefined) patch.priceId = args.priceId;
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});