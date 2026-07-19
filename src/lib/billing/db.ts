/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

export interface SubscriptionRecord {
  id: string;
  workspace_id: string;
  provider: string;
  customer_id: string;
  subscription_id: string;
  plan: string;
  status: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface BillingEventRecord {
  id: string;
  workspace_id: string;
  event_type: string;
  provider_event_id: string;
  metadata: any;
  created_at: string;
}

const DB_FILE = path.join(process.cwd(), 'maneli_billing_db.json');

function readDb(): { subscriptions: SubscriptionRecord[]; billing_events: BillingEventRecord[] } {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { subscriptions: [], billing_events: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading billing mock database file, using in-memory state:', err);
    return { subscriptions: [], billing_events: [] };
  }
}

function writeDb(data: { subscriptions: SubscriptionRecord[]; billing_events: BillingEventRecord[] }) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to billing mock database file:', err);
  }
}

export const BillingDb = {
  getSubscriptions(workspaceId?: string): SubscriptionRecord[] {
    const db = readDb();
    if (workspaceId) {
      return db.subscriptions.filter(s => s.workspace_id === workspaceId);
    }
    return db.subscriptions;
  },

  saveSubscription(sub: SubscriptionRecord) {
    const db = readDb();
    const existingIndex = db.subscriptions.findIndex(
      s => s.subscription_id === sub.subscription_id || s.workspace_id === sub.workspace_id
    );

    if (existingIndex !== -1) {
      db.subscriptions[existingIndex] = {
        ...db.subscriptions[existingIndex],
        ...sub,
        updated_at: new Date().toISOString()
      };
    } else {
      db.subscriptions.push(sub);
    }
    writeDb(db);
  },

  getBillingEvents(workspaceId?: string): BillingEventRecord[] {
    const db = readDb();
    if (workspaceId) {
      return db.billing_events.filter(e => e.workspace_id === workspaceId);
    }
    return db.billing_events;
  },

  saveBillingEvent(event: BillingEventRecord) {
    const db = readDb();
    db.billing_events.unshift(event); // keep newest first
    writeDb(db);
  },

  deleteSubscription(workspaceId: string) {
    const db = readDb();
    db.subscriptions = db.subscriptions.filter(s => s.workspace_id !== workspaceId);
    writeDb(db);
  }
};
