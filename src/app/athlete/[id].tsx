import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/i18n/language-context';
import { fetchProfile, getOrCreateDirectConversation, listEvents } from '@/lib/supabase-services';
import type { Profile, SportEvent } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

export default function AthleteProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messagePending, setMessagePending] = useState(false);
  const [messageError, setMessageError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const [profileResult, eventResults] = await Promise.all([
          fetchProfile(id),
          listEvents({ organizerId: id }),
        ]);
        if (active) {
          setProfile(profileResult);
          setEvents(eventResults);
          if (!profileResult) setError(isBg ? 'Профилът не беше намерен.' : 'Profile not found.');
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : (isBg ? 'Профилът не можа да се зареди.' : 'Could not load this profile.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, [id, isBg]);

  const name = profile?.display_name?.trim() || (isBg ? 'Спортист' : 'Athlete');
  const level = profile?.skill_level === 'beginner'
    ? (isBg ? 'Начинаещ' : 'Beginner')
    : profile?.skill_level === 'intermediate'
      ? (isBg ? 'Средно ниво' : 'Intermediate')
      : profile?.skill_level === 'advanced'
        ? (isBg ? 'Напреднал' : 'Advanced')
        : '';

  async function openDirectMessage() {
    if (!id || messagePending) return;
    setMessagePending(true);
    setMessageError('');
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push('/login'); return; }
      const conversationId = await getOrCreateDirectConversation(id);
      router.push(`/chat/${conversationId}`);
    } catch (reason) {
      setMessageError(reason instanceof Error ? reason.message : (isBg ? 'Не успяхме да отворим чата.' : 'Could not open this chat.'));
    } finally {
      setMessagePending(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/people')} style={styles.backButton} accessibilityRole="button" hitSlop={8}>
          <Ionicons name="arrow-back" size={19} color="#FFFFFF" />
          <ThemedText type="smallBold">{isBg ? 'Спортисти' : 'Athletes'}</ThemedText>
        </Pressable>

        {loading ? <View style={styles.state}><ActivityIndicator color="#D7F36A" /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждаме профила…' : 'Loading profile…'}</ThemedText></View> : null}
        {!!error && !loading ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={23} color="#FF8F8F" /><ThemedText type="small">{error}</ThemedText></View> : null}

        {profile && !loading ? <>
          <View style={styles.hero}>
            <View style={styles.coverFrame}>
              {profile.cover_url ? <Image source={{ uri: profile.cover_url }} style={styles.coverImage} contentFit="cover" /> : <View style={styles.coverFallback}><Ionicons name="fitness-outline" size={38} color="rgba(255,255,255,0.62)" /></View>}
              <View style={styles.coverShade} />
            </View>
            <View style={styles.heroIdentity}>
            {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><ThemedText type="title" style={styles.initial}>{name.charAt(0).toUpperCase()}</ThemedText></View>}
            <ThemedText type="subtitle" style={styles.name}>{name}</ThemedText>
            <View style={styles.memberBadge}><Ionicons name="sparkles" size={15} color="#D7F36A" /><ThemedText type="smallBold" style={styles.memberText}>{isBg ? 'SPORTSHUB СПОРТИСТ' : 'SPORTHUB ATHLETE'}</ThemedText></View>
            {!!profile.location && <View style={styles.meta}><Ionicons name="location-outline" size={17} color="#D7F36A" /><ThemedText type="small" themeColor="textSecondary">{profile.location}</ThemedText></View>}
            {!!level && <View style={styles.meta}><Ionicons name="speedometer-outline" size={17} color="#D7F36A" /><ThemedText type="small" themeColor="textSecondary">{level}</ThemedText></View>}
            {!!profile.biography && <ThemedText type="default" style={styles.bio}>{profile.biography}</ThemedText>}
            <Pressable onPress={() => void openDirectMessage()} disabled={messagePending} accessibilityRole="button" style={[styles.messageButton, messagePending && styles.disabled]}>
              {messagePending ? <ActivityIndicator color="#0B1110" size="small" /> : <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0B1110" />}
              <ThemedText type="smallBold" style={styles.messageButtonText}>{isBg ? 'Изпрати лично съобщение' : 'Send a direct message'}</ThemedText>
            </Pressable>
            {!!messageError ? <ThemedText type="small" style={styles.messageError}>{messageError}</ThemedText> : null}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}><Ionicons name="heart-outline" size={19} color="#D7F36A" /><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Спортни интереси' : 'Sports interests'}</ThemedText></View>
            {(profile.favorite_sports ?? []).length ? <View style={styles.chips}>{profile.favorite_sports?.map((sport) => <View key={sport} style={styles.sportChip}><ThemedText type="smallBold" style={styles.sportText}>{sport}</ThemedText></View>)}</View> : <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Няма добавени спортове.' : 'No sports added yet.'}</ThemedText>}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}><Ionicons name="calendar-outline" size={19} color="#D7F36A" /><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Предстоящи събития' : 'Upcoming events'}</ThemedText><View style={styles.count}><ThemedText type="smallBold" style={styles.countText}>{events.length}</ThemedText></View></View>
            {events.length ? events.map((event) => <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}`)} accessibilityRole="button" style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}>
              <View style={styles.eventIcon}><Ionicons name="fitness-outline" size={19} color="#D7F36A" /></View>
              <View style={styles.eventCopy}><ThemedText type="smallBold" numberOfLines={1}>{event.title}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{event.venue || new Date(event.starts_at).toLocaleDateString(isBg ? 'bg-BG' : 'en-GB')}</ThemedText></View>
              <Ionicons name="chevron-forward" size={17} color="#8F8798" />
            </Pressable>) : <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Този спортист още няма предстоящи събития.' : 'This athlete has no upcoming events yet.'}</ThemedText>}
          </View>
        </> : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1110' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingTop: 20, paddingBottom: 120, gap: 14 },
  backButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, borderRadius: 22, backgroundColor: '#151D1B' },
  hero: { alignItems: 'stretch', gap: 0, padding: 12, borderRadius: 26, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#151D1B', overflow: 'hidden' },
  coverFrame: { height: 182, borderRadius: 19, overflow: 'hidden', backgroundColor: '#292333' },
  coverImage: StyleSheet.absoluteFill,
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#292333' },
  coverShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,8,14,0.12)' },
  heroIdentity: { alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 12, marginTop: -48 },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#202A26', borderWidth: 2, borderColor: 'rgba(215,243,106,0.7)' },
  avatarFallback: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.16)', borderWidth: 2, borderColor: 'rgba(215,243,106,0.7)' },
  initial: { color: '#D7F36A' },
  name: { fontSize: 27, textAlign: 'center' },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberText: { color: '#D7F36A', fontSize: 10, letterSpacing: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bio: { marginTop: 4, textAlign: 'center', lineHeight: 23 },
  messageButton: { width: '100%', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, paddingHorizontal: 14, backgroundColor: '#D7F36A' },
  messageButtonText: { color: '#0B1110' },
  messageError: { color: '#FF8F8F', textAlign: 'center' },
  disabled: { opacity: 0.65 },
  section: { gap: 13, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#151D1B' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { fontSize: 17, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sportChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(215,243,106,0.13)' },
  sportText: { color: '#D7F36A', fontSize: 11 },
  count: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.13)' },
  countText: { color: '#D7F36A' },
  eventRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.04)' },
  eventIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(215,243,106,0.12)' },
  eventCopy: { flex: 1, gap: 3 },
  pressed: { opacity: 0.8 },
});
