/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * High-security Route-Level Boundary.
 * Ensures the wrapped dashboard UI components are only mounted if there's an active valid session.
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center font-mono">
        <Loader2 className="w-8 h-8 text-[#00FFAA] animate-spin mb-4" />
        <span className="text-xs text-white/40 uppercase tracking-widest">Querying identity authority...</span>
      </div>
    );
  }

  if (!currentUser) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto my-12 bg-rose-500/[0.02] border border-rose-500/15 rounded-2xl p-6 md:p-8 text-center backdrop-blur-md relative"
      >
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-rose-400" />
        </div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 font-mono">Gated Layer Protected</h3>
        <p className="text-xs text-white/50 leading-relaxed mb-6">
          Access denied. This zone requires a validated tenant identity signature. Establish a session first.
        </p>
      </motion.div>
    );
  }

  return <>{children}</>;
}
