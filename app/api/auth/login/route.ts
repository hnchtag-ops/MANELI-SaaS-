/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Route handler for email/password login under the MANELI Kernel.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase credentials are not configured on the host.' },
        { status: 500 }
      );
    }

    // Initialize standard Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Authenticate user with password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: error?.message || 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // Return the authenticated session and user information
    return NextResponse.json({
      success: true,
      message: 'Authentication successful.',
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'An internal kernel error occurred.' },
      { status: 500 }
    );
  }
}
