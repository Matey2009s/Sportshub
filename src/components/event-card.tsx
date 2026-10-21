import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SportHubBrandColors, Spacing } from '@/constants/theme';

export type SportEventCardData = {
  id: string;
  title: string;
  sport: string;
  sportKey: 'cycling' | 'running' | 'fitness' | 'group';
  date: string;
  time: string;
  place: string;
  level: string;
  attendees: string;
  distance?: string;
};

export function EventCard({
  event,
  joined,
  onToggleJoin,
}: {
  event: SportEventCardData;
  joined: boolean;
  onToggleJoin: (eventId: string) => void;
}) {
  const iconName = {
    cycling: 'bicycle',
    running: 'walk',
    fitness: 'fitness',
    group: 'people',
  }[event.sportKey] as keyof typeof Ionicons.glyphMap;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badgeWrap}>
          <View style={styles.iconBadge}>
            <Ionicons name={iconName} size={18} color={SportHubBrandColors.accent} />
          </View>
          <ThemedText type="smallBold">{event.sport}</ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {event.date} • {event.time}
        </ThemedText>
      </View>

      <ThemedText type="smallBold" style={styles.eventTitle}>{event.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {event.place}
        {event.distance ? ` • ${event.distance}` : ''}
      </ThemedText>

      <View style={styles.metaRow}>
        <ThemedText type="small">Ниво: {event.level}</ThemedText>
        <ThemedText type="small">{event.attendees}</ThemedText>
      </View>

      <Pressable onPress={() => onToggleJoin(event.id)} style={[styles.button, joined && styles.buttonJoined]}>
        <ThemedText type="smallBold" themeColor={joined ? 'background' : 'text'}>
          {joined ? 'Записан си' : 'Ще дойда'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#29332B',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    alignItems: 'center',
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184, 255, 77, 0.12)',
  },
  eventTitle: {
    fontSize: 20,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    alignItems: 'center',
  },
  button: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#B8FF4D',
    marginTop: Spacing.one,
  },
  buttonJoined: {
    backgroundColor: '#70E69A',
  },
});
