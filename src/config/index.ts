/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FolderStructureNode, DBTableSchema } from '../types';

/**
 * System directory architecture metadata.
 */
export const ARCHITECTURE_FOLDERS: FolderStructureNode[] = [
  {
    name: 'app',
    path: '/app',
    type: 'folder',
    description: 'Next.js App Router entrypoints, route groups, page modules, and metadata definitions.',
    children: [
      { name: '(auth)', path: '/app/(auth)', type: 'folder', description: 'Gated tenant authentication layout, sign-in, and sign-up flows.' },
      { name: '(dashboard)', path: '/app/(dashboard)', type: 'folder', description: 'Unified shell dashboard containing core analytics, tenant controls, and platform settings.' },
      { name: 'api', path: '/app/api', type: 'folder', description: 'Serverless API endpoints, webhooks, proxy routes, and stripe gateway controllers.' }
    ]
  },
  {
    name: 'components',
    path: '/components',
    type: 'folder',
    description: 'Highly modular, accessible React elements styled exclusively with Tailwind CSS CSS variables.',
    children: [
      { name: 'ui', path: '/components/ui', type: 'folder', description: 'Primitives (Buttons, Cards, Inputs, Dialogs) matching the dark premium design system tokens.' },
      { name: 'shell', path: '/components/shell', type: 'folder', description: 'Layout containers, dynamic sidebars, universal headers, and system status indicators.' }
    ]
  },
  {
    name: 'lib',
    path: '/lib',
    type: 'folder',
    description: 'Shared server and client side utilities, client instantiations, and cryptographic signatures.',
    children: [
      { name: 'supabase.ts', path: '/lib/supabase.ts', type: 'file', description: 'Client-side Supabase wrapper integrating standard user sessions.' },
      { name: 'supabaseServer.ts', path: '/lib/supabaseServer.ts', type: 'file', description: 'Server-side Supabase client for reading cookie headers and validating RLS contexts.' },
      { name: 'utils.ts', path: '/lib/utils.ts', type: 'file', description: 'Style merger utility combining clsx and tailwind-merge.' }
    ]
  },
  {
    name: 'hooks',
    path: '/hooks',
    type: 'folder',
    description: 'Custom React state hooks wrapper for tenant selection, auth polling, and platform policy checks.'
  },
  {
    name: 'types',
    path: '/types',
    type: 'folder',
    description: 'Unified TypeScript definition modules, interface specifications, and schema helpers.'
  },
  {
    name: 'config',
    path: '/config',
    type: 'folder',
    description: 'Application parameters, pricing schedules, routing configurations, and environmental maps.'
  },
  {
    name: 'database',
    path: '/database',
    type: 'folder',
    description: 'Postgres raw schemas, database migration checkpoints, custom trigger functions, and RLS tables.'
  },
  {
    name: 'features',
    path: '/features',
    type: 'folder',
    description: 'Isolated, domain-driven workspace feature containers (Tenant sandboxes, settings, telemetry).'
  }
];

/**
 * Standard Multi-tenant tables with RLS and Security constraints.
 */
