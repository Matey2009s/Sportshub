import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SportHubBrandColors, Spacing } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';

export type SportEventCardData = {
  id: string;
  title: string;
  sport: string;
  sportKey: 'cycling' | 'running' | 'fitness' | 'football' | 'basketball' | 'tennis' | 'volleyball' | 'hiking' | 'group';
  date: string;
  time: string;
  place: string;
  level: string;
  attendees: string;
  isFull?: boolean;
  imageUrl?: string | null;
  imageUrls?: string[];
  categoryKey?: string;
};

export function EventCard({
  event,
  joined,
  pending = false,
  onToggleJoin,
  onOpen,
}: {
  event: SportEventCardData;
  joined: boolean;
  pending?: boolean;
  onToggleJoin: (eventId: string) => void;
  onOpen: (eventId: string) => void;
}) {
  const { language } = useLanguage();
  const iconName = {
    cycling: 'bicycle', running: 'walk', fitness: 'fitness', football: 'football', basketball: 'basketball',
    tennis: 'tennisball', volleyball: 'volleyball', hiking: 'trail-sign', group: 'people',
  }[event.sportKey] as keyof typeof Ionicons.glyphMap;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable onPress={() => onOpen(event.id)} accessibilityRole="button" accessibilityLabel={`${event.title}, ${event.place}`} style={({ pressed }) => [styles.details, pressed && styles.pressed]}>
        {event.imageUrl ? <View style={styles.coverWrap}><Image source={{ uri: event.imageUrl }} style={styles.coverImage} contentFit="cover" transition={180} />{(event.imageUrls?.length ?? 0) > 1 ? <View style={styles.photoCount}><Ionicons name="images-outline" size={13} color="#FFFFFF" /><ThemedText type="smallBold" style={styles.photoCountText}>{event.imageUrls!.length}</ThemedText></View> : null}</View> : null}
        <View style={styles.headerRow}>
          <View style={styles.badgeWrap}>
            <View style={styles.iconBadge}><Ionicons name={iconName} size={18} color={SportHubBrandColors.accent} /></View>
            <ThemedText type="smallBold">{event.sport}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.date}>{event.date} · {event.time}</ThemedText>
        </View>
        <ThemedText type="smallBold" style={styles.eventTitle}>{event.title}</ThemedText>
        <View style={styles.placeRow}>
          <Ionicons name="location-outline" size={15} color="#ACB6AD" />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.place}>{event.place}</ThemedText>
        </View>
        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary">{event.level}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{event.attendees}</ThemedText>
        </View>
        <View style={styles.moreRow}><ThemedText type="smallBold" style={styles.moreText}>{language === 'bg' ? 'Виж подробностите' : 'View details'}</ThemedText><Ionicons name="arrow-forward" size={15} color="#D7F36A" /></View>
      </Pressable>
      <Pressable onPress={() => onToggleJoin(event.id)} disabled={pending || (Boolean(event.isFull) && !joined)} style={[styles.button, joined && styles.buttonJoined, event.isFull && !joined && styles.buttonFull, pending && styles.pending]} accessibilityRole="button">
        {pending ? <ActivityIndicator color={joined ? '#FFFFFF' : '#0B1110'} /> : <ThemedText type="smallBold" style={joined ? styles.joinedText : event.isFull ? styles.buttonFullText : styles.buttonText}>{joined ? (language === 'bg' ? 'Записан си · откажи' : 'Joined · leave') : event.isFull ? (language === 'bg' ? 'Няма свободни места' : 'Event full') : (language === 'bg' ? 'Ще дойда' : 'Join event')}</ThemedText>}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: Spacing.three, gap: 14, borderWidth: 1, borderColor: '#2D3932' },
  details: { gap: 11 },
  coverImage: { width: '100%', height: 168, borderRadius: 17, backgroundColor: '#202A26' },
  coverWrap: { position: 'relative' },
  photoCount: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(13,10,20,0.78)' },
  photoCountText: { color: '#FFFFFF', fontSize: 12 },
  pressed: { opacity: 0.78 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  badgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconBadge: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.12)' },
  date: { fontSize: 12, textAlign: 'right' },
  eventTitle: { fontSize: 20, lineHeight: 27 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  place: { flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center', paddingTop: 4 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  moreText: { color: '#D7F36A', fontSize: 13 },
  button: { borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#D7F36A' },
  buttonText: { color: '#0B1110' },
  joinedText: { color: '#0B1110' },
  buttonJoined: { backgroundColor: '#BFE95D' },
  buttonFull: { backgroundColor: '#2D3932' },
  buttonFullText: { color: '#FFFFFF' },
  pending: { opacity: 0.7 },
});
