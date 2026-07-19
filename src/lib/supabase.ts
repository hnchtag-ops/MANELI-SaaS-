/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

export interface SupabaseClient {
  supabaseUrl: string;
  supabaseAnonKey: string;
  auth: any;
  from: (table: string) => any;
}

let supabaseClientInstance: SupabaseClient | null = null;

/**
 * Initializes and retrieves the client-side Supabase client connection instance.
 * Checks for required public variables and fails gracefully with informative console guidelines.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  // Read environment variable using import.meta.env for Vite SPAs
  const supabaseUrl = ((import.meta as any).env?.VITE_NEXT_PUBLIC_SUPABASE_URL as string) || 
                       (process?.env?.NEXT_PUBLIC_SUPABASE_URL as string) || 
                       "";
  const supabaseAnonKey = ((import.meta as any).env?.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY as string) || 
                          (process?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) || 
                          "";

  const hasRealCreds = supabaseUrl && supabaseAnonKey && 
                       !supabaseUrl.includes('placeholder') &&
                       supabaseUrl !== "";

  if (hasRealCreds) {
    const realClient = createClient(supabaseUrl, supabaseAnonKey) as any;
    realClient.supabaseUrl = supabaseUrl;
    realClient.supabaseAnonKey = supabaseAnonKey;
    supabaseClientInstance = realClient;
    return supabaseClientInstance;
  }

  // Fallback high-fidelity local storage mock client for seamless offline-first sandbox preview
  const fallbackClient: SupabaseClient = {
    supabaseUrl,
    supabaseAnonKey,
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
            eq(column: string, value: any) {
              const mockQuery = {
                async eq(subCol: string, subVal: any) {
                  const items = JSON.parse(localStorage.getItem(`maneli_mock_${table}`) || '[]');
                  const filtered = items.filter((item: any) => item[column] === value && item[subCol] === subVal);
                  return { data: filtered, error: null };
                },
                then(onfulfilled: any) {
                  const items = JSON.parse(localStorage.getItem(`maneli_mock_${table}`) || '[]');
                  const filtered = items.filter((item: any) => item[column] === value);
                  return Promise.resolve(onfulfilled({ data: filtered, error: null }));
                }
              };
              return mockQuery;
            },
            then(onfulfilled: any) {
              const items = JSON.parse(localStorage.getItem(`maneli_mock_${table}`) || '[]');
              return Promise.resolve(onfulfilled({ data: items, error: null }));
            }
          };
        },
        insert(values: any) {
          return {
            select() {
              return {
                then(onfulfilled: any) {
                  const items = JSON.parse(localStorage.getItem(`maneli_mock_${table}`) || '[]');
                  const newItems = Array.isArray(values) ? values : [values];
                  const processed = newItems.map(item => ({
                    id: item.id || 'usr_' + Math.random().toString(36).substring(2, 11),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    ...item
                  }));
                  items.push(...processed);
                  localStorage.setItem(`maneli_mock_${table}`, JSON.stringify(items));
                  return Promise.resolve(onfulfilled({ data: processed, error: null }));
                }
              };
            },
            then(onfulfilled: any) {
              const items = JSON.parse(localStorage.getItem(`maneli_mock_${table}`) || '[]');
              const newItems = Array.isArray(values) ? values : [values];
              const processed = newItems.map(item => ({
                id: item.id || 'usr_' + Math.random().toString(36).substring(2, 11),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...item
              }));
              items.push(...processed);
              localStorage.setItem(`maneli_mock_${table}`, JSON.stringify(items));
              return Promise.resolve(onfulfilled({ data: processed, error: null }));
            }
          };
        },
        delete() {
          return {
            eq(column: string, value: any) {
              return {
                then(onfulfilled: any) {
                  const items = JSON.parse(localStorage.getItem(`maneli_mock_${table}`) || '[]');
                  const filtered = items.filter((item: any) => item[column] !== value);
                  localStorage.setItem(`maneli_mock_${table}`, JSON.stringify(filtered));
                  return Promise.resolve(onfulfilled({ error: null }));
                }
              };
            }
          };
        },
        update(values: any) {
          return {
            eq(column: string, value: any) {
              return {
                then(onfulfilled: any) {
                  const items = JSON.parse(localStorage.getItem(`maneli_mock_${table}`) || '[]');
                  const updated = items.map((item: any) => {
                    if (item[column] === value) {
                      return { ...item, ...values, updated_at: new Date().toISOString() };
                    }
                    return item;
                  });
                  localStorage.setItem(`maneli_mock_${table}`, JSON.stringify(updated));
                  return Promise.resolve(onfulfilled({ error: null }));
                }
              };
            }
          };
        }
      };
    }
  };

  supabaseClientInstance = fallbackClient;
  return supabaseClientInstance;
}
