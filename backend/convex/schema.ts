import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  conversations: defineTable({
    userId: v.string(), // User ID from auth
    messages: v.array(
      v.object({
        role: v.union(v.literal('system'), v.literal('user'), v.literal('assistant')),
        content: v.string(),
      })
    ),
    model: v.string(),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      })
    ),
  }).index('by_user', ['userId']),
});
