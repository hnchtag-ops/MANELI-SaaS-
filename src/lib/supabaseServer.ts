/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SupabaseClient } from './supabase';

let supabaseServerInstance: SupabaseClient | null = null;

/**
 * Initializes and retrieves a privileged Server-side Supabase client.
 * Bypasses Row Level Security (RLS) constraints for system-critical tasks using the SERVICE_ROLE key.
 * DO NOT expose this client, keys, or its usage inside browser-level components.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (supabaseServerInstance) {
    return supabaseServerInstance;
  }

  const supabaseUrl = process?.env?.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process?.env?.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "MANELI KERNEL WARNING: Server service credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY) are undefined. " +
      "Verify server settings before executing backend routines."
    );
  }

  supabaseServerInstance = {
    supabaseUrl,
    supabaseAnonKey: serviceRoleKey,
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: null }, error: null };
      },
      async signOut() {
        return { error: null };
      }
    },
    from(table: string) {
      return {
        select(columns = "*") {
          return {
            async eq(column: string, value: any) {
              return { data: [], error: null };
            }
          };
        },
        insert(values: any) {
          return {
            async select() {
              return { data: [values], error: null };
            }
          };
        }
      };
    }
  };

  return supabaseServerInstance;
}