export const CORE_DATABASE_SCHEMAS: DBTableSchema[] = [
  {
    name: 'tenants',
    description: 'Primary registry for subscription workspaces and routing paths.',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'name', type: 'varchar(255)', constraints: 'NOT NULL' },
      { name: 'subdomain', type: 'varchar(100)', constraints: 'UNIQUE NOT NULL' },
      { name: 'status', type: 'tenant_status', constraints: 'DEFAULT \'STAGING\'' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' }
    ],
    rlsPolicies: [
      {
        name: 'Public Read Access on active subdomains',
        action: 'SELECT',
        roles: ['public', 'authenticated'],
        usingExpression: 'status = \'PROVISIONED\''
      },
      {
        name: 'Platform Service Role write access',
        action: 'ALL',
        roles: ['service_role'],
        usingExpression: 'true'
      }
    ]
  },
  {
    name: 'tenant_users',
    description: 'Maps users to their authorized tenant workspace domains with permission levels.',
    columns: [
      { name: 'tenant_id', type: 'uuid', constraints: 'REFERENCES tenants(id) ON DELETE CASCADE' },
      { name: 'user_id', type: 'uuid', constraints: 'REFERENCES auth.users(id) ON DELETE CASCADE' },
      { name: 'role', type: 'user_role', constraints: 'DEFAULT \'member\'' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' }
    ],
    rlsPolicies: [
      {
        name: 'Users see records for their active tenants',
        action: 'SELECT',
        roles: ['authenticated'],
        usingExpression: 'tenant_id IN (SELECT auth.current_tenant_id())'
      }
    ]
  },
  {
    name: 'profiles',
    description: 'Identity profiles corresponding to registered auth.users accounts.',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'user_id', type: 'uuid', constraints: 'UNIQUE NOT NULL' },
      { name: 'email', type: 'varchar(255)', constraints: 'UNIQUE NOT NULL' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' }
    ],
    rlsPolicies: [
      {
        name: 'Users can read their own profile',
        action: 'SELECT',
        roles: ['authenticated'],
        usingExpression: 'user_id = auth.uid()'
      },
      {
        name: 'Users can update their own profile',
        action: 'UPDATE',
        roles: ['authenticated'],
        usingExpression: 'user_id = auth.uid()'
      }
    ]
  },
  {
    name: 'workspaces',
    description: 'SaaS multi-tenant workspaces where all applications and resources reside.',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'owner_id', type: 'uuid', constraints: 'NOT NULL' },
      { name: 'name', type: 'varchar(255)', constraints: 'NOT NULL' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' }
    ],
    rlsPolicies: [
      {
        name: 'Select workspaces user owns or is a member of',
        action: 'SELECT',
        roles: ['authenticated'],
        usingExpression: 'owner_id = auth.uid() OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid())'
      },
      {
        name: 'Owners can insert new workspaces',
        action: 'INSERT',
        roles: ['authenticated'],
        usingExpression: 'owner_id = auth.uid()'
      },
      {
        name: 'Owners or Admins can modify workspaces',
        action: 'UPDATE',
        roles: ['authenticated'],
        usingExpression: 'owner_id = auth.uid() OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND role IN (\'owner\', \'admin\'))'
      },
      {
        name: 'Only owners can delete workspaces',
        action: 'DELETE',
        roles: ['authenticated'],
        usingExpression: 'owner_id = auth.uid()'
      }
    ]
  },
  {
    name: 'workspace_members',
    description: 'Binds users to specific workspace roles (owner, admin, member).',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'workspace_id', type: 'uuid', constraints: 'REFERENCES workspaces(id) ON DELETE CASCADE' },
      { name: 'user_id', type: 'uuid', constraints: 'NOT NULL' },
      { name: 'role', type: 'user_role', constraints: 'DEFAULT \'member\'' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' }
    ],
    rlsPolicies: [
      {
        name: 'Select workspace members of authorized workspaces',
        action: 'SELECT',
        roles: ['authenticated'],
        usingExpression: 'user_id = auth.uid() OR EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_members.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members AS wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid())'
      },
      {
        name: 'Admins or Owners can manage members',
        action: 'ALL',
        roles: ['authenticated'],
        usingExpression: 'EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_members.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members AS wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role IN (\'owner\', \'admin\'))'
      }
    ]
  },
  {
    name: 'features',
    description: 'Dynamic schema-free JSONB storage for SaaS features (CueAudio, QuoteFlow, InvoiceFlow, etc.).',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'workspace_id', type: 'uuid', constraints: 'REFERENCES workspaces(id) ON DELETE CASCADE' },
      { name: 'type', type: 'varchar(100)', constraints: 'NOT NULL' },
      { name: 'data', type: 'jsonb', constraints: 'DEFAULT \'{}\'::jsonb' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'timestamp with time zone', constraints: 'DEFAULT now()' }
    ],
    rlsPolicies: [
      {
        name: 'Workspace members can read feature data',
        action: 'SELECT',
        roles: ['authenticated'],
        usingExpression: 'EXISTS (SELECT 1 FROM workspaces WHERE id = features.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = features.workspace_id AND user_id = auth.uid())'
      },
      {
        name: 'Workspace admins or owners can manage features',
        action: 'ALL',
        roles: ['authenticated'],
        usingExpression: 'EXISTS (SELECT 1 FROM workspaces WHERE id = features.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = features.workspace_id AND user_id = auth.uid() AND role IN (\'owner\', \'admin\'))'
      }
    ]
  },
  {
    name: 'subscriptions',
    description: 'Active subscriptions and billing plans mapped to workspace isolation containers.',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'workspace_id', type: 'uuid', constraints: 'REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL' },
      { name: 'provider', type: 'varchar(50)', constraints: 'NOT NULL' },
      { name: 'customer_id', type: 'varchar(255)', constraints: 'NOT NULL' },
      { name: 'subscription_id', type: 'varchar(255)', constraints: 'NOT NULL' },
      { name: 'plan', type: 'varchar(100)', constraints: 'NOT NULL' },
      { name: 'status', type: 'varchar(50)', constraints: 'NOT NULL' },
      { name: 'current_period_end', type: 'timestamp with time zone', constraints: 'NOT NULL' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now() NOT NULL' },
      { name: 'updated_at', type: 'timestamp with time zone', constraints: 'DEFAULT now() NOT NULL' }
    ],
    rlsPolicies: [
      {
        name: 'Workspace members can read subscriptions',
        action: 'SELECT',
        roles: ['authenticated'],
        usingExpression: 'EXISTS (SELECT 1 FROM workspaces WHERE id = subscriptions.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = subscriptions.workspace_id AND user_id = auth.uid())'
      },
      {
        name: 'Workspace owners or admins can manage subscriptions',
        action: 'ALL',
        roles: ['authenticated'],
        usingExpression: 'EXISTS (SELECT 1 FROM workspaces WHERE id = subscriptions.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = subscriptions.workspace_id AND user_id = auth.uid() AND role IN (\'owner\', \'admin\'))'
      }
    ]
  },
  {
    name: 'billing_events',
    description: 'Audit trail of stripe or billing provider events received via webhooks.',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'workspace_id', type: 'uuid', constraints: 'REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL' },
      { name: 'event_type', type: 'varchar(100)', constraints: 'NOT NULL' },
      { name: 'provider_event_id', type: 'varchar(255)', constraints: 'NOT NULL' },
      { name: 'metadata', type: 'jsonb', constraints: 'DEFAULT \'{}\'::jsonb NOT NULL' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now() NOT NULL' }
    ],
    rlsPolicies: [
      {
        name: 'Workspace members can read billing events',
        action: 'SELECT',
        roles: ['authenticated'],
        usingExpression: 'EXISTS (SELECT 1 FROM workspaces WHERE id = billing_events.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = billing_events.workspace_id AND user_id = auth.uid())'
      }
    ]
  },
  {
    name: 'tracks',
    description: 'Catalog of music tracks published or created by workspace artists.',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'workspace_id', type: 'uuid', constraints: 'REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL' },
      { name: 'title', type: 'varchar(255)', constraints: 'NOT NULL' },
      { name: 'artist_name', type: 'varchar(255)', constraints: 'NOT NULL' },
      { name: 'description', type: 'text', constraints: '' },
      { name: 'cover_url', type: 'text', constraints: '' },
      { name: 'audio_url', type: 'text', constraints: 'NOT NULL' },
      { name: 'price', type: 'numeric(10,2)', constraints: 'NOT NULL' },
      { name: 'status', type: 'varchar(50)', constraints: 'DEFAULT \'draft\' NOT NULL' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now() NOT NULL' },
      { name: 'updated_at', type: 'timestamp with time zone', constraints: 'DEFAULT now() NOT NULL' }
    ],
    rlsPolicies: [
      {
        name: 'Anyone can select published tracks',
        action: 'SELECT',
        roles: ['public', 'authenticated'],
        usingExpression: 'status = \'published\''
      },
      {
        name: 'Workspace members can manage all tracks in workspace',
        action: 'ALL',
        roles: ['authenticated'],
        usingExpression: 'EXISTS (SELECT 1 FROM workspaces WHERE id = tracks.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = tracks.workspace_id AND user_id = auth.uid())'
      }
    ]
  },
  {
    name: 'purchases',
    description: 'Transaction ledger tracking purchased tracks and buyer receipts.',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'track_id', type: 'uuid', constraints: 'REFERENCES tracks(id) ON DELETE CASCADE NOT NULL' },
      { name: 'workspace_id', type: 'uuid', constraints: 'REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL' },
      { name: 'buyer_email', type: 'varchar(255)', constraints: 'NOT NULL' },
      { name: 'amount', type: 'numeric(10,2)', constraints: 'NOT NULL' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now() NOT NULL' }
    ],
    rlsPolicies: [
      {
        name: 'Workspace members can view purchase ledger',
        action: 'SELECT',
        roles: ['authenticated'],
        usingExpression: 'EXISTS (SELECT 1 FROM workspaces WHERE id = purchases.workspace_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = purchases.workspace_id AND user_id = auth.uid())'
      },
      {
        name: 'Public buyers can insert purchases on checkouts',
        action: 'INSERT',
        roles: ['public', 'authenticated'],
        usingExpression: 'true'
      }
    ]
  },
  {
    name: 'downloads',
    description: 'Fulfillment ledger recording download tokens and access rules.',
    columns: [
      { name: 'id', type: 'uuid', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
      { name: 'purchase_id', type: 'uuid', constraints: 'REFERENCES purchases(id) ON DELETE CASCADE NOT NULL' },
      { name: 'track_id', type: 'uuid', constraints: 'REFERENCES tracks(id) ON DELETE CASCADE NOT NULL' },
      { name: 'download_token', type: 'varchar(255)', constraints: 'UNIQUE NOT NULL' },
      { name: 'expires_at', type: 'timestamp with time zone', constraints: 'NOT NULL' },
      { name: 'created_at', type: 'timestamp with time zone', constraints: 'DEFAULT now() NOT NULL' }
    ],
    rlsPolicies: [
      {
        name: 'Anyone with a valid unexpired token can select download',
        action: 'SELECT',
        roles: ['public', 'authenticated'],
        usingExpression: 'expires_at > now()'
      }
    ]
  }
];
