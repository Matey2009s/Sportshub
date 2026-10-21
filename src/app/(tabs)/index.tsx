
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  EventCard,
  type SportEventCardData,
} from '@/components/event-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
  SportHubBrandColors,
} from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { listEvents } from '@/lib/supabase-services';
import { supabase, type SportEvent } from '@/lib/supabase';

const sportKeyMap: Record<
  string,
  SportEventCardData['sportKey']
> = {
  cycling: 'cycling',
  running: 'running',
  fitness: 'fitness',
  group: 'group',
};

const sportLabels: Record<string, { bg: string; en: string }> = {
  cycling: { bg: 'Колело', en: 'Cycling' },
  running: { bg: 'Бягане', en: 'Running' },
  fitness: { bg: 'Фитнес', en: 'Fitness' },
  group: { bg: 'Групово', en: 'Group' },
};

function mapSportEvent(
  event: SportEvent,
  language: 'bg' | 'en',
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
        ? `0/${event.participant_capacity} участници`
        : `0/${event.participant_capacity} participants`,
  };
}

const filterOptions = [
  { key: 'all', label: 'all' },
  { key: 'running', label: 'running' },
  { key: 'cycling', label: 'cycling' },
  { key: 'fitness', label: 'fitness' },
  { key: 'group', label: 'group' },
] as const;

export default function HomeScreen() {
  const { t, language, setLanguage } = useLanguage();

  const [displayName, setDisplayName] = useState('');
  const [selectedFilter, setSelectedFilter] =
    useState<(typeof filterOptions)[number]['key']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [joinedEventIds, setJoinedEventIds] = useState<string[]>([]);
  const [events, setEvents] = useState<SportEventCardData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Зареждане на името на влезлия потребител.
  useEffect(() => {
    let active = true;

    const updateName = (user: {
      user_metadata?: Record<string, unknown>;
      email?: string;
    } | null) => {
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
  useEffect(() => {
    let active = true;

    async function loadEvents() {
      try {
        setLoadingEvents(true);
        setEventsError(null);

        const data = await listEvents();

        if (active) {
          setEvents(data.map((event) => mapSportEvent(event, language)));
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
  }, [language]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      const matchesFilter =
        selectedFilter === 'all' ||
        event.sportKey === selectedFilter;

      const text =
        `${event.title} ${event.sport} ${event.place}`.toLowerCase();

      return matchesFilter && (!query || text.includes(query));
    });
  }, [events, searchQuery, selectedFilter]);

  // Това засега е само визуално състояние на бутона.
  // Записването в event_participants се прави отделно през Supabase.
  const handleToggleJoin = (eventId: string) => {
    setJoinedEventIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  };

  const greeting = displayName
    ? `${language === 'bg' ? 'Здравей' : 'Hi'}, ${displayName}`
    : language === 'bg'
      ? 'Добре дошъл в SportHub!'
      : 'Welcome to SportHub!';

  return (
    <ThemedView style={styles.container}>
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
              <ThemedText type="small" themeColor="textSecondary">
                {t.tagline}
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

          <ThemedText type="small" themeColor="textSecondary">
            {t.discover}
          </ThemedText>

          <View style={styles.searchWrap}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t.search}
              placeholderTextColor="#A1ADA4"
              style={styles.searchInput}
            />
          </View>

          <View style={styles.filterRow}>
            {filterOptions.map(({ key, label }) => {
              const isActive = selectedFilter === key;

              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedFilter(key)}
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
                    {t[label]}
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
                    onToggleJoin={handleToggleJoin}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080B09',
  },
  wrapper: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: BottomTabInset + Spacing.three,
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
    backgroundColor: '#141915',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: '#29332B',
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
    color: '#080B09',
  },
  title: {
    marginTop: Spacing.two,
  },
  searchWrap: {
    marginTop: Spacing.one,
  },
  searchInput: {
    backgroundColor: '#141915',
    borderWidth: 1,
    borderColor: '#29332B',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F4F7F4',
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
    backgroundColor: '#141915',
    borderWidth: 1,
    borderColor: '#29332B',
  },
  filterChipActive: {
    backgroundColor: '#B8FF4D',
    borderColor: '#B8FF4D',
  },
  filterText: {
    lineHeight: 18,
  },
  emptyState: {
    borderRadius: 24,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#29332B',
    gap: Spacing.one,
  },
});
