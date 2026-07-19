/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { Mail, Lock, UserPlus, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface RegisterFormProps {
  onSuccess?: () => void;
  onToggleLogin?: () => void;
  addLogMessage?: (level: 'INFO' | 'OK' | 'WARN' | 'ALERT', category: 'DATABASE' | 'STRIPE' | 'AUTH0' | 'ROUTING', message: string) => void;
}

export function RegisterForm({ onSuccess, onToggleLogin, addLogMessage }: RegisterFormProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    addLogMessage?.('INFO', 'AUTH0', `Initiating compiler profile generation for: ${email}`);

    try {
      const res = await register(email, password);
      
      if (res.success) {
        setSuccess(true);
        addLogMessage?.('OK', 'AUTH0', `Account registered successfully for ${email}. Profile workspace created.`);
        addLogMessage?.('OK', 'DATABASE', `User database row inserted in public.profiles table schema.`);
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1200);
        }
      } else {
        setErrorMsg(res.error || 'Registration failed.');
        addLogMessage?.('ALERT', 'AUTH0', `Registration failed for ${email}: ${res.error}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected registration crash occurred.');
      addLogMessage?.('ALERT', 'AUTH0', `Registration crash for ${email}`);
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
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00CCFF] to-transparent"></div>

      <div className="flex flex-col gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#00CCFF]/10 border border-[#00CCFF]/20 flex items-center justify-center self-start mb-2">
          <UserPlus className="w-5 h-5 text-[#00CCFF]" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight font-sans">
          Create <span className="text-[#00CCFF]">Identity Profile</span>
        </h2>
        <p className="text-xs text-white/50">
          Provision a brand-new multi-tenant user account inside the core auth table.
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
          className="mb-5 p-3.5 rounded-xl bg-[#00CCFF]/10 border border-[#00CCFF]/20 flex gap-2.5 items-center text-xs text-[#00CCFF]"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 animate-pulse" />
          <span>Success! Profile compiled and RLS policies injected.</span>
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
              placeholder="e.g. yourname@example.com"
              className="w-full bg-[#050505] border border-white/10 rounded-xl text-xs font-mono pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#00CCFF]/40 focus:bg-[#0A0A0A] transition-colors disabled:opacity-40"
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
              placeholder="Min. 6 characters"
              className="w-full bg-[#050505] border border-white/10 rounded-xl text-xs font-mono pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#00CCFF]/40 focus:bg-[#0A0A0A] transition-colors disabled:opacity-40"
            />
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-white/20">
              <Lock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2 font-bold">Confirm Password</label>
          <div className="relative">
            <input
              type="password"
              required
              disabled={loading || success}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Match password"
              className="w-full bg-[#050505] border border-white/10 rounded-xl text-xs font-mono pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#00CCFF]/40 focus:bg-[#0A0A0A] transition-colors disabled:opacity-40"
            />
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-white/20">
              <Lock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full bg-[#00CCFF] hover:bg-[#00CCFF]/90 text-[#050505] font-mono font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,204,255,0.15)] hover:shadow-[0_4px_24px_rgba(0,204,255,0.3)] transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Compiling profile...</span>
            </>
          ) : (
            <>
              <span>Compile Profile</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {onToggleLogin && (
        <div className="mt-6 pt-5 border-t border-white/5 text-center">
          <p className="text-xs text-white/40">
            Already registered on the Kernel?{' '}
            <button
              onClick={onToggleLogin}
              disabled={loading}
              className="text-[#00CCFF] hover:underline font-semibold font-mono tracking-tight"
            >
              Sign In
            </button>
          </p>
        </div>
      )}
    </motion.div>
  );
}
