/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { StripeBillingProvider } from './src/lib/billing/provider';
import { BillingDb } from './src/lib/billing/db';
import { hasActiveSubscription, getPlan } from './src/lib/billing/middleware';

const app = express();
const PORT = 3000;

// Setup JSON parsing. Note: we might need raw bodies for actual stripe signature verification,
// so let's handle both raw and parsed json.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/billing/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------------------------------
// SECURE BILLING API ENDPOINTS
// -----------------------------------------------------------------------------

/**
 * 1. Checkout Endpoint
 * Initiates the checkout session for a given plan and workspace.
 */
app.post('/api/billing/checkout', async (req, res) => {
  try {
    const { workspaceId, plan, successUrl, cancelUrl, email } = req.body;

    if (!workspaceId || !plan || !successUrl || !cancelUrl || !email) {
      return res.status(400).json({
        error: 'Missing parameters. required: workspaceId, plan, successUrl, cancelUrl, email',
      });
    }

    const provider = new StripeBillingProvider();
    
    // Step A: Register or look up customer
    const { customerId } = await provider.createCustomer(workspaceId, email);

    // Step B: Generate the secure Checkout URL
    const { checkoutUrl } = await provider.createCheckout(
      workspaceId,
      customerId,
      plan,
      successUrl,
      cancelUrl
    );

    res.json({ checkoutUrl });
  } catch (err: any) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to initiate checkout', details: err.message });
  }
});

/**
 * 2. Webhook Endpoint
 * Receives server-to-server webhook events from Stripe (or our simulated trigger).
 */
