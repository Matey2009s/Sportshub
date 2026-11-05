import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ExpoLinking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import EventLocationMap from '@/components/event-location-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SportHubBrandColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { fetchEventById, fetchProfile, joinEvent, listEventParticipantCounts, listJoinedEventIds } from '@/lib/supabase-services';
import { supabase } from '@/lib/supabase';
import type { Profile, SportEvent } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [event, setEvent] = useState<SportEvent | null>(null);
  const [organizer, setOrganizer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [joining, setJoining] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isModerator, setIsModerator] = useState(false);
  const [moderationWorking, setModerationWorking] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return;
    fetchEventById(id)
      .then((result) => {
        if (active) {
          setEvent(result);
          if (!result) setError(isBg ? 'Събитието не беше намерено.' : 'Event not found.');
          else void fetchProfile(result.organizer_id).then((profile) => { if (active) setOrganizer(profile); }).catch(() => {});
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : (isBg ? 'Събитието не можа да се зареди.' : 'Could not load event.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, isBg]);

  useEffect(() => {
    let active = true;
    if (!id) return;
    async function loadMembership() {
      try {
        const [{ data: auth }, counts, { data: moderator }] = await Promise.all([
          supabase.auth.getUser(),
          listEventParticipantCounts([id]),
          supabase.rpc('is_sporthub_moderator'),
        ]);
        if (!active) return;
        const currentUserId = auth.user?.id ?? null;
        setUserId(currentUserId);
        setIsModerator(moderator === true);
        setParticipantCount(counts[id] ?? 0);
        if (currentUserId) {
          const joinedIds = await listJoinedEventIds(currentUserId);
          if (active) setJoined(joinedIds.includes(id));
        }
      } catch {
        // Event details remain usable when membership data is temporarily unavailable.
      }
    }
    void loadMembership();
    return () => { active = false; };
  }, [id]);

  async function handleJoinEvent() {
    if (!event) return;
    if (!userId) { router.push('/login'); return; }
    setJoining(true);
    setActionError('');
    try {
      await joinEvent(event.id);
      setJoined(true);
      setParticipantCount((count) => count + 1);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isBg ? 'Не успяхме да те запишем.' : 'Could not join this event.'));
    } finally { setJoining(false); }
  }

  async function handleModeratorDelete() {
    if (!event || !isModerator || moderationWorking) return;
    const message = isBg ? `Изтриване на „${event.title}“? Това действие не може да се отмени.` : `Delete “${event.title}”? This cannot be undone.`;
    const confirmed = Platform.OS === 'web'
      ? window.confirm(message)
      : await new Promise<boolean>((resolve) => Alert.alert(
          isBg ? 'Изтрий събитието' : 'Delete event',
          message,
          [
            { text: isBg ? 'Отказ' : 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: isBg ? 'Изтрий' : 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ));
    if (!confirmed) return;
    setModerationWorking(true);
    setActionError('');
    try {
      const { error: deleteError } = await supabase.from('sports_events').delete().eq('id', event.id);
      if (deleteError) throw deleteError;
      router.replace('/(tabs)');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isBg ? 'Събитието не беше изтрито.' : 'Could not delete the event.'));
    } finally {
      setModerationWorking(false);
    }
  }

  const start = event ? new Date(event.starts_at) : null;
  const locale = isBg ? 'bg-BG' : 'en-GB';
  const date = start?.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = start?.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const category = event?.sport_category;
  const sports: Record<string, { bg: string; en: string }> = {
    running: { bg: 'Бягане', en: 'Running' }, cycling: { bg: 'Колоездене', en: 'Cycling' },
    fitness: { bg: 'Фитнес', en: 'Fitness' }, group: { bg: 'Групов спорт', en: 'Group' },
  };
  const levels: Record<string, { bg: string; en: string }> = {
    beginner: { bg: 'Начинаещи', en: 'Beginner' }, intermediate: { bg: 'Средно', en: 'Intermediate' },
    advanced: { bg: 'Напреднали', en: 'Advanced' },
  };

  async function shareEvent() {
    if (!event) return;
    const url = Platform.OS === 'web' ? window.location.href : ExpoLinking.createURL(`event/${event.id}`);
    try {
      if (Platform.OS === 'web' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareMessage(isBg ? 'Линкът е копиран.' : 'Event link copied.');
      } else {
        await Share.share({ title: event.title, message: `${event.title}\n${event.venue ?? ''}\n${url}`, url });
      }
    } catch {
      setShareMessage(isBg ? 'Не успяхме да споделим събитието.' : 'Could not share the event.');
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <ThemedText type="smallBold">{isBg ? 'Към събитията' : 'Back to events'}</ThemedText>
        </Pressable>

        {loading ? <View style={styles.state}><ActivityIndicator color={SportHubBrandColors.accent} /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждаме събитието…' : 'Loading event…'}</ThemedText></View> : null}
        {!!error && !loading ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={24} color="#FF7777" /><ThemedText type="small">{error}</ThemedText></View> : null}

        {event ? <>
          {isModerator ? <View style={styles.moderatorActions}>
            <View style={styles.moderatorLabelRow}>
              <Ionicons name="shield-checkmark-outline" size={17} color="#E9D8FF" />
              <ThemedText type="smallBold" style={styles.moderatorLabel}>{isBg ? 'МОДЕРАТОРСКИ ДЕЙСТВИЯ' : 'MODERATOR ACTIONS'}</ThemedText>
            </View>
            <View style={styles.moderatorButtons}>
              <Pressable onPress={() => router.push('/moderation')} style={styles.moderatorManageButton} accessibilityRole="button">
                <Ionicons name="settings-outline" size={17} color="#FFFFFF" />
                <ThemedText type="smallBold" style={styles.moderatorButtonText}>{isBg ? 'Панел за модерация' : 'Moderation panel'}</ThemedText>
              </Pressable>
              <Pressable onPress={() => void handleModeratorDelete()} disabled={moderationWorking} style={[styles.moderatorDeleteButton, moderationWorking && styles.joinDisabled]} accessibilityRole="button">
                {moderationWorking ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="trash-outline" size={17} color="#FFFFFF" />}
                <ThemedText type="smallBold" style={styles.moderatorButtonText}>{isBg ? 'Изтрий събитието' : 'Delete event'}</ThemedText>
              </Pressable>
            </View>
          </View> : null}
          {(event.image_urls?.length ? event.image_urls : event.image_url ? [event.image_url] : []).length ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery} contentContainerStyle={styles.galleryContent}>
            {(event.image_urls?.length ? event.image_urls : event.image_url ? [event.image_url] : []).map((uri, index) => <View key={`${uri}-${index}`} style={styles.galleryItem}><Image source={{ uri }} style={styles.coverImage} contentFit="cover" transition={180} />{event.image_urls?.length > 1 ? <View style={styles.galleryCounter}><ThemedText type="smallBold" style={styles.galleryCounterText}>{index + 1} / {event.image_urls.length}</ThemedText></View> : null}</View>)}
          </ScrollView> : null}
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.sportBadge}><Ionicons name="fitness-outline" size={16} color="#D7F36A" /><ThemedText type="smallBold" style={styles.sportText}>{sports[category ?? '']?.[language] ?? category}</ThemedText></View>
              <View style={styles.statusBadge}><View style={styles.statusDot} /><ThemedText type="smallBold" style={styles.statusText}>{isBg ? 'ПРЕДСТОЯЩО' : 'UPCOMING'}</ThemedText></View>
            </View>
            <ThemedText type="subtitle" style={styles.title}>{event.title}</ThemedText>
            <View style={styles.dateRow}><Ionicons name="calendar-outline" size={18} color="#D7F36A" /><ThemedText type="default" style={styles.dateText}>{date} · {time}</ThemedText></View>
          </View>

          <Pressable onPress={() => router.push(`/athlete/${event.organizer_id}`)} accessibilityRole="button" style={styles.organizerRow}>
            {organizer?.avatar_url ? <Image source={{ uri: organizer.avatar_url }} style={styles.organizerAvatar} contentFit="cover" /> : <View style={styles.organizerAvatarFallback}><Ionicons name="person" size={17} color="#D7F36A" /></View>}
            <View style={styles.organizerCopy}><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Създадено от' : 'Created by'}</ThemedText><ThemedText type="smallBold">{organizer?.display_name?.trim() || (isBg ? 'Спортист' : 'Athlete')}</ThemedText></View>
            <Ionicons name="chevron-forward" size={17} color="#8F8798" />
          </Pressable>

          <View style={styles.infoGrid}>
            <InfoTile icon="location-outline" label={isBg ? 'СРЕЩА' : 'MEETING POINT'} value={event.venue || (isBg ? 'Мястото не е посочено' : 'Location not specified')} />
            <InfoTile icon="people-outline" label={isBg ? 'УЧАСТНИЦИ' : 'JOINED'} value={`${participantCount}/${event.participant_capacity}`} />
            <InfoTile icon="speedometer-outline" label={isBg ? 'НИВО' : 'LEVEL'} value={levels[event.skill_level]?.[language] ?? event.skill_level} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitleRow}><Ionicons name="map-outline" size={20} color="#D7F36A" /><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Точно място' : 'Exact location'}</ThemedText></View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.venue}>{event.venue || (isBg ? 'Маркер на картата' : 'Map pin')}</ThemedText>
            {event.latitude !== null && event.longitude !== null ? <>
              <EventLocationMap latitude={event.latitude} longitude={event.longitude} title={event.title} venue={event.venue ?? ''} />
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`)} style={styles.coordsRow}>
                <Ionicons name="navigate-outline" size={16} color="#D7F36A" />
                <ThemedText type="small" themeColor="textSecondary">{event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}</ThemedText>
                <ThemedText type="smallBold" style={styles.directions}>{isBg ? 'Упътвания ↗' : 'Directions ↗'}</ThemedText>
              </Pressable>
            </> : <View style={styles.noMap}><Ionicons name="map-outline" size={22} color="#ACB6AD" /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Организаторът не е добавил точка на картата.' : 'The organizer did not add a map pin.'}</ThemedText></View>}
          </View>

          {event.description ? <View style={styles.section}>
            <View style={styles.sectionTitleRow}><Ionicons name="document-text-outline" size={20} color="#D7F36A" /><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'За събитието' : 'About this event'}</ThemedText></View>
            <ThemedText type="default" style={styles.description}>{event.description}</ThemedText>
          </View> : null}
          {userId === event.organizer_id || joined ? <Pressable onPress={() => router.push(`/event/${event.id}/chat`)} accessibilityRole="button" style={styles.chatButton}>
            <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
            <View style={styles.chatButtonCopy}><ThemedText type="smallBold" style={styles.chatButtonTitle}>{isBg ? 'Отвори груповия чат' : 'Open event group chat'}</ThemedText><ThemedText type="small" style={styles.chatButtonSubtitle}>{isBg ? 'Уговорете детайлите с участниците' : 'Coordinate with the event group'}</ThemedText></View>
            <Ionicons name="arrow-forward" size={18} color="#E6D8FF" />
          </Pressable> : <Pressable onPress={() => void handleJoinEvent()} disabled={joining || participantCount >= event.participant_capacity} accessibilityRole="button" style={[styles.joinButton, (joining || participantCount >= event.participant_capacity) && styles.joinDisabled]}>
            {joining ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={userId ? 'person-add-outline' : 'log-in-outline'} size={19} color="#FFFFFF" />}
            <ThemedText type="smallBold" style={styles.joinButtonText}>{!userId ? (isBg ? 'Влез, за да се включиш' : 'Sign in to join') : participantCount >= event.participant_capacity ? (isBg ? 'Няма свободни места' : 'Event is full') : (isBg ? 'Присъедини се към събитието' : 'Join this event')}</ThemedText>
            {!joining ? <Ionicons name="arrow-forward" size={18} color="#FFFFFF" /> : null}
          </Pressable>}
          {!!actionError ? <ThemedText type="small" style={styles.actionError}>{actionError}</ThemedText> : null}
          <Pressable onPress={() => void shareEvent()} style={styles.shareButton} accessibilityRole="button">
            <Ionicons name="share-outline" size={18} color="#0B1110" />
            <ThemedText type="smallBold" style={styles.shareText}>{isBg ? 'Сподели събитието' : 'Share event'}</ThemedText>
          </Pressable>
          {!!shareMessage && <ThemedText type="small" themeColor="textSecondary" style={styles.shareMessage}>{shareMessage}</ThemedText>}
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoTile({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.infoTile}><Ionicons name={icon} size={19} color="#D7F36A" /><ThemedText type="smallBold" style={styles.infoLabel}>{label}</ThemedText><ThemedText type="small" style={styles.infoValue}>{value}</ThemedText></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1110' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 72, gap: 20 },
  backButton: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hero: { padding: 22, gap: 18, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(221,235,225,0.12)', backgroundColor: '#151D1B' },
  organizerRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(221,235,225,0.1)', backgroundColor: '#151D1B' },
  organizerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#202A26' },
  organizerAvatarFallback: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.15)' },
  organizerCopy: { flex: 1, gap: 2 },
  moderatorActions: { padding: 13, gap: 11, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(196,161,255,0.4)', backgroundColor: '#2C2038' },
  moderatorLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  moderatorLabel: { color: '#E9D8FF', fontSize: 10, letterSpacing: 1.1 },
  moderatorButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  moderatorManageButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#63417F' },
  moderatorDeleteButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#8E3346' },
  moderatorButtonText: { color: '#FFFFFF' },
  gallery: { width: '100%', borderRadius: 25 },
  galleryContent: { gap: 10 },
  galleryItem: { width: 780, maxWidth: '100%', height: 230, position: 'relative' },
  coverImage: { width: '100%', height: 230, borderRadius: 25, backgroundColor: '#202A26' },
  galleryCounter: { position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(13,10,20,0.78)' },
  galleryCounterText: { color: '#FFFFFF', fontSize: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sportBadge: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 11, borderRadius: 999, backgroundColor: 'rgba(215,243,106,0.1)' },
  sportText: { color: '#D7F36A' },
  statusBadge: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D7F36A' },
  statusText: { color: '#ACB6AD', fontSize: 10, letterSpacing: 1 },
  title: { fontSize: 32, lineHeight: 39 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dateText: { fontSize: 15 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoTile: { flexGrow: 1, flexBasis: '30%', minWidth: 140, padding: 15, gap: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(221,235,225,0.1)', backgroundColor: '#151D1B' },
  infoLabel: { fontSize: 10, letterSpacing: 1, color: '#ACB6AD' },
  infoValue: { color: '#FFFFFF' },
  section: { padding: 18, gap: 12, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(221,235,225,0.1)', backgroundColor: '#151D1B' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { fontSize: 17 },
  venue: { marginTop: -7 },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  directions: { marginLeft: 'auto', color: '#D7F36A' },
  noMap: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)' },
  description: { lineHeight: 25, color: '#E9E1F0' },
  shareButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#D7F36A' },
  chatButton: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(196,161,255,0.35)', backgroundColor: '#39264F' },
  chatButtonCopy: { flex: 1, gap: 3 },
  chatButtonTitle: { color: '#FFFFFF' },
  chatButtonSubtitle: { color: '#D5C7E3' },
  joinButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, borderRadius: 17, backgroundColor: '#7044A0' },
  joinButtonText: { color: '#FFFFFF', flex: 1, textAlign: 'center' },
  joinDisabled: { opacity: 0.55 },
  actionError: { color: '#FF8F8F' },
  shareText: { color: '#0B1110' },
  shareMessage: { textAlign: 'center' },
});
