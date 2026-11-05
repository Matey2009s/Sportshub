import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/i18n/language-context';
import { supabase, type PostComment, type Profile, type SocialPost, type SportEvent } from '@/lib/supabase';

type Ban = { user_id: string; reason: string; banned_by: string; created_at: string };

function confirmAction(title: string, message: string, confirmLabel: string) {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise<boolean>((resolve) => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

export default function ModerationScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: moderator, error: roleError } = await supabase.rpc('is_sporthub_moderator');
      if (roleError) throw roleError;
      if (!moderator) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);
      const [profileResult, eventResult, postResult, commentResult, banResult] = await Promise.all([
        supabase.from('profiles').select('id,display_name,avatar_url,cover_url,biography,favorite_sports,skill_level,location,created_at,updated_at').order('display_name').limit(100),
        supabase.from('sports_events').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('post_comments').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('user_bans').select('*'),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (eventResult.error) throw eventResult.error;
      if (postResult.error) throw postResult.error;
      if (commentResult.error) throw commentResult.error;
      if (banResult.error) throw banResult.error;
      setProfiles((profileResult.data ?? []) as Profile[]);
      setEvents((eventResult.data ?? []) as SportEvent[]);
      setPosts((postResult.data ?? []) as SocialPost[]);
      setComments((commentResult.data ?? []) as PostComment[]);
      setBans((banResult.data ?? []) as Ban[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Не успяхме да заредим модераторските инструменти.' : 'Could not load moderation tools.'));
    } finally {
      setLoading(false);
    }
  }, [isBg]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggleBan(profile: Profile) {
    const currentlyBanned = bans.some((ban) => ban.user_id === profile.id);
    if (currentlyBanned) {
      const ok = await confirmAction(isBg ? 'Премахване на ограничението' : 'Remove restriction', isBg ? `Да бъде ли възстановен достъпът на ${profile.display_name || 'този профил'}?` : `Restore access for ${profile.display_name || 'this profile'}?`, isBg ? 'Премахни' : 'Unban');
      if (!ok) return;
    } else {
      const ok = await confirmAction(isBg ? 'Ограничи профила' : 'Restrict account', isBg ? `Профилът ${profile.display_name || ''} няма да може да създава събития, постове, коментари, съобщения или да се записва за събития. Потребителят ще може да влиза в акаунта си.` : `${profile.display_name || 'This member'} will be blocked from creating events, posts, comments, messages, or joining events. They can still sign in.`, isBg ? 'Блокирай' : 'Ban');
      if (!ok) return;
    }
    setWorking(`ban:${profile.id}`);
    setError(''); setNotice('');
    try {
      if (currentlyBanned) {
        const { error: actionError } = await supabase.from('user_bans').delete().eq('user_id', profile.id);
        if (actionError) throw actionError;
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const moderatorId = sessionData.session?.user.id;
        if (!moderatorId) throw new Error('Please sign in again.');
        const { error: actionError } = await supabase.from('user_bans').insert({ user_id: profile.id, banned_by: moderatorId, reason: 'Community guidelines' });
        if (actionError) throw actionError;
      }
      setNotice(isBg ? 'Промяната е запазена.' : 'Moderation action saved.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Действието не беше изпълнено.' : 'Could not complete the action.'));
    } finally { setWorking(''); }
  }

  async function deleteContent(kind: 'event' | 'post' | 'comment', id: string, label: string) {
    const ok = await confirmAction(isBg ? 'Изтриване на съдържание' : 'Delete content', isBg ? `Сигурен ли си, че искаш да изтриеш „${label}“? Това действие не може да се отмени.` : `Delete “${label}”? This cannot be undone.`, isBg ? 'Изтрий' : 'Delete');
    if (!ok) return;
    setWorking(`${kind}:${id}`); setError(''); setNotice('');
    try {
      const { error: actionError } = kind === 'event'
        ? await supabase.from('sports_events').delete().eq('id', id)
        : kind === 'post'
          ? await supabase.from('social_posts').delete().eq('id', id)
          : await supabase.from('post_comments').delete().eq('id', id);
      if (actionError) throw actionError;
      setNotice(isBg ? 'Съдържанието е изтрито.' : 'Content deleted.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Изтриването не беше успешно.' : 'Could not delete content.'));
    } finally { setWorking(''); }
  }

  const filteredProfiles = profiles.filter((profile) => `${profile.display_name ?? ''} ${profile.location ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={styles.back} accessibilityRole="button">
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" /><ThemedText type="smallBold">{isBg ? 'Профил' : 'Profile'}</ThemedText>
        </Pressable>
        <View style={styles.heading}>
          <View style={styles.eyebrow}><Ionicons name="shield-checkmark" size={15} color="#C4A1FF" /><ThemedText type="smallBold" style={styles.eyebrowText}>SPORTSHUB MODERATION</ThemedText></View>
          <ThemedText type="subtitle" style={styles.title}>{isBg ? 'Модераторски панел' : 'Moderator panel'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Управлявай с членове, събития и публикации.' : 'Manage members, events and posts.'}</ThemedText>
        </View>
        {loading ? <View style={styles.state}><ActivityIndicator color="#C4A1FF" /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждане…' : 'Loading…'}</ThemedText></View> : null}
        {!loading && !authorized ? <View style={styles.state}><Ionicons name="lock-closed-outline" size={25} color="#C4A1FF" /><ThemedText type="smallBold">{isBg ? 'Нямаш достъп до този панел.' : 'You do not have access to this panel.'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Пусни последната moderation миграция в Supabase и влез с одобрения имейл.' : 'Apply the moderation migration in Supabase and sign in with the moderator email.'}</ThemedText></View> : null}
        {!!error ? <View style={styles.messageError}><ThemedText type="small" style={styles.errorText}>{error}</ThemedText></View> : null}
        {!!notice ? <View style={styles.messageSuccess}><ThemedText type="small" style={styles.successText}>{notice}</ThemedText></View> : null}
        {authorized ? <>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Членове' : 'Members'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{filteredProfiles.length}</ThemedText></View>
            <View style={styles.search}><Ionicons name="search-outline" size={17} color="#C4A1FF" /><TextInput value={search} onChangeText={setSearch} placeholder={isBg ? 'Търси по име или град' : 'Search name or city'} placeholderTextColor="#968CA4" style={styles.searchInput} /></View>
            {filteredProfiles.map((profile) => {
              const banned = bans.some((ban) => ban.user_id === profile.id);
              return <View key={profile.id} style={styles.row}>
                <View style={[styles.avatar, banned && styles.avatarBanned]}><ThemedText type="smallBold" style={styles.avatarText}>{(profile.display_name?.trim().charAt(0) || '?').toUpperCase()}</ThemedText></View>
                <View style={styles.rowCopy}><ThemedText type="smallBold" numberOfLines={1}>{profile.display_name || (isBg ? 'Спортист' : 'Athlete')}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{profile.location || profile.id.slice(0, 8)}</ThemedText></View>
                <Pressable disabled={working === `ban:${profile.id}`} onPress={() => void toggleBan(profile)} style={[styles.action, banned ? styles.unban : styles.ban, working === `ban:${profile.id}` && styles.disabled]} accessibilityRole="button">
                  {working === `ban:${profile.id}` ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ThemedText type="smallBold" style={styles.actionText}>{banned ? (isBg ? 'Разбан' : 'Unban') : (isBg ? 'Бан' : 'Ban')}</ThemedText>}
                </Pressable>
              </View>;
            })}
            {!filteredProfiles.length ? <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Няма намерени членове.' : 'No members found.'}</ThemedText> : null}
          </View>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Събития' : 'Events'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{events.length}</ThemedText></View>
            {events.map((event) => <View key={event.id} style={styles.contentRow}>
              <View style={styles.rowCopy}><ThemedText type="smallBold" numberOfLines={1}>{event.title}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{event.sport_category} · {event.venue || (isBg ? 'Без адрес' : 'No venue')}</ThemedText></View>
              <Pressable disabled={!!working} onPress={() => void deleteContent('event', event.id, event.title)} style={styles.deleteButton} accessibilityRole="button" accessibilityLabel={isBg ? 'Изтрий събитие' : 'Delete event'}><Ionicons name="trash-outline" size={17} color="#FF9AAB" /><ThemedText type="smallBold" style={styles.deleteLabel}>{isBg ? 'Изтрий' : 'Delete'}</ThemedText></Pressable>
            </View>)}
            {!events.length ? <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Няма събития.' : 'No events.'}</ThemedText> : null}
          </View>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Публикации' : 'Posts'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{posts.length}</ThemedText></View>
            {posts.map((post) => <View key={post.id} style={styles.contentRow}>
              <View style={styles.rowCopy}><ThemedText type="smallBold" numberOfLines={2}>{post.body || (isBg ? 'Публикация със снимка' : 'Photo post')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{post.author_name}</ThemedText></View>
              <Pressable disabled={!!working} onPress={() => void deleteContent('post', post.id, post.body || post.author_name)} style={styles.deleteButton} accessibilityRole="button" accessibilityLabel={isBg ? 'Изтрий публикация' : 'Delete post'}><Ionicons name="trash-outline" size={17} color="#FF9AAB" /><ThemedText type="smallBold" style={styles.deleteLabel}>{isBg ? 'Изтрий' : 'Delete'}</ThemedText></Pressable>
            </View>)}
            {!posts.length ? <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Няма публикации.' : 'No posts.'}</ThemedText> : null}
          </View>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Коментари' : 'Comments'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{comments.length}</ThemedText></View>
            {comments.map((comment) => <View key={comment.id} style={styles.contentRow}>
              <View style={styles.rowCopy}>
                <ThemedText type="smallBold" numberOfLines={1}>{comment.author_name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>{comment.body}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{new Date(comment.created_at).toLocaleDateString(isBg ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short' })}</ThemedText>
              </View>
              <Pressable disabled={!!working} onPress={() => void deleteContent('comment', comment.id, comment.body)} style={styles.deleteButton} accessibilityRole="button" accessibilityLabel={isBg ? 'Изтрий коментар' : 'Delete comment'}>
                {working === `comment:${comment.id}` ? <ActivityIndicator size="small" color="#FF9AAB" /> : <><Ionicons name="trash-outline" size={17} color="#FF9AAB" /><ThemedText type="smallBold" style={styles.deleteLabel}>{isBg ? 'Изтрий' : 'Delete'}</ThemedText></>}
              </Pressable>
            </View>)}
            {!comments.length ? <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Няма коментари.' : 'No comments.'}</ThemedText> : null}
          </View>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0D0A12' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingTop: 22, paddingBottom: 130, gap: 16 },
  back: { minHeight: 42, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  heading: { gap: 7, marginTop: 5, marginBottom: 3 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrowText: { color: '#C4A1FF', fontSize: 10, letterSpacing: 1.5 },
  title: { fontSize: 30, lineHeight: 37 },
  state: { minHeight: 170, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24, borderRadius: 22, backgroundColor: '#19151F' },
  section: { padding: 15, gap: 11, borderWidth: 1, borderColor: '#302638', borderRadius: 20, backgroundColor: '#17131C' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 17 },
  search: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#33283D', backgroundColor: '#100D14' },
  searchInput: { flex: 1, minHeight: 42, color: '#FFFFFF', fontSize: 14 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  rowCopy: { flex: 1, gap: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3F2B56', alignItems: 'center', justifyContent: 'center' },
  avatarBanned: { backgroundColor: '#672B38' },
  avatarText: { color: '#E5D4FF' },
  action: { minWidth: 74, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12 },
  ban: { backgroundColor: '#8E3346' },
  unban: { backgroundColor: '#3C3150' },
  actionText: { color: '#FFFFFF' },
  disabled: { opacity: 0.55 },
  contentRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  deleteButton: { minWidth: 92, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,110,140,0.12)' },
  deleteLabel: { color: '#FF9AAB' },
  messageError: { padding: 12, borderRadius: 13, backgroundColor: 'rgba(255,100,120,0.12)' },
  errorText: { color: '#FF9AAB' },
  messageSuccess: { padding: 12, borderRadius: 13, backgroundColor: 'rgba(150,110,255,0.13)' },
  successText: { color: '#D9C4FF' },
});
