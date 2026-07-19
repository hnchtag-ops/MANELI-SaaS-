/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Track {
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

export interface Purchase {
  id: string;
  track_id: string;
  workspace_id: string;
  buyer_email: string;
  amount: number;
  created_at: string;
}

export interface Download {
  id: string;
  purchase_id: string;
  track_id: string;
  download_token: string;
  expires_at: string;
  created_at: string;
}
