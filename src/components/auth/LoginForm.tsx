/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { Mail, Lock, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginFormProps {
  onSuccess?: () => void;
  onToggleRegister?: () => void;
  addLogMessage?: (level: 'INFO' | 'OK' | 'WARN' | 'ALERT', category: 'DATABASE' | 'STRIPE' | 'AUTH0' | 'ROUTING', message: string) => void;
}

export function LoginForm({ onSuccess, onToggleRegister, addLogMessage }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);
    addLogMessage?.('INFO', 'AUTH0', `Initiating authentication handshake for email: ${email}`);

    try {
      const res = await login(email, password);
      
      if (res.success) {
        setSuccess(true);
        addLogMessage?.('OK', 'AUTH0', `Authentication successful for ${email}. Access token generated successfully.`);
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1000);
        }
      } else {
        setErrorMsg(res.error || 'Invalid credentials or connection error.');
        addLogMessage?.('ALERT', 'AUTH0', `Authentication failed for ${email}: ${res.error || 'Access denied'}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected authentication crash occurred.');
      addLogMessage?.('ALERT', 'AUTH0', `Authentication crash for ${email}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md mx-auto bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden shadow-2xl"
    >
      {/* Decorative top line */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00FFAA] to-transparent"></div>

      <div className="flex flex-col gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#00FFAA]/10 border border-[#00FFAA]/20 flex items-center justify-center self-start mb-2">
          <ShieldCheck className="w-5 h-5 text-[#00FFAA]" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight font-sans">
          Welcome back to <span className="text-[#00FFAA]">MANELI KERNEL</span>
        </h2>
        <p className="text-xs text-white/50">
          Provide your tenant credentials to gain access to gated layers.
        </p>
      </div>

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex gap-2.5 items-start text-xs text-rose-400"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-5 p-3.5 rounded-xl bg-[#00FFAA]/10 border border-[#00FFAA]/20 flex gap-2.5 items-center text-xs text-[#00FFAA]"
        >
          <ShieldCheck className="w-4 h-4 shrink-0 animate-pulse" />
          <span>Handshake successful! Routing session context...</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2 font-bold">Email Address</label>
          <div className="relative">
            <input
              type="email"
              required
              disabled={loading || success}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. dev@honchprods.com"
              className="w-full bg-[#050505] border border-white/10 rounded-xl text-xs font-mono pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#00FFAA]/40 focus:bg-[#0A0A0A] transition-colors disabled:opacity-40"
            />
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-white/20">
              <Mail className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2 font-bold">Secret Password</label>
          <div className="relative">
            <input
              type="password"
              required
              disabled={loading || success}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#050505] border border-white/10 rounded-xl text-xs font-mono pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#00FFAA]/40 focus:bg-[#0A0A0A] transition-colors disabled:opacity-40"
            />
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-white/20">
              <Lock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full bg-[#00FFAA] hover:bg-[#00FFAA]/90 text-[#050505] font-mono font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,255,170,0.15)] hover:shadow-[0_4px_24px_rgba(0,255,170,0.3)] transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Handshake...</span>
            </>
          ) : (
            <>
              <span>Establish Session</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {onToggleRegister && (
        <div className="mt-6 pt-5 border-t border-white/5 text-center">
          <p className="text-xs text-white/40">
            Don't have a workspace user account?{' '}
            <button
              onClick={onToggleRegister}
              disabled={loading}
              className="text-[#00FFAA] hover:underline font-semibold font-mono tracking-tight"
            >
              Sign Up
            </button>
          </p>
        </div>
      )}
    </motion.div>
  );
}
