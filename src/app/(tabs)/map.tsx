import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import SportHubMap, { type SportMapEvent } from '@/components/sporthub-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, SportHubBrandColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listEvents } from '@/lib/supabase-services';
import type { SportEvent } from '@/lib/supabase';

type Coordinates = { latitude: number; longitude: number };
type NearbyEvent = SportMapEvent & { distanceMeters: number | null };

function toMapEvent(event: SportEvent): SportMapEvent | null {
  if (event.latitude === null || event.longitude === null) return null;
  return { id: event.id, title: event.title, venue: event.venue, latitude: event.latitude, longitude: event.longitude };
}

function distanceMeters(from: Coordinates, to: Coordinates) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

export default function MapScreen() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const isBg = language === 'bg';
  const [events, setEvents] = useState<SportMapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationMessage, setLocationMessage] = useState('');

  const requestLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationMessage('');
    try {
      // On web, Expo's permission query depends on the Permissions API, which
      // is missing in some browsers. Calling geolocation directly both opens
      // the browser's native permission prompt and returns the actual position.
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          setLocation(null);
          setLocationMessage(isBg ? 'Този браузър не поддържа местоположение.' : 'This browser does not support location.');
          return;
        }
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            maximumAge: 30_000,
            timeout: 20_000,
          });
        });
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        return;
      }

      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission = currentPermission.status === 'granted'
        ? currentPermission
        : currentPermission.status === 'undetermined'
          ? await Location.requestForegroundPermissionsAsync()
          : currentPermission;
      if (permission.status !== 'granted') {
        setLocation(null);
        setLocationMessage(isBg ? 'Достъпът до местоположение е изключен. Можеш да го включиш от настройките на телефона.' : 'Location access is off. You can enable it in your phone settings.');
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocation(null);
        setLocationMessage(isBg ? 'Включи услугите за местоположение в настройките на телефона.' : 'Turn on Location Services in your phone settings.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (reason) {
      setLocation(null);
      const code = typeof reason === 'object' && reason !== null && 'code' in reason ? Number(reason.code) : 0;
      if (code === 1) {
        setLocationMessage(isBg ? 'Достъпът е отказан. Разреши местоположението от настройките на браузъра за localhost.' : 'Location access was denied. Allow it in your browser settings for localhost.');
      } else if (code === 2) {
        setLocationMessage(isBg ? 'Устройството не успя да определи местоположението. Провери GPS и опитай отново.' : 'Your device could not determine its location. Check GPS and try again.');
      } else if (code === 3) {
        setLocationMessage(isBg ? 'Определянето на местоположението отне твърде дълго. Опитай отново.' : 'Location lookup timed out. Please try again.');
      } else {
        setLocationMessage(isBg ? 'Не успяхме да намерим местоположението. Провери настройките и опитай отново.' : 'Could not get your location. Check settings and try again.');
      }
    } finally {
      setLocationLoading(false);
    }
  }, [isBg]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    listEvents()
      .then((records) => { if (active) { setEvents(records.map(toMapEvent).filter((event): event is SportMapEvent => event !== null)); setError(''); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : (isBg ? 'Събитията не се заредиха.' : 'Could not load events.')); })
      .finally(() => { if (active) setLoading(false); });
    void requestLocation();
    return () => { active = false; };
  }, [isBg, requestLocation]));

  const sortedEvents = useMemo<NearbyEvent[]>(() => events
    .map((event) => ({ ...event, distanceMeters: location ? distanceMeters(location, event) : null }))
    .sort((a, b) => a.distanceMeters === null || b.distanceMeters === null ? 0 : a.distanceMeters - b.distanceMeters), [events, location]);
  const nearby = sortedEvents.filter((event) => event.distanceMeters !== null && event.distanceMeters <= 2000);
  const farther = sortedEvents.filter((event) => event.distanceMeters === null || event.distanceMeters > 2000);

  const renderEvent = (event: NearbyEvent) => (
    <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}`)} style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.pinIcon}><Ionicons name="location" size={18} color="#D7F36A" /></View>
      <View style={styles.eventCopy}>
        <ThemedText type="smallBold" numberOfLines={1}>{event.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{event.venue || `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`}</ThemedText>
      </View>
      {event.distanceMeters !== null ? <View style={[styles.distanceBadge, event.distanceMeters <= 2000 && styles.nearbyBadge]}><ThemedText type="smallBold" style={styles.distanceText}>{formatDistance(event.distanceMeters)}</ThemedText></View> : null}
      <Ionicons name="chevron-forward" size={17} color="#ACB6AD" />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <ThemedText type="smallBold" style={styles.eyebrow}>{isBg ? 'НАБЛИЗО ДО ТЕБ' : 'AROUND YOU'}</ThemedText>
          <ThemedText type="subtitle" style={styles.title}>{t.map}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Намери спортни събития и виж точното им място.' : 'Find sports events and see exactly where they are.'}</ThemedText>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationIcon}><Ionicons name={location ? 'navigate' : 'location-outline'} size={20} color="#D7F36A" /></View>
          <View style={styles.locationCopy}>
            <ThemedText type="smallBold">{location ? (isBg ? 'Местоположението е включено' : 'Location is on') : (isBg ? 'Включи местоположението' : 'Turn on location')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{location ? (isBg ? 'Събитията са подредени по близост.' : 'Events are sorted by distance.') : (locationMessage || (isBg ? 'Ще покажем събитията в радиус 2 км.' : 'We’ll show events within a 2 km radius.'))}</ThemedText>
          </View>
          {locationLoading ? <ActivityIndicator size="small" color="#D7F36A" /> : null}
        </View>

        <View style={styles.mapCard}><SportHubMap events={events} userLocation={location} detailsLabel={isBg ? 'Виж подробности' : 'View details'} /></View>

        {loading ? <View style={styles.state}><ActivityIndicator color={SportHubBrandColors.accent} /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждаме събитията…' : 'Loading events…'}</ThemedText></View> : null}
        {!!error ? <ThemedView type="backgroundElement" style={styles.empty}><ThemedText type="small">{error}</ThemedText></ThemedView> : null}
        {!loading && !error && sortedEvents.length === 0 ? <ThemedView type="backgroundElement" style={styles.empty}><Ionicons name="location-outline" size={22} color="#ACB6AD" /><ThemedText type="smallBold">{isBg ? 'Все още няма събития с локация' : 'No events with a location yet'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Създай събитие и избери място на картата.' : 'Create an event and select a point on the map.'}</ThemedText></ThemedView> : null}
        {!loading && !error && location ? <>
          <View style={styles.listHeading}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'До 2 км от теб' : 'Within 2 km'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{nearby.length}</ThemedText></View>
          {nearby.length ? nearby.map(renderEvent) : <ThemedText type="small" themeColor="textSecondary" style={styles.noResults}>{isBg ? 'Няма събития в радиус 2 км засега.' : 'No events within 2 km yet.'}</ThemedText>}
          <View style={styles.listHeading}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'По-далеч от 2 км' : 'Farther than 2 km'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{farther.length}</ThemedText></View>
          {farther.map(renderEvent)}
        </> : null}
        {!loading && !error && !location ? <>
          <View style={styles.listHeading}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Събития с локация' : 'Events with a location'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{sortedEvents.length}</ThemedText></View>
          {sortedEvents.map(renderEvent)}
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1110' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: Spacing.four, paddingTop: 24, paddingBottom: 220, gap: 16 },
  heading: { gap: 7, marginBottom: 3 },
  eyebrow: { color: '#D7F36A', fontSize: 11, letterSpacing: 1.5 },
  title: { fontSize: 34, lineHeight: 40 },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#151D1B' },
  locationIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.1)' },
  locationCopy: { flex: 1, gap: 3 },
  mapCard: { minHeight: 350, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#2D3932' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  sectionTitle: { fontSize: 18 },
  state: { alignItems: 'center', padding: 24, gap: 10 },
  empty: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2D3932', gap: 8, alignItems: 'flex-start' },
  noResults: { paddingVertical: 10 },
  eventRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(221,235,225,0.1)', backgroundColor: '#151D1B' },
  pinIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.1)' },
  eventCopy: { flex: 1, gap: 3 },
  distanceBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.08)' },
  nearbyBadge: { backgroundColor: 'rgba(215,243,106,0.14)' },
  distanceText: { color: '#D7F36A', fontSize: 11 },
  pressed: { opacity: 0.78 },
});
