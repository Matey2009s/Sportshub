
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

const events = [
  {
    id: '1',
    title: 'Бягане в парка',
    description: 'Демонстрационна активност',
    latitude: 42.6849,
    longitude: 23.3342,
  },
  {
    id: '2',
    title: 'Футбол',
    description: 'Демонстрационна активност',
    latitude: 42.6867,
    longitude: 23.3367,
  },
  {
    id: '3',
    title: 'Колоездене',
    description: 'Демонстрационна активност',
    latitude: 42.6638,
    longitude: 23.3154,
  },
];

export default function SportHubMap() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 42.6977,
          longitude: 23.3219,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.latitude,
              longitude: event.longitude,
            }}
            title={event.title}
            description={event.description}
            pinColor="#B8FF4D"
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#141915',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
