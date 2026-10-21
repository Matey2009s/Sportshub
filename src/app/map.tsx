
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import SportHubMap from '@/components/sporthub-map';
import { Spacing } from '@/constants/theme';

const demoMarkers = [
  {
    id: '1',
    name: 'Витоша',
    time: '17:00',
    sport: 'Колоездене',
    distance: '20 km',
    participants: 8,
  },
  {
    id: '2',
    name: 'Люлин',
    time: '18:30',
    sport: 'Бягане',
    distance: '8 km',
    participants: 5,
  },
  {
    id: '3',
    name: 'Симеоново',
    time: '19:00',
    sport: 'Фитнес',
    distance: '45 min',
    participants: 6,
  },
];

export default function MapScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>
            Карта
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            Открий спортни активности около теб
          </ThemedText>
        </View>

        <View style={styles.mapContainer}>
          <SportHubMap />
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Събития близо до теб
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            {demoMarkers.length} активности
          </ThemedText>
        </View>

        {demoMarkers.map((marker) => (
          <ThemedView
            key={marker.id}
            type="backgroundElement"
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <View style={styles.sportBadge}>
                <ThemedText type="smallBold">
                  {marker.sport}
                </ThemedText>
              </View>

              <ThemedText type="small" themeColor="textSecondary">
                {marker.time}
              </ThemedText>
            </View>

            <ThemedText style={styles.cardLocation}>
              {marker.name}
            </ThemedText>

            <View style={styles.cardFooter}>
              <ThemedText type="small" themeColor="textSecondary">
                Разстояние: {marker.distance}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {marker.participants} участници
              </ThemedText>
            </View>
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.four * 2,
  },

  header: {
    gap: Spacing.one,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  mapContainer: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 24,
    minHeight: 400,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },

  sectionTitle: {
    fontSize: 16,
  },

  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sportBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    backgroundColor: '#1B231D',
  },

  cardLocation: {
    fontSize: 20,
    fontWeight: '700',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
