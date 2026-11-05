import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

export type SportMapEvent = {
  id: string;
  title: string;
  venue: string | null;
  latitude: number;
  longitude: number;
};

type Props = { events: SportMapEvent[]; detailsLabel?: string; userLocation?: { latitude: number; longitude: number } | null };

export default function SportHubMap({ events, userLocation }: Props) {
  const mapRef = useRef<MapView>(null);
  const initial = events[0];
  useEffect(() => {
    if (userLocation) mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 500);
  }, [userLocation]);
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: userLocation?.latitude ?? initial?.latitude ?? 42.6977,
          longitude: userLocation?.longitude ?? initial?.longitude ?? 23.3219,
          latitudeDelta: userLocation ? 0.035 : 0.08,
          longitudeDelta: userLocation ? 0.035 : 0.08,
        }}
        showsUserLocation={Boolean(userLocation)}
        showsMyLocationButton={Boolean(userLocation)}
      >
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.latitude, longitude: event.longitude }}
            title={event.title}
            description={event.venue ?? undefined}
            pinColor="#D7F36A"
            onCalloutPress={() => router.push(`/event/${event.id}`)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 350, overflow: 'hidden', borderRadius: 20, backgroundColor: '#151D1B' },
  map: { width: '100%', height: '100%' },
});
