/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          owner_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      features: {
        Row: {
          id: string
          workspace_id: string
          type: string
          data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          type: string
          data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          type?: string
          data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "features_workspace_id_fkey"
            columns: ["workspace_id"]
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      tracks: {
        Row: {
          id: string
          workspace_id: string
          title: string
          artist_name: string
          description: string
          cover_url: string
          audio_url: string
          price: number
          status: 'published' | 'draft'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          artist_name: string
          description?: string
          cover_url?: string
          audio_url: string
          price: number
          status?: 'published' | 'draft'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          artist_name?: string
          description?: string
          cover_url?: string
          audio_url?: string
          price?: number
          status?: 'published' | 'draft'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          id: string
          track_id: string
          workspace_id: string
          buyer_email: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          track_id: string
          workspace_id: string
          buyer_email: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          track_id?: string
          workspace_id?: string
          buyer_email?: string
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      downloads: {
        Row: {
          id: string
          purchase_id: string
          track_id: string
          download_token: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          purchase_id: string
          track_id: string
          download_token: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          purchase_id?: string
          track_id?: string
          download_token?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      tenant_status: 'STAGING' | 'PROVISIONED' | 'SUSPENDED'
      user_role: 'owner' | 'admin' | 'member'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
