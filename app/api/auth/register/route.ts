/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Route handler for email/password registration under the MANELI Kernel.
 * Also handles initial Profile creation in the identity subsystem.
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

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials are not configured on the host.' },
        { status: 500 }
      );
    }

    // Initialize elevated Supabase Admin client to write profiles safely
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Authentication registration failed.' },
        { status: 400 }
      );
    }

    // 2. Create the profile record foundation for user (One user = One profile)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        email: authData.user.email,
      });

    if (profileError) {
      console.error('MANELI IDENTITY KERNEL ERROR (Profile creation):', profileError.message);
      // We don't fail the whole request because the auth user was successfully created
    }

    return NextResponse.json({
      success: true,
      message: 'User registered successfully and profiles foundation established.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        createdAt: authData.user.created_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'An internal kernel error occurred.' },
      { status: 500 }
    );
  }
}
