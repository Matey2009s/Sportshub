import {
  hasSupabaseConfig,
  supabase,
  type EventParticipant,
  type Profile,
  type SportEvent,
} from './supabase';

export type EventFilters = {
  search?: string;
  sportCategory?: string;
  onlyUpcoming?: boolean;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function upsertProfile(profile: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listEvents(filters: EventFilters = {}) {
  const { search, sportCategory, onlyUpcoming = true } = filters;

  let query = supabase.from('sports_events').select('*');

  if (onlyUpcoming) {
    query = query.gte('starts_at', new Date().toISOString());
  }

  if (sportCategory) {
    query = query.eq('sport_category', sportCategory);
  }

  if (search) {
    const safeSearch = search.trim();

    if (safeSearch) {
      query = query.or(
        `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,venue.ilike.%${safeSearch}%`,
      );
    }
  }

  const { data, error } = await query.order('starts_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SportEvent[];
}

export async function fetchEventById(eventId: string): Promise<SportEvent | null> {
  const { data, error } = await supabase
    .from('sports_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function createEvent(eventInput: Partial<SportEvent>) {
  const { data, error } = await supabase
    .from('sports_events')
    .insert(eventInput)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SportEvent;
}

export async function updateEvent(eventId: string, payload: Partial<SportEvent>) {
  const { data, error } = await supabase
    .from('sports_events')
    .update(payload)
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SportEvent;
}

export async function deleteEvent(eventId: string) {
  const { error } = await supabase.from('sports_events').delete().eq('id', eventId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchParticipants(eventId: string): Promise<EventParticipant[]> {
  const { data, error } = await supabase
    .from('event_participants')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EventParticipant[];
}

export async function joinEvent(eventId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error('Authentication required to join an event.');
  }

  const { data, error } = await supabase
    .from('event_participants')
    .insert([
      {
        event_id: eventId,
        user_id: userData.user.id,
        participation_status: 'joined',
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as EventParticipant;
}

export async function leaveEvent(eventId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error('Authentication required to leave an event.');
  }

  const { error } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userData.user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export type SupabaseConnectionStatus = {
  configured: boolean;
  connectionOk: boolean | null;
  outcome: 'success' | 'empty' | 'error';
  count: number | null;
  sampleEventId: string | null;
  table: string;
  message: string;
};

export async function testSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  if (!hasSupabaseConfig) {
    return {
      configured: false,
      connectionOk: false,
      outcome: 'error',
      count: null,
      sampleEventId: null,
      table: 'sports_events',
      message: 'Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    };
  }

  try {
    const { data, error, count } = await supabase
      .from('sports_events')
      .select('id', { count: 'exact' })
      .limit(1);

    if (error) {
      return {
        configured: true,
        connectionOk: false,
        outcome: 'error',
        count: null,
        sampleEventId: null,
        table: 'sports_events',
        message: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        configured: true,
        connectionOk: true,
        outcome: 'empty',
        count: typeof count === 'number' ? count : null,
        sampleEventId: null,
        table: 'sports_events',
        message: 'Read-only query succeeded but no records were found in sports_events.',
      };
    }

    return {
      configured: true,
      connectionOk: true,
      outcome: 'success',
      count: typeof count === 'number' ? count : null,
      sampleEventId: data[0]?.id ?? null,
      table: 'sports_events',
      message: 'Read-only query succeeded against sports_events with limit(1).',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connection error';

    return {
      configured: true,
      connectionOk: false,
      outcome: 'error',
      count: null,
      sampleEventId: null,
      table: 'sports_events',
      message,
    };
  }
}
