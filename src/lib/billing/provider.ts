/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BillingProvider {
  createCustomer(workspaceId: string, email: string): Promise<{ customerId: string }>;
  createCheckout(
    workspaceId: string,
    customerId: string,
    plan: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkoutUrl: string }>;
  cancelSubscription(subscriptionId: string): Promise<{ success: boolean }>;
  getSubscription(subscriptionId: string): Promise<{
    id: string;
    workspaceId: string;
    provider: string;
    customerId: string;
    subscriptionId: string;
    plan: string;
    status: string;
    currentPeriodEnd: Date;
  } | null>;
}

/**
 * Concrete Stripe Billing Provider.
 * Implements lazy initialization and fallback simulation to prevent crash on startup if Stripe is unconfigured,
 * while allowing full actual Stripe API integration when STRIPE_SECRET_KEY is provided in the workspace.
 */
export class StripeBillingProvider implements BillingProvider {
  private apiKey: string | null;
  private stripeClient: any | null = null;

  constructor() {
    this.apiKey = process.env.STRIPE_SECRET_KEY || null;
  }

  /**
   * Lazily initializes Stripe SDK client safely.
   */
  private async getStripe() {
    if (!this.apiKey) {
      return null;
    }
    if (!this.stripeClient) {
      try {
        // Dynamic import of stripe to handle node env and avoid startup crash if package not present yet
        const { default: Stripe } = await import('stripe');
        this.stripeClient = new Stripe(this.apiKey, {
          apiVersion: '2023-10-16' as any,
        });
      } catch (err) {
        console.warn('Stripe package failed to load dynamically. Defaulting to mock simulation adapter.');
        return null;
      }
    }
    return this.stripeClient;
  }

  async createCustomer(workspaceId: string, email: string): Promise<{ customerId: string }> {
    const stripe = await this.getStripe();
    if (!stripe) {
      // Return beautiful mock customer id for simulation testing
      console.log(`[Stripe Simulation] Creating customer for workspace ${workspaceId} (${email})`);
      return { customerId: `cus_sim_${Math.random().toString(36).substring(2, 10)}` };
    }

    try {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          workspaceId,
        },
      });
      return { customerId: customer.id };
    } catch (err: any) {
      throw new Error(`Stripe API failure on createCustomer: ${err.message}`);
    }
  }

  async createCheckout(
    workspaceId: string,
    customerId: string,
    plan: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkoutUrl: string }> {
    const stripe = await this.getStripe();
    if (!stripe) {
      // Fallback simulation URL that triggers webhook behavior on the development dev server
      console.log(`[Stripe Simulation] Creating checkout URL for plan ${plan}, customer ${customerId}`);
      const devServerUrl = process.env.APP_URL || 'http://localhost:3000';
      const simulatedCheckoutUrl = `${devServerUrl}/api/billing/checkout/simulate?workspace_id=${workspaceId}&customer_id=${customerId}&plan=${plan}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`;
      return { checkoutUrl: simulatedCheckoutUrl };
    }

    try {
      // Map plan to specific Stripe price IDs if configured, otherwise use default mock lookup
      const priceId = process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}`] || 'price_mock_premium';

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          workspaceId,
          plan,
        },
        subscription_data: {
          metadata: {
            workspaceId,
            plan,
          },
        },
      });

      return { checkoutUrl: session.url || successUrl };
    } catch (err: any) {
      throw new Error(`Stripe API failure on createCheckout: ${err.message}`);
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<{ success: boolean }> {
    const stripe = await this.getStripe();
    if (!stripe) {
      console.log(`[Stripe Simulation] Cancel subscription ${subscriptionId}`);
      return { success: true };
    }

    try {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return { success: true };
    } catch (err: any) {
      throw new Error(`Stripe API failure on cancelSubscription: ${err.message}`);
    }
  }

  async getSubscription(subscriptionId: string): Promise<{
    id: string;
    workspaceId: string;
    provider: string;
    customerId: string;
    subscriptionId: string;
    plan: string;
    status: string;
    currentPeriodEnd: Date;
  } | null> {
    const stripe = await this.getStripe();
    if (!stripe) {
      console.log(`[Stripe Simulation] Get subscription data for ${subscriptionId}`);
      return {
        id: `sub_sim_rec_${Math.random().toString(36).substring(2, 10)}`,
        workspaceId: 'ws_placeholder',
        provider: 'stripe',
        customerId: 'cus_sim_placeholder',
        subscriptionId,
        plan: 'premium',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }

    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        id: sub.id,
        workspaceId: (sub.metadata?.workspaceId as string) || '',
        provider: 'stripe',
        customerId: sub.customer as string,
        subscriptionId: sub.id,
        plan: (sub.metadata?.plan as string) || 'default_plan',
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      };
    } catch (err: any) {
      throw new Error(`Stripe API failure on getSubscription: ${err.message}`);
    }
  }
}
