/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BillingDb } from './db';

/**
 * Checks if a workspace currently holds an active subscription container.
 * Acceptable active statuses include: 'active', 'trialing', 'simulated_active'.
 * Also verifies that the current_period_end is in the future.
 */
export async function hasActiveSubscription(workspaceId: string): Promise<boolean> {
  if (!workspaceId) return false;
  
  const subs = BillingDb.getSubscriptions(workspaceId);
  if (subs.length === 0) return false;

  return subs.some(sub => {
    const isValidStatus = ['active', 'trialing', 'simulated_active'].includes(sub.status);
    const isNotExpired = new Date(sub.current_period_end).getTime() > Date.now();
    return isValidStatus && isNotExpired;
  });
}

/**
 * Resolves the current plan name for the active workspace.
 * Returns null if no active or valid subscription is present.
 */
export async function getPlan(workspaceId: string): Promise<string | null> {
  if (!workspaceId) return null;

  const subs = BillingDb.getSubscriptions(workspaceId);
  const activeSub = subs.find(sub => {
    const isValidStatus = ['active', 'trialing', 'simulated_active'].includes(sub.status);
    const isNotExpired = new Date(sub.current_period_end).getTime() > Date.now();
    return isValidStatus && isNotExpired;
  });

  return activeSub ? activeSub.plan : null;
}

/**
 * Express middleware helper to enforce active subscription boundaries
 * on secure API endpoints.
 */
export function expressSubscriptionGuard(
  req: any,
  res: any,
  next: () => void
) {
  const workspaceId = req.headers['x-workspace-id'] || req.query.workspace_id || req.body.workspaceId;

  if (!workspaceId) {
    return res.status(400).json({
      error: 'Subscription Guard Violation: Header "x-workspace-id" or query parameter is required for multi-tenant isolation.',
    });
  }

  hasActiveSubscription(workspaceId)
    .then(hasActive => {
      if (!hasActive) {
        return res.status(402).json({
          error: 'Payment Required: This workspace requires an active Premium plan to access advanced multi-tenant features.',
          workspace_id: workspaceId,
          code: 'SUBSCRIPTION_REQUIRED',
        });
      }
      next();
    })
    .catch(err => {
      res.status(500).json({ error: 'Internal subscription evaluation error.', details: err.message });
    });
}
