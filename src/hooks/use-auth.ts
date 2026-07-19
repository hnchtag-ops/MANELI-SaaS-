/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
  profileCreated?: boolean;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: number;
}

/**
 * Reusable Identity State hook for MANELI Kernel.
 * Incorporates hot-reload state mirroring from localStorage for zero-latency testing
 * and supports physical Supabase auth connectivity when keys are active.
 */
export function useAuth() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  const hasRealCreds = supabase.supabaseUrl && supabase.supabaseAnonKey && 
                       !supabase.supabaseUrl.includes('placeholder') &&
                       supabase.supabaseUrl !== "";

  // Poll or retrieve initial session
  useEffect(() => {
    async function loadSession() {
      setLoading(true);
      setError(null);

      try {
        if (hasRealCreds) {
          // Real Supabase session fetching
          const { data, error: authError } = await supabase.auth.getSession();
          if (authError) throw authError;

          if (data?.session) {
            setCurrentUser({
              id: data.session.user.id,
              email: data.session.user.email || '',
              createdAt: data.session.user.created_at,
            });
            setSession({
              accessToken: data.session.access_token,
              expiresAt: data.session.expires_at || 0,
            });
          } else {
            setCurrentUser(null);
            setSession(null);
          }
        } else {
          // Simulated/Sandboxed session retrieval for instant preview fidelity
          const storedUser = localStorage.getItem('maneli_auth_user');
          const storedSession = localStorage.getItem('maneli_auth_session');

          if (storedUser && storedSession) {
            setCurrentUser(JSON.parse(storedUser));
            setSession(JSON.parse(storedSession));
          } else {
            setCurrentUser(null);
            setSession(null);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to recover active user session.');
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [hasRealCreds]);

  /**
   * Register a new user with email and password
   */
  const register = async (email: string, password: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> => {
    setLoading(true);
    setError(null);

    try {
      if (hasRealCreds) {
        // Real Supabase Auth Sign Up
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || 'Registration failed.');
        }

        return { success: true, user: resData.user };
      } else {
        // High fidelity sandbox simulation
        await new Promise(resolve => setTimeout(resolve, 800));

        // Retrieve existing mock users from localStorage
        const usersRaw = localStorage.getItem('maneli_mock_users') || '[]';
        const usersList: AuthUser[] = JSON.parse(usersRaw);

        if (usersList.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('User already exists in Supabase directory.');
        }

        const newUser: AuthUser = {
          id: 'usr_' + Math.random().toString(36).substring(2, 11),
          email,
          createdAt: new Date().toISOString(),
          profileCreated: true,
        };

        // Persist to user list and automatic profile table sync
        usersList.push(newUser);
        localStorage.setItem('maneli_mock_users', JSON.stringify(usersList));

        // Add to simulated profiles database
        const profilesRaw = localStorage.getItem('maneli_mock_profiles') || '[]';
        const profilesList = JSON.parse(profilesRaw);
        profilesList.push({
          id: 'prof_' + Math.random().toString(36).substring(2, 11),
          user_id: newUser.id,
          email: newUser.email,
          created_at: newUser.createdAt,
          updated_at: newUser.createdAt,
        });
        localStorage.setItem('maneli_mock_profiles', JSON.stringify(profilesList));

        return { success: true, user: newUser };
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during registration.');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Authenticate / Login user
   */
  const login = async (email: string, password: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> => {
    setLoading(true);
    setError(null);

    try {
      if (hasRealCreds) {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || 'Login failed.');
        }

        const authUser: AuthUser = {
          id: resData.user.id,
          email: resData.user.email,
          createdAt: resData.user.createdAt || new Date().toISOString(),
        };

        const authSession: AuthSession = {
          accessToken: resData.session.accessToken,
          expiresAt: resData.session.expiresAt,
        };

        setCurrentUser(authUser);
        setSession(authSession);

        return { success: true, user: authUser };
      } else {
        // High fidelity sandbox login
        await new Promise(resolve => setTimeout(resolve, 800));

        const usersRaw = localStorage.getItem('maneli_mock_users') || '[]';
        const usersList: AuthUser[] = JSON.parse(usersRaw);

        const foundUser = usersList.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        // Let's seed a default developer account if usersList is empty for ease of testing
        let matchedUser = foundUser;
        if (!foundUser && email === 'dev@honchprods.com') {
          const defaultUser: AuthUser = {
            id: 'usr_dev_kernel_maneli',
            email: 'dev@honchprods.com',
            createdAt: new Date().toISOString(),
            profileCreated: true
          };
          usersList.push(defaultUser);
          localStorage.setItem('maneli_mock_users', JSON.stringify(usersList));
          
          const profilesRaw = localStorage.getItem('maneli_mock_profiles') || '[]';
          const profilesList = JSON.parse(profilesRaw);
          profilesList.push({
            id: 'prof_dev_kernel',
            user_id: defaultUser.id,
            email: defaultUser.email,
            created_at: defaultUser.createdAt,
            updated_at: defaultUser.createdAt,
          });
          localStorage.setItem('maneli_mock_profiles', JSON.stringify(profilesList));
          
          matchedUser = defaultUser;
        }

        if (!matchedUser) {
          throw new Error('No account found matching this email. Please register first.');
        }

        // Generate temporary simulation session
        const mockSession: AuthSession = {
          accessToken: 'jwt_mock_' + Math.random().toString(36).substring(2, 15),
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        };

        localStorage.setItem('maneli_auth_user', JSON.stringify(matchedUser));
        localStorage.setItem('maneli_auth_session', JSON.stringify(mockSession));

        setCurrentUser(matchedUser);
        setSession(mockSession);

        return { success: true, user: matchedUser };
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during authentication login.');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log out and terminate current session
   */
  const logout = async (): Promise<boolean> => {
    setLoading(true);
    try {
      if (hasRealCreds) {
        await fetch('/api/auth/logout', { method: 'POST' });
        await supabase.auth.signOut();
      }

      // Clear standard states
      localStorage.removeItem('maneli_auth_user');
      localStorage.removeItem('maneli_auth_session');
      setCurrentUser(null);
      setSession(null);
      return true;
    } catch (err) {
      console.error('MANELI AUTH LOGOUT ERROR:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentUser,
    session,
    loading,
    error,
    register,
    login,
    logout,
  };
}
