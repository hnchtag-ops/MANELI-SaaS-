/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  Database, 
  Terminal as TerminalIcon, 
  Layers, 
  Folder, 
  FileCode, 
  ChevronRight, 
  Key, 
  Plus, 
  Trash2, 
  Info, 
  Sliders, 
  CheckCircle, 
  Lock, 
  HelpCircle,
  Code,
  FileText,
  Activity,
  Maximize2,
  Minimize2,
  Users,
  Briefcase,
  Play,
  AlertTriangle,
  Settings,
  RefreshCw,
  FileJson
} from 'lucide-react';
import { useKernel } from './hooks/useKernel';
import { ARCHITECTURE_FOLDERS, CORE_DATABASE_SCHEMAS } from './config';
import { FolderStructureNode } from './types';
import { useAuth } from './hooks/use-auth';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { AuthGuard } from './components/auth/AuthGuard';
import { useDatabase } from './hooks/use-database';
import { CueAudioModule } from './features/cueaudio';

export default function App() {
  const {
    policies,
    togglePolicy,
    tenants,
    registerTenant,
    removeTenant,
    envVars,
    toggleEnvVar,
    logs,
    addLog,
    coreStatus,
    setCoreStatus,
    integrityLevel,
    setIntegrityLevel
  } = useKernel();

  const { currentUser, logout } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const {
    workspaces,
    selectedWorkspace,
    setSelectedWorkspace,
    members,
    features,
    createWorkspace,
    addWorkspaceMember,
    addFeature,
    deleteWorkspace,
    runRlsDiagnosticTest
  } = useDatabase();

  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [newFeatureType, setNewFeatureType] = useState<'CueAudio' | 'QuoteFlow' | 'InvoiceFlow'>('CueAudio');
  const [newFeatureJson, setNewFeatureJson] = useState(JSON.stringify({
    appName: "CueAudio Streamer",
    settings: { audioQuality: "high", streamBitrate: 320, defaultVolume: 0.8, crossfadeSeconds: 4 },
    playlist: ["intro_chime.wav", "ambient_pad_f.mp3", "loop_32.ogg"],
    activeStreamId: "stream_cue_901"
  }, null, 2));

  // RLS Diagnostic Simulation states
  const [rlsSimUserEmail, setRlsSimUserEmail] = useState('');
  const [rlsSimResult, setRlsSimResult] = useState<{
    success: boolean;
    message: string;
    details: string;
    accessGranted: boolean;
  } | null>(null);
  const [wsTab, setWsTab] = useState<'members' | 'features' | 'rls' | 'billing'>('members');

  const handleFeatureTypeChange = (type: 'CueAudio' | 'QuoteFlow' | 'InvoiceFlow') => {
    setNewFeatureType(type);
    if (type === 'CueAudio') {
      setNewFeatureJson(JSON.stringify({
        appName: "CueAudio Streamer",
        settings: { audioQuality: "high", streamBitrate: 320, defaultVolume: 0.8, crossfadeSeconds: 4 },
        playlist: ["intro_chime.wav", "ambient_pad_f.mp3", "loop_32.ogg"],
        activeStreamId: "stream_cue_901"
      }, null, 2));
    } else if (type === 'QuoteFlow') {
      setNewFeatureJson(JSON.stringify({
        appName: "QuoteFlow Engine",
        templates: ["Minimalist Dark", "Serif Journal", "Modernist Grid"],
        rules: { allowCustomQuotes: true, autoRotateIntervalMinutes: 60, censorProfanity: true },
        curatedCategories: ["Mindfulness", "Productivity", "Philosophy"]
      }, null, 2));
    } else if (type === 'InvoiceFlow') {
      setNewFeatureJson(JSON.stringify({
        appName: "InvoiceFlow Billing",
        companyDetails: { name: "Acme Production Corp", taxId: "US-98765432-A" },
        currency: "USD",
        billingRules: { gracePeriodDays: 14, sendAutomaticReminders: true, paymentGateways: ["Stripe", "BankTransfer"] }
      }, null, 2));
    }
  };

  // Selected structural folder for inspection
  const [selectedFolder, setSelectedFolder] = useState<FolderStructureNode>(ARCHITECTURE_FOLDERS[0]);
  
  // Custom schema query view state
  const [activeSchemaTab, setActiveSchemaTab] = useState<'sql' | 'rls' | 'clients'>('sql');

  // Billing & Revenue state
  const [billingStatus, setBillingStatus] = useState<{
    hasActiveSubscription: boolean;
    plan: string | null;
    subscriptions: any[];
    events: any[];
  } | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const fetchBillingStatus = async () => {
    if (!selectedWorkspace?.id) return;
    setLoadingBilling(true);
    try {
      const res = await fetch(`/api/billing/status?workspaceId=${selectedWorkspace.id}`);
      const data = await res.json();
      setBillingStatus(data);
    } catch (err) {
      console.error('Error fetching billing status:', err);
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    if (selectedWorkspace?.id) {
      fetchBillingStatus();
    } else {
      setBillingStatus(null);
    }
  }, [selectedWorkspace, wsTab]);

  // Tenant registration states
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSubdomain, setNewTenantSubdomain] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationProgress, setCompilationProgress] = useState(0);

  // Terminal parameters
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'OK' | 'WARN' | 'ALERT'>('ALL');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Handle client-side mock registration compile action
  const handleCompileTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName || !newTenantSubdomain) return;

    setIsCompiling(true);
    setCompilationProgress(0);
    setCoreStatus('COMPILING');
    addLog('INFO', 'ROUTING', `Initiating compiler sequence for new workspace tenant [${newTenantName}]...`);

    const interval = setInterval(() => {
      setCompilationProgress(prev => {
        const next = prev + 25;
        if (next === 25) {
          addLog('INFO', 'DATABASE', `Allocating isolated namespace: tenant_${newTenantSubdomain.toLowerCase()}.db`);
        } else if (next === 50) {
          addLog('INFO', 'DATABASE', `Applying schema tables, primary keys, and RLS bypass mechanisms...`);
        } else if (next === 75) {
          addLog('OK', 'ROUTING', `Configuring virtual custom URL routing logic for subdomain: ${newTenantSubdomain.toLowerCase()}`);
        } else if (next === 100) {
          clearInterval(interval);
          const success = registerTenant(newTenantName, newTenantSubdomain);
          if (success) {
            addLog('OK', 'DATABASE', `Tenant Workspace "${newTenantName}" compiled successfully.`);
          }
          setIsCompiling(false);
          setCoreStatus('SECURE');
          setNewTenantName('');
          setNewTenantSubdomain('');
        }
        return next;
      });
    }, 600);
  };

  // Filter logs safely
  const filteredLogs = logs.filter(log => logFilter === 'ALL' || log.level === logFilter);

  return (
    <div className="min-h-screen bg-[#050505] text-[#E5E5E5] font-sans antialiased selection:bg-[#00FFAA] selection:text-[#050505] relative overflow-x-hidden">
      
      {/* Decorative Grid Overlay & Ambient Lighting */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-[#00FFAA]/5 to-transparent rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-[#00CCFF]/3 to-transparent rounded-full blur-[180px] pointer-events-none"></div>

      <div className="relative z-10 max-w-[1500px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {/* TOP STATUS BAR & BRAND HEADER */}
        <header id="maneli-platform-header" className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00FFAA]/20 to-[#00CCFF]/10 border border-[#00FFAA]/40 flex items-center justify-center relative overflow-hidden shadow-[0_0_15px_rgba(0,255,170,0.15)]">
                <Cpu className="w-4.5 h-4.5 text-[#00FFAA]" />
                <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-extrabold tracking-tighter text-white flex items-center gap-2">
                  MANELI™ <span className="text-[#00FFAA] drop-shadow-[0_0_12px_rgba(0,255,170,0.4)] font-mono tracking-normal">KERNEL v1</span>
                </h1>
              </div>
            </div>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mt-2 flex flex-wrap items-center gap-2">
              <span>Universal Operating System for Subscription Apps</span>
              <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
              <span className="text-[#00CCFF]">PHASE 1: FOUNDATION BUILD</span>
            </p>
          </div>

          {/* Core Hardware Metrics */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 backdrop-blur-md">
            <div className="flex flex-col min-w-[90px]">
              <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">System State</span>
              <span className="text-xs text-white font-semibold flex items-center gap-2 mt-0.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  coreStatus === 'SECURE' ? 'bg-[#00FFAA]' : 
                  coreStatus === 'COMPILING' ? 'bg-amber-400 animate-pulse' : 'bg-[#00CCFF] animate-pulse'
                }`}></span>
                <span className="font-mono text-xs">{coreStatus}</span>
              </span>
            </div>
            <div className="h-8 w-[1px] bg-white/10 hidden sm:block"></div>
            <div className="flex flex-col min-w-[90px]">
              <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">RLS Integrity</span>
              <span className="text-sm font-bold font-mono text-[#00FFAA] mt-0.5">
                {integrityLevel}% <span className="text-[9px] font-normal text-white/40">SECURE</span>
              </span>
            </div>
            <div className="h-8 w-[1px] bg-white/10 hidden sm:block"></div>
            <div className="flex flex-col min-w-[90px]">
              <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Active Clusters</span>
              <span className="text-sm font-bold font-mono text-white mt-0.5">
                {tenants.length} <span className="text-[9px] font-normal text-white/40">DOMAINS</span>
              </span>
            </div>
          </div>
        </header>

        {/* PRIMARY CONSOLE GRID */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* IDENTITY LAYER HANDSHAKE & VERIFICATION BOARD (PHASE 2) */}
          <section id="identity-layer-verification-board" className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT PANEL: GATED /DASHBOARD ZONE (SPAN 7) */}
            <div className="col-span-1/12 lg:col-span-7 bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[580px]">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00FFAA] to-transparent"></div>
              
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00FFAA] animate-pulse"></div>
                    <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">Path: /dashboard (Gated Zone)</h3>
                  </div>
                  <span className="text-[9px] font-mono bg-white/5 text-[#00FFAA] border border-white/5 px-2 py-0.5 rounded uppercase tracking-widest font-extrabold">
                    Middleware Enforced
                  </span>
                </div>

                <AuthGuard 
                  fallback={
                    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mb-4">
                        <Lock className="w-5.5 h-5.5 text-rose-400" />
                      </div>
                      <h4 className="text-xs font-bold font-mono uppercase text-rose-400 tracking-wider mb-2">
                        Gated Middleware Intercept
                      </h4>
                      <p className="text-xs text-white/50 max-w-sm leading-relaxed mb-6">
                        Redirected to <span className="font-mono text-white">/login</span>. The <span className="font-mono text-[#00FFAA]">middleware.ts</span> rule intercepted this route because no valid session token exists in your client headers.
                      </p>
                      
                      {/* Short demo instructions */}
                      <div className="bg-[#050505] border border-white/5 p-4 rounded-xl text-left max-w-md w-full">
                        <span className="text-[9px] font-mono uppercase text-[#00CCFF] tracking-widest font-bold block mb-1.5">Interactive Verification Guide:</span>
                        <ul className="space-y-1 text-[11px] text-white/60 font-sans list-disc list-inside">
                          <li>Create a new account using the <strong className="text-white">Compile Profile</strong> form.</li>
                          <li>Your newly created user will automatically spawn a matching record in the <strong className="text-white">profiles</strong> table database.</li>
                          <li>Log in to automatically establish a JWT session token.</li>
                          <li>The Middleware will successfully authenticate and mount this gated dashboard!</li>
                        </ul>
                      </div>
                    </div>
                  }
                >
                  {/* Inside Gated Dashboard Context */}
                  <div className="space-y-5">
                    
                    {/* Authorized Session Info */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-[#00FFAA]/5 to-[#00CCFF]/5 border border-[#00FFAA]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <span className="text-[9px] font-mono uppercase text-[#00FFAA] tracking-wider font-bold">Authorized Session Identity</span>
                        <h4 className="text-sm font-bold text-white tracking-tight mt-0.5">{currentUser?.email}</h4>
                        <span className="text-[10px] text-white/40 font-mono">User ID: {currentUser?.id}</span>
                      </div>
                      
                      <button
                        onClick={async () => {
                          const success = await logout();
                          if (success) {
                            addLog('INFO', 'AUTH0', `Active session successfully cleared by logout command.`);
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Terminate Session
                      </button>
                    </div>

                    {/* Workspaces Manager */}
                    <div className="bg-[#050505] border border-white/5 rounded-xl p-4">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5 mb-3">
                        <div>
                          <h4 className="text-xs font-mono uppercase text-white/80 font-bold">Workspace Isolation Containers</h4>
                          <span className="text-[9px] text-white/40 font-mono">Table: public.workspaces & workspace_members</span>
                        </div>
                        <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider font-bold">RLS ACTIVE</span>
                      </div>

                      {/* Workspace List */}
                      {workspaces.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-white/10 rounded-xl mb-4 bg-white/[0.01]">
                          <Briefcase className="w-6 h-6 text-white/20 mx-auto mb-2" />
                          <p className="text-xs text-white/50">No workspaces compiled yet.</p>
                          <p className="text-[10px] text-white/30 max-w-xs mx-auto mt-1 leading-relaxed">
                            Every tenant requires a workspace. Compile one using the form below to begin deploying SaaS features.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1 mb-4">
                          {workspaces.map(ws => {
                            const isSelected = selectedWorkspace?.id === ws.id;
                            const isOwner = ws.owner_id === currentUser?.id;
                            return (
                              <div
                                key={ws.id}
                                onClick={() => setSelectedWorkspace(ws)}
                                className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex justify-between items-center ${
                                  isSelected 
                                    ? 'bg-[#00FFAA]/5 border-[#00FFAA]/30 shadow-[0_0_12px_rgba(0,255,170,0.05)]' 
                                    : 'bg-[#0F0F0F] border-white/5 hover:border-white/15'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white tracking-tight">{ws.name}</span>
                                    {isOwner ? (
                                      <span className="text-[8px] font-mono bg-[#00FFAA]/10 text-[#00FFAA] border border-[#00FFAA]/20 px-1.5 py-0.2 rounded font-extrabold uppercase">
                                        Owner
                                      </span>
                                    ) : (
                                      <span className="text-[8px] font-mono bg-[#00CCFF]/10 text-[#00CCFF] border border-[#00CCFF]/20 px-1.5 py-0.2 rounded font-extrabold uppercase">
                                        Member
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-white/40 font-mono block mt-0.5 select-all">UUID: {ws.id}</span>
                                </div>

                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  {isOwner && (
                                    <button
                                      onClick={async () => {
                                        if (confirm('Are you sure you want to cascade delete this workspace and all associated member and feature entries?')) {
                                          try {
                                            await deleteWorkspace(ws.id);
                                            addLog('WARN', 'DATABASE', `Purged workspace "${ws.name}" and cascading tables.`);
                                          } catch (err: any) {
                                            alert(err.message);
                                          }
                                        }
                                      }}
                                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded hover:border-rose-500/40 transition-all"
                                      title="Delete Workspace"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-[#00FFAA] translate-x-0.5' : 'text-white/20'}`} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Workspace Creation Form */}
                      <form 
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newWorkspaceName.trim()) return;
                          try {
                            const ws = await createWorkspace(newWorkspaceName.trim());
                            if (ws) {
                              addLog('OK', 'DATABASE', `Auth schema initialized public.workspaces entry "${ws.name}". Owner mapped to ${currentUser?.email}.`);
                              setNewWorkspaceName('');
                            }
                          } catch (err: any) {
                            addLog('ALERT', 'DATABASE', `Workspace build failed: ${err.message}`);
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          placeholder="Compile New Workspace Name (e.g. Acme Production)..."
                          value={newWorkspaceName}
                          onChange={e => setNewWorkspaceName(e.target.value)}
                          className="bg-[#0F0F0F] border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#00FFAA]/50 flex-1 font-sans"
                        />
                        <button
                          type="submit"
                          className="px-3 bg-[#00FFAA] hover:bg-[#00CCFF] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-4 h-4 stroke-[3px]" />
                          Deploy
                        </button>
                      </form>
                    </div>

                    {/* Live Profiles Sync Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* JWT Handshake Panel */}
                      <div className="bg-[#050505] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-mono uppercase text-white/40 tracking-wider font-bold block mb-1.5">JWT Handshake Claims</span>
                          <pre className="text-[10px] font-mono text-[#00FFAA] leading-relaxed overflow-x-auto p-2 bg-[#0A0A0A] rounded border border-white/5">
{`{
  "iss": "maneli-auth-server",
  "sub": "${currentUser?.id}",
  "email": "${currentUser?.email}",
  "role": "authenticated",
  "workspace_count": ${workspaces.length}
}`}
                          </pre>
                        </div>
                        <span className="text-[8px] font-mono text-white/30 uppercase mt-2 block">Algorithm: RS256 Signature verified</span>
                      </div>

                      {/* Sync Profile */}
                      <div className="bg-[#050505] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-mono uppercase text-white/40 tracking-wider font-bold block mb-1.5">Database Profile Hook</span>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center bg-white/[0.01] border border-white/5 p-1.5 rounded text-[10px]">
                              <span className="text-white/40 font-mono">Sync Table</span>
                              <span className="text-[#00CCFF] font-bold font-mono">public.profiles</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/[0.01] border border-white/5 p-1.5 rounded text-[10px]">
                              <span className="text-white/40 font-mono">Profile ID</span>
                              <span className="text-white/80 font-mono truncate select-all max-w-[110px]">
                                {'prof_' + currentUser?.id?.substring(4, 12)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center bg-white/[0.01] border border-white/5 p-1.5 rounded text-[10px]">
                              <span className="text-white/40 font-mono">Created At</span>
                              <span className="text-white/60 font-mono text-[9px]">
                                {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[9px] font-mono text-white/30 uppercase">
                          <CheckCircle className="w-3.5 h-3.5 text-[#00FFAA]" />
                          <span>Linked Identity verified in profiles</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </AuthGuard>
              </div>

              <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between text-[11px] text-white/40">
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <ShieldCheck className="w-4 h-4 text-[#00FFAA]" />
                  <span>Session persistence active in client cookies</span>
                </div>
                <span className="font-mono text-[9px] bg-[#00FFAA]/10 text-[#00FFAA] px-2 py-0.5 rounded border border-[#00FFAA]/20 font-bold">JWT SECURE</span>
              </div>
            </div>

            {/* RIGHT PANEL: DYNAMIC AUTH PORTAL OR WORKSPACE CONTROL PANEL (SPAN 5) */}
            <div className="col-span-1/12 lg:col-span-5 flex flex-col justify-stretch">
              {!currentUser ? (
                authView === 'login' ? (
                  <LoginForm 
                    onSuccess={() => {}} 
                    onToggleRegister={() => setAuthView('register')}
                    addLogMessage={addLog}
                  />
                ) : (
                  <RegisterForm 
                    onSuccess={() => setAuthView('login')} 
                    onToggleLogin={() => setAuthView('login')}
                    addLogMessage={addLog}
                  />
                )
              ) : selectedWorkspace ? (
                /* Dynamic Workspace control panel when logged in & workspace selected */
                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 relative overflow-hidden shadow-2xl flex flex-col h-full min-h-[580px] justify-between">
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-[#00CCFF]"></div>
                  
                  <div>
                    {/* Header */}
                    <div className="border-b border-white/5 pb-3 mb-4 flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest block">Active Tenant scope</span>
                        <h3 className="text-sm font-bold text-white tracking-tight mt-0.5">{selectedWorkspace.name}</h3>
                        <span className="text-[8px] font-mono text-white/30 block select-all mt-0.5">WS_ID: {selectedWorkspace.id}</span>
                      </div>
                      <span className="text-[9px] font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded uppercase tracking-wider font-extrabold text-[#00CCFF]">
                        TENANT BOUND
                      </span>
                    </div>

                    {/* Tab Selection */}
                    <div className="flex bg-[#050505] p-1 rounded-xl gap-1 border border-white/5 mb-4">
                      {(['members', 'features', 'rls'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => {
                            setWsTab(tab);
                            if (tab === 'rls') {
                              setRlsSimUserEmail(currentUser.email);
                              setRlsSimResult(null);
                            }
                          }}
                          className={`flex-1 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg transition-all cursor-pointer ${
                            wsTab === tab 
                              ? 'bg-white/10 text-white border-b border-white/20' 
                              : 'text-white/40 hover:text-white/70'
                          }`}
                        >
                          {tab === 'members' ? 'Members' : tab === 'features' ? 'Apps/Data' : 'RLS Check'}
                        </button>
                      ))}
                    </div>

                    {/* TAB CONTENT: MEMBERSHIP SYSTEM */}
                    {wsTab === 'members' && (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-[11px] font-mono uppercase text-white/70 mb-1 font-bold">Invite Tenant Workspace Members</h4>
                          <p className="text-[10px] text-white/40 leading-relaxed">
                            Binds user profiles to this specific workspace with a secure role (owner, admin, or member).
                          </p>
                        </div>

                        {/* Invite Member Form */}
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!newMemberEmail.trim()) return;
                            try {
                              await addWorkspaceMember(selectedWorkspace.id, newMemberEmail.trim(), newMemberRole);
                              addLog('OK', 'DATABASE', `Membership database synchronized: Added "${newMemberEmail.trim()}" as role [${newMemberRole}].`);
                              setNewMemberEmail('');
                            } catch (err: any) {
                              addLog('ALERT', 'DATABASE', `Invitation rejected: ${err.message}`);
                              alert(err.message);
                            }
                          }}
                          className="bg-[#050505] border border-white/5 p-3 rounded-xl space-y-3"
                        >
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-white/40 block">Profile Registered Email</label>
                            <input
                              type="email"
                              placeholder="e.g. colleague@company.com"
                              value={newMemberEmail}
                              onChange={e => setNewMemberEmail(e.target.value)}
                              className="w-full bg-[#0F0F0F] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00CCFF]/50"
                            />
                            <p className="text-[8px] text-[#00CCFF]/60 font-mono">
                              *Note: Only emails registered inside the Profile database can be added. Register them first.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono uppercase text-white/40 block">Workspace Role</label>
                              <select
                                value={newMemberRole}
                                onChange={e => setNewMemberRole(e.target.value as any)}
                                className="w-full bg-[#0F0F0F] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00CCFF]/50"
                              >
                                <option value="member">member (Read-only App)</option>
                                <option value="admin">admin (Full config/write)</option>
                                <option value="owner">owner (Primary root)</option>
                              </select>
                            </div>

                            <div className="flex items-end">
                              <button
                                type="submit"
                                className="w-full py-1.5 bg-[#00CCFF] hover:bg-[#00FFAA] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                              >
                                Invite Profile
                              </button>
                            </div>
                          </div>
                        </form>

                        {/* Members List */}
                        <div className="space-y-2">
                          <span className="text-[9px] font-mono uppercase text-white/40 block font-bold">Active Members ({members.length})</span>
                          <div className="space-y-1.5 max-h-[130px] overflow-y-auto pr-1">
                            {members.map(m => {
                              // Retrieve mock users to display their email
                              const usersRaw = localStorage.getItem('maneli_mock_users') || '[]';
                              const usersList = JSON.parse(usersRaw);
                              const user = usersList.find((u: any) => u.id === m.user_id);
                              return (
                                <div key={m.id} className="bg-white/[0.01] border border-white/5 rounded-lg p-2 flex justify-between items-center text-[11px]">
                                  <div>
                                    <span className="text-white font-sans font-medium">{user?.email || 'unresolved_user'}</span>
                                    <span className="text-[8px] text-white/30 font-mono block">ID: {m.user_id.substring(0, 12)}...</span>
                                  </div>
                                  <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border font-bold ${
                                    m.role === 'owner' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : m.role === 'admin'
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                      : 'bg-white/5 text-white/60 border-white/10'
                                  }`}>
                                    {m.role}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB CONTENT: SAAS CORE FEATURES DATA */}
                    {wsTab === 'features' && (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center">
                            <h4 className="text-[11px] font-mono uppercase text-white/70 font-bold">Application Logic Integration</h4>
                            <span className="text-[8px] font-mono text-emerald-400">JSONB EXTENSIBLE</span>
                          </div>
                          <p className="text-[10px] text-white/40 leading-relaxed mt-1">
                            Attach custom app configurations (e.g. CueAudio, QuoteFlow, InvoiceFlow) directly to this workspace without table structural migrations.
                          </p>
                        </div>

                        {/* Attach Feature Logic form */}
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                              const parsedData = JSON.parse(newFeatureJson);
                              await addFeature(selectedWorkspace.id, newFeatureType, parsedData);
                              addLog('OK', 'DATABASE', `Business logic table "features" entry updated. App: "${newFeatureType}".`);
                              alert(`App feature "${newFeatureType}" deployed successfully!`);
                            } catch (err: any) {
                              alert(`Failed to deploy: ${err.message}`);
                            }
                          }}
                          className="bg-[#050505] border border-white/5 p-3 rounded-xl space-y-3"
                        >
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-white/40 block">Select Target SaaS App</label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {(['CueAudio', 'QuoteFlow', 'InvoiceFlow'] as const).map(appType => (
                                <button
                                  key={appType}
                                  type="button"
                                  onClick={() => handleFeatureTypeChange(appType)}
                                  className={`py-1 text-[10px] font-mono rounded border transition-all cursor-pointer ${
                                    newFeatureType === appType
                                      ? 'bg-[#00CCFF]/10 text-[#00CCFF] border-[#00CCFF]/30 font-bold'
                                      : 'bg-transparent text-white/40 border-white/5 hover:border-white/15'
                                  }`}
                                >
                                  {appType}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-mono uppercase text-white/40 block">Dynamic payload (JSONB)</label>
                              <span className="text-[8px] text-white/30 font-mono">Validate JSON syntax</span>
                            </div>
                            <textarea
                              rows={5}
                              value={newFeatureJson}
                              onChange={e => setNewFeatureJson(e.target.value)}
                              className="w-full bg-[#0F0F0F] border border-white/5 rounded-lg p-2 text-[10px] font-mono text-[#00FFAA] focus:outline-none focus:border-[#00CCFF]/50 leading-relaxed"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-1.5 bg-[#00CCFF] hover:bg-[#00FFAA] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                          >
                            Deploy SaaS Logic
                          </button>
                        </form>

                        {/* List Attached Features */}
                        <div className="space-y-2">
                          <span className="text-[9px] font-mono uppercase text-white/40 block font-bold">Deployed Workspace Features ({features.length})</span>
                          <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                            {features.length === 0 ? (
                              <span className="text-[10px] text-white/30 italic font-sans block">No apps configured yet on this tenant workspace.</span>
                            ) : (
                              features.map(f => (
                                <div key={f.id} className="bg-white/[0.01] border border-white/5 rounded-lg p-2.5 text-[11px] font-sans">
                                  <div className="flex justify-between items-center pb-1.5 border-b border-white/5 mb-1.5">
                                    <span className="text-white font-mono font-bold text-xs text-[#00CCFF]">{f.type}</span>
                                    <span className="text-[9px] font-mono text-white/30">UUID: {f.id.substring(5, 12)}</span>
                                  </div>
                                  <pre className="text-[9.5px] font-mono text-[#00FFAA] leading-relaxed max-h-[70px] overflow-auto bg-[#050505] p-1.5 rounded">
                                    {JSON.stringify(f.data, null, 2)}
                                  </pre>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB CONTENT: RLS SECURITY DIAGNOSTICS SUITE */}
                    {wsTab === 'rls' && (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center">
                            <h4 className="text-[11px] font-mono uppercase text-white/70 font-bold">Row Level Security Trace</h4>
                            <span className="text-[8px] font-mono text-[#00FFAA]">POSTGRES RLS</span>
                          </div>
                          <p className="text-[10px] text-white/40 leading-relaxed mt-1">
                            Simulate active queries from different profiles on this workspace. Validates that unauthorized users cannot read data.
                          </p>
                        </div>

                        {/* Simulation setup */}
                        <div className="bg-[#050505] border border-white/5 p-3 rounded-xl space-y-3 text-left">
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-white/40 block">Simulating Profile Query Identity</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {/* Quick selections */}
                              <button
                                type="button"
                                onClick={() => {
                                  setRlsSimUserEmail(currentUser.email);
                                  setRlsSimResult(null);
                                }}
                                className={`px-2.5 py-1 text-[9px] font-mono rounded border transition-all cursor-pointer ${
                                  rlsSimUserEmail === currentUser.email
                                    ? 'bg-[#00FFAA]/10 text-[#00FFAA] border-[#00FFAA]/30'
                                    : 'bg-transparent text-white/40 border-white/5 hover:border-white/10'
                                }`}
                              >
                                Myself (Owner)
                              </button>
                              {members.filter(m => m.user_id !== currentUser.id).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const firstMemberId = members.find(m => m.user_id !== currentUser.id)?.user_id;
                                    const usersRaw = localStorage.getItem('maneli_mock_users') || '[]';
                                    const usersList = JSON.parse(usersRaw);
                                    const targetUser = usersList.find((u: any) => u.id === firstMemberId);
                                    if (targetUser) {
                                      setRlsSimUserEmail(targetUser.email);
                                      setRlsSimResult(null);
                                    }
                                  }}
                                  className={`px-2.5 py-1 text-[9px] font-mono rounded border transition-all cursor-pointer ${
                                    rlsSimUserEmail !== currentUser.email && rlsSimUserEmail !== 'malicious@unauthorized.io'
                                      ? 'bg-[#00CCFF]/10 text-[#00CCFF] border-[#00CCFF]/30'
                                      : 'bg-transparent text-white/40 border-white/5 hover:border-white/10'
                                  }`}
                                >
                                  Colleague (Member)
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setRlsSimUserEmail('malicious@unauthorized.io');
                                  setRlsSimResult(null);
                                }}
                                className={`px-2.5 py-1 text-[9px] font-mono rounded border transition-all cursor-pointer ${
                                  rlsSimUserEmail === 'malicious@unauthorized.io'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold'
                                    : 'bg-transparent text-white/40 border-white/5 hover:border-white/10'
                                }`}
                              >
                                Malicious Attacker
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-white/40 block">Email to query under</label>
                            <input
                              type="text"
                              value={rlsSimUserEmail}
                              onChange={e => {
                                setRlsSimUserEmail(e.target.value);
                                setRlsSimResult(null);
                              }}
                              className="w-full bg-[#0F0F0F] border border-white/5 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#00CCFF]/50"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              // Ensure attacker profile exists in simulated users list so we can check RLS
                              const usersRaw = localStorage.getItem('maneli_mock_users') || '[]';
                              const usersList = JSON.parse(usersRaw);
                              if (rlsSimUserEmail === 'malicious@unauthorized.io' && !usersList.some((u: any) => u.email === rlsSimUserEmail)) {
                                usersList.push({
                                  id: 'usr_malicious_attacker_999',
                                  email: 'malicious@unauthorized.io',
                                  createdAt: new Date().toISOString()
                                });
                                localStorage.setItem('maneli_mock_users', JSON.stringify(usersList));
                              }

                              const res = runRlsDiagnosticTest(rlsSimUserEmail, selectedWorkspace.id);
                              setRlsSimResult(res);
                              addLog(
                                res.accessGranted ? 'OK' : 'WARN',
                                'DATABASE',
                                `RLS POLICY INJECTION: Simulating query from "${rlsSimUserEmail}" on workspaces table. Access ${res.accessGranted ? 'GRANTED' : 'DENIED'}.`
                              );
                            }}
                            className="w-full py-1.5 bg-[#00FFAA] hover:bg-[#00CCFF] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-black" />
                            Run Transaction Simulation
                          </button>
                        </div>

                        {/* Simulation results output */}
                        {rlsSimResult && (
                          <div className={`p-3 rounded-xl border text-xs leading-relaxed font-mono ${
                            rlsSimResult.accessGranted 
                              ? 'bg-[#00FFAA]/5 border-[#00FFAA]/20 text-white/90' 
                              : 'bg-rose-500/5 border-rose-500/20 text-white/90'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-1.5 font-bold">
                              {rlsSimResult.accessGranted ? (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#00FFAA] animate-pulse"></span>
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                              )}
                              <span className={rlsSimResult.accessGranted ? 'text-[#00FFAA]' : 'text-rose-400'}>
                                {rlsSimResult.message}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/60 leading-relaxed pl-4 border-l border-white/10 italic">
                              {rlsSimResult.details}
                            </p>
                            <div className="mt-2 text-[9px] text-white/30 uppercase flex justify-between items-center">
                              <span>Trace Status: Complete</span>
                              <span>DB Engine: PG_16.2</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {wsTab === 'billing' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div>
                          <div className="flex justify-between items-center">
                            <h4 className="text-[11px] font-mono uppercase text-white/70 font-bold">Billing & Subscriptions</h4>
                            <span className="text-[8px] font-mono text-[#00CCFF]">STRIPE REVENUE LAYER</span>
                          </div>
                          <p className="text-[10px] text-white/40 leading-relaxed mt-1">
                            Manage multi-tenant billing tiers and inspect server-side transaction ledgers.
                          </p>
                        </div>

                        {loadingBilling && !billingStatus ? (
                          <div className="py-8 text-center text-xs font-mono text-white/40 flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-[#00FFAA]" />
                            <span>Querying Stripe state ledger...</span>
                          </div>
                        ) : billingStatus?.hasActiveSubscription ? (
                          /* Active Subscription Panel */
                          <div className="bg-[#050505] border border-[#00FFAA]/20 rounded-xl p-4 space-y-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
                            
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#00FFAA] animate-pulse"></span>
                                <span className="text-xs font-bold font-mono uppercase text-[#00FFAA]">Active Subscription Bound</span>
                              </div>
                              <span className="text-[10px] bg-[#00FFAA]/15 border border-[#00FFAA]/30 text-[#00FFAA] px-2.5 py-0.5 rounded font-mono font-bold uppercase">
                                {billingStatus.plan?.toUpperCase()} Plan
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-white/[0.01] p-2.5 border border-white/5 rounded-lg">
                              <div>
                                <span className="text-white/40 block">Customer ID</span>
                                <span className="text-white/80 select-all truncate block">
                                  {billingStatus.subscriptions[0]?.customer_id || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-white/40 block">Subscription ID</span>
                                <span className="text-white/80 select-all truncate block">
                                  {billingStatus.subscriptions[0]?.subscription_id || 'N/A'}
                                </span>
                              </div>
                              <div className="mt-2">
                                <span className="text-white/40 block">Provider</span>
                                <span className="text-indigo-400 font-bold block">
                                  {billingStatus.subscriptions[0]?.provider?.toUpperCase() || 'STRIPE'}
                                </span>
                              </div>
                              <div className="mt-2">
                                <span className="text-white/40 block">Current Period End</span>
                                <span className="text-white/70 block">
                                  {billingStatus.subscriptions[0]?.current_period_end 
                                    ? new Date(billingStatus.subscriptions[0].current_period_end).toLocaleDateString()
                                    : 'N/A'
                                  }
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={async () => {
                                if (!confirm('Are you sure you want to request Stripe to cancel your subscription at the end of the current billing cycle?')) return;
                                const subId = billingStatus.subscriptions[0]?.subscription_id;
                                if (!subId) return;

                                try {
                                  // Trigger server mock webhook call for deleted subscription to simulate the stripe flow!
                                  const mockStripeWebhookPayload = {
                                    id: `evt_sim_del_${Math.random().toString(36).substring(2, 12)}`,
                                    object: 'event',
                                    type: 'customer.subscription.deleted',
                                    data: {
                                      object: {
                                        id: subId,
                                        metadata: {
                                          workspaceId: selectedWorkspace.id
                                        }
                                      }
                                    }
                                  };

                                  await fetch('/api/billing/webhook', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(mockStripeWebhookPayload)
                                  });

                                  addLog('WARN', 'DATABASE', `Requested cancellation of subscription ID: ${subId}. Stripe callback completed.`);
                                  fetchBillingStatus();
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }}
                              className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-mono font-bold uppercase transition-all"
                            >
                              Simulate Cancellation
                            </button>
                          </div>
                        ) : (
                          /* Pricing Tiers Selection */
                          <div className="space-y-3">
                            <span className="text-[9px] font-mono uppercase text-white/40 block font-bold">Select Workspace Pricing Tier</span>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* CUEAUDIO CREATOR PLAN */}
                              <div className="bg-[#050505] border border-white/5 hover:border-[#00FFAA]/30 rounded-xl p-3 flex flex-col justify-between transition-all">
                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-[#00FFAA] font-mono">CUEAUDIO CREATOR</span>
                                    <span className="text-[9px] font-mono text-[#00FFAA] font-bold">$9.99/mo</span>
                                  </div>
                                  <p className="text-[9px] text-white/50 leading-relaxed mb-3">
                                    Enables track publication, digital storefront sales, and secure key downloads.
                                  </p>
                                </div>
                                <button
                                  onClick={async () => {
                                    setCheckoutLoading('cueaudio_creator');
                                    try {
                                      const res = await fetch('/api/billing/checkout', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          workspaceId: selectedWorkspace.id,
                                          plan: 'cueaudio_creator',
                                          email: currentUser.email,
                                          successUrl: window.location.href,
                                          cancelUrl: window.location.href
                                        })
                                      });
                                      const data = await res.json();
                                      if (data.checkoutUrl) {
                                        addLog('INFO', 'ROUTING', `Initiated Stripe Checkout redirect for CueAudio Creator.`);
                                        window.location.href = data.checkoutUrl;
                                      } else {
                                        throw new Error(data.error || 'Checkout URL generation failed');
                                      }
                                    } catch (err: any) {
                                      alert(err.message);
                                    } finally {
                                      setCheckoutLoading(null);
                                    }
                                  }}
                                  disabled={checkoutLoading !== null}
                                  className="w-full py-1.5 bg-[#00FFAA] hover:bg-[#00CCFF] disabled:opacity-50 text-black font-mono font-bold text-[10px] uppercase rounded-lg transition-all"
                                >
                                  {checkoutLoading === 'cueaudio_creator' ? 'Loading...' : 'Checkout CueAudio'}
                                </button>
                              </div>

                              {/* PRO PLAN */}
                              <div className="bg-[#050505] border border-white/5 hover:border-[#00CCFF]/30 rounded-xl p-3 flex flex-col justify-between transition-all">
                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-white font-mono">PRO TIER</span>
                                    <span className="text-[9px] font-mono text-[#00CCFF] font-bold">$29/mo</span>
                                  </div>
                                  <p className="text-[9px] text-white/50 leading-relaxed mb-3">
                                    Enables full isolation workspace clusters, team invites, and custom deployments.
                                  </p>
                                </div>
                                <button
                                  onClick={async () => {
                                    setCheckoutLoading('pro');
                                    try {
                                      const res = await fetch('/api/billing/checkout', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          workspaceId: selectedWorkspace.id,
                                          plan: 'pro',
                                          email: currentUser.email,
                                          successUrl: window.location.href,
                                          cancelUrl: window.location.href
                                        })
                                      });
                                      const data = await res.json();
                                      if (data.checkoutUrl) {
                                        addLog('INFO', 'ROUTING', `Initiated Stripe Checkout redirect for Pro Plan.`);
                                        window.location.href = data.checkoutUrl;
                                      } else {
                                        throw new Error(data.error || 'Checkout URL generation failed');
                                      }
                                    } catch (err: any) {
                                      alert(err.message);
                                    } finally {
                                      setCheckoutLoading(null);
                                    }
                                  }}
                                  disabled={checkoutLoading !== null}
                                  className="w-full py-1.5 bg-[#00CCFF] hover:bg-[#00FFAA] disabled:opacity-50 text-black font-mono font-bold text-[10px] uppercase rounded-lg transition-all"
                                >
                                  {checkoutLoading === 'pro' ? 'Loading...' : 'Checkout Pro'}
                                </button>
                              </div>

                              {/* SCALE PLAN */}
                              <div className="bg-[#050505] border border-white/5 hover:border-[#00FFAA]/30 rounded-xl p-3 flex flex-col justify-between transition-all">
                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-white font-mono">SCALE TIER</span>
                                    <span className="text-[9px] font-mono text-[#00FFAA] font-bold">$99/mo</span>
                                  </div>
                                  <p className="text-[9px] text-white/50 leading-relaxed mb-3">
                                    Maximum workspace isolation boundaries and limitless feature sets.
                                  </p>
                                </div>
                                <button
                                  onClick={async () => {
                                    setCheckoutLoading('scale');
                                    try {
                                      const res = await fetch('/api/billing/checkout', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          workspaceId: selectedWorkspace.id,
                                          plan: 'scale',
                                          email: currentUser.email,
                                          successUrl: window.location.href,
                                          cancelUrl: window.location.href
                                        })
                                      });
                                      const data = await res.json();
                                      if (data.checkoutUrl) {
                                        addLog('INFO', 'ROUTING', `Initiated Stripe Checkout redirect for Scale Plan.`);
                                        window.location.href = data.checkoutUrl;
                                      } else {
                                        throw new Error(data.error || 'Checkout URL generation failed');
                                      }
                                    } catch (err: any) {
                                      alert(err.message);
                                    } finally {
                                      setCheckoutLoading(null);
                                    }
                                  }}
                                  disabled={checkoutLoading !== null}
                                  className="w-full py-1.5 bg-[#00CCFF] hover:bg-[#00FFAA] disabled:opacity-50 text-black font-mono font-bold text-[10px] uppercase rounded-lg transition-all"
                                >
                                  {checkoutLoading === 'scale' ? 'Loading...' : 'Checkout Scale'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TRANSACTION HISTORY & WEBHOOK AUDIT LEDGER */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-mono uppercase text-white/40 block font-bold">Stripe Audit Log (billing_events)</span>
                            <button 
                              type="button"
                              onClick={fetchBillingStatus}
                              className="text-[9px] font-mono text-[#00CCFF] hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Reload
                            </button>
                          </div>
                          
                          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                            {!billingStatus?.events || billingStatus.events.length === 0 ? (
                              <span className="text-[10px] text-white/30 italic font-sans block">No webhook events recorded in billing_events ledger.</span>
                            ) : (
                              billingStatus.events.map((e: any) => (
                                <div key={e.id} className="bg-white/[0.01] border border-white/5 rounded-lg p-2 text-[10.5px] font-mono text-white/70 space-y-1">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-cyan-400 font-bold">{e.event_type}</span>
                                    <span className="text-white/30 text-[8px]">{new Date(e.created_at).toLocaleTimeString()}</span>
                                  </div>
                                  <div className="text-[9px] text-white/40 flex justify-between items-center">
                                    <span>Event ID: {e.provider_event_id.substring(0, 15)}...</span>
                                    <span className="text-[#00FFAA]">STATUS: DB_SYNCED</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Purge workspace instructions */}
                  <div className="pt-3 border-t border-white/5 text-[9px] font-mono text-white/30 uppercase flex items-center justify-between">
                    <span>Multi-tenant Isolation</span>
                    <span>Verified Core Schema</span>
                  </div>
                </div>
              ) : (
                /* When logged in but NO workspace selected */
                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl flex flex-col justify-center text-center items-center h-full min-h-[580px] px-6">
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00CCFF] to-transparent"></div>
                  
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-[#00CCFF]">
                    <Database className="w-6 h-6 text-[#00CCFF]" />
                  </div>
                  
                  <h4 className="text-sm font-bold font-mono text-white uppercase tracking-wider mb-2">
                    No Active Workspace Selected
                  </h4>
                  <p className="text-xs text-white/50 max-w-xs leading-relaxed">
                    Select an existing workspace isolation container from the left list, or compile a new tenant workspace to start inviting members, attaching dynamic SaaS apps, and testing RLS rules.
                  </p>
                </div>
              )}
            </div>

          </section>

          {/* CUEAUDIO ACTIVE MULTI-TENANT APPLICATION MODULE */}
          {currentUser && selectedWorkspace && (
            <section id="cueaudio-app-module" className="col-span-12">
              <CueAudioModule
                workspaceId={selectedWorkspace.id}
                currentUserEmail={currentUser.email}
                addLog={addLog}
                billingStatus={billingStatus}
                fetchBillingStatus={fetchBillingStatus}
              />
            </section>
          )}

          {/* LEFT PANEL (SPAN 4): CORE FILES & SYSTEM DIRECTORY EXPLORER */}
          <section id="directory-explorer-card" className="col-span-1 lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md flex flex-col gap-4 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 w-[3px] h-14 bg-[#00FFAA]"></div>
              
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h2 className="text-xs font-mono uppercase text-[#00FFAA] tracking-wider font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00FFAA]" />
                  Directory Architecture
                </h2>
                <span className="text-[9px] font-mono text-white/30">src/</span>
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                Maneli Kernel organizes clean domains inside strict directories to support rapid multi-tenant body generation. Click directories to explore code scopes:
              </p>

              {/* Folder Nodes list */}
              <div className="flex flex-col gap-1.5 mt-2">
                {ARCHITECTURE_FOLDERS.map((node) => {
                  const isSelected = selectedFolder.name === node.name;
                  return (
                    <button
                      key={node.name}
                      onClick={() => setSelectedFolder(node)}
                      className={`w-full text-left px-3.5 py-3 rounded-lg border flex items-center justify-between transition-all group ${
                        isSelected 
                          ? 'bg-[#00FFAA]/5 border-[#00FFAA]/30 text-white shadow-[0_0_12px_rgba(0,255,170,0.05)]' 
                          : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-white/70 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Folder className={`w-4.5 h-4.5 transition-colors ${isSelected ? 'text-[#00FFAA]' : 'text-white/40 group-hover:text-white/60'}`} />
                        <span className="text-xs font-semibold font-mono tracking-tight">/{node.name}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-[#00FFAA] translate-x-0.5' : 'text-white/20 group-hover:text-white/40'}`} />
                    </button>
                  );
                })}
              </div>

              {/* Directory Inspector Details */}
              <div className="bg-[#050505] border border-white/5 rounded-xl p-4 mt-2 flex flex-col gap-2 relative">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/30 uppercase tracking-wider font-bold">
                  <Info className="w-3.5 h-3.5 text-[#00CCFF]" />
                  Scope Detail: {selectedFolder.path}
                </div>
                <p className="text-xs text-white/80 leading-relaxed mt-1">{selectedFolder.description}</p>
                
                {/* Children files list if exists */}
                {selectedFolder.children && selectedFolder.children.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2">
                    <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest font-bold">Key Foundation files:</span>
                    <div className="space-y-1.5">
                      {selectedFolder.children.map(child => (
                        <div key={child.name} className="flex items-start gap-2.5 text-[11px] font-mono text-white/70 bg-white/[0.01] p-2 rounded border border-white/5">
                          {child.type === 'folder' ? (
                            <Folder className="w-3.5 h-3.5 mt-0.5 text-white/40 shrink-0" />
                          ) : (
                            <FileCode className="w-3.5 h-3.5 mt-0.5 text-[#00CCFF] shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-semibold text-white/90">{child.name}</span>
                            <span className="text-[10px] text-white/40 leading-normal mt-0.5">{child.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DIRECT DESIGN SYSTEM TOKENS CARD */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-xs font-mono uppercase text-[#00CCFF] tracking-wider font-bold flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  Design Token Tokens
                </span>
                <span className="text-[9px] font-mono text-white/30">Theme v1</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="bg-[#050505] p-3 rounded-xl border border-white/5 flex flex-col gap-1">
                  <span className="text-white/40 font-mono text-[9px] uppercase">Glow Primary</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-4 h-4 rounded bg-[#00FFAA] border border-white/10"></div>
                    <span className="font-mono text-white/80 font-semibold">#00FFAA</span>
                  </div>
                </div>
                <div className="bg-[#050505] p-3 rounded-xl border border-white/5 flex flex-col gap-1">
                  <span className="text-white/40 font-mono text-[9px] uppercase">Edge Brand</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-4 h-4 rounded bg-[#00CCFF] border border-white/10"></div>
                    <span className="font-mono text-white/80 font-semibold">#00CCFF</span>
                  </div>
                </div>
                <div className="bg-[#050505] p-3 rounded-xl border border-white/5 flex flex-col gap-1">
                  <span className="text-white/40 font-mono text-[9px] uppercase">App Background</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-4 h-4 rounded bg-[#050505] border border-white/10"></div>
                    <span className="font-mono text-white/80 font-semibold">#050505</span>
                  </div>
                </div>
                <div className="bg-[#050505] p-3 rounded-xl border border-white/5 flex flex-col gap-1">
                  <span className="text-white/40 font-mono text-[9px] uppercase">Borders</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-4 h-4 rounded bg-[#1C1C1C] border border-white/10"></div>
                    <span className="font-mono text-white/80 font-semibold">rgba(255,255,255,0.08)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CENTER PANEL (SPAN 5): SECURITY RULES & INTERACTIVE ENVIRONMENT */}
          <section id="database-rules-card" className="col-span-1 lg:col-span-5 flex flex-col gap-6">
            
            {/* Supabase, RLS & SQL Code Module */}
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 relative overflow-hidden shadow-2xl min-h-[460px] flex flex-col justify-between">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00CCFF] to-transparent"></div>
              
              <div>
                <div className="flex justify-between items-start gap-4 mb-4">
                  <span className="bg-[#00CCFF]/10 text-[#00CCFF] text-[10px] px-2.5 py-1 rounded border border-[#00CCFF]/20 uppercase font-bold tracking-wider font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00CCFF] animate-pulse"></span>
                    Database Core Sheet
                  </span>

                  {/* Tabs selector */}
                  <div className="flex bg-[#050505] p-1 rounded-lg border border-white/5 text-[9px] font-mono">
                    <button
                      onClick={() => setActiveSchemaTab('sql')}
                      className={`px-2 py-1 rounded ${activeSchemaTab === 'sql' ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white/70'}`}
                    >
                      PostgreSQL
                    </button>
                    <button
                      onClick={() => setActiveSchemaTab('rls')}
                      className={`px-2 py-1 rounded ${activeSchemaTab === 'rls' ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white/70'}`}
                    >
                      RLS Tables
                    </button>
                    <button
                      onClick={() => setActiveSchemaTab('clients')}
                      className={`px-2 py-1 rounded ${activeSchemaTab === 'clients' ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Init Client
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  {activeSchemaTab === 'sql' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-white/60 font-semibold font-mono">/database/schema.sql</span>
                        <span className="text-[9px] text-white/30 uppercase font-mono">triggers & structures</span>
                      </div>
                      <div className="bg-[#050505] p-4 rounded-xl border border-white/5 font-mono text-[10px] leading-relaxed text-white/80 h-72 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <span className="text-[#00FFAA] font-bold">-- Core SQL Schema for Multi-Tenant Partitioning</span>
                        <p className="mt-1.5 text-white/40">-- Create tables mapping tenants inside isolated scopes</p>
                        <code className="block mt-2 whitespace-pre text-white/70">
{`CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  status tenant_status DEFAULT 'STAGING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Apply Select policies globally for active subdomains
CREATE POLICY active_tenant_select ON tenants
  FOR SELECT USING (status = 'PROVISIONED');`}
                        </code>
                      </div>
                    </div>
                  )}

                  {activeSchemaTab === 'rls' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-white/60 font-semibold font-mono">Supabase Row-Level Security Policies</span>
                        <span className="text-[9px] text-white/30 uppercase font-mono">Isolated Contexts</span>
                      </div>
                      
                      <div className="space-y-4 h-72 overflow-y-auto pr-1">
                        {CORE_DATABASE_SCHEMAS.map(schema => (
                          <div key={schema.name} className="bg-[#050505] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <span className="text-xs font-bold text-white font-mono">Table: {schema.name}</span>
                              <span className="text-[9px] bg-white/5 text-white/60 px-2 py-0.5 rounded border border-white/5 font-mono">RLS Enabled</span>
                            </div>
                            <p className="text-[11px] text-white/50">{schema.description}</p>
                            
                            <div className="mt-1 space-y-2">
                              <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest font-bold block">RLS Security Rules:</span>
                              {schema.rlsPolicies.map(pol => (
                                <div key={pol.name} className="bg-white/[0.01] border border-white/5 rounded p-2.5 flex flex-col gap-1 text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#00FFAA]"></div>
                                    <span className="font-bold text-white/90">{pol.name}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[9px] text-white/40 pt-1 border-t border-white/[0.02]">
                                    <span>Roles: {pol.roles.join(', ')}</span>
                                    <span className="text-right">Action: {pol.action}</span>
                                  </div>
                                  <div className="bg-[#050505] p-1.5 rounded text-[9px] font-mono text-[#00FFAA] mt-1 break-all">
                                    USING ({pol.usingExpression})
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSchemaTab === 'clients' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-white/60 font-semibold font-mono">/lib/supabase.ts</span>
                        <span className="text-[9px] text-white/30 uppercase font-mono">Handshake instantiation</span>
                      </div>
                      <div className="bg-[#050505] p-4 rounded-xl border border-white/5 font-mono text-[10px] leading-relaxed text-white/80 h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <span className="text-[#00CCFF] font-bold">import {`{ getSupabaseClient }`} from "../lib/supabase";</span>
                        <p className="mt-2 text-white/40">// Retrieve single-instance DB client</p>
                        <code className="block mt-2 whitespace-pre text-white/70">
{`const supabase = getSupabaseClient();

export async function fetchActiveTenant(subdomain: string) {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, status")
    .eq("subdomain", subdomain);
    
  if (error) {
    throw new Error(error.message);
  }
  return data;
}`}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Secure statement signature */}
              <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between text-[11px] text-white/40">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#00FFAA]" />
                  <span>Row-Level Security enforces tenant boundary separation</span>
                </div>
                <span className="font-mono text-[9px] bg-white/5 px-2 py-0.5 rounded border border-white/5">AES_256_GCM</span>
              </div>
            </div>

            {/* INTERACTIVE ENVIRONMENT ARCHITECTURE PANEL */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-xs font-mono uppercase text-white/60 tracking-wider font-bold flex items-center gap-2">
                  <Key className="w-4 h-4 text-white/40" />
                  Environment Variable Registry
                </span>
                <span className="text-[10px] font-mono text-white/30">.env.example</span>
              </div>

              <p className="text-xs text-white/50 leading-relaxed">
                Toggle variables to simulate their presence on the platform host. Variables update system states in real time:
              </p>

              <div className="space-y-2.5 mt-1">
                {envVars.map(v => (
                  <div 
                    key={v.key} 
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-all ${
                      v.isSet 
                        ? 'bg-white/[0.02] border-white/5' 
                        : 'bg-rose-500/[0.01] border-rose-500/10'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-white">{v.key}</span>
                        <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                          v.isPublic 
                            ? 'bg-[#00CCFF]/10 text-[#00CCFF] border-[#00CCFF]/20' 
                            : 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                        }`}>
                          {v.isPublic ? 'Public/Client' : 'Private/Server'}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 leading-normal mt-1">{v.description}</p>
                    </div>

                    <button
                      onClick={() => toggleEnvVar(v.key)}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider border focus:outline-none transition-all cursor-pointer ${
                        v.isSet 
                          ? 'bg-[#00FFAA]/10 text-[#00FFAA] border-[#00FFAA]/20 hover:bg-[#00FFAA]/20' 
                          : 'bg-white/5 text-white/30 border-white/5 hover:bg-white/10 hover:text-white/60'
                      }`}
                    >
                      {v.isSet ? 'DEFINED' : 'MISSING'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </section>

          {/* RIGHT PANEL (SPAN 3): PLATFORM POLICY GATES & TENANT LAUNCHER */}
          <section id="policy-scheduler-card" className="col-span-1 lg:col-span-3 flex flex-col gap-6">
            
            {/* Policy Gates Switch Panel */}
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                <Sliders className="w-4 h-4 text-white/40" />
                <h2 className="text-xs font-bold font-mono uppercase text-white/60 tracking-wider">Kernel Policy Gate</h2>
              </div>
              
              <div className="space-y-4">
                {/* Gate 1: Isolation */}
                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="flex-1">
                    <p className="text-white font-semibold mb-0.5">Tenant Isolation</p>
                    <p className="text-white/40 text-[10px] leading-relaxed">Dynamic metadata separation across database workspaces.</p>
                  </div>
                  <button 
                    onClick={() => togglePolicy('tenantIsolation')}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${
                      policies.tenantIsolation ? 'bg-[#00FFAA]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-[#050505] transition-transform duration-200 transform ${
                      policies.tenantIsolation ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Gate 2: P99 Rate Limiting */}
                <div className="flex items-start justify-between gap-3 text-xs pt-3 border-t border-white/5">
                  <div className="flex-1">
                    <p className="text-white font-semibold mb-0.5">P99 Rate Limiter</p>
                    <p className="text-white/40 text-[10px] leading-relaxed">High-availability filter shielding container layers.</p>
                  </div>
                  <button 
                    onClick={() => togglePolicy('rateLimitingP99')}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${
                      policies.rateLimitingP99 ? 'bg-[#00FFAA]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-[#050505] transition-transform duration-200 transform ${
                      policies.rateLimitingP99 ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Gate 3: strict CORS */}
                <div className="flex items-start justify-between gap-3 text-xs pt-3 border-t border-white/5">
                  <div className="flex-1">
                    <p className="text-white font-semibold mb-0.5">Strict CORS Rules</p>
                    <p className="text-white/40 text-[10px] leading-relaxed">Restricts cross-origin routes strictly to designated domains.</p>
                  </div>
                  <button 
                    onClick={() => togglePolicy('strictCors')}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${
                      policies.strictCors ? 'bg-[#00FFAA]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-[#050505] transition-transform duration-200 transform ${
                      policies.strictCors ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Gate 4: Redis Edge caching */}
                <div className="flex items-start justify-between gap-3 text-xs pt-3 border-t border-white/5">
                  <div className="flex-1">
                    <p className="text-white font-semibold mb-0.5">Redis Edge Cache</p>
                    <p className="text-white/40 text-[10px] leading-relaxed">Global feature-gate caching for low-latency retrieval.</p>
                  </div>
                  <button 
                    onClick={() => togglePolicy('edgeCaching')}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${
                      policies.edgeCaching ? 'bg-[#00FFAA]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-[#050505] transition-transform duration-200 transform ${
                      policies.edgeCaching ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Live Multi-Tenant Sandbox Compiler */}
            <div className="bg-gradient-to-br from-[#00FFAA]/5 to-[#00CCFF]/5 border border-white/10 p-5 rounded-2xl flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-28 h-28 border border-[#00FFAA]/10 rounded-full pointer-events-none"></div>
              
              <div>
                <h2 className="text-xs font-mono font-bold uppercase text-[#00FFAA] tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  Tenant Sandbox Compiler
                </h2>
                <p className="text-[11px] text-white/50 leading-relaxed mt-2">
                  Simulate registering and launching isolated subscription spaces directly on the core application kernel.
                </p>
              </div>

              {/* Form to spawn brand new workspace */}
              <form onSubmit={handleCompileTenant} className="space-y-3 mt-1.5">
                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-wider text-white/40 mb-1.5 font-bold">Tenant/Client Name</label>
                  <input
                    type="text"
                    required
                    disabled={isCompiling}
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-[#050505] border border-white/10 rounded-lg text-xs font-mono px-3 py-2 text-white focus:outline-none focus:border-[#00FFAA]/40 focus:bg-[#0A0A0A] transition-colors disabled:opacity-40"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-wider text-white/40 mb-1.5 font-bold">Domain Subdomain</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={isCompiling}
                      value={newTenantSubdomain}
                      onChange={(e) => setNewTenantSubdomain(e.target.value)}
                      placeholder="acme-saas"
                      className="w-full bg-[#050505] border border-white/10 rounded-lg text-xs font-mono pl-3 pr-24 py-2 text-white focus:outline-none focus:border-[#00FFAA]/40 focus:bg-[#0A0A0A] transition-colors disabled:opacity-40"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <span className="text-[9px] font-mono text-white/30 uppercase tracking-tight">.kernel.app</span>
                    </div>
                  </div>
                </div>

                {isCompiling ? (
                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] font-mono text-[#00CCFF] mb-1.5 font-bold">
                      <span>COMPILING ASSETS...</span>
                      <span>{compilationProgress}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-[#00CCFF] h-full transition-all duration-300" style={{ width: `${compilationProgress}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-full bg-[#00FFAA] hover:bg-[#00FFAA]/90 text-[#050505] font-mono font-extrabold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,255,170,0.25)] hover:shadow-[0_4px_24px_rgba(0,255,170,0.4)] transition-all cursor-pointer mt-4"
                  >
                    <Plus className="w-4 h-4 stroke-[3px]" />
                    Compile Workspace
                  </button>
                )}
              </form>

              {/* Spawned instances list */}
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest font-bold">Active sandbox spaces ({tenants.length}):</span>
                <div className="space-y-2">
                  {tenants.map(t => (
                    <div key={t.id} className="bg-[#050505] border border-white/5 rounded-xl p-3 flex justify-between items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-white">{t.name}</span>
                        <span className="font-mono text-[9px] text-[#00FFAA]">{t.subdomain}.kernel.app</span>
                      </div>
                      <button
                        onClick={() => removeTenant(t.id, t.name)}
                        className="p-2 rounded bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 text-white/40 hover:text-rose-400 transition-all focus:outline-none cursor-pointer"
                        title="Tear down sandbox tenant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

        </main>

        {/* BOTTOM REAL-TIME LOGS & SYSTEM FEEDS TERMINAL */}
        <footer id="bottom-terminal-console" className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-3">
            <div className="flex items-center gap-2.5">
              <TerminalIcon className="w-4 h-4 text-[#00FFAA]" />
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-white/80">Kernel Event Feed</span>
              <span className="w-2 h-2 rounded-full bg-[#00FFAA] animate-pulse"></span>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1.5 bg-[#050505] p-1 rounded-lg border border-white/5 text-[10px] font-mono font-bold">
              {(['ALL', 'INFO', 'OK', 'WARN', 'ALERT'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setLogFilter(lvl)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    logFilter === lvl 
                      ? 'bg-white/10 text-white border border-white/5 shadow-inner' 
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Logs scroll console windows */}
          <div className="h-44 overflow-y-auto bg-[#050505] p-4 rounded-xl border border-white/5 font-mono text-[10px] leading-relaxed space-y-2.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {filteredLogs.length === 0 ? (
              <div className="text-white/20 italic text-center py-12">No records found matching filter. Click variables or register tenants to generate logs.</div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 group">
                  <span className="text-white/20 select-none font-mono">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold select-none tracking-wide text-center min-w-[50px] inline-block font-mono ${
                    log.level === 'OK' ? 'bg-[#00FFAA]/10 text-[#00FFAA] border border-[#00FFAA]/20' :
                    log.level === 'WARN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    log.level === 'ALERT' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse' :
                    'bg-[#00CCFF]/10 text-[#00CCFF] border border-[#00CCFF]/20'
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-[#00FFAA]/80 font-bold font-mono shrink-0">[{log.category}]</span>
                  <span className="text-white/80 group-hover:text-white flex-1">{log.message}</span>
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Footer Metadata */}
          <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-white/20 pt-2 gap-2 border-t border-white/5 mt-1">
            <div className="flex gap-6 uppercase">
              <span>© 2026 MANELI INDUSTRIES</span>
              <span className="hidden sm:inline font-bold">BUILD_ID: 99x_KRNL_FOUNDATION</span>
            </div>
            <div className="flex gap-3 items-center">
              <span className="flex items-center gap-1.5 text-[9px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FFAA] animate-pulse"></span>
                <span>SYSTEMS INTEGRATION READY: STRIPE, SUPABASE</span>
              </span>
            </div>
          </div>
        </footer>

      </div>

    </div>
  );
}
