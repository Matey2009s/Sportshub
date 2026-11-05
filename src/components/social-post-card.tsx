import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ExpoLinking from 'expo-linking';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/i18n/language-context';
import type { SocialFeedPost } from '@/lib/supabase-services';

export function SocialPostCard({ post, onLike, onComments, likePending = false }: {
  post: SocialFeedPost;
  onLike: (post: SocialFeedPost) => void;
  onComments: (post: SocialFeedPost) => void;
  likePending?: boolean;
}) {
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [shareMessage, setShareMessage] = useState('');
  const activityLabels: Record<string, { bg: string; en: string }> = {
    running: { bg: 'Бягане', en: 'Running' }, cycling: { bg: 'Колоездене', en: 'Cycling' },
    fitness: { bg: 'Фитнес', en: 'Fitness' }, football: { bg: 'Футбол', en: 'Football' },
    basketball: { bg: 'Баскетбол', en: 'Basketball' }, tennis: { bg: 'Тенис', en: 'Tennis' },
    volleyball: { bg: 'Волейбол', en: 'Volleyball' }, hiking: { bg: 'Преходи', en: 'Hiking' },
  };
  const activity = post.sport_category ? activityLabels[post.sport_category] : undefined;
  const postedAt = new Date(post.created_at).toLocaleDateString(isBg ? 'bg-BG' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  async function sharePost() {
    const url = Platform.OS === 'web' ? `${window.location.origin}/post/${post.id}` : ExpoLinking.createURL(`post/${post.id}`);
    try {
      if (Platform.OS === 'web' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${post.body}\n${url}`);
        setShareMessage(isBg ? 'Линкът е копиран.' : 'Link copied.');
        return;
      }
      await Share.share({ title: post.author_name, message: `${post.body}\n${url}`, url });
    } catch {
      setShareMessage(isBg ? 'Не успяхме да споделим публикацията.' : 'Could not share the post.');
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={isBg ? `Отвори профила на ${post.author_name}` : `View ${post.author_name}'s profile`} onPress={() => router.push(`/athlete/${post.author_id}`)} style={styles.authorRow}>
        {post.author_avatar_url ? <Image source={{ uri: post.author_avatar_url }} style={styles.avatar} contentFit="cover" /> :
          <View style={styles.avatarFallback}><ThemedText type="smallBold" style={styles.avatarLetter}>{post.author_name.trim().charAt(0).toUpperCase() || 'S'}</ThemedText></View>}
        <View style={styles.authorCopy}>
          <ThemedText type="smallBold" numberOfLines={1}>{post.author_name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{postedAt}</ThemedText>
        </View>
        <View style={styles.activityPill}><Ionicons name="fitness-outline" size={13} color="#D7F36A" /><ThemedText type="smallBold" style={styles.activityLabel}>{activity?.[language] ?? (isBg ? 'АКТИВНОСТ' : 'ACTIVITY')}</ThemedText></View>
      </Pressable>
      {post.body ? <ThemedText type="default" style={styles.body}>{post.body}</ThemedText> : null}
      {(post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : []).length ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoGallery}>
        {(post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : []).map((uri, index) => <View key={`${uri}-${index}`} style={styles.photoFrame}><Image source={{ uri }} style={styles.photo} contentFit="cover" transition={180} />{(post.image_urls?.length ?? 0) > 1 ? <View style={styles.photoCounter}><ThemedText type="smallBold" style={styles.photoCounterText}>{index + 1} / {post.image_urls.length}</ThemedText></View> : null}</View>)}
      </ScrollView> : null}
      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={isBg ? 'Харесай публикацията' : 'Like post'} accessibilityState={{ selected: post.liked_by_me }} disabled={likePending} onPress={() => onLike(post)} style={styles.action}>
          <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={21} color={post.liked_by_me ? '#FF6D9A' : '#F5F1FA'} />
          <ThemedText type="smallBold">{post.like_count}</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isBg ? 'Отвори коментарите' : 'Open comments'} onPress={() => onComments(post)} style={styles.action}>
          <Ionicons name="chatbubble-outline" size={19} color="#F5F1FA" />
          <ThemedText type="smallBold">{post.comment_count} {isBg ? 'коментара' : 'comments'}</ThemedText>
        </Pressable>
        <View style={styles.spacer} />
        <Pressable accessibilityRole="button" accessibilityLabel={isBg ? 'Сподели публикацията' : 'Share post'} onPress={() => void sharePost()} hitSlop={8}>
          <Ionicons name="share-social-outline" size={19} color="#D7F36A" />
        </Pressable>
      </View>
      {!!shareMessage ? <ThemedText type="small" themeColor="textSecondary" style={styles.shareMessage}>{shareMessage}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#202A26' },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.18)', borderWidth: 1, borderColor: 'rgba(215,243,106,0.5)' },
  avatarLetter: { color: '#D7F36A' },
  authorCopy: { flex: 1, gap: 2 },
  activityPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(215,243,106,0.1)' },
  activityLabel: { color: '#D7F36A', fontSize: 9, letterSpacing: 0.7 },
  body: { paddingHorizontal: 16, paddingBottom: 14, lineHeight: 23 },
  photoGallery: { gap: 8 },
  photoFrame: { width: 360, maxWidth: '100%', height: 270, position: 'relative' },
  photo: { width: '100%', height: 270, backgroundColor: '#202A26' },
  photoCounter: { position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(13,10,20,0.78)' },
  photoCounterText: { color: '#FFFFFF', fontSize: 12 },
  actionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 15 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },
  spacer: { flex: 1 },
  shareMessage: { paddingHorizontal: 15, paddingBottom: 10 },
});
