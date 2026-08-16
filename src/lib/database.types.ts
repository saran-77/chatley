export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      conversation_keys: {
        Row: {
          conversation_id: string
          epoch: number
          user_id: string
          wrapped_key: string
        }
        Insert: {
          conversation_id: string
          epoch: number
          user_id: string
          wrapped_key: string
        }
        Update: {
          conversation_id?: string
          epoch?: number
          user_id?: string
          wrapped_key?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          hidden_at: string | null
          id: string
          joined_at: string
          last_read_at: string | null
          pinned_at: string | null
          read_mark: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string | null
          id?: string
          joined_at?: string
          last_read_at?: string | null
          pinned_at?: string | null
          read_mark?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string | null
          id?: string
          joined_at?: string
          last_read_at?: string | null
          pinned_at?: string | null
          read_mark?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_path: string | null
          created_at: string
          created_by: string | null
          id: string
          invite_token: string
          key_epoch: number
          name: string | null
          type: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invite_token?: string
          key_epoch?: number
          name?: string | null
          type: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invite_token?: string
          key_epoch?: number
          name?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_backups: {
        Row: {
          created_at: string
          kdf_salt: string
          user_id: string
          wrapped_identity_sk: string
        }
        Insert: {
          created_at?: string
          kdf_salt: string
          user_id: string
          wrapped_identity_sk: string
        }
        Update: {
          created_at?: string
          kdf_salt?: string
          user_id?: string
          wrapped_identity_sk?: string
        }
        Relationships: []
      }
      message_hides: {
        Row: {
          hidden_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          hidden_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          hidden_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_hides_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_hides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          key_epoch: number | null
          nonce: string | null
          reply_to_id: string | null
          sender_id: string | null
          sent_at: string
        }
        Insert: {
          body: string
          conversation_id: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          key_epoch?: number | null
          nonce?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          sent_at?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          key_epoch?: number | null
          nonce?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          identity_pub_key: string | null
          last_seen_at: string | null
          status: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          identity_pub_key?: string | null
          last_seen_at?: string | null
          status?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          identity_pub_key?: string | null
          last_seen_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      install_conversation_epoch: {
        Args: {
          _conversation_id: string
          _epoch: number
          _wraps: Json
        }
        Returns: number
      }
      join_by_invite_token: {
        Args: { _token: string }
        Returns: string
      }
      preview_invite: {
        Args: { _token: string }
        Returns: {
          avatar_path: string | null
          id: string
          name: string | null
          type: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
