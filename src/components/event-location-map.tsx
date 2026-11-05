import { Linking, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';

export type EventMapProps = {
  latitude: number;
  longitude: number;
  title: string;
  venue: string;
};

export default function EventLocationMap({ latitude, longitude, title, venue }: EventMapProps) {
  const coordinate = { latitude, longitude };
  const openDirections = () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);

  return (
    <View style={styles.wrap}>
      <MapView
        style={styles.map}
        initialRegion={{ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        showsCompass
        toolbarEnabled
      >
        <Marker coordinate={coordinate} title={title} description={venue} pinColor="#D7F36A" />
      </MapView>
      <Pressable accessibilityRole="link" onPress={openDirections} style={styles.directions}>
        <ThemedText type="smallBold" style={styles.directionsText}>Отвори в Google Maps ↗</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 280, borderRadius: 22, overflow: 'hidden', backgroundColor: '#151D1B' },
  map: { flex: 1 },
  directions: { position: 'absolute', right: 12, bottom: 12, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#D7F36A' },
  directionsText: { color: '#0B1110' },
});
