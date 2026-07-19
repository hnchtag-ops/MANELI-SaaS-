/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Core tenant representation within the MANELI™ KERNEL multi-tenant architecture.
 */
export interface TenantConfig {
  id: string;
  subdomain: string;
  name: string;
  status: 'PROVISIONED' | 'SUSPENDED' | 'STAGING';
  createdAt: string;
  databaseSchema: string;
}

/**
 * System-wide architectural policies gated at the kernel layer.
 */
export interface KernelPolicies {
  tenantIsolation: boolean;
  rateLimitingP99: boolean;
  strictCors: boolean;
  edgeCaching: boolean;
}

/**
 * Environmental Variable validation state.
 */
export interface EnvVarStatus {
  key: string;
  isSet: boolean;
  isPublic: boolean;
  description: string;
}

/**
 * Core folder structure of the MANELI™ KERNEL architecture.
 */
export interface FolderStructureNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  description: string;
  children?: FolderStructureNode[];
}

/**
 * Representation of a database table configuration.
 */
export interface DBTableSchema {
  name: string;
  description: string;
  columns: {
    name: string;
    type: string;
    constraints?: string;
  }[];
  rlsPolicies: {
    name: string;
    action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
    roles: string[];
    usingExpression: string;
  }[];
}
