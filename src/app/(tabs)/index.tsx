
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

import {
  EventCard,
  type SportEventCardData,
} from '@/components/event-card';
import { SocialPostCard } from '@/components/social-post-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
  SportHubBrandColors,
} from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { createSocialPost, joinEvent, leaveEvent, listEventParticipantCounts, listEvents, listJoinedEventIds, listSocialFeed, setPostLike, type SocialFeedPost } from '@/lib/supabase-services';
import { pickPhotos, uploadPhoto } from '@/lib/media';
import { supabase, type SportEvent } from '@/lib/supabase';

const sportKeyMap: Record<
  string,
  SportEventCardData['sportKey']
> = {
  cycling: 'cycling',
  running: 'running',
  fitness: 'fitness',
  football: 'football',
  basketball: 'basketball',
  tennis: 'tennis',
  volleyball: 'volleyball',
  hiking: 'hiking',
  group: 'group',
};

const sportLabels: Record<string, { bg: string; en: string }> = {
  cycling: { bg: 'Колело', en: 'Cycling' },
  running: { bg: 'Бягане', en: 'Running' },
  fitness: { bg: 'Фитнес', en: 'Fitness' },
  football: { bg: 'Футбол', en: 'Football' },
  basketball: { bg: 'Баскетбол', en: 'Basketball' },
  tennis: { bg: 'Тенис', en: 'Tennis' },
  volleyball: { bg: 'Волейбол', en: 'Volleyball' },
  hiking: { bg: 'Преходи', en: 'Hiking' },
  group: { bg: 'Групово', en: 'Group' },
};

function mapSportEvent(
  event: SportEvent,
  language: 'bg' | 'en',
  participantCount: number,
): SportEventCardData {
  const start = new Date(event.starts_at);
  const locale = language === 'bg' ? 'bg-BG' : 'en-GB';

  const sportLabel = sportLabels[event.sport_category];

  const levelLabels: Record<string, { bg: string; en: string }> = {
    beginner: { bg: 'Начинаещи', en: 'Beginner' },
    intermediate: { bg: 'Средно', en: 'Intermediate' },
    advanced: { bg: 'Напреднали', en: 'Advanced' },
    all: { bg: 'Всички', en: 'All levels' },
  };

  const level = event.skill_level
    ? levelLabels[event.skill_level]
    : undefined;

  return {
    id: event.id,
    imageUrl: event.image_urls?.[0] ?? event.image_url,
    imageUrls: event.image_urls?.length ? event.image_urls : event.image_url ? [event.image_url] : [],
    categoryKey: event.sport_category,
    title: event.title,
    sport:
      sportLabel?.[language] ??
      event.sport_category,
    sportKey: sportKeyMap[event.sport_category] ?? 'group',
    date: start.toLocaleDateString(locale),
    time: start.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }),
    place:
      event.venue ??
      (language === 'bg'
        ? 'Мястото не е посочено'
        : 'Location not specified'),
    level: level?.[language] ?? event.skill_level ?? (
      language === 'bg' ? 'Всички' : 'All levels'
    ),
    attendees:
      language === 'bg'
        ? `${participantCount}/${event.participant_capacity} участници`
        : `${participantCount}/${event.participant_capacity} participants`,
    isFull: participantCount >= event.participant_capacity,
  };
}

const filterOptions = [
  { key: 'all', bg: 'Всички', en: 'All' },
  { key: 'running', bg: 'Бягане', en: 'Running' },
  { key: 'cycling', bg: 'Колоездене', en: 'Cycling' },
  { key: 'fitness', bg: 'Фитнес', en: 'Fitness' },
  { key: 'football', bg: 'Футбол', en: 'Football' },
  { key: 'basketball', bg: 'Баскетбол', en: 'Basketball' },
  { key: 'tennis', bg: 'Тенис', en: 'Tennis' },
  { key: 'volleyball', bg: 'Волейбол', en: 'Volleyball' },
  { key: 'hiking', bg: 'Преходи', en: 'Hiking' },
  { key: 'group', bg: 'Групово', en: 'Group' },
] as const;

