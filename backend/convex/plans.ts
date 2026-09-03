/** Product plans and per-plan monthly weighted-token quotas. */
export const PLANS = {
  proxy: {
    id: 'proxy',
    label: 'PROXY X',
    weightedTokenLimit: 10_000_000,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const DEFAULT_PLAN_ID: PlanId = 'proxy';

export function quotaForPlan(planId?: string | null): number {
  if (planId && planId in PLANS) {
    return PLANS[planId as PlanId].weightedTokenLimit;
  }
  return PLANS[DEFAULT_PLAN_ID].weightedTokenLimit;
}

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function isSubscriptionActive(status?: string | null): boolean {
  return Boolean(status && ACTIVE_SUBSCRIPTION_STATUSES.has(status));
}
