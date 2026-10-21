import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const normalizeSupabaseUrl = (value: string) => {
  if (!value) return '';

  return value.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
};

const supabaseUrl = normalizeSupabaseUrl(
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
);

const supabaseKey = (
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  ''
).trim();

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  biography: string | null;
  favorite_sports: string[] | null;
  skill_level: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
};

export type SportEvent = {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  sport_category: string;
  starts_at: string;
  duration_minutes: number | null;
  venue: string | null;
  latitude: number | null;
  longitude: number | null;
  participant_capacity: number;
  skill_level: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EventParticipant = {
  id: string;
  event_id: string;
  user_id: string;
  participation_status: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      sports_events: {
        Row: SportEvent;
        Insert: Partial<SportEvent>;
        Update: Partial<SportEvent>;
        Relationships: [];
      };
      event_participants: {
        Row: EventParticipant;
        Insert: Partial<EventParticipant>;
        Update: Partial<EventParticipant>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {
      // Storage may be unavailable in private or restricted browsing modes.
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {
      // Storage may be unavailable in private or restricted browsing modes.
    }
  },
};

export const supabase = createClient<Database>(
  supabaseUrl || 'https://example.supabase.co',
  supabaseKey || 'placeholder-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
      storageKey: 'sporthub-auth-storage',
    },
  },
);

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) throw new Error(error.message);

  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);

  return data;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) throw new Error(error.message);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) throw new Error(error.message);
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);

  return data.user;
}

export const supabaseConfig = {
  url: supabaseUrl,
  hasPublishableKey: Boolean(supabaseKey),
};