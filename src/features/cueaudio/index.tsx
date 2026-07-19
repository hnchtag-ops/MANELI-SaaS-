/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArtistDashboard } from './ArtistDashboard';
import { PublicTrackPage } from './PublicTrackPage';
import { Music, Sliders, ShoppingBag, Terminal } from 'lucide-react';

interface CueAudioModuleProps {
  workspaceId: string;
  currentUserEmail: string;
  addLog: (level: 'INFO' | 'OK' | 'WARN' | 'ALERT', category: string, message: string) => void;
  billingStatus: {
    hasActiveSubscription: boolean;
    plan: string | null;
    subscriptions: any[];
    events: any[];
  } | null;
  fetchBillingStatus: () => Promise<void>;
}

export const CueAudioModule: React.FC<CueAudioModuleProps> = ({ 
  workspaceId, 
  currentUserEmail,
  addLog,
  billingStatus,
  fetchBillingStatus
}) => {
  const [activeTab, setActiveTab] = useState<'artist' | 'public'>('artist');

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 relative overflow-hidden shadow-2xl space-y-6">
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00CCFF] to-transparent"></div>
      
      {/* Module Title & Tab Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00FFAA]/20 to-[#00CCFF]/20 border border-[#00FFAA]/30 flex items-center justify-center text-[#00FFAA]">
            <Music className="w-4.5 h-4.5" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-extrabold font-mono text-white uppercase tracking-wider">CueAudio Module</h2>
              <span className="text-[9px] font-mono bg-[#00CCFF]/10 text-[#00CCFF] border border-[#00CCFF]/20 px-1.5 py-0.2 rounded font-extrabold uppercase">v1.0</span>
            </div>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">Application feature deployed on workspace isolation container</p>
          </div>
        </div>

        {/* Tab switch button */}
        <div className="flex p-1 bg-[#050505] rounded-xl border border-white/5 text-[10px] font-mono font-bold self-end sm:self-auto">
          <button
            onClick={() => {
              setActiveTab('artist');
              addLog('INFO', 'CUEAUDIO', 'Context switched to Artist / Creator workspace dashboard.');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'artist' 
                ? 'bg-[#00FFAA]/10 text-[#00FFAA] border border-[#00FFAA]/25' 
                : 'text-white/40 hover:text-white/75'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Artist Console</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('public');
              addLog('INFO', 'CUEAUDIO', 'Context switched to Public Client / Storefront portal.');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'public' 
                ? 'bg-[#00CCFF]/10 text-[#00CCFF] border border-[#00CCFF]/25' 
                : 'text-white/40 hover:text-white/75'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Storefront Portal</span>
          </button>
        </div>
      </div>

      {/* Render selected workspace feature tab */}
      {activeTab === 'artist' ? (
        <ArtistDashboard 
          workspaceId={workspaceId} 
          currentUserEmail={currentUserEmail}
          addLog={addLog}
          billingStatus={billingStatus}
          fetchBillingStatus={fetchBillingStatus}
        />
      ) : (
        <PublicTrackPage 
          workspaceId={workspaceId} 
          addLog={addLog}
        />
      )}

      {/* Active telemetry info signature footer */}
      <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center text-[9px] font-mono text-white/30 uppercase gap-2">
        <span className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#00FFAA]" />
          <span>Active Context: {activeTab === 'artist' ? 'Creator / Admin' : 'Public / Guest'}</span>
        </span>
        <span>Secure container: public.workspaces_isolation_group_1a</span>
      </div>

    </div>
  );
};
export default CueAudioModule;
