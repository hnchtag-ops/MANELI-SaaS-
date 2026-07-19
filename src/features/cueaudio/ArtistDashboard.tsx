/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Music, Plus, Trash2, Globe, Eye, EyeOff, DollarSign, 
  Tag, RefreshCw, FileText, CheckCircle2, AlertTriangle, Play, Pause, Coins, User,
  Zap, Lock
} from 'lucide-react';
import { Track } from './types';
import { getSupabaseClient } from '../../lib/supabase';

// Cover preset suggestions for a seamless, beautiful creator experience
const COVER_PRESETS = [
  { name: 'Nebula Horizon', url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=300&auto=format&fit=crop' },
  { name: 'Retro Grid', url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300&auto=format&fit=crop' },
  { name: 'Analog Waveform', url: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=300&auto=format&fit=crop' },
  { name: 'Midnight Neon', url: 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=300&auto=format&fit=crop' }
];

// Audio presets (standard MP3s from archive or public domains) for real audio playback
const AUDIO_PRESETS = [
  { name: 'Acoustic Brightness', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name: 'Ambient Chillout', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { name: 'Synthwave Driver', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

interface ArtistDashboardProps {
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

export const ArtistDashboard: React.FC<ArtistDashboardProps> = ({ 
  workspaceId, 
  currentUserEmail,
  addLog,
  billingStatus,
  fetchBillingStatus
}) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasActiveSubscription = true; // Stripe subscription gating disabled for now

  // Form state
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState(COVER_PRESETS[0].url);
  const [audioUrl, setAudioUrl] = useState(AUDIO_PRESETS[0].url);
  const [price, setPrice] = useState('19.99');
  
  // Audio preview state
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch tracks
  const fetchTracks = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchErr } = await supabase
        .from('tracks')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (fetchErr) throw fetchErr;
      setTracks(data || []);
      addLog('INFO', 'DATABASE', `Table public.tracks synced for workspace "${workspaceId}". Loaded ${data?.length || 0} catalog records.`);
    } catch (err: any) {
      setError(err.message || 'Error occurred querying workspace catalog.');
      addLog('ALERT', 'DATABASE', `Failed to sync table public.tracks for workspace "${workspaceId}": ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
    // Stop audio on unmount or workspace change
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [workspaceId]);

  // Audio Play/Pause handler
  const handleTogglePreview = (track: Track) => {
    if (playingTrackId === track.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingTrackId(null);
      addLog('INFO', 'CUEAUDIO', `Playback paused: "${track.title}" preview stopped.`);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      addLog('INFO', 'CUEAUDIO', `Buffering audio stream: "${track.title}" from source URL...`);
      const newAudio = new Audio(track.audio_url);
      
      newAudio.oncanplay = () => {
        addLog('OK', 'CUEAUDIO', `Active playback started for track: "${track.title}" by ${track.artist_name}.`);
      };

      newAudio.onerror = () => {
        addLog('ALERT', 'CUEAUDIO', `Audio preview stream failed for track: "${track.title}". Check source URL.`);
        setPlayingTrackId(null);
        audioRef.current = null;
      };

      newAudio.onended = () => {
        addLog('INFO', 'CUEAUDIO', `Playback ended naturally for track: "${track.title}".`);
        setPlayingTrackId(null);
        audioRef.current = null;
      };

      audioRef.current = newAudio;
      setPlayingTrackId(track.id);
      
      newAudio.play().catch(err => {
        console.error('Audio playback failed:', err);
        addLog('ALERT', 'CUEAUDIO', `Audio playback blocked by autoplay policy: ${err.message}`);
        setPlayingTrackId(null);
        audioRef.current = null;
      });
    }
  };

  // Create track form submit
  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artistName.trim() || !price) return;

    setError(null);
    try {
      const supabase = getSupabaseClient();
      const sanitizedDescription = description.trim() || 'No description provided.';
      const formattedPrice = Number(Number(price).toFixed(2));

      const trackData = {
        workspace_id: workspaceId,
        title: title.trim(),
        artist_name: artistName.trim(),
        description: sanitizedDescription,
        cover_url: coverUrl,
        audio_url: audioUrl,
        price: formattedPrice,
        status: 'draft'
      };

      const { data, error: insertErr } = await supabase
        .from('tracks')
        .insert(trackData)
        .select();

      if (insertErr) throw insertErr;

      const newTrack = data && data[0];
      if (!newTrack) throw new Error('Failed to create track record.');

      addLog('OK', 'DATABASE', `Successfully compiled track record "${newTrack.title}" by ${newTrack.artist_name} inside workspace_${workspaceId}. Status: DRAFT.`);
      
      // Reset form
      setTitle('');
      setArtistName('');
      setDescription('');
      
      fetchTracks();
    } catch (err: any) {
      setError(err.message || 'Error compiling track record.');
      addLog('ALERT', 'DATABASE', `Failed to create track record: ${err.message || err}`);
    }
  };

  // Toggle publish state
  const handleTogglePublish = async (track: Track) => {
    const nextStatus = track.status === 'published' ? 'draft' : 'published';
    
    // UI check for active subscription before allowing publish
    if (nextStatus === 'published' && !hasActiveSubscription) {
      setError('Stripe subscription required to publish.');
      addLog('ALERT', 'STRIPE', 'Stripe subscription required to publish.');
      return;
    }

    try {
      const res = await fetch(`/api/cueaudio/tracks/${track.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          status: nextStatus
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Status transition failed.');
      }
      
      const updatedTrack = await res.json();
      addLog('INFO', 'DATABASE', `Table public.tracks transaction update: Track "${updatedTrack.title}" status changed to ${updatedTrack.status.toUpperCase()}`);
      
      fetchTracks();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle publish status.');
      addLog('ALERT', 'DATABASE', `Failed to update publish status for track "${track.title}": ${err.message || err}`);
    }
  };

  // Delete track
  const handleDeleteTrack = async (trackId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete track "${title}"?`)) return;

    try {
      const supabase = getSupabaseClient();
      const { error: deleteErr } = await supabase
        .from('tracks')
        .delete()
        .eq('id', trackId);

      if (deleteErr) throw deleteErr;
      
      addLog('WARN', 'DATABASE', `Purged track record "${title}" (ID: ${trackId}) from table public.tracks cascade.`);
      fetchTracks();
    } catch (err: any) {
      setError(err.message || 'Failed to delete track.');
      addLog('ALERT', 'DATABASE', `Failed to delete track "${title}" (ID: ${trackId}): ${err.message || err}`);
    }
  };

  // Statistics calculation
  const totalTracks = tracks.filter(t => t.workspace_id === workspaceId).length;
  const publishedTracks = tracks.filter(t => t.workspace_id === workspaceId && t.status === 'published').length;
  const draftTracks = totalTracks - publishedTracks;

  return (
    <div className="space-y-6">
      
      {/* SUBSCRIPTION GATE WARNING AND UPGRADE CARD */}
      <div className="p-4 rounded-xl bg-[#050F0A] border border-[#00FFAA]/20 text-left flex items-center gap-3">
        <div className="w-6 h-6 rounded-lg bg-[#00FFAA]/10 border border-[#00FFAA]/20 flex items-center justify-center text-[#00FFAA] shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
        <div className="text-[11px] font-mono">
          <span className="text-[#00FFAA] font-extrabold uppercase">✓ ACTIVE LICENSE GRANTED:</span>
          <span className="text-white/75 ml-1.5">Your workspace is fully authorized to publish tracks, collect fan storefront revenue, and generate cryptographic keys.</span>
        </div>
      </div>
      
      {/* Overview stats header banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#050505] border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-white/40 block">Workspace Music</span>
            <span className="text-xl font-bold font-mono text-white mt-0.5">{totalTracks} Tracks</span>
          </div>
          <Music className="w-5 h-5 text-[#00CCFF] opacity-60" />
        </div>
        
        <div className="bg-[#050505] border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#00FFAA] block">Published Storefront</span>
            <span className="text-xl font-bold font-mono text-[#00FFAA] mt-0.5">{publishedTracks} Live</span>
          </div>
          <Globe className="w-5 h-5 text-[#00FFAA] opacity-60" />
        </div>

        <div className="bg-[#050505] border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-amber-400 block">Staged Drafts</span>
            <span className="text-xl font-bold font-mono text-amber-400 mt-0.5">{draftTracks} Pending</span>
          </div>
          <EyeOff className="w-5 h-5 text-amber-400 opacity-60" />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Add Track on left, Track list on right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT: Upload/Add Track Form (Span 5) */}
        <div className="xl:col-span-5 bg-[#050505]/60 border border-white/5 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Plus className="w-4 h-4 text-[#00FFAA]" />
            <h4 className="text-xs font-mono uppercase font-bold text-white tracking-wider">Register Track Metadata</h4>
          </div>

          <form onSubmit={handleAddTrack} className="space-y-3 text-left">
            <div>
              <label className="block text-[9px] font-mono uppercase text-white/40 mb-1 font-bold">Track Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Neon Horizon"
                className="w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#00FFAA]/50 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-mono uppercase text-white/40 mb-1 font-bold">Artist / Producer</label>
                <input
                  type="text"
                  required
                  value={artistName}
                  onChange={e => setArtistName(e.target.value)}
                  placeholder="e.g. Lumina Drift"
                  className="w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#00FFAA]/50 font-sans"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase text-white/40 mb-1 font-bold">Price (USD)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-mono text-white/30">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="19.99"
                    className="w-full bg-[#0F0F0F] border border-white/10 rounded-lg pl-6 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#00FFAA]/50 font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-mono uppercase text-white/40 mb-1 font-bold">Short Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Briefly describe the track genre, BPM, key signature, or license permissions..."
                rows={2}
                className="w-full bg-[#0F0F0F] border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#00FFAA]/50 font-sans"
              />
            </div>

            {/* Cover image selection */}
            <div>
              <label className="block text-[9px] font-mono uppercase text-white/40 mb-1 font-bold">Cover Art Preset / Custom URL</label>
              <input
                type="text"
                required
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
                className="w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-mono text-white/70 focus:outline-none focus:border-[#00FFAA]/50 mb-2"
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {COVER_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setCoverUrl(preset.url)}
                    className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded border text-[9px] font-mono transition-all ${
                      coverUrl === preset.url
                        ? 'bg-[#00FFAA]/10 border-[#00FFAA]/30 text-[#00FFAA]'
                        : 'bg-white/[0.01] border-white/5 text-white/50 hover:border-white/10'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="w-4 h-4 rounded object-cover" referrerPolicy="no-referrer" />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio file URL preset selection */}
            <div>
              <label className="block text-[9px] font-mono uppercase text-white/40 mb-1 font-bold">Audio File Preset / Custom URL</label>
              <input
                type="text"
                required
                value={audioUrl}
                onChange={e => setAudioUrl(e.target.value)}
                className="w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-mono text-white/70 focus:outline-none focus:border-[#00FFAA]/50 mb-2"
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {AUDIO_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setAudioUrl(preset.url)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[9px] font-mono transition-all ${
                      audioUrl === preset.url
                        ? 'bg-[#00CCFF]/10 border-[#00CCFF]/30 text-[#00CCFF]'
                        : 'bg-white/[0.01] border-white/5 text-white/50 hover:border-white/10'
                    }`}
                  >
                    <Music className="w-3 h-3 text-[#00CCFF]" />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#00FFAA] hover:bg-[#00CCFF] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              Publish Staged Track
            </button>
          </form>
        </div>

        {/* RIGHT: Active Catalog Lists (Span 7) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-[#00CCFF]" />
              <h4 className="text-xs font-mono uppercase font-bold text-white tracking-wider">Workspace Audio Catalog ({totalTracks})</h4>
            </div>
            <button 
              onClick={fetchTracks}
              className="p-1.5 hover:bg-white/5 rounded border border-white/5 text-white/50 hover:text-white transition-all cursor-pointer"
              title="Refresh Catalog Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && tracks.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-white/40 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#00FFAA]" />
              <span>Scanning tenant tracks table...</span>
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
              <Music className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-xs text-white/50">Your workspace music catalog is empty.</p>
              <p className="text-[10px] text-white/30 max-w-sm mx-auto mt-2 leading-relaxed">
                Add your first audio recording using the metadata compilation form on the left to start selling globally on the kernel.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {tracks.map(track => {
                const isDemo = track.workspace_id === 'ws_demo_seed';
                const isPlaying = playingTrackId === track.id;
                return (
                  <div 
                    key={track.id}
                    className={`p-3.5 rounded-xl border flex items-center gap-3.5 justify-between transition-all ${
                      isPlaying 
                        ? 'bg-[#00FFAA]/5 border-[#00FFAA]/25' 
                        : isDemo 
                          ? 'bg-[#0A0A0A] border-white/5 opacity-60 hover:opacity-80' 
                          : 'bg-[#0A0A0A] border-white/5 hover:border-white/15'
                    }`}
                  >
                    {/* Cover Art and Main details */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10 group">
                        <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          onClick={() => handleTogglePreview(track)}
                          className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {isPlaying ? (
                            <Pause className="w-4.5 h-4.5 text-[#00FFAA]" />
                          ) : (
                            <Play className="w-4.5 h-4.5 text-[#00CCFF] fill-[#00CCFF]" />
                          )}
                        </button>
                      </div>

                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white tracking-tight truncate block max-w-[140px] sm:max-w-[200px]">
                            {track.title}
                          </span>
                          {isDemo && (
                            <span className="text-[8px] font-mono bg-[#00CCFF]/10 border border-[#00CCFF]/20 text-[#00CCFF] px-1 py-0.2 rounded font-extrabold uppercase">
                              DEMO SEED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-white/40 mt-0.5 font-mono">
                          <User className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{track.artist_name}</span>
                          <span>•</span>
                          <span className="font-bold text-white/60">${track.price.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] text-white/30 truncate max-w-[220px] sm:max-w-[320px] font-sans mt-0.5 leading-normal italic">
                          {track.description || 'No description provided.'}
                        </p>
                      </div>
                    </div>

                    {/* Controls & Status toggles */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePublish(track)}
                        disabled={isDemo}
                        className={`px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase border transition-all flex items-center gap-1 ${
                          track.status === 'published'
                            ? 'bg-[#00FFAA]/10 text-[#00FFAA] border-[#00FFAA]/25 hover:bg-[#00FFAA]/20'
                            : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white/60'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title={track.status === 'published' ? 'Click to set to Draft' : 'Click to publish Track'}
                      >
                        {track.status === 'published' ? (
                          <>
                            <Globe className="w-3 h-3" />
                            <span>PUBLISHED</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>DRAFT</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteTrack(track.id, track.title)}
                        disabled={isDemo}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Delete Track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table schema RLS trace mapping */}
          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-[10px] font-mono text-white/40 text-left flex justify-between items-center flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00FFAA]" />
              <span>Bound tables: public.tracks, public.purchases (Workspace Isolation Active)</span>
            </span>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-extrabold uppercase">
              RLS ENFORCED
            </span>
          </div>

        </div>

      </div>

    </div>
  );
};
