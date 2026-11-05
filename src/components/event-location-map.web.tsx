import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { EventMapProps } from '@/components/event-location-map';

export default function EventLocationMap({ latitude, longitude, title, venue }: EventMapProps) {
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  return (
    <View style={styles.wrap}>
      <iframe title={`${title} — ${venue}`} src={`https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`} style={{ width: '100%', height: '100%', border: 0 }} loading="lazy" />
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)} style={styles.directions}>
        <ThemedText type="smallBold" style={styles.directionsText}>Отвори в Google Maps ↗</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 280, borderRadius: 22, overflow: 'hidden', backgroundColor: '#151D1B', position: 'relative' },
  directions: { position: 'absolute', right: 12, bottom: 12, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#D7F36A' },
  directionsText: { color: '#0B1110' },
});
