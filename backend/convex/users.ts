import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Create or update a user from WorkOS webhook
export const upsertUser = mutation({
  args: {
    workosId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();

    const now = Date.now();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePictureUrl: args.profilePictureUrl,
        updatedAt: now,
      });
      return existingUser._id;
    } else {
      // Create new user
      const userId = await ctx.db.insert('users', {
        workosId: args.workosId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePictureUrl: args.profilePictureUrl,
        createdAt: now,
        updatedAt: now,
      });
      return userId;
    }
  },
});

// Delete a user by WorkOS ID
export const deleteUser = mutation({
  args: {
    workosId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();

    if (user) {
      await ctx.db.delete(user._id);
      return true;
    }
    return false;
  },
});

// Query to get user by WorkOS ID
export const getUserByWorkosId = query({
  args: {
    workosId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      workosId: v.string(),
      email: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      profilePictureUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .first();
  },
});
