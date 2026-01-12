import { query } from './_generated/server';
import { v } from 'convex/values';

// Query to check if the current user is authenticated
export const getUser = query({
  args: {},
  returns: v.union(
    v.object({
      id: v.string(),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return {
      id: identity.subject,
      email: identity.email,
      name: identity.name,
    };
  },
});

// Query to verify token is valid (returns true if authenticated)
export const isAuthenticated = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity !== null;
  },
});
