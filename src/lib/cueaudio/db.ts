/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

export interface TrackRecord {
  id: string;
  workspace_id: string;
  title: string;
  artist_name: string;
  description: string;
  cover_url: string;
  audio_url: string;
  price: number;
  status: 'published' | 'draft';
  created_at: string;
  updated_at: string;
}

export interface PurchaseRecord {
  id: string;
  track_id: string;
  workspace_id: string;
  buyer_email: string;
  amount: number;
  created_at: string;
}

export interface DownloadRecord {
  id: string;
  purchase_id: string;
  track_id: string;
  download_token: string;
  expires_at: string;
  created_at: string;
}

const DB_FILE = path.join(process.cwd(), 'maneli_cueaudio_db.json');

interface CueAudioDbStructure {
  tracks: TrackRecord[];
  purchases: PurchaseRecord[];
  downloads: DownloadRecord[];
}

function readDb(): CueAudioDbStructure {
  try {
    if (!fs.existsSync(DB_FILE)) {
      // Seed some beautiful default tracks to make the initial experience incredibly rich and polished!
      const initialTracks: TrackRecord[] = [
        {
          id: 'track_seed_1',
          workspace_id: 'ws_demo_seed',
          title: 'Midnight Resonance',
          artist_name: 'Aether Drift',
          description: 'A deep, cinematic synthwave track with organic soundscapes and resonant ambient textures.',
          cover_url: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=300&auto=format&fit=crop',
          audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          price: 19.99,
          status: 'published',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'track_seed_2',
          workspace_id: 'ws_demo_seed',
          title: 'Quantum Horizon',
          artist_name: 'Lumina Mono',
          description: 'Intricate digital rhythms paired with warm analog brass leads. High-energy cyberpunk aesthetic.',
          cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300&auto=format&fit=crop',
          audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
          price: 29.50,
          status: 'published',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      return { tracks: initialTracks, purchases: [], downloads: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading CueAudio mock database file, using in-memory state:', err);
    return { tracks: [], purchases: [], downloads: [] };
  }
}

function writeDb(data: CueAudioDbStructure) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to CueAudio mock database file:', err);
  }
}

export const CueAudioDb = {
  getTracks(workspaceId?: string): TrackRecord[] {
    const db = readDb();
    if (workspaceId) {
      // If workspaceId is provided, filter by it OR allow seed tracks to show up as a demo helper
      return db.tracks.filter(t => t.workspace_id === workspaceId || t.workspace_id === 'ws_demo_seed');
    }
    return db.tracks;
  },

  getTrack(trackId: string): TrackRecord | undefined {
    const db = readDb();
    return db.tracks.find(t => t.id === trackId);
  },

  saveTrack(track: TrackRecord) {
    const db = readDb();
    const existingIndex = db.tracks.findIndex(t => t.id === track.id);

    if (existingIndex !== -1) {
      db.tracks[existingIndex] = {
        ...db.tracks[existingIndex],
        ...track,
        updated_at: new Date().toISOString()
      };
    } else {
      db.tracks.push(track);
    }
    writeDb(db);
  },

  deleteTrack(trackId: string, workspaceId: string) {
    const db = readDb();
    db.tracks = db.tracks.filter(t => !(t.id === trackId && t.workspace_id === workspaceId));
    writeDb(db);
  },

  getPurchases(workspaceId?: string): PurchaseRecord[] {
    const db = readDb();
    if (workspaceId) {
      return db.purchases.filter(p => p.workspace_id === workspaceId);
    }
    return db.purchases;
  },

  savePurchase(purchase: PurchaseRecord) {
    const db = readDb();
    db.purchases.push(purchase);
    writeDb(db);
  },

  getDownloads(): DownloadRecord[] {
    const db = readDb();
    return db.downloads;
  },

  getDownloadByToken(token: string): DownloadRecord | undefined {
    const db = readDb();
    return db.downloads.find(d => d.download_token === token);
  },

  saveDownload(download: DownloadRecord) {
    const db = readDb();
    db.downloads.push(download);
    writeDb(db);
  }
};
