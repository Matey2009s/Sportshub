import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing, SportHubBrandColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { supabase, type EventMessage, type SportEvent } from '@/lib/supabase';
import { fetchEventById, fetchEventMessages, listEventParticipantCounts, sendEventMessage } from '@/lib/supabase-services';

type SenderProfile = { display_name: string | null; avatar_url: string | null };

export default function EventChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const listRef = useRef<ScrollViewInstance>(null);
  const [event, setEvent] = useState<SportEvent | null>(null);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, SenderProfile>>({});
  const [participantCount, setParticipantCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    if (!id) return;
    const nextMessages = await fetchEventMessages(id);
    setMessages(nextMessages);
    const authorIds = [...new Set(nextMessages.map((message) => message.user_id))];
    if (!authorIds.length) { setSenderProfiles({}); return; }
    const { data, error: profilesError } = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', authorIds);
    if (profilesError) throw new Error(profilesError.message);
    const profileMap: Record<string, SenderProfile> = {};
    for (const profile of data ?? []) profileMap[profile.id] = { display_name: profile.display_name, avatar_url: profile.avatar_url };
    setSenderProfiles(profileMap);
  }, [id]);

  useEffect(() => {
    let active = true;
    async function loadChat() {
      setLoading(true);
      setError('');
      try {
        const [{ data, error: authError }, eventRecord] = await Promise.all([supabase.auth.getUser(), fetchEventById(id)]);
        if (authError || !data.user) { router.replace('/login'); return; }
        if (!eventRecord) throw new Error(isBg ? 'Събитието не е намерено.' : 'Event not found.');
        const [chatMessages, participantCounts] = await Promise.all([fetchEventMessages(id), listEventParticipantCounts([id])]);
        if (active) {
          setUserId(data.user.id);
          setEvent(eventRecord);
          setMessages(chatMessages);
          setParticipantCount(participantCounts[id] ?? 0);
          const authorIds = [...new Set(chatMessages.map((message) => message.user_id))];
          if (authorIds.length) {
            const { data: profiles } = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', authorIds);
            if (active) {
              const profileMap: Record<string, SenderProfile> = {};
              for (const profile of profiles ?? []) profileMap[profile.id] = { display_name: profile.display_name, avatar_url: profile.avatar_url };
              setSenderProfiles(profileMap);
            }
          }
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : (isBg ? 'Чатът не се зареди.' : 'Could not load this chat.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadChat();
    return () => { active = false; };
  }, [id, isBg, router]);

  useEffect(() => {
    if (!id || !userId) return;
    const channel = supabase.channel(`event-chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${id}` }, () => {
        void loadMessages().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not refresh chat.'));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, loadMessages, userId]);

  useEffect(() => { listRef.current?.scrollToEnd({ animated: true }); }, [messages.length]);

  async function sendMessage() {
    const body = draft.trim();
    if (!id || !userId || !body || sending) return;
    setSending(true);
    setError('');
    try {
      await sendEventMessage(id, userId, body);
      setDraft('');
      await loadMessages();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Съобщението не се изпрати.' : 'Message could not be sent.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <View style={styles.wrapper}>
          <View style={styles.header}>
            <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/messages')} style={styles.backButton} accessibilityRole="button"><Ionicons name="arrow-back" size={19} color="#FFFFFF" /></Pressable>
            <View style={styles.headerCopy}><ThemedText type="smallBold" numberOfLines={1}>{event?.title || (isBg ? 'Чат на събитието' : 'Event chat')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{participantCount} {isBg ? 'участници' : 'participants'}</ThemedText></View>
            <Pressable onPress={() => router.push(`/event/${id}`)} style={styles.eventButton} accessibilityRole="button" accessibilityLabel={isBg ? 'Детайли на събитието' : 'Event details'}><Ionicons name="information-circle-outline" size={21} color="#D7F36A" /></Pressable>
          </View>

          {loading ? <View style={styles.state}><ActivityIndicator color={SportHubBrandColors.accent} /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждане на чата…' : 'Loading chat…'}</ThemedText></View> : <ScrollView ref={listRef} style={styles.messages} contentContainerStyle={styles.messageList} keyboardShouldPersistTaps="handled">
            {messages.length === 0 ? <View style={styles.firstMessage}><View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={24} color="#D7F36A" /></View><ThemedText type="smallBold">{isBg ? 'Започни разговора' : 'Start the conversation'}</ThemedText><ThemedText type="small" themeColor="textSecondary" style={styles.center}>{isBg ? 'Уговори мястото и детайлите с участниците.' : 'Coordinate the meeting point and details with the group.'}</ThemedText></View> : messages.map((message) => {
              const own = message.user_id === userId;
              const time = new Date(message.created_at).toLocaleTimeString(isBg ? 'bg-BG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
              const profile = senderProfiles[message.user_id];
              const senderName = own ? (isBg ? 'Ти' : 'You') : profile?.display_name?.trim() || (isBg ? 'Участник' : 'Participant');
              return <View key={message.id} style={[styles.messageRow, own && styles.ownMessageRow]}>
                {!own ? profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.senderAvatar} contentFit="cover" /> : <View style={styles.senderAvatarFallback}><Ionicons name="person" size={14} color="#D4B7F5" /></View> : null}
                <View style={[styles.bubble, own ? styles.ownBubble : styles.otherBubble]}>
                  {!own ? <ThemedText type="smallBold" style={styles.senderName}>{senderName}</ThemedText> : null}
                  <ThemedText type="small" style={own ? styles.ownText : undefined}>{message.body}</ThemedText>
                  <ThemedText type="small" style={[styles.messageTime, own && styles.ownTime]}>{senderName} · {time}</ThemedText>
                </View>
              </View>;
            })}
          </ScrollView>}

          {!!error && <View style={styles.errorBox}><ThemedText type="small" style={styles.errorText}>{error}</ThemedText></View>}
          <View style={styles.composer}>
            <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => void sendMessage()} placeholder={isBg ? 'Напиши съобщение…' : 'Write a message…'} placeholderTextColor="#929D94" style={styles.input} multiline maxLength={2000} editable={!sending && !loading} accessibilityLabel={isBg ? 'Съобщение' : 'Message'} />
            <Pressable onPress={() => void sendMessage()} disabled={!draft.trim() || sending || loading} accessibilityRole="button" accessibilityLabel={isBg ? 'Изпрати' : 'Send'} style={[styles.sendButton, (!draft.trim() || sending || loading) && styles.disabled]}>
              {sending ? <ActivityIndicator color="#0B1110" /> : <Ionicons name="arrow-up" size={21} color="#0B1110" />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1110' },
  flex: { flex: 1 },
  wrapper: { flex: 1, width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: Spacing.three, paddingTop: 10, paddingBottom: 8 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#2D3932', paddingBottom: 10 },
  backButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#202A26' },
  headerCopy: { flex: 1, gap: 2 },
  eventButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.1)' },
  messages: { flex: 1 },
  messageList: { flexGrow: 1, justifyContent: 'flex-end', gap: 10, paddingVertical: 16 },
  firstMessage: { alignItems: 'center', gap: 10, padding: 28, marginVertical: 'auto' },
  emptyIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(215,243,106,0.12)' },
  center: { textAlign: 'center' },
  messageRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  ownMessageRow: { justifyContent: 'flex-end' },
  senderAvatar: { width: 30, height: 30, borderRadius: 15, alignSelf: 'flex-end', marginRight: 7, backgroundColor: '#30243D' },
  senderAvatarFallback: { width: 30, height: 30, borderRadius: 15, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', marginRight: 7, backgroundColor: '#30243D' },
  bubble: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10, gap: 6 },
  ownBubble: { borderBottomRightRadius: 6, backgroundColor: '#7442A2' },
  otherBubble: { borderBottomLeftRadius: 6, backgroundColor: '#202A26', borderWidth: 1, borderColor: '#2D3932' },
  ownText: { color: '#FFFFFF' },
  messageTime: { color: '#C4B8D1', fontSize: 10, alignSelf: 'flex-end' },
  senderName: { color: '#D8B9FF', fontSize: 11 },
  ownTime: { color: '#F0E7F9' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorBox: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(130,35,35,0.2)', marginBottom: 8 },
  errorText: { color: '#FF8F8F' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 9, borderRadius: 20, borderWidth: 1, borderColor: '#3E314B', backgroundColor: '#151D1B' },
  input: { flex: 1, maxHeight: 120, minHeight: 40, paddingHorizontal: 9, paddingTop: 10, paddingBottom: 8, color: '#FFFFFF', fontSize: 15 },
  sendButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7F36A' },
  disabled: { opacity: 0.45 },
});
