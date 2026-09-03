import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  users: defineTable({
    workosId: v.string(), // WorkOS user ID (from JWT subject)
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workos_id', ['workosId'])
    .index('by_email', ['email']),

  subscriptions: defineTable({
    // Preferred key: WorkOS user id (injective mapping)
    // Optional to avoid breaking any existing records created by the public email flow.
    workosId: v.optional(v.string()),

    // Email is still useful for Stripe receipts / fallback matching
    email: v.optional(v.string()),

    // Stripe identifiers (may be absent until checkout completes)
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),

    // Stripe subscription status (active, trialing, past_due, canceled, unpaid, etc.)
    status: v.string(),

    // Product plan (e.g. "proxy"); set when subscription becomes active
    plan: v.optional(v.string()),

    // Subscription details
    currentPeriodEnd: v.optional(v.number()),
    priceId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workos_id', ['workosId'])
    .index('by_email', ['email'])
    .index('by_stripe_customer_id', ['stripeCustomerId'])
    .index('by_stripe_subscription_id', ['stripeSubscriptionId']),

  /** Per-user weighted token usage for AI (monthly period). */
  usage: defineTable({
    workosId: v.string(),
    usagePeriodStart: v.number(),
    weightedTokensUsed: v.number(),
    weightedTokenLimit: v.number(),
    inputTokensUsed: v.optional(v.number()),
    outputTokensUsed: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_workos_id', ['workosId']),

  /** Per-user custom chat states (presets), synced across desktop + web. */
  userStates: defineTable({
    workosId: v.string(),
    states: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_workos_id', ['workosId']),
});
