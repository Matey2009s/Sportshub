import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/language-context';
import { supabase, type DirectMessage, type Profile } from '@/lib/supabase';
import { fetchDirectConversation, listDirectMessages, sendDirectMessage } from '@/lib/supabase-services';

export default function DirectChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function refresh() {
      try {
        const [conversation, auth] = await Promise.all([fetchDirectConversation(id), supabase.auth.getUser()]);
        const items = await listDirectMessages(id);
        if (!active) return;
        setProfile(conversation?.other_profile ?? null);
        setMessages(items);
        setCurrentUserId(auth.data.user?.id ?? '');
        setError(conversation ? '' : (isBg ? 'Чатът не беше намерен.' : 'Conversation not found.'));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : (isBg ? 'Чатът не може да се зареди.' : 'Could not load this conversation.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    setLoading(true);
    void refresh();
    timer = setInterval(() => {
      void listDirectMessages(id).then((items) => { if (active) setMessages(items); }).catch(() => {});
    }, 5000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [id, isBg]));

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const message = await sendDirectMessage(id, body);
      setMessages((current) => [...current, message]);
      setDraft('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Съобщението не беше изпратено.' : 'Message could not be sent.'));
    } finally {
      setSending(false);
    }
  }

  const name = profile?.display_name?.trim() || (isBg ? 'Спортист' : 'Athlete');
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <View style={styles.header}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/messages')} accessibilityRole="button" style={styles.backButton} hitSlop={8}><Ionicons name="arrow-back" size={21} color="#FFFFFF" /></Pressable>
          {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><ThemedText type="smallBold" style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</ThemedText></View>}
          <View style={styles.headerCopy}><ThemedText type="smallBold" numberOfLines={1}>{name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Лично съобщение' : 'Direct message'}</ThemedText></View>
          {profile ? <Pressable onPress={() => router.push(`/athlete/${profile.id}`)} accessibilityRole="button" style={styles.profileButton}><Ionicons name="person-outline" size={19} color="#D7F36A" /></Pressable> : null}
        </View>
        {loading ? <View style={styles.state}><ActivityIndicator color="#D7F36A" /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждане на разговора…' : 'Loading conversation…'}</ThemedText></View> : <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {!messages.length ? <View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={26} color="#D7F36A" /><ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>{isBg ? `Започни разговор с ${name}.` : `Start a conversation with ${name}.`}</ThemedText></View> : null}
          {messages.map((message) => {
            const mine = message.sender_id === currentUserId;
            return <View key={message.id} style={[styles.messageRow, mine && styles.messageRowMine]}><View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}><ThemedText type="default" style={mine ? styles.messageTextMine : styles.messageTextOther}>{message.body}</ThemedText><ThemedText type="small" style={mine ? styles.messageTimeMine : styles.messageTimeOther}>{new Date(message.created_at).toLocaleTimeString(isBg ? 'bg-BG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</ThemedText></View></View>;
          })}
        </ScrollView>}
        {!!error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
        <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder={isBg ? 'Напиши съобщение…' : 'Write a message…'} placeholderTextColor="#948B9F" style={styles.input} multiline maxLength={2000} editable={!sending} onSubmitEditing={() => void send()} /><Pressable onPress={() => void send()} disabled={!draft.trim() || sending} accessibilityRole="button" accessibilityLabel={isBg ? 'Изпрати' : 'Send'} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}>{sending ? <ActivityIndicator size="small" color="#0B1110" /> : <Ionicons name="send" size={18} color="#0B1110" />}</Pressable></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1110' },
  flex: { flex: 1 },
  header: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 6, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#30283A', backgroundColor: '#15111C' },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#202A26' },
  avatarFallback: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(215,243,106,0.16)' },
  avatarLetter: { color: '#D7F36A' },
  headerCopy: { flex: 1, gap: 2 },
  profileButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(215,243,106,0.1)' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 11 },
  messages: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 180 },
  emptyCopy: { textAlign: 'center' },
  messageRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  messageRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '84%', minWidth: 70, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 7, borderRadius: 19, gap: 5 },
  bubbleMine: { backgroundColor: '#D7F36A', borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: '#211B2A', borderWidth: 1, borderColor: '#2D3932', borderBottomLeftRadius: 6 },
  messageTextMine: { color: '#0B1110' },
  messageTextOther: { color: '#F5F1FA' },
  messageTimeMine: { color: 'rgba(13,10,20,0.65)', fontSize: 10, textAlign: 'right' },
  messageTimeOther: { color: '#A69DB0', fontSize: 10, textAlign: 'right' },
  error: { color: '#FF8F8F', paddingHorizontal: 16, paddingVertical: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 14, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 8 : 10, borderTopWidth: 1, borderTopColor: '#30283A', backgroundColor: '#15111C' },
  input: { flex: 1, maxHeight: 120, minHeight: 46, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18, color: '#FFFFFF', backgroundColor: '#211B2A', borderWidth: 1, borderColor: '#2D3932', fontSize: 15, textAlignVertical: 'center' },
  sendButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#D7F36A' },
  sendDisabled: { opacity: 0.48 },
});
