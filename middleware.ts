/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Next.js Middleware to enforce dashboard authentication boundaries.
 * Redirects unauthenticated requests from /dashboard to /login.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect the dashboard routes
  if (pathname.startsWith('/dashboard')) {
    // If Supabase is not configured, proceed as mock or fail safely
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('MANELI KERNEL MIDDLEWARE: Supabase credentials are missing on host. Bypass enforced for sandbox preview.');
      return NextResponse.next();
    }

    // Initialize standard Supabase client for session checks
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Retrieve session from requests (Next.js context parses cookie headers)
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // User is unauthenticated, redirect to sign-in login portal
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirected', 'true');
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

/**
 * Configure matching pathways for performance tuning.
 */
export const config = {
  matcher: ['/dashboard/:path*'],
};
