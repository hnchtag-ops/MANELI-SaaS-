/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Music, Play, Pause, ShoppingBag, X, CreditCard, 
  Download, Calendar, ShieldCheck, Key, RefreshCw, Clock, CheckCircle2, AlertTriangle, DollarSign
} from 'lucide-react';
import { Track } from './types';
import { getSupabaseClient } from '../../lib/supabase';

interface PublicTrackPageProps {
  workspaceId: string;
  addLog: (level: 'INFO' | 'OK' | 'WARN' | 'ALERT', category: string, message: string) => void;
}

export const PublicTrackPage: React.FC<PublicTrackPageProps> = ({ 
  workspaceId, 
  addLog 
}) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  // Checkout modal state
  const [checkoutTrack, setCheckoutTrack] = useState<Track | null>(null);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  // Verify Download Key state
  const [inputToken, setInputToken] = useState('');
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [downloadResult, setDownloadResult] = useState<any | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  
  // Simulated downloading progress
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  // Fetch published tracks
  const fetchPublishedTracks = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchErr } = await supabase
        .from('tracks')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'published');

      if (fetchErr) throw fetchErr;
      setTracks(data || []);
    } catch (err: any) {
      setError(err.message || 'Error occurred fetching published tracks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublishedTracks();
    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [workspaceId]);

  // Audio player toggle
  const handleTogglePlay = (track: Track) => {
    if (playingTrackId === track.id) {
      if (audio) {
        audio.pause();
      }
      setPlayingTrackId(null);
    } else {
      if (audio) {
        audio.pause();
      }
      const newAudio = new Audio(track.audio_url);
      newAudio.play();
      setAudio(newAudio);
      setPlayingTrackId(track.id);

      newAudio.onended = () => {
        setPlayingTrackId(null);
      };
    }
  };

  // Submit checkout purchase
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutTrack || !buyerEmail.trim()) return;

    setCheckoutProcessing(true);
    try {
      const res = await fetch('/api/cueaudio/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: checkoutTrack.id,
          workspaceId,
          buyerEmail: buyerEmail.trim(),
          amount: checkoutTrack.price
        })
      });

      if (!res.ok) throw new Error('Transaction process failed.');
      const data = await res.json();

      setReceipt(data);
      addLog('OK', 'CUEAUDIO', `Processed storefront checkout of track "${checkoutTrack.title}" to buyer ${buyerEmail.trim()}`);
    } catch (err: any) {
      alert(err.message || 'Transaction compilation failed.');
    } finally {
      setCheckoutProcessing(false);
    }
  };

  // Submit download token verification
  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;

    setVerifyingToken(true);
    setDownloadResult(null);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/cueaudio/downloads/${inputToken.trim()}`);
      if (!res.ok) {
        throw new Error('Invalid download key. Token does not match active records.');
      }
      const data = await res.json();

      if (data.expired) {
        throw new Error('This download token has EXPIRED (24-hour limit exceeded).');
      }

      setDownloadResult(data);
      addLog('OK', 'CUEAUDIO', `Valid download token verified on server! Access GRANTED for track "${data.track.title}".`);
    } catch (err: any) {
      setDownloadError(err.message || 'Verification failed.');
      addLog('ALERT', 'CUEAUDIO', `Unauthorized download attempts detected. Token: ${inputToken.trim()}`);
    } finally {
      setVerifyingToken(false);
    }
  };

  // Simulated download action
  const triggerSimulatedDownload = (trackTitle: string) => {
    setDownloadProgress(0);
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev === null) return 0;
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setDownloadProgress(null);
            alert(`Fulfillment successful! Simulated high-resolution download complete for track: "${trackTitle}.mp3"`);
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  return (
    <div className="space-y-6">
      
      {/* Visual Header Grid banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#00FFAA]/5 to-transparent border border-[#00FFAA]/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div>
          <span className="text-[10px] font-mono text-[#00FFAA] uppercase tracking-widest font-extrabold block">PUBLIC PORTAL</span>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">Multi-Tenant Storefront</h2>
          <p className="text-xs text-white/50 leading-relaxed mt-1 max-w-lg">
            Simulate a public buyer arriving at this unique tenant's custom link. Buyers can listen to high-fidelity audio, purchase tracks via Stripe simulation, and redeem secure download keys.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] font-mono bg-white/5 text-white/70 border border-white/5 px-2.5 py-1 rounded uppercase font-bold">
            Catalog: {tracks.length} Published
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: Published listings on left, Token validator widget on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT: Listings (Span 8) */}
        <div className="lg:col-span-8 space-y-4">
          
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <ShoppingBag className="w-4 h-4 text-[#00FFAA]" />
            <h3 className="text-xs font-mono uppercase font-bold text-white tracking-wider">Available Tracks</h3>
          </div>

          {loading && tracks.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-white/40 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#00FFAA]" />
              <span>Scanning published track tables...</span>
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-xl bg-[#0A0A0A]">
              <Music className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-xs text-white/50">This tenant has no active published listings yet.</p>
              <p className="text-[10px] text-white/30 max-w-sm mx-auto mt-2 leading-relaxed">
                Log in as the workspace owner/admin, access the Artist Dashboard tab, register a track, and toggle its status to "Published" to compile listings here!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tracks.map(track => {
                const isPlaying = playingTrackId === track.id;
                return (
                  <div 
                    key={track.id} 
                    className={`bg-[#050505]/80 border rounded-2xl p-4 flex flex-col justify-between min-h-[290px] transition-all relative overflow-hidden group ${
                      isPlaying 
                        ? 'border-[#00FFAA]/40 shadow-[0_0_15px_rgba(0,255,170,0.04)]' 
                        : 'border-white/5 hover:border-white/15 hover:bg-[#080808]'
                    }`}
                  >
                    {/* Glowing highlight for active audio playing */}
                    {isPlaying && (
                      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00FFAA] to-transparent animate-pulse"></div>
                    )}

                    <div>
                      {/* Cover image area */}
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-white/5 bg-black mb-3.5 flex items-center justify-center">
                        <img 
                          src={track.cover_url} 
                          alt={track.title} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                          referrerPolicy="no-referrer"
                        />
                        
                        {/* Interactive Play Overlay Button */}
                        <button
                          onClick={() => handleTogglePlay(track)}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:scale-110 hover:bg-black/80 transition-all cursor-pointer shadow-lg">
                            {isPlaying ? (
                              <Pause className="w-5 h-5 text-[#00FFAA]" />
                            ) : (
                              <Play className="w-5 h-5 text-[#00CCFF] fill-[#00CCFF] ml-0.5" />
                            )}
                          </div>
                        </button>
                      </div>

                      {/* Header details */}
                      <div className="text-left">
                        <h4 className="text-sm font-bold text-white tracking-tight truncate">{track.title}</h4>
                        <span className="text-[10px] font-mono text-white/40 block mt-0.5">by {track.artist_name}</span>
                        <p className="text-[11px] text-white/50 leading-relaxed font-sans mt-2 line-clamp-2 italic h-[34px]">
                          {track.description || 'No description provided.'}
                        </p>
                      </div>
                    </div>

                    {/* Footer price & Buy panel */}
                    <div className="border-t border-white/5 pt-3 mt-4 flex items-center justify-between">
                      <div className="text-left">
                        <span className="text-[9px] font-mono uppercase text-white/30 block">Single License</span>
                        <span className="text-sm font-bold font-mono text-[#00FFAA]">${track.price.toFixed(2)}</span>
                      </div>

                      <button
                        onClick={() => {
                          setCheckoutTrack(track);
                          setReceipt(null);
                          setBuyerEmail('');
                        }}
                        className="px-3.5 py-1.5 bg-[#00FFAA] hover:bg-[#00CCFF] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5px]" />
                        Buy Track
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* RIGHT: Redeem / Verify Token Widget (Span 4) */}
        <div className="lg:col-span-4 space-y-4">
          
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Key className="w-4 h-4 text-[#00CCFF]" />
            <h3 className="text-xs font-mono uppercase font-bold text-white tracking-wider">Fulfillment Gate</h3>
          </div>

          <div className="bg-[#050505]/80 border border-white/5 rounded-2xl p-4 text-left space-y-4">
            <div>
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Redeem Download Token</h4>
              <p className="text-[10px] text-white/40 leading-relaxed mt-1">
                Enter your 24-hour cryptographic token here to claim your lossless high-resolution audio files.
              </p>
            </div>

            <form onSubmit={handleVerifyToken} className="space-y-2">
              <input
                type="text"
                required
                value={inputToken}
                onChange={e => setInputToken(e.target.value)}
                placeholder="Enter dl_tok_... key"
                className="w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-[#00FFAA] placeholder-white/20 focus:outline-none focus:border-[#00CCFF]/50"
              />
              <button
                type="submit"
                disabled={verifyingToken || !inputToken.trim()}
                className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                {verifyingToken ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#00CCFF]" />
                    <span>Verify Token</span>
                  </>
                )}
              </button>
            </form>

            {/* Error output */}
            {downloadError && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl text-[10px] leading-relaxed text-rose-400 font-mono">
                <div className="flex items-center gap-1.5 mb-1 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Validation Refused</span>
                </div>
                {downloadError}
              </div>
            )}

            {/* Download validation Success info */}
            {downloadResult && (
              <div className="p-3.5 bg-[#00FFAA]/5 border border-[#00FFAA]/20 rounded-xl space-y-3 font-mono text-[11px] text-white">
                <div className="flex items-center gap-1.5 text-[#00FFAA] font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>TOKEN REDEMPTION VALID</span>
                </div>

                <div className="space-y-1.5 bg-black/40 p-2.5 rounded-lg border border-white/5">
                  <p className="text-white font-bold tracking-tight">{downloadResult.track.title}</p>
                  <p className="text-[9px] text-white/40">Artist: {downloadResult.track.artist_name}</p>
                  <p className="text-[9px] text-white/40 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#00FFAA]" />
                    <span>Expires: {new Date(downloadResult.download.expires_at).toLocaleTimeString()}</span>
                  </p>
                </div>

                {downloadProgress !== null ? (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[9px] text-[#00FFAA] font-bold">
                      <span>DOWNLOADING LOSSLESS MP3...</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-[#00FFAA] h-full transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => triggerSimulatedDownload(downloadResult.track.title)}
                    className="w-full py-2 bg-[#00FFAA] hover:bg-[#00FFAA]/90 text-black font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5px]" />
                    Download File
                  </button>
                )}
              </div>
            )}

          </div>

        </div>

      </div>

      {/* CHECKOUT PURCHASE OVERLAY MODAL */}
      {checkoutTrack && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-teal-500 via-emerald-500 to-[#00FFAA]"></div>
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <span className="text-xs font-mono uppercase text-[#00FFAA] tracking-wider font-extrabold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FFAA] animate-pulse"></span>
                Simulated Credit Checkout
              </span>
              <button 
                onClick={() => setCheckoutTrack(null)}
                className="p-1 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Content */}
            {!receipt ? (
              <form onSubmit={handlePurchaseSubmit} className="p-5 space-y-4 text-left">
                
                {/* Track details summary */}
                <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                  <img 
                    src={checkoutTrack.cover_url} 
                    alt={checkoutTrack.title} 
                    className="w-10 h-10 rounded-lg object-cover border border-white/10" 
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-tight">{checkoutTrack.title}</h4>
                    <span className="text-[9px] font-mono text-white/40">by {checkoutTrack.artist_name}</span>
                  </div>
                  <span className="ml-auto font-mono text-xs text-[#00FFAA] font-bold">${checkoutTrack.price.toFixed(2)}</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-mono uppercase text-white/40 font-bold">Buyer Email Address</label>
                  <input
                    type="email"
                    required
                    value={buyerEmail}
                    onChange={e => setBuyerEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#00FFAA]/50 font-sans"
                  />
                  <p className="text-[9px] text-white/30 italic mt-1 leading-normal">
                    Fulfillment codes and transaction histories are automatically generated under this address.
                  </p>
                </div>

                {/* Mock Card UI */}
                <div className="bg-[#050505] border border-white/5 rounded-xl p-3.5 space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl"></div>
                  <span className="text-[9px] font-mono uppercase text-white/30 block font-bold">Mock Payment Details</span>
                  
                  <div className="space-y-2">
                    <div className="relative">
                      <input 
                        type="text" 
                        value="4242  4242  4242  4242" 
                        disabled 
                        className="w-full bg-white/[0.02] border border-white/5 rounded-lg pl-3 pr-10 py-1.5 text-xs font-mono text-[#00CCFF] cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-2 text-[10px] font-bold text-indigo-400 font-mono">VISA</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                      <input type="text" value="12 / 28" disabled className="bg-white/[0.02] border border-white/5 rounded-lg py-1.5 text-center text-white/40 cursor-not-allowed" />
                      <input type="text" value="424" disabled className="bg-white/[0.02] border border-white/5 rounded-lg py-1.5 text-center text-white/40 cursor-not-allowed" />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCheckoutTrack(null)}
                    className="w-1/2 py-2 border border-white/10 bg-transparent hover:bg-white/5 rounded-xl text-xs font-mono font-bold uppercase text-white transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={checkoutProcessing || !buyerEmail.trim()}
                    className="w-1/2 py-2 bg-[#00FFAA] hover:bg-[#00CCFF] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    {checkoutProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Authorizing...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Complete Checkout</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            ) : (
              /* RECEIPT SUCCESS FULL-SCREEN */
              <div className="p-5 text-center space-y-4 font-mono text-[11px] text-white">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-2 text-[#00FFAA]">
                  <CheckCircle2 className="w-6 h-6 text-[#00FFAA]" />
                </div>
                
                <div>
                  <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">Purchase Successful!</h3>
                  <p className="text-[10px] text-white/50 mt-1">Transaction recorded in the purchases table ledger</p>
                </div>

                <div className="border border-white/5 rounded-xl p-3.5 text-left bg-[#050505] space-y-2">
                  <div className="flex justify-between border-b border-white/5 pb-1.5 text-white/40 text-[9px] uppercase font-bold">
                    <span>Receipt Code</span>
                    <span className="text-white select-all">{receipt.purchase.id}</span>
                  </div>

                  <div className="flex justify-between pt-1">
                    <span className="text-white/40">Track License</span>
                    <span className="text-white font-bold">{receipt.trackTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Artist</span>
                    <span className="text-white">{receipt.artistName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Buyer Email</span>
                    <span className="text-white truncate max-w-[160px]">{receipt.purchase.buyer_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Total Charged</span>
                    <span className="text-[#00FFAA] font-bold">${receipt.purchase.amount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Secret token key block */}
                <div className="p-3.5 bg-gradient-to-br from-[#00CCFF]/10 to-indigo-500/5 border border-[#00CCFF]/20 rounded-xl space-y-2.5 text-left">
                  <div>
                    <span className="text-[9px] bg-[#00CCFF]/15 text-[#00CCFF] border border-[#00CCFF]/30 px-1.5 py-0.2 rounded font-extrabold uppercase">
                      Secure Download Token
                    </span>
                    <p className="text-[9.5px] text-white/60 leading-relaxed mt-1.5">
                      Copy the token below to verify and unlock your track download in the Fulfillment Gate:
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={receipt.download.download_token} 
                      className="flex-1 bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#00FFAA] font-mono select-all"
                    />
                  </div>

                  <span className="text-[8px] text-white/30 block uppercase tracking-tight">
                    * Limit 1 download per token. Key auto-expires in 24 hours.
                  </span>
                </div>

                <button
                  onClick={() => {
                    setInputToken(receipt.download.download_token);
                    setCheckoutTrack(null);
                  }}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white uppercase tracking-wider rounded-xl cursor-pointer transition-all font-bold"
                >
                  Apply Key & Close
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
