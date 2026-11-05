import {
  hasSupabaseConfig,
  supabase,
  type EventParticipant,
  type EventMessage,
  type DirectConversation,
  type DirectMessage,
  type PostComment,
  type Profile,
  type SocialPost,
  type SportEvent,
} from './supabase';

export type EventFilters = {
  search?: string;
  sportCategory?: string;
  organizerId?: string;
  onlyUpcoming?: boolean;
};

export type SocialFeedPost = SocialPost & {
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

export async function listSocialFeed(): Promise<SocialFeedPost[]> {
  const [{ data: postRows, error: postError }, { data: sessionData }] = await Promise.all([
    supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(40),
    supabase.auth.getSession(),
  ]);
  if (postError) throw new Error(postError.message);
  const posts = (postRows ?? []) as SocialPost[];
  if (!posts.length) return [];

  const postIds = posts.map((post) => post.id);
  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from('post_likes').select('post_id,user_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds),
  ]);
  if (likesError) throw new Error(likesError.message);
  if (commentsError) throw new Error(commentsError.message);

  const likeCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  const userId = sessionData.session?.user.id;
  for (const like of likes ?? []) {
    likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1);
    if (like.user_id === userId) likedByMe.add(like.post_id);
  }
  for (const comment of comments ?? []) commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) ?? 0) + 1);

  return posts.map((post) => ({
    ...post,
    like_count: likeCounts.get(post.id) ?? 0,
    comment_count: commentCounts.get(post.id) ?? 0,
    liked_by_me: likedByMe.has(post.id),
  }));
}

export async function createSocialPost(body: string, imageUrls: string[], sportCategory: string | null) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (sessionError || !user) throw new Error('Sign in to share an update.');
  const { data, error } = await supabase.from('social_posts')
    .insert({ author_id: user.id, body: body.trim(), image_url: imageUrls[0] ?? null, image_urls: imageUrls, sport_category: sportCategory })
    .select().single();
  if (error) throw new Error(error.message);
  return data as SocialPost;
}

