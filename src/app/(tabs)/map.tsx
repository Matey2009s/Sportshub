import { ScrollView, StyleSheet, View } from 'react-native';

import SportHubMap from '@/components/sporthub-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';

const demoMarkers = [
  { name: 'Витоша', time: '17:00', sport: 'Колело', distance: '20 km' },
  { name: 'Люлин', time: '18:30', sport: 'Бягане', distance: '8 km' },
  { name: 'Симеоново', time: '19:00', sport: 'Фитнес', distance: '45 min' },
];

export default function MapScreen() {
  const { t } = useLanguage();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="subtitle" style={styles.title}>{t.map}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.mapCard}>
          <SportHubMap />
        </ThemedView>

        <ThemedText type="smallBold" style={styles.sectionTitle}>{t.nearbyEvents}</ThemedText>

        {demoMarkers.map((marker) => (
          <ThemedView key={marker.name} type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{marker.sport}</ThemedText>
            <ThemedText style={styles.cardLocation}>{marker.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {marker.time} • {marker.distance}
            </ThemedText>
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  title: {
    marginTop: Spacing.three,
  },
  mapCard: {
    borderRadius: 28,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#29332B',
  },
  sectionTitle: {
    marginTop: Spacing.one,
  },
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: '#29332B',
  },
  cardLocation: {
    fontSize: 18,
    fontWeight: '700',
  },
});
