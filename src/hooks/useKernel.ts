/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { KernelPolicies, EnvVarStatus, TenantConfig } from '../types';

export interface KernelLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'OK' | 'WARN' | 'ALERT';
  category: 'DATABASE' | 'STRIPE' | 'AUTH0' | 'ROUTING';
  message: string;
}

export function useKernel() {
  // Active policies state
  const [policies, setPolicies] = useState<KernelPolicies>({
    tenantIsolation: true,
    rateLimitingP99: true,
    strictCors: true,
    edgeCaching: false,
  });

  // Current provisioned tenants in sandbox
  const [tenants, setTenants] = useState<TenantConfig[]>([
    {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      name: 'Default Tenant',
      subdomain: 'platform-default',
      status: 'PROVISIONED',
      createdAt: '2026-07-18T12:00:00Z',
      databaseSchema: 'public.tenants'
    },
    {
      id: '4ac8bc53-a55e-4604-bb50-b8e76fb2be32',
      name: 'Staging Sandbox',
      subdomain: 'sandbox-staging',
      status: 'STAGING',
      createdAt: '2026-07-18T12:30:00Z',
      databaseSchema: 'staging.tenants'
    }
  ]);

  // Environmental status list
  const [envVars, setEnvVars] = useState<EnvVarStatus[]>([
    { key: 'NEXT_PUBLIC_SUPABASE_URL', isSet: true, isPublic: true, description: 'Client access url for connecting to Supabase auth/db services.' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', isSet: true, isPublic: true, description: 'Public schema-bound api token for standard client-side permissions.' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', isSet: false, isPublic: false, description: 'Superuser administration bypass token. Never leak to clients.' },
    { key: 'STRIPE_SECRET_KEY', isSet: false, isPublic: false, description: 'Private credential used to process subscriptions and charge portals.' },
    { key: 'STRIPE_WEBHOOK_SECRET', isSet: false, isPublic: false, description: 'Used to verify stripe webhook requests from the payment gateway.' }
  ]);

  // System Core Status
  const [coreStatus, setCoreStatus] = useState<'IDLE' | 'COMPILING' | 'TESTING' | 'SECURE'>('SECURE');
  const [integrityLevel, setIntegrityLevel] = useState<number>(100);

  // Core feed logging
  const [logs, setLogs] = useState<KernelLog[]>([
    { id: '1', timestamp: '13:00:05', level: 'OK', category: 'DATABASE', message: 'Row-Level Security applied successfully to tenants schema.' },
    { id: '2', timestamp: '13:00:12', level: 'OK', category: 'AUTH0', message: 'Federated token handler linked to client auth middleware.' },
    { id: '3', timestamp: '13:01:22', level: 'INFO', category: 'ROUTING', message: 'Pre-compiling route groups for (auth) and (dashboard) zones.' },
    { id: '4', timestamp: '13:02:40', level: 'WARN', category: 'STRIPE', message: 'STRIPE_SECRET_KEY missing in environment variables. Webhook handshakes skipped.' }
  ]);

  // Add customized system logs helper
  const addLog = (level: 'INFO' | 'OK' | 'WARN' | 'ALERT', category: 'DATABASE' | 'STRIPE' | 'AUTH0' | 'ROUTING', message: string) => {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];
    const newLog: KernelLog = {
      id: Math.random().toString(36).substring(7),
      timestamp,
      level,
      category,
      message
    };
    setLogs(prev => [...prev, newLog].slice(-40));
  };

  // Toggle Policy States
  const togglePolicy = (key: keyof KernelPolicies) => {
    setPolicies(prev => {
      const nextVal = !prev[key];
      addLog(
        nextVal ? 'OK' : 'WARN',
        'DATABASE',
        `Policy Gate [${key.replace(/([A-Z])/g, '_$1').toUpperCase()}] has been ${nextVal ? 'ENFORCED' : 'SOFTENED'}.`
      );
      return { ...prev, [key]: nextVal };
    });
  };

  // Toggle Env Variable
  const toggleEnvVar = (key: string) => {
    setEnvVars(prev => prev.map(v => {
      if (v.key === key) {
        const nextSet = !v.isSet;
        addLog(
          nextSet ? 'OK' : 'WARN',
          v.isPublic ? 'ROUTING' : 'DATABASE',
          `Variable [${key}] state updated to ${nextSet ? 'DEFINED_ON_HOST' : 'UNDEFINED'}.`
        );
        return { ...v, isSet: nextSet };
      }
      return v;
    }));
  };

  // Launch New Sandbox Tenant
  const registerTenant = (name: string, subdomain: string) => {
    const formattedSub = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!name || !formattedSub) return false;

    // Check existing
    if (tenants.some(t => t.subdomain === formattedSub)) {
      addLog('ALERT', 'ROUTING', `Compilation failed: subdomain "${formattedSub}" already allocated.`);
      return false;
    }

    addLog('INFO', 'DATABASE', `Compiling schemas for vertical sandbox: "${name}"`);
    
    const newTenant: TenantConfig = {
      id: Math.random().toString(36).substring(2, 15),
      name,
      subdomain: formattedSub,
      status: 'STAGING',
      createdAt: new Date().toISOString(),
      databaseSchema: `tenant_${formattedSub}.tenants`
    };

    setTenants(prev => [...prev, newTenant]);
    addLog('OK', 'ROUTING', `Subdomain routing successfully mapped to edge boundary: https://${formattedSub}.maneli-kernel.app`);
    return true;
  };

  // Tear down a tenant
  const removeTenant = (id: string, name: string) => {
    setTenants(prev => prev.filter(t => t.id !== id));
    addLog('ALERT', 'DATABASE', `Sandbox configuration purged and storage deallocated for tenant "${name}".`);
  };

  return {
    policies,
    togglePolicy,
    tenants,
    registerTenant,
    removeTenant,
    envVars,
    toggleEnvVar,
    logs,
    addLog,
    coreStatus,
    setCoreStatus,
    integrityLevel,
    setIntegrityLevel
  };
}
