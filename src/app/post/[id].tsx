import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SportHubBrandColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { supabase, type PostComment, type SocialPost } from '@/lib/supabase';
import { createPostComment, fetchSocialPost, listPostComments } from '@/lib/supabase-services';

export default function PostCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const listRef = useRef<ScrollViewInstance>(null);
  const [post, setPost] = useState<SocialPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadPost() {
      try {
        const [postData, commentData] = await Promise.all([fetchSocialPost(id), listPostComments(id)]);
        if (active) { setPost(postData); setComments(commentData); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : (isBg ? 'Публикацията не се зареди.' : 'Could not load this post.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPost();
    return () => { active = false; };
  }, [id, isBg]);

  async function sendComment() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) { router.push('/login'); return; }
      const comment = await createPostComment(id, body);
      setComments((current) => [...current, comment]);
      setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Коментарът не се изпрати.' : 'Could not send your comment.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={isBg ? 'Назад' : 'Back'} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backButton}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.headerCopy}><ThemedText type="smallBold">{isBg ? 'Разговор' : 'Conversation'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{comments.length} {isBg ? 'коментара' : 'comments'}</ThemedText></View>
      </View>
      {loading ? <View style={styles.loading}><ActivityIndicator color={SportHubBrandColors.accent} /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждаме…' : 'Loading…'}</ThemedText></View> : <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <ScrollView ref={listRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!!error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
          {post ? <View style={styles.postCard}>
            <View style={styles.authorRow}>
              {post.author_avatar_url ? <Image source={{ uri: post.author_avatar_url }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><ThemedText type="smallBold" style={styles.avatarLetter}>{post.author_name.charAt(0).toUpperCase()}</ThemedText></View>}
              <View style={styles.authorCopy}><ThemedText type="smallBold">{post.author_name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{new Date(post.created_at).toLocaleDateString(isBg ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</ThemedText></View>
            </View>
            {post.body ? <ThemedText type="default" style={styles.postBody}>{post.body}</ThemedText> : null}
            {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postPhoto} contentFit="cover" /> : null}
          </View> : !error ? <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Публикацията не е намерена.' : 'Post not found.'}</ThemedText> : null}
          {comments.length ? comments.map((comment) => <View key={comment.id} style={styles.commentRow}>
            {comment.author_avatar_url ? <Image source={{ uri: comment.author_avatar_url }} style={styles.commentAvatar} contentFit="cover" /> : <View style={styles.commentAvatarFallback}><ThemedText type="smallBold" style={styles.avatarLetter}>{comment.author_name.charAt(0).toUpperCase()}</ThemedText></View>}
            <View style={styles.commentBubble}><View style={styles.commentHeading}><ThemedText type="smallBold">{comment.author_name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{new Date(comment.created_at).toLocaleTimeString(isBg ? 'bg-BG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</ThemedText></View><ThemedText type="small">{comment.body}</ThemedText></View>
          </View>) : <View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={25} color="#D7F36A" /><ThemedText type="smallBold">{isBg ? 'Започни разговора' : 'Start the conversation'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Остави подкрепящ коментар.' : 'Leave an encouraging comment.'}</ThemedText></View>}
        </ScrollView>
        <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder={isBg ? 'Напиши коментар…' : 'Write a comment…'} placeholderTextColor="#ACB6AD" style={styles.input} maxLength={1000} multiline returnKeyType="send" onSubmitEditing={() => void sendComment()} /><Pressable accessibilityRole="button" accessibilityLabel={isBg ? 'Изпрати коментар' : 'Send comment'} disabled={!draft.trim() || sending} onPress={() => void sendComment()} style={[styles.sendButton, (!draft.trim() || sending) && styles.disabled]}>{sending ? <ActivityIndicator size="small" color="#0B1110" /> : <Ionicons name="arrow-up" size={20} color="#0B1110" />}</Pressable></View>
      </KeyboardAvoidingView>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1110' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#2D3932' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#151D1B' },
  headerCopy: { gap: 3 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 24, gap: 13 },
  postCard: { gap: 12, padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#151D1B', marginBottom: 6 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#202A26' },
  avatarFallback: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.18)' },
  avatarLetter: { color: '#D7F36A' },
  authorCopy: { flex: 1, gap: 2 },
  postBody: { lineHeight: 23 },
  postPhoto: { width: '100%', height: 240, borderRadius: 14, backgroundColor: '#202A26' },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#202A26' },
  commentAvatarFallback: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.18)' },
  commentBubble: { flex: 1, gap: 5, padding: 12, borderRadius: 16, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#2D3932' },
  commentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  empty: { alignItems: 'center', padding: 28, gap: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 13, borderTopWidth: 1, borderTopColor: '#2D3932' },
  input: { minHeight: 45, maxHeight: 120, flex: 1, borderWidth: 1, borderColor: '#2D3932', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, color: '#FFFFFF', backgroundColor: '#151D1B', fontSize: 15 },
  sendButton: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7F36A' },
  disabled: { opacity: 0.55 },
  error: { color: '#FF8F8F' },
});