const postSportOptions = [
  { key: 'running', bg: 'Бягане', en: 'Running' },
  { key: 'cycling', bg: 'Колоездене', en: 'Cycling' },
  { key: 'fitness', bg: 'Фитнес', en: 'Fitness' },
  { key: 'football', bg: 'Футбол', en: 'Football' },
  { key: 'basketball', bg: 'Баскетбол', en: 'Basketball' },
  { key: 'tennis', bg: 'Тенис', en: 'Tennis' },
  { key: 'volleyball', bg: 'Волейбол', en: 'Volleyball' },
  { key: 'hiking', bg: 'Преходи', en: 'Hiking' },
] as const;

export default function HomeScreen() {
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [homeMode, setHomeMode] = useState<'feed' | 'events'>('feed');
  const [feedPosts, setFeedPosts] = useState<SocialFeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postSport, setPostSport] = useState<string | null>(null);
  const [postPhotos, setPostPhotos] = useState<ImagePickerAsset[]>([]);
  const [posting, setPosting] = useState(false);
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [joinedEventIds, setJoinedEventIds] = useState<string[]>([]);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');
  const [events, setEvents] = useState<SportEventCardData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const refreshFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError('');
    try {
      setFeedPosts(await listSocialFeed());
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : (language === 'bg' ? 'Публикациите не се заредиха.' : 'Could not load the community feed.'));
    } finally {
      setFeedLoading(false);
    }
  }, [language]);

  useFocusEffect(useCallback(() => { void refreshFeed(); }, [refreshFeed]));

  async function choosePostPhoto() {
    try {
      const remaining = 8 - postPhotos.length;
      if (remaining <= 0) return;
      const images = await pickPhotos(remaining);
      if (images.length) setPostPhotos((current) => [...current, ...images].slice(0, 8));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : (language === 'bg' ? 'Снимката не може да бъде отворена.' : 'Could not open the photo library.'));
    }
  }

  async function publishUpdate() {
    if (posting) return;
    if (!postBody.trim() && !postPhotos.length) return;
    setPosting(true);
    setFeedError('');
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push('/login');
        return;
      }
      const imageUrls = await Promise.all(postPhotos.map((photo) => uploadPhoto(photo.uri, data.user.id, 'posts', photo.mimeType)));
      await createSocialPost(postBody, imageUrls, postSport);
      setPostBody('');
      setPostPhotos([]);
      setPostSport(null);
      setHomeMode('feed');
      await refreshFeed();
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : (language === 'bg' ? 'Публикацията не беше споделена.' : 'Could not share your update.'));
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: SocialFeedPost) {
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    if (pendingLikeId) return;
    setPendingLikeId(post.id);
    setFeedPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, liked_by_me: !item.liked_by_me, like_count: Math.max(0, item.like_count + (item.liked_by_me ? -1 : 1)) }
      : item));
    try {
      await setPostLike(post.id, post.liked_by_me);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : (language === 'bg' ? 'Не успяхме да запазим харесването.' : 'Could not save your like.'));
      await refreshFeed();
    } finally {
      setPendingLikeId(null);
    }
  }

  // Зареждане на името на влезлия потребител.
  useEffect(() => {
    let active = true;

    const updateName = (user: {
      user_metadata?: Record<string, unknown>;
      email?: string;
    } | null) => {
      setIsSignedIn(Boolean(user));
      const name =
        user?.user_metadata?.display_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        '';

      if (active) {
        setDisplayName(String(name));
      }
    };

    supabase.auth.getUser().then(({ data, error }) => {
      if (active) {
        updateName(error ? null : data.user);
      }
    }).catch(() => {
      if (active) setDisplayName('');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateName(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Зареждане само на реалните събития от Supabase.
  useFocusEffect(useCallback(() => {
    let active = true;

    async function loadEvents() {
      try {
        setLoadingEvents(true);
        setEventsError(null);

        const data = await listEvents();
        const { data: authData } = await supabase.auth.getUser();
        const [joinedIds, participantCounts] = await Promise.all([
          authData.user ? listJoinedEventIds(authData.user.id) : Promise.resolve([]),
          listEventParticipantCounts(data.map((event) => event.id)),
        ]);

        if (active) {
          setEvents(data.map((event) => mapSportEvent(event, language, participantCounts[event.id] ?? 0)));
          setJoinedEventIds(joinedIds);
        }
      } catch (error) {
        if (active) {
          setEvents([]);
          setEventsError(
            error instanceof Error
              ? error.message
              : language === 'bg'
                ? 'Неуспешно зареждане на събитията.'
                : 'Could not load events.',
          );
        }
      } finally {
        if (active) setLoadingEvents(false);
      }
    }

    void loadEvents();

    return () => {
      active = false;
    };
  }, [language]));

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      const matchesFilter =
        selectedFilter === 'all' ||
        event.categoryKey === selectedFilter;

      const text =
        `${event.title} ${event.sport} ${event.place}`.toLowerCase();

      return matchesFilter && (!query || text.includes(query));
    });
  }, [events, searchQuery, selectedFilter]);

  const availableFilters = useMemo(() => {
    const known = new Set<string>(filterOptions.map(({ key }) => key));
    const custom = [...new Set(events.map((event) => event.categoryKey).filter((key) => key && !known.has(key)))];
    return [...filterOptions, ...custom.map((key) => ({ key, bg: key, en: key }))];
  }, [events]);

  const handleToggleJoin = async (eventId: string) => {
    if (pendingEventId) return;
    setPendingEventId(eventId);
    setJoinError('');
    try {
      if (joinedEventIds.includes(eventId)) {
        await leaveEvent(eventId);
        setJoinedEventIds((current) => current.filter((id) => id !== eventId));
      } else {
        await joinEvent(eventId);
        setJoinedEventIds((current) => [...current, eventId]);
      }
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : (language === 'bg' ? 'Не успяхме да запишем участието.' : 'Could not update your RSVP.'));
    } finally {
      setPendingEventId(null);
    }
  };

  const greeting = displayName
    ? `${language === 'bg' ? 'Хайде да се раздвижим,' : 'Ready to move,'} ${displayName}`
    : language === 'bg'
      ? 'Намери си компания за спорт.'
      : 'Find your people. Get moving.';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.wrapper}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View>
              <ThemedText type="smallBold" style={styles.brandText}>
                {t.brand}
              </ThemedText>
            </View>

            <View style={styles.languageToggle}>
              {(['bg', 'en'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setLanguage(option)}
                  style={[
                    styles.langButton,
                    language === option && styles.langButtonActive,
                  ]}
                >
                  <ThemedText type="smallBold" style={styles.langText}>
                    {option === 'bg' ? 'BG' : 'EN'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <ThemedText type="subtitle" style={styles.title}>
            {greeting}
          </ThemedText>

          <Pressable
            onPress={() => { setHomeMode('events'); setSelectedFilter('all'); setSearchQuery(''); }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.spotlight, pressed && styles.spotlightPressed]}
          >
            <View style={styles.spotlightGlow} />
            <View style={styles.spotlightCopy}>
              <View style={styles.liveEyebrow}><View style={styles.liveDot} /><ThemedText type="smallBold" style={styles.liveText}>{language === 'bg' ? 'В ДВИЖЕНИЕ' : 'MAKE IT HAPPEN'}</ThemedText></View>
              <ThemedText type="subtitle" style={styles.spotlightTitle}>{language === 'bg' ? 'Следващата ти тренировка е тук.' : 'Your next session starts here.'}</ThemedText>
              <ThemedText type="small" style={styles.spotlightMeta}>{events.length} {language === 'bg' ? (events.length === 1 ? 'предстоящо събитие' : 'предстоящи събития') : (events.length === 1 ? 'upcoming session' : 'upcoming sessions')}</ThemedText>
              <View style={styles.spotlightCta}><ThemedText type="smallBold" style={styles.spotlightCtaText}>{language === 'bg' ? 'Намери събитие' : 'Find a session'}</ThemedText><Ionicons name="arrow-forward" size={16} color="#0B1110" /></View>
            </View>
            <View style={styles.spotlightArt}><View style={styles.artDisc} /><Ionicons name="fitness" size={50} color="#21182C" /><View style={styles.artSpark}><Ionicons name="flash" size={16} color="#21182C" /></View></View>
          </Pressable>

          <View style={styles.quickActions}>
            <Pressable onPress={() => router.push('/create')} accessibilityRole="button" style={styles.quickAction}><View style={styles.quickIcon}><Ionicons name="add" size={19} color="#C9F36A" /></View><ThemedText type="smallBold" style={styles.quickLabel}>{language === 'bg' ? 'Създай' : 'Create'}</ThemedText></Pressable>
            <Pressable onPress={() => router.push('/map')} accessibilityRole="button" style={styles.quickAction}><View style={styles.quickIcon}><Ionicons name="map-outline" size={18} color="#D7F36A" /></View><ThemedText type="smallBold" style={styles.quickLabel}>{language === 'bg' ? 'Карта' : 'Map'}</ThemedText></Pressable>
            <Pressable onPress={() => router.push('/workout')} accessibilityRole="button" style={styles.quickAction}><View style={styles.quickIcon}><Ionicons name="barbell-outline" size={18} color="#FF9B70" /></View><ThemedText type="smallBold" style={styles.quickLabel}>{language === 'bg' ? 'Дневник' : 'Training log'}</ThemedText></Pressable>
          </View>

          <View style={styles.modeSwitch}>
            <Pressable onPress={() => setHomeMode('feed')} accessibilityRole="button" accessibilityState={{ selected: homeMode === 'feed' }} style={[styles.modeButton, homeMode === 'feed' && styles.modeButtonActive]}>
              <Ionicons name="people-outline" size={17} color={homeMode === 'feed' ? '#0B1110' : '#D7F36A'} />
              <ThemedText type="smallBold" style={homeMode === 'feed' ? styles.modeButtonTextActive : undefined}>{language === 'bg' ? 'Общност' : 'Community'}</ThemedText>
            </Pressable>
            <Pressable onPress={() => setHomeMode('events')} accessibilityRole="button" accessibilityState={{ selected: homeMode === 'events' }} style={[styles.modeButton, homeMode === 'events' && styles.modeButtonActive]}>
              <Ionicons name="calendar-outline" size={17} color={homeMode === 'events' ? '#0B1110' : '#D7F36A'} />
              <ThemedText type="smallBold" style={homeMode === 'events' ? styles.modeButtonTextActive : undefined}>{language === 'bg' ? 'Събития' : 'Events'}</ThemedText>
            </Pressable>
          </View>

          {homeMode === 'feed' ? <>
            <View style={styles.composer}>
              <View style={styles.composerTop}>
                <View style={styles.composerAvatar}><ThemedText type="smallBold" style={styles.composerInitial}>{displayName.trim().charAt(0).toUpperCase() || 'S'}</ThemedText></View>
                <TextInput value={postBody} onChangeText={setPostBody} editable={isSignedIn && !posting} placeholder={isSignedIn ? (language === 'bg' ? 'Как мина тренировката?' : 'Share a training moment…') : (language === 'bg' ? 'Влез, за да споделиш с общността' : 'Sign in to share with the community')} placeholderTextColor="#ACB6AD" style={styles.composerInput} multiline maxLength={2000} />
              </View>
              {postPhotos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postPhotoStrip}>{postPhotos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.postPhotoWrap}><Image source={{ uri: photo.uri }} style={styles.postPhotoPreview} contentFit="cover" /><Pressable accessibilityRole="button" accessibilityLabel={language === 'bg' ? 'Премахни снимка' : 'Remove photo'} onPress={() => setPostPhotos((current) => current.filter((_, i) => i !== index))} style={styles.removePostPhoto}><Ionicons name="close" size={16} color="#FFFFFF" /></Pressable>{index === 0 ? <View style={styles.postCoverBadge}><ThemedText type="smallBold" style={styles.postCoverBadgeText}>{language === 'bg' ? 'Корица' : 'Cover'}</ThemedText></View> : null}</View>)}</ScrollView> : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postSportRow}>
                {postSportOptions.map((sport) => <Pressable key={sport.key} onPress={() => setPostSport((current) => current === sport.key ? null : sport.key)} accessibilityRole="button" accessibilityState={{ selected: postSport === sport.key }} style={[styles.postSportChip, postSport === sport.key && styles.postSportChipActive]}><ThemedText type="smallBold" style={postSport === sport.key ? styles.postSportChipTextActive : styles.postSportChipText}>{language === 'bg' ? sport.bg : sport.en}</ThemedText></Pressable>)}
              </ScrollView>
              <View style={styles.composerActions}>
                <Pressable onPress={isSignedIn ? () => void choosePostPhoto() : () => router.push('/login')} accessibilityRole="button" style={styles.photoAction}><Ionicons name="images-outline" size={19} color="#D7F36A" /><ThemedText type="smallBold" style={styles.photoActionText}>{language === 'bg' ? `Снимки ${postPhotos.length}/8` : `Photos ${postPhotos.length}/8`}</ThemedText></Pressable>
                <Pressable onPress={isSignedIn ? () => void publishUpdate() : () => router.push('/login')} disabled={posting || (isSignedIn && !postBody.trim() && !postPhotos.length)} accessibilityRole="button" style={[styles.publishButton, (posting || (isSignedIn && !postBody.trim() && !postPhotos.length)) && styles.publishDisabled]}>
                  {posting ? <ActivityIndicator color="#0B1110" size="small" /> : <><Ionicons name={isSignedIn ? 'paper-plane-outline' : 'log-in-outline'} size={16} color="#0B1110" /><ThemedText type="smallBold" style={styles.publishText}>{isSignedIn ? (language === 'bg' ? 'Сподели' : 'Post') : (language === 'bg' ? 'Вход' : 'Sign in')}</ThemedText></>}
                </Pressable>
              </View>
            </View>
            {!!feedError ? <ThemedView type="backgroundElement" style={styles.emptyState}><ThemedText type="small" style={styles.joinError}>{feedError}</ThemedText></ThemedView> : null}
            {feedLoading ? <View style={styles.feedLoading}><ActivityIndicator color={SportHubBrandColors.accent} /><ThemedText type="small" themeColor="textSecondary">{language === 'bg' ? 'Зареждаме общността…' : 'Loading community…'}</ThemedText></View> : null}
            {!feedLoading && !feedError && feedPosts.length === 0 ? <ThemedView type="backgroundElement" style={styles.emptyState}><Ionicons name="sparkles-outline" size={24} color="#D7F36A" /><ThemedText type="smallBold">{language === 'bg' ? 'Бъди първият, който споделя' : 'Be the first to share'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{language === 'bg' ? 'Публикувай снимка или разкажи за тренировката си.' : 'Post a photo or tell the community about your training.'}</ThemedText></ThemedView> : null}
            {!feedLoading ? feedPosts.map((post) => <SocialPostCard key={post.id} post={post} likePending={pendingLikeId === post.id} onLike={(item) => void toggleLike(item)} onComments={(item) => router.push(`/post/${item.id}`)} />) : null}
          </> : <>

          <View style={styles.searchWrap}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t.search}
              placeholderTextColor="#ACB6AD"
              style={styles.searchInput}
            />
          </View>

          <View style={styles.filterRow}>
            {availableFilters.map(({ key, ...label }) => {
              const filterKey = key ?? 'all';
              const isActive = selectedFilter === filterKey;

              return (
                <Pressable
                  key={filterKey}
                  onPress={() => setSelectedFilter(filterKey)}
                  style={[
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    themeColor={isActive ? 'text' : 'textSecondary'}
                    style={styles.filterText}
                  >
                  {language === 'bg' ? label.bg : label.en}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {loadingEvents && (
            <ThemedText type="small" themeColor="textSecondary">
              {language === 'bg'
                ? 'Зареждане на събитията...'
                : 'Loading events...'}
            </ThemedText>
          )}

          {eventsError && (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="smallBold">
                {language === 'bg'
                  ? 'Неуспешно зареждане от Supabase'
                  : 'Could not load events from Supabase'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {eventsError}
              </ThemedText>
            </ThemedView>
          )}

          {!!joinError && <ThemedView type="backgroundElement" style={styles.emptyState}><ThemedText type="small" style={styles.joinError}>{joinError}</ThemedText></ThemedView>}

          {!loadingEvents && !eventsError && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {filteredEvents.length}{' '}
                {language === 'bg' ? 'събития' : 'events'}
              </ThemedText>

              {filteredEvents.length === 0 ? (
                <ThemedView
                  type="backgroundElement"
                  style={styles.emptyState}
                >
                  <ThemedText type="smallBold">
                    {language === 'bg'
                      ? 'Няма намерени събития'
                      : 'No events found'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {language === 'bg'
                      ? 'Опитай с друг филтър или потърси по друга дума. Новите събития ще се появят тук, след като бъдат създадени.'
                      : 'Try another filter or search term. Newly created events will appear here.'}
                  </ThemedText>
                </ThemedView>
              ) : (
                filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    joined={joinedEventIds.includes(event.id)}
                    pending={pendingEventId === event.id}
                    onToggleJoin={handleToggleJoin}
                    onOpen={(eventId) => router.push(`/event/${eventId}`)}
                  />
                ))
              )}
            </>
          )}
          </>}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1110',
  },
  wrapper: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: BottomTabInset + 88,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandText: {
    letterSpacing: 0.4,
  },
  languageToggle: {
    flexDirection: 'row',
    gap: Spacing.one,
    backgroundColor: '#151D1B',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2D3932',
  },
  langButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  langButtonActive: {
    backgroundColor: SportHubBrandColors.accent,
  },
  langText: {
    color: '#0B1110',
  },
  title: {
    marginTop: 2,
    fontSize: 27,
    lineHeight: 34,
  },
  spotlight: { minHeight: 220, position: 'relative', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', padding: 20, borderRadius: 26, backgroundColor: '#D7F36A' },
  spotlightPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  spotlightGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -78, top: -84, backgroundColor: 'rgba(255,255,255,0.28)' },
  spotlightCopy: { zIndex: 1, flex: 1, alignItems: 'flex-start', gap: 9, paddingRight: 4 },
  liveEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6A9E1C' },
  liveText: { color: '#30223F', letterSpacing: 1.3, fontSize: 10 },
  spotlightTitle: { maxWidth: 245, color: '#17111F', fontSize: 23, lineHeight: 28 },
  spotlightMeta: { color: '#453451', fontSize: 12 },
  spotlightCta: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 14, borderRadius: 99, backgroundColor: '#C9F36A' },
  spotlightCtaText: { color: '#17111F', fontSize: 12 },
  spotlightArt: { width: 94, height: 132, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
  artDisc: { position: 'absolute', width: 105, height: 105, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.3)' },
  artSpark: { position: 'absolute', right: 2, top: 11, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C9F36A', transform: [{ rotate: '12deg' }] },
  quickActions: { flexDirection: 'row', gap: 9 },
  quickAction: { flex: 1, minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#2D3932' },
  quickIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  quickLabel: { fontSize: 12 },
  modeSwitch: { flexDirection: 'row', gap: 8, padding: 5, borderRadius: 19, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#2D3932' },
  modeButton: { minHeight: 43, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingHorizontal: 10 },
  modeButtonActive: { backgroundColor: '#D7F36A' },
  modeButtonTextActive: { color: '#0B1110' },
  composer: { gap: 12, padding: 15, borderRadius: 22, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#2D3932' },
  composerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  composerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.18)' },
  composerInitial: { color: '#D7F36A' },
  composerInput: { minHeight: 55, flex: 1, paddingTop: 8, color: '#FFFFFF', fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  composerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2D3932', paddingTop: 11 },
  photoAction: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 5 },
  photoActionText: { color: '#D7F36A' },
  publishButton: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, paddingHorizontal: 15, backgroundColor: '#D7F36A' },
  publishDisabled: { opacity: 0.5 },
  publishText: { color: '#0B1110' },
  postPhotoStrip: { gap: 9, paddingVertical: 2 },
  postPhotoWrap: { width: 160, height: 142, position: 'relative' },
  postSportRow: { gap: 7, paddingVertical: 2 },
  postSportChip: { minHeight: 32, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#202A26', borderWidth: 1, borderColor: '#2D3932' },
  postSportChipActive: { backgroundColor: '#D7F36A', borderColor: '#D7F36A' },
  postSportChipText: { color: '#D8E0D5', fontSize: 11 },
  postSportChipTextActive: { color: '#0B1110', fontSize: 11 },
  postPhotoPreview: { width: 160, height: 142, borderRadius: 15, backgroundColor: '#202A26' },
  removePostPhoto: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,10,20,0.78)' },
  postCoverBadge: { position: 'absolute', left: 8, bottom: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(13,10,20,0.78)' },
  postCoverBadgeText: { color: '#FFFFFF', fontSize: 10 },
  feedLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 22 },
  searchWrap: {
    marginTop: Spacing.one,
  },
  searchInput: {
    backgroundColor: '#151D1B',
    borderWidth: 1,
    borderColor: '#2D3932',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#151D1B',
    borderWidth: 1,
    borderColor: '#2D3932',
  },
  filterChipActive: {
    backgroundColor: '#D7F36A',
    borderColor: '#D7F36A',
  },
  filterText: {
    lineHeight: 18,
  },
  emptyState: {
    borderRadius: 24,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2D3932',
    gap: Spacing.one,
  },
  joinError: { color: '#FF8F8F' },
});
