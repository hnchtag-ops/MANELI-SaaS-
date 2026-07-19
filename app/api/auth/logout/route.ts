/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Route handler for user logout / session clearance.
 */
export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase credentials are not configured on the host.' },
        { status: 500 }
      );
    }

    // Initialize standard Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Call Supabase signOut
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully and session cleared.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'An internal kernel error occurred.' },
      { status: 500 }
    );
  }
}
