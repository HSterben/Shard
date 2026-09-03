import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/** One custom chat "state" (preset) — flexible fields match desktop presets JSON. */
const stateValueValidator = v.object({
  description: v.optional(v.string()),
  desc: v.optional(v.string()),
  systemInstruction: v.optional(v.string()),
  system_instruction: v.optional(v.string()),
  temperature: v.optional(v.number()),
  maxTokens: v.optional(v.number()),
  topP: v.optional(v.number()),
  frequencyPenalty: v.optional(v.number()),
  presencePenalty: v.optional(v.number()),
  stop: v.optional(v.union(v.string(), v.array(v.string()))),
});

type StateValue = {
  description?: string;
  desc?: string;
  systemInstruction?: string;
  system_instruction?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
};

function normalizeStates(raw: unknown): Record<string, StateValue> {
  const states: Record<string, StateValue> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return states;
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const src = value as Record<string, unknown>;
    const next: StateValue = {};
    if (typeof src.description === 'string') next.description = src.description;
    if (typeof src.desc === 'string') next.desc = src.desc;
    if (typeof src.systemInstruction === 'string') {
      next.systemInstruction = src.systemInstruction;
    }
    if (typeof src.system_instruction === 'string') {
      next.system_instruction = src.system_instruction;
    }
    if (typeof src.temperature === 'number') next.temperature = src.temperature;
    if (typeof src.maxTokens === 'number') next.maxTokens = src.maxTokens;
    if (typeof src.topP === 'number') next.topP = src.topP;
    if (typeof src.frequencyPenalty === 'number') {
      next.frequencyPenalty = src.frequencyPenalty;
    }
    if (typeof src.presencePenalty === 'number') {
      next.presencePenalty = src.presencePenalty;
    }
    if (typeof src.stop === 'string') next.stop = src.stop;
    else if (Array.isArray(src.stop) && src.stop.every((s) => typeof s === 'string')) {
      next.stop = src.stop as string[];
    }
    states[name] = next;
  }
  return states;
}

/**
 * Cloud-synced custom states for the signed-in user (desktop + web).
 */
export const getMyStates = query({
  args: {},
  returns: v.union(
    v.object({
      states: v.record(v.string(), stateValueValidator),
      updatedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const row = await ctx.db
      .query('userStates')
      .withIndex('by_workos_id', (q) => q.eq('workosId', identity.subject))
      .first();

    if (!row) {
      return { states: {}, updatedAt: undefined };
    }

    return {
      states: normalizeStates(row.states),
      updatedAt: row.updatedAt,
    };
  },
});

/**
 * Replace the user's full states map (same shape as local presets JSON).
 */
export const saveMyStates = mutation({
  args: {
    states: v.record(v.string(), stateValueValidator),
  },
  returns: v.object({
    states: v.record(v.string(), stateValueValidator),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Authentication required');
    }

    const workosId = identity.subject;
    const now = Date.now();
    const states = normalizeStates(args.states);
    const existing = await ctx.db
      .query('userStates')
      .withIndex('by_workos_id', (q) => q.eq('workosId', workosId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        states,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('userStates', {
        workosId,
        states,
        updatedAt: now,
        createdAt: now,
      });
    }

    return { states, updatedAt: now };
  },
});
