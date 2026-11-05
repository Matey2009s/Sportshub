import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, SportHubBrandColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { listDirectConversations, listMyChatEvents, type DirectConversationSummary, type EventChatSummary } from '@/lib/supabase-services';

export default function MessagesScreen() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const isBg = language === 'bg';
  const [events, setEvents] = useState<EventChatSummary[]>([]);
  const [directConversations, setDirectConversations] = useState<DirectConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    async function load() {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user) {
          if (active) { setSignedIn(false); setEvents([]); setError(''); }
          return;
        }
        const [chats, direct] = await Promise.all([listMyChatEvents(data.user.id), listDirectConversations(data.user.id)]);
        if (active) { setSignedIn(true); setEvents(chats); setDirectConversations(direct); setError(''); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : (isBg ? 'Чатовете не се заредиха.' : 'Could not load your chats.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [isBg]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <ThemedText type="smallBold" style={styles.eyebrow}>{isBg ? 'ТВОИТЕ РАЗГОВОРИ' : 'YOUR CONVERSATIONS'}</ThemedText>
          <ThemedText type="subtitle" style={styles.title}>{t.messages}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Общувай с хората от твоите спортни събития.' : 'Talk with the people in your sports events.'}</ThemedText>
        </View>

        {!loading && signedIn ? <Pressable onPress={() => router.push('/wellness' as never)} accessibilityRole="button" style={({ pressed }) => [styles.coachCard, pressed && styles.pressed]}>
          <View style={styles.coachIcon}><Ionicons name="sparkles" size={21} color="#17121D" /></View>
          <View style={styles.chatCopy}><ThemedText type="smallBold" style={styles.coachTitle}>{isBg ? 'AI помощник за здраве и спорт' : 'AI wellness & sport coach'}</ThemedText><ThemedText type="small" style={styles.coachSubtitle}>{isBg ? 'Попитай за спортни навици и wellbeing' : 'Ask about activity habits and wellbeing'}</ThemedText></View>
          <Ionicons name="arrow-forward" size={19} color="#E9D8FF" />
        </Pressable> : null}
        {loading ? <View style={styles.state}><ActivityIndicator color={SportHubBrandColors.accent} /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждане на чатовете…' : 'Loading chats…'}</ThemedText></View> : null}
        {!!error ? <ThemedView type="backgroundElement" style={styles.empty}><ThemedText type="small" style={styles.error}>{error}</ThemedText></ThemedView> : null}
        {!loading && !error && !signedIn ? <View style={styles.empty}>
          <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={28} color="#D7F36A" /></View>
          <ThemedText type="smallBold" style={styles.center}>{isBg ? 'Влез, за да отвориш чатовете си' : 'Sign in to see your chats'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{isBg ? 'Когато участваш в събитие, ще имаш групов чат с останалите.' : 'Join an event to get a group chat with its participants.'}</ThemedText>
          <Pressable onPress={() => router.push('/login')} accessibilityRole="button" style={styles.primaryButton}><ThemedText type="smallBold" style={styles.primaryButtonText}>{isBg ? 'Вход' : 'Sign in'}</ThemedText></Pressable>
        </View> : null}
        {!loading && !error && signedIn && events.length === 0 && directConversations.length === 0 ? <View style={styles.empty}>
          <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={28} color="#D7F36A" /></View>
          <ThemedText type="smallBold" style={styles.center}>{isBg ? 'Започни разговор' : 'Start a conversation'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{isBg ? 'Пиши лично на спортист или се включи в групов чат на събитие.' : 'Message an athlete privately or join an event group chat.'}</ThemedText>
          <Pressable onPress={() => router.push('/people')} accessibilityRole="button" style={styles.primaryButton}><ThemedText type="smallBold" style={styles.primaryButtonText}>{isBg ? 'Намери спортисти' : 'Find athletes'}</ThemedText></Pressable>
        </View> : null}

        {!loading && !error && signedIn && directConversations.length > 0 ? <View style={styles.sectionHeading}><Ionicons name="chatbubble-ellipses-outline" size={18} color="#D7F36A" /><ThemedText type="smallBold">{isBg ? 'Лични съобщения' : 'Direct messages'}</ThemedText></View> : null}
        {!loading && !error ? directConversations.map((conversation) => {
          const profile = conversation.other_profile;
          const name = profile?.display_name?.trim() || (isBg ? 'Спортист' : 'Athlete');
          return <Pressable key={conversation.id} onPress={() => router.push(`/chat/${conversation.id}`)} accessibilityRole="button" style={({ pressed }) => [styles.chatCard, pressed && styles.pressed]}>
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.directAvatar} contentFit="cover" /> : <View style={styles.directAvatarFallback}><ThemedText type="smallBold" style={styles.directAvatarLetter}>{name.charAt(0).toUpperCase()}</ThemedText></View>}
            <View style={styles.chatCopy}><ThemedText type="smallBold" style={styles.chatTitle} numberOfLines={1}>{name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{conversation.last_message?.body || (isBg ? 'Започни разговор…' : 'Start a conversation…')}</ThemedText>{conversation.last_message ? <ThemedText type="small" style={styles.chatDate}>{new Date(conversation.last_message.created_at).toLocaleDateString(isBg ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short' })}</ThemedText> : null}</View>
            <Ionicons name="chevron-forward" size={18} color="#ACB6AD" />
          </Pressable>;
        }) : null}

        {!loading && !error && events.length > 0 ? <View style={[styles.sectionHeading, styles.groupHeading]}><Ionicons name="people-outline" size={18} color="#D7F36A" /><ThemedText type="smallBold">{isBg ? 'Групови чатове на събития' : 'Event group chats'}</ThemedText></View> : null}
        {!loading && !error ? events.map((event) => {
          const date = new Date(event.starts_at);
          return <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}/chat`)} accessibilityRole="button" style={({ pressed }) => [styles.chatCard, pressed && styles.pressed]}>
            <View style={styles.chatIcon}><Ionicons name="chatbubble-ellipses" size={20} color="#D7F36A" /></View>
            <View style={styles.chatCopy}>
              <ThemedText type="smallBold" style={styles.chatTitle} numberOfLines={1}>{event.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{event.last_message?.body || event.venue || (isBg ? 'Спортна група' : 'Event group')}</ThemedText>
              <ThemedText type="small" style={styles.chatDate}>{event.last_message ? new Date(event.last_message.created_at).toLocaleDateString(isBg ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short' }) : `${date.toLocaleDateString(isBg ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString(isBg ? 'bg-BG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ACB6AD" />
          </Pressable>;
        }) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1110' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: Spacing.four, paddingTop: 24, paddingBottom: 220, gap: 14 },
  heading: { gap: 7, marginBottom: 8 },
  eyebrow: { color: '#D7F36A', fontSize: 11, letterSpacing: 1.5 },
  title: { fontSize: 34, lineHeight: 40 },
  state: { alignItems: 'center', padding: 28, gap: 12 },
  empty: { borderRadius: 22, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#151D1B', alignItems: 'center', padding: 24, gap: 13 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.13)' },
  center: { textAlign: 'center' },
  primaryButton: { minHeight: 46, paddingHorizontal: 18, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#D7F36A', marginTop: 4 },
  primaryButtonText: { color: '#0B1110' },
  coachCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 19, borderWidth: 1, borderColor: '#674987', backgroundColor: '#30233B' },
  coachIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7F36A' },
  coachTitle: { color: '#FFFFFF' },
  coachSubtitle: { color: '#D7C7E4' },  chatCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 19, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#151D1B' },
  chatIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.12)' },
  chatCopy: { flex: 1, gap: 3 },
  chatTitle: { fontSize: 15 },
  chatDate: { color: '#D7F36A', fontSize: 11 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 1 },
  groupHeading: { marginTop: 14 },
  directAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#202A26' },
  directAvatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.17)' },
  directAvatarLetter: { color: '#D7F36A' },
  pressed: { opacity: 0.78 },
  error: { color: '#FF8F8F' },
});