export async function setPostLike(postId: string, liked: boolean) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (sessionError || !userId) throw new Error('Sign in to like a post.');
  if (liked) {
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function listPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase.from('post_comments').select('*').eq('post_id', postId)
    .order('created_at', { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as PostComment[];
}

export async function fetchSocialPost(postId: string): Promise<SocialPost | null> {
  const { data, error } = await supabase.from('social_posts').select('*').eq('id', postId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SocialPost | null;
}

export async function createPostComment(postId: string, body: string) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (sessionError || !user) throw new Error('Sign in to comment.');
  const { data, error } = await supabase.from('post_comments')
    .insert({ post_id: postId, author_id: user.id, body: body.trim() })
    .select().single();
  if (error) throw new Error(error.message);
  return data as PostComment;
}

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

export async function listPublicProfiles(search = ''): Promise<Profile[]> {
  let query = supabase
    .from('profiles')
    .select('id,display_name,avatar_url,cover_url,biography,favorite_sports,skill_level,location,created_at,updated_at')
    .order('display_name', { ascending: true })
    .limit(60);

  const term = search.trim().replace(/[,%()]/g, ' ');
  if (term) query = query.ilike('display_name', `%${term}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
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

  if (filters.organizerId) {
    query = query.eq('organizer_id', filters.organizerId);
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

export async function listJoinedEventIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('event_participants')
    .select('event_id')
    .eq('user_id', userId)
    .eq('participation_status', 'joined');

  if (error) throw new Error(error.message);
  return (data ?? []).map((participant) => participant.event_id);
}

export async function listEventParticipantCounts(eventIds: string[]): Promise<Record<string, number>> {
  if (!eventIds.length) return {};
  const { data, error } = await supabase.from('event_participants').select('event_id')
    .eq('participation_status', 'joined').in('event_id', eventIds);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce<Record<string, number>>((counts, participant) => {
    counts[participant.event_id] = (counts[participant.event_id] ?? 0) + 1;
    return counts;
  }, {});
}

export type EventChatSummary = SportEvent & { last_message: Pick<EventMessage, 'body' | 'created_at'> | null };

export async function listMyChatEvents(userId: string): Promise<EventChatSummary[]> {
  const [events, joinedEventIds] = await Promise.all([listEvents({ onlyUpcoming: false }), listJoinedEventIds(userId)]);
  const joined = new Set(joinedEventIds);
  const chatEvents = events.filter((event) => event.organizer_id === userId || joined.has(event.id));
  if (!chatEvents.length) return [];
  const { data, error } = await supabase.from('event_messages').select('event_id,body,created_at')
    .in('event_id', chatEvents.map((event) => event.id)).order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  const latestByEvent = new Map<string, Pick<EventMessage, 'body' | 'created_at'>>();
  for (const message of data ?? []) {
    if (!latestByEvent.has(message.event_id)) latestByEvent.set(message.event_id, { body: message.body, created_at: message.created_at });
  }
  return chatEvents.map((event) => ({ ...event, last_message: latestByEvent.get(event.id) ?? null }));
}

export type DirectConversationSummary = DirectConversation & {
  other_profile: Profile | null;
  last_message: DirectMessage | null;
};

export async function getOrCreateDirectConversation(otherUserId: string): Promise<string> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const currentUserId = auth.user?.id;
  if (authError || !currentUserId) throw new Error('Sign in to send a direct message.');
  if (currentUserId === otherUserId) throw new Error('You cannot message yourself.');

  const [participant_one, participant_two] = [currentUserId, otherUserId].sort();
  const findExisting = () => supabase.from('direct_conversations').select('*')
    .eq('participant_one', participant_one).eq('participant_two', participant_two).maybeSingle();
  const existing = await findExisting();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return (existing.data as DirectConversation).id;

  const created = await supabase.from('direct_conversations')
    .insert({ participant_one, participant_two })
    .select('*').single();
  if (!created.error && created.data) return (created.data as DirectConversation).id;

  // A concurrent tap may create the same pair first; re-read the unique row.
  const raced = await findExisting();
  if (raced.data) return (raced.data as DirectConversation).id;
  throw new Error(created.error?.message ?? raced.error?.message ?? 'Could not start this conversation.');
}

export async function listDirectConversations(userId: string): Promise<DirectConversationSummary[]> {
  const { data, error } = await supabase.from('direct_conversations').select('*')
    .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
    .order('updated_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  const conversations = (data ?? []) as DirectConversation[];
  if (!conversations.length) return [];

  const otherIds = [...new Set(conversations.map((conversation) =>
    conversation.participant_one === userId ? conversation.participant_two : conversation.participant_one,
  ))];
  const [{ data: profiles, error: profilesError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from('profiles').select('*').in('id', otherIds),
    supabase.from('direct_messages').select('*').in('conversation_id', conversations.map((item) => item.id))
      .order('created_at', { ascending: false }).limit(500),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (messagesError) throw new Error(messagesError.message);
  const profileById = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const lastMessageByConversation = new Map<string, DirectMessage>();
  for (const message of (messages ?? []) as DirectMessage[]) {
    if (!lastMessageByConversation.has(message.conversation_id)) lastMessageByConversation.set(message.conversation_id, message);
  }
  return conversations.map((conversation) => {
    const otherId = conversation.participant_one === userId ? conversation.participant_two : conversation.participant_one;
    return { ...conversation, other_profile: profileById.get(otherId) ?? null, last_message: lastMessageByConversation.get(conversation.id) ?? null };
  });
}

export async function fetchDirectConversation(conversationId: string): Promise<DirectConversationSummary | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in to open messages.');
  const { data, error } = await supabase.from('direct_conversations').select('*').eq('id', conversationId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const conversation = data as DirectConversation;
  if (conversation.participant_one !== auth.user.id && conversation.participant_two !== auth.user.id) {
    throw new Error('This conversation is not available to your account.');
  }
  const otherId = conversation.participant_one === auth.user.id ? conversation.participant_two : conversation.participant_one;
  const [profile, messages] = await Promise.all([
    fetchProfile(otherId),
    listDirectMessages(conversationId),
  ]);
  return { ...conversation, other_profile: profile, last_message: messages.at(-1) ?? null };
}

export async function listDirectMessages(conversationId: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase.from('direct_messages').select('*').eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }).limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as DirectMessage[];
}

export async function sendDirectMessage(conversationId: string, body: string): Promise<DirectMessage> {
  const text = body.trim();
  if (!text || text.length > 2000) throw new Error('Message must contain 1–2000 characters.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in to send a message.');
  const { data, error } = await supabase.from('direct_messages')
    .insert({ conversation_id: conversationId, sender_id: auth.user.id, body: text })
    .select('*').single();
  if (error) throw new Error(error.message);
  return data as DirectMessage;
}

export async function fetchEventMessages(eventId: string): Promise<EventMessage[]> {
  const { data, error } = await supabase
    .from('event_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as EventMessage[];
}

export async function sendEventMessage(eventId: string, userId: string, body: string): Promise<EventMessage> {
  const { data, error } = await supabase
    .from('event_messages')
    .insert({ event_id: eventId, user_id: userId, body: body.trim() })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as EventMessage;
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