app.post('/api/billing/webhook', async (req, res) => {
  let event: any;

  try {
    const stripeProvider = new StripeBillingProvider();
    const stripe = (stripeProvider as any).apiKey ? await (stripeProvider as any).getStripe() : null;

    if (stripe && req.headers['stripe-signature']) {
      // Real Stripe signature verification
      const sig = req.headers['stripe-signature'] as string;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
      const body = (req as any).body.toString('utf8');
      
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } else {
      // Fallback for simulation or unconfigured webhooks
      const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
      event = JSON.parse(bodyStr);
    }

    console.log(`[Billing Webhook] Received billing event of type: ${event.type}`);

    // Parse and register events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const workspaceId = session.metadata?.workspaceId;
        const plan = session.metadata?.plan || 'premium';
        const customerId = session.customer;
        const subscriptionId = session.subscription || `sub_sim_${Math.random().toString(36).substring(2, 10)}`;

        if (workspaceId) {
          // Store active subscription status
          BillingDb.saveSubscription({
            id: 'sub_' + Math.random().toString(36).substring(2, 11),
            workspace_id: workspaceId,
            provider: 'stripe',
            customer_id: customerId,
            subscription_id: subscriptionId,
            plan,
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          // Register audit log event
          BillingDb.saveBillingEvent({
            id: 'ev_' + Math.random().toString(36).substring(2, 11),
            workspace_id: workspaceId,
            event_type: 'checkout.session.completed',
            provider_event_id: event.id || `evt_${Math.random().toString(36).substring(2, 10)}`,
            metadata: {
              customerId,
              subscriptionId,
              plan,
              paymentStatus: session.payment_status || 'paid'
            },
            created_at: new Date().toISOString()
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const workspaceId = sub.metadata?.workspaceId;

        if (workspaceId) {
          // Delete active subscription
          BillingDb.deleteSubscription(workspaceId);

          // Log cancellation event
          BillingDb.saveBillingEvent({
            id: 'ev_' + Math.random().toString(36).substring(2, 11),
            workspace_id: workspaceId,
            event_type: 'customer.subscription.deleted',
            provider_event_id: event.id || `evt_${Math.random().toString(36).substring(2, 10)}`,
            metadata: {
              subscriptionId: sub.id,
              status: 'canceled'
            },
            created_at: new Date().toISOString()
          });
        }
        break;
      }

      default:
        console.log(`Unhandled billing event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook payload error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

/**
 * 3. Subscription Status Endpoint
 * Returns the currently active plan and transaction history for a given workspace.
 */
app.get('/api/billing/status', async (req, res) => {
  const workspaceId = req.query.workspaceId as string;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId query parameter is required' });
  }

  try {
    const hasActive = await hasActiveSubscription(workspaceId);
    const plan = await getPlan(workspaceId);
    const subscriptions = BillingDb.getSubscriptions(workspaceId);
    const events = BillingDb.getBillingEvents(workspaceId);

    res.json({
      workspaceId,
      hasActiveSubscription: hasActive,
      plan,
      subscriptions,
      events,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch billing status', details: err.message });
  }
});

// -----------------------------------------------------------------------------
// SECURE CUEAUDIO APPLICATION MODULE ENDPOINTS
// -----------------------------------------------------------------------------
import { CueAudioDb } from './src/lib/cueaudio/db';

/**
 * 1. Fetch Tracks Endpoint
 * Returns all active tracks within a tenant workspace boundary (and seed tracks).
 */
app.get('/api/cueaudio/tracks', (req, res) => {
  const workspaceId = req.query.workspaceId as string;
  try {
    const tracks = CueAudioDb.getTracks(workspaceId);
    res.json(tracks);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch tracks', details: err.message });
  }
});

/**
 * 2. Create Track Endpoint
 * Inserts a new track within a workspace context.
 */
app.post('/api/cueaudio/tracks', (req, res) => {
  const { workspaceId, title, artist_name, description, cover_url, audio_url, price } = req.body;

  if (!workspaceId || !title || !artist_name || price === undefined) {
    return res.status(400).json({ error: 'Missing track parameters. Required: workspaceId, title, artist_name, price' });
  }

  try {
    const newTrack = {
      id: 'track_' + Math.random().toString(36).substring(2, 11),
      workspace_id: workspaceId,
      title,
      artist_name,
      description: description || '',
      cover_url: cover_url || 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=300&auto=format&fit=crop',
      audio_url: audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      price: Number(price),
      status: 'draft' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    CueAudioDb.saveTrack(newTrack);
    res.json(newTrack);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compile track record', details: err.message });
  }
});

/**
 * 3. Update Status Endpoint
 * Publishes or unpublishes a track.
 */
app.put('/api/cueaudio/tracks/:id/status', async (req, res) => {
  const trackId = req.params.id;
  const { workspaceId, status } = req.body;

  if (!workspaceId || !status) {
    return res.status(400).json({ error: 'Missing required parameters: workspaceId, status' });
  }

  try {
    const track = CueAudioDb.getTrack(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    if (track.workspace_id !== workspaceId && track.workspace_id !== 'ws_demo_seed') {
      return res.status(403).json({ error: 'Forbidden: Workspace tenant separation boundary violation' });
    }

    // Gate: Check subscription to publish
    if (status === 'published') {
      const active = await hasActiveSubscription(workspaceId);
      if (!active) {
        return res.status(402).json({
          error: 'Payment Required: Active subscription is required to publish tracks.',
          code: 'SUBSCRIPTION_REQUIRED'
        });
      }
    }

    track.status = status;
    CueAudioDb.saveTrack(track);

    res.json(track);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update track status', details: err.message });
  }
});

/**
 * 4. Delete Track Endpoint
 * Removes a track from the database.
 */
app.delete('/api/cueaudio/tracks/:id', (req, res) => {
  const trackId = req.params.id;
  const workspaceId = req.query.workspaceId as string;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId query parameter is required' });
  }

  try {
    const track = CueAudioDb.getTrack(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    if (track.workspace_id !== workspaceId) {
      return res.status(403).json({ error: 'Forbidden: Tenant isolation rules apply' });
    }

    CueAudioDb.deleteTrack(trackId, workspaceId);
    res.json({ success: true, id: trackId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete track', details: err.message });
  }
});

/**
 * 5. Purchase Endpoint
 * Simulates purchasing a track. Records purchase and returns active download token.
 */
app.post('/api/cueaudio/purchases', (req, res) => {
  const { trackId, workspaceId, buyerEmail, amount } = req.body;

  if (!trackId || !workspaceId || !buyerEmail || amount === undefined) {
    return res.status(400).json({ error: 'Missing purchase parameters' });
  }

  try {
    const track = CueAudioDb.getTrack(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track to purchase not found' });
    }

    const purchaseId = 'pur_' + Math.random().toString(36).substring(2, 11);
    const newPurchase = {
      id: purchaseId,
      track_id: trackId,
      workspace_id: workspaceId,
      buyer_email: buyerEmail,
      amount: Number(amount),
      created_at: new Date().toISOString()
    };

    CueAudioDb.savePurchase(newPurchase);

    // Create a download token valid for 24 hours
    const downloadToken = 'dl_tok_' + Math.random().toString(36).substring(2, 12);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const downloadId = 'dl_' + Math.random().toString(36).substring(2, 11);

    const newDownload = {
      id: downloadId,
      purchase_id: purchaseId,
      track_id: trackId,
      download_token: downloadToken,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    CueAudioDb.saveDownload(newDownload);

    res.json({
      purchase: newPurchase,
      download: newDownload,
      trackTitle: track.title,
      artistName: track.artist_name,
      coverUrl: track.cover_url
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process checkout transaction', details: err.message });
  }
});

/**
 * 6. Get Download by Token Endpoint
 * Resolves an active download token, validates expiry, and returns track data.
 */
app.get('/api/cueaudio/downloads/:token', (req, res) => {
  const token = req.params.token;

  try {
    const download = CueAudioDb.getDownloadByToken(token);
    if (!download) {
      return res.status(404).json({ error: 'Invalid or expired download token' });
    }

    const track = CueAudioDb.getTrack(download.track_id);
    if (!track) {
      return res.status(404).json({ error: 'Associated track records no longer exist on this host' });
    }

    const isExpired = new Date(download.expires_at).getTime() < Date.now();

    res.json({
      expired: isExpired,
      download,
      track: {
        title: track.title,
        artist_name: track.artist_name,
        description: track.description,
        cover_url: track.cover_url,
        audio_url: track.audio_url,
        price: track.price
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve download token details', details: err.message });
  }
});


// -----------------------------------------------------------------------------
// STRIPE HIGH-FIDELITY SIMULATION SANDBOX
// -----------------------------------------------------------------------------

/**
 * Serves a visually stunning Simulated Stripe Checkout view inside the iframe
 * to let developers test the entire transaction pipeline easily.
 */
app.get('/api/billing/checkout/simulate', (req, res) => {
  const { workspace_id, customer_id, plan, success_url, cancel_url } = req.query;

  const planPrice = plan === 'scale' ? '$99.00/mo' : plan === 'cueaudio_creator' ? '$9.99/mo' : plan === 'premium' ? '$29.00/mo' : '$9.00/mo';
  const planDisplay = plan === 'cueaudio_creator' ? 'CUEAUDIO CREATOR' : plan ? String(plan).toUpperCase() : 'PREMIUM';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Stripe Simulated Checkout</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
      </style>
    </head>
    <body class="bg-[#0D0E12] text-white min-h-screen flex items-center justify-center p-4">
      <div class="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 bg-[#161821] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
        <div class="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>

        <!-- LEFT: Summary Panel -->
        <div class="md:col-span-5 bg-black/30 p-8 flex flex-col justify-between border-r border-white/5">
          <div>
            <div class="flex items-center gap-2 mb-8">
              <span class="w-6 h-6 rounded bg-[#635BFF] flex items-center justify-center text-xs font-bold">S</span>
              <span class="text-xs tracking-widest uppercase font-semibold text-white/50">Stripe Simulator</span>
            </div>
            
            <span class="text-xs uppercase tracking-wider text-cyan-400 font-mono font-bold">MANELI KERNEL SUBSCRIPTION</span>
            <h2 class="text-2xl font-bold mt-1 text-white">${planDisplay} Plan</h2>
            <p class="text-3xl font-black mt-4 text-white">${planPrice}</p>
            <p class="text-xs text-white/40 mt-1">Multi-tenant isolation boundary tier</p>
          </div>

          <div class="pt-6 border-t border-white/10 mt-12 space-y-3">
            <div class="flex justify-between text-xs text-white/50">
              <span>Tenant Workspace</span>
              <span class="mono text-white select-all text-[10px]">${workspace_id}</span>
            </div>
            <div class="flex justify-between text-xs text-white/50">
              <span>Customer ID</span>
              <span class="mono text-white text-[10px]">${customer_id}</span>
            </div>
            <div class="flex justify-between text-xs text-white/50">
              <span>Billing Cycle</span>
              <span>Monthly Recurring</span>
            </div>
          </div>
        </div>

        <!-- RIGHT: Payment Panel -->
        <div class="md:col-span-7 p-8">
          <h3 class="text-lg font-bold mb-6">Simulate Credit Card Payment</h3>
          
          <form action="/api/billing/checkout/simulate-process" method="POST" class="space-y-4">
            <input type="hidden" name="workspace_id" value="${workspace_id || ''}">
            <input type="hidden" name="customer_id" value="${customer_id || ''}">
            <input type="hidden" name="plan" value="${plan || ''}">
            <input type="hidden" name="success_url" value="${success_url || ''}">
            <input type="hidden" name="cancel_url" value="${cancel_url || ''}">

            <div>
              <label class="block text-xs uppercase tracking-wider text-white/50 mb-1.5 font-semibold">Email Address</label>
              <input type="email" value="dev@honchprods.com" disabled class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/50 cursor-not-allowed">
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wider text-white/50 mb-1.5 font-semibold font-mono">Card Information</label>
              <div class="relative">
                <input type="text" value="4242  4242  4242  4242" disabled class="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-12 py-2 text-xs mono text-cyan-400">
                <span class="absolute right-3 top-2 text-xs font-bold text-indigo-400 font-mono">VISA</span>
              </div>
              <div class="grid grid-cols-2 gap-3 mt-3">
                <input type="text" value="12 / 28" disabled class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs mono text-white/50 text-center">
                <input type="text" value="424" disabled class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs mono text-white/50 text-center">
              </div>
            </div>

            <div class="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] leading-relaxed text-indigo-300">
              💡 <strong>Developer Sandbox:</strong> Pressing "Authorize Simulated Webhook" generates a real backend HTTP postback mimicking a <code>checkout.session.completed</code> transaction event, updating active database subscriptions instantly.
            </div>

            <div class="pt-4 grid grid-cols-2 gap-4">
              <a href="${cancel_url || '#'}" class="py-2.5 bg-white/5 hover:bg-white/10 text-center rounded-xl text-xs font-bold transition-all border border-white/5">
                Cancel
              </a>
              <button type="submit" class="py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-90 font-bold rounded-xl text-xs text-black tracking-wider uppercase transition-all shadow-lg font-bold">
                Authorize Payment
              </button>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

/**
 * Handles payment processor completion form post, executes backend webhook callback,
 * then safely redirects to successUrl!
 */
app.post('/api/billing/checkout/simulate-process', async (req, res) => {
  const { workspace_id, customer_id, plan, success_url } = req.body;

  try {
    const mockEventId = `evt_sim_${Math.random().toString(36).substring(2, 12)}`;
    const mockSessionId = `cs_sim_${Math.random().toString(36).substring(2, 12)}`;
    const mockSubId = `sub_sim_${Math.random().toString(36).substring(2, 12)}`;

    const mockStripeWebhookPayload = {
      id: mockEventId,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: mockSessionId,
          object: 'checkout.session',
          customer: customer_id || 'cus_sim_default',
          payment_status: 'paid',
          subscription: mockSubId,
          metadata: {
            workspaceId: workspace_id,
            plan: plan || 'premium',
          }
        }
      }
    };

    // Trigger local post-back webhook programmatically
    const webhookUrl = `http://localhost:${PORT}/api/billing/webhook`;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockStripeWebhookPayload)
    });

    console.log(`[Stripe Simulation] Webhook successfully pushed back for workspace ${workspace_id}`);
    res.redirect(success_url || '/');
  } catch (err: any) {
    console.error('Simulation webhook execution failed:', err);
    res.status(500).send(`Simulation error: ${err.message}`);
  }
});

// -----------------------------------------------------------------------------
// VITE CLIENT INTEGRATION
// -----------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite Dev Server middleware in Development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve build static files in Production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MANELI KERNEL (Full-Stack) running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
