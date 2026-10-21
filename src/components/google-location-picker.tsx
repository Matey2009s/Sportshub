
import { useEffect, useRef } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Marker,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';

type Props = {
  latitude: number | null;
  longitude: number | null;
  onSelect: (latitude: number, longitude: number) => void;
};

const DEFAULT_LOCATION = {
  latitude: 42.6977,
  longitude: 23.3219,
};

export default function GoogleLocationPicker({
  latitude,
  longitude,
  onSelect,
}: Props) {
  const mapRef = useRef<MapView>(null);

  const coordinate = {
    latitude: latitude ?? DEFAULT_LOCATION.latitude,
    longitude: longitude ?? DEFAULT_LOCATION.longitude,
  };

  useEffect(() => {
    if (latitude === null || longitude === null) return;

    const region: Region = {
      ...coordinate,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    mapRef.current?.animateToRegion(region, 300);
  }, [latitude, longitude]);

  function handleMapPress(event: MapPressEvent) {
    const { latitude: lat, longitude: lng } =
      event.nativeEvent.coordinate;

    onSelect(lat, lng);
  }

  async function openStreetView() {
    const { latitude: lat, longitude: lng } = coordinate;

    const url =
      `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

    try {
      await Linking.openURL(url);
    } catch {
      // Картата остава отворена, ако линкът не може да се отвори.
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          ...DEFAULT_LOCATION,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        onPress={handleMapPress}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {latitude !== null && longitude !== null && (
          <Marker
            coordinate={coordinate}
            title="Място на събитието"
            description="Избрана локация"
            draggable
            onDragEnd={(event) => {
              const { latitude: lat, longitude: lng } =
                event.nativeEvent.coordinate;

              onSelect(lat, lng);
            }}
          />
        )}
      </MapView>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Натисни картата, за да избереш място, или премести маркера.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={openStreetView}
        style={styles.streetViewButton}
      >
        <Text style={styles.streetViewText}>
          Отвори Street View
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 360,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#141915',
  },
  map: {
    flex: 1,
  },
  hint: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 11, 9, 0.9)',
  },
  hintText: {
    color: '#F4F7F4',
    fontSize: 12,
  },
  streetViewButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#B8FF4D',
  },
  streetViewText: {
    color: '#080B09',
    fontSize: 13,
    fontWeight: '700',
  },
});
