
import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  Marker,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';

type Props = {
  venue: string;
  onVenueChange: (venue: string) => void;
  latitude: number | null;
  longitude: number | null;
  onSelect: (latitude: number, longitude: number, address?: string) => void;
};

type PlaceSuggestion = { placeId: string; text: string };

function createSessionToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

const DEFAULT_LOCATION = {
  latitude: 42.6977,
  longitude: 23.3219,
};

export default function GoogleLocationPicker({
  venue,
  onVenueChange,
  latitude,
  longitude,
  onSelect,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const sessionToken = useRef('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const coordinate = {
    latitude: latitude ?? DEFAULT_LOCATION.latitude,
    longitude: longitude ?? DEFAULT_LOCATION.longitude,
  };

  useEffect(() => {
    if (latitude === null || longitude === null) return;

    const region: Region = {
      latitude,
      longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    mapRef.current?.animateToRegion(region, 300);
  }, [latitude, longitude]);

  useEffect(() => {
    const query = venue.trim();
    if (!apiKey || query.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      sessionToken.current ||= createSessionToken();

      try {
        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
          },
          body: JSON.stringify({ input: query, sessionToken: sessionToken.current, languageCode: 'bg', regionCode: 'BG' }),
        });
        if (!response.ok) throw new Error('Google Places не успя да намери адреса. Провери ключа и Places API (New).');
        const result = await response.json() as {
          suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
        };
        setSuggestions((result.suggestions ?? []).flatMap((item) => {
          const place = item.placePrediction;
          return place?.placeId && place.text?.text ? [{ placeId: place.placeId, text: place.text.text }] : [];
        }));
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSearchError(error instanceof Error ? error.message : 'Търсенето на адрес не успя.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, venue]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    if (!apiKey) return;
    setSearching(true);
    setSearchError('');
    try {
      const token = sessionToken.current || createSessionToken();
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(suggestion.placeId)}?sessionToken=${encodeURIComponent(token)}`,
        { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'location,formattedAddress' } },
      );
      if (!response.ok) throw new Error('Не успях да взема координатите на избраното място.');
      const place = await response.json() as {
        location?: { latitude?: number; longitude?: number };
        formattedAddress?: string;
      };
      if (typeof place.location?.latitude !== 'number' || typeof place.location.longitude !== 'number') {
        throw new Error('Google не върна координати за това място.');
      }
      const address = place.formattedAddress ?? suggestion.text;
      onVenueChange(address);
      onSelect(place.location.latitude, place.location.longitude, address);
      setSuggestions([]);
      sessionToken.current = '';
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Не успях да избера това място.');
    } finally {
      setSearching(false);
    }
  }

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
      <View style={styles.searchBox}>
        <TextInput
          value={venue}
          onChangeText={(value) => {
            onVenueChange(value);
            setSuggestions([]);
            setSearchError('');
            if (!value.trim()) sessionToken.current = '';
          }}
          placeholder="Търси адрес или място"
          placeholderTextColor="#929D94"
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Търси място в Google Maps"
        />
        {searching ? <Text style={styles.searching}>…</Text> : null}
        {suggestions.length > 0 ? <View style={styles.suggestions}>
          {suggestions.map((suggestion) => <Pressable key={suggestion.placeId} onPress={() => void selectSuggestion(suggestion)} style={styles.suggestion}>
            <Text style={styles.suggestionPin}>●</Text>
            <Text style={styles.suggestionText}>{suggestion.text}</Text>
          </Pressable>)}
          <Text style={styles.attribution}>Powered by Google</Text>
        </View> : null}
        {!!searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
        {!apiKey ? <Text style={styles.searchError}>Добави EXPO_PUBLIC_GOOGLE_MAPS_API_KEY и включи Places API (New).</Text> : null}
      </View>
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

      {Platform.OS !== 'ios' ? <Pressable
        accessibilityRole="button"
        onPress={openStreetView}
        style={styles.streetViewButton}
      >
        <Text style={styles.streetViewText}>
          Отвори Street View
        </Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 420,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#151D1B',
  },
  map: {
    flex: 1,
  },
  searchBox: {
    position: 'absolute',
    zIndex: 5,
    top: 10,
    left: 10,
    right: 10,
  },
  searchInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(9,7,15,0.96)',
    paddingHorizontal: 14,
    paddingRight: 36,
    color: '#FFFFFF',
    fontSize: 15,
  },
  searching: {
    position: 'absolute',
    top: 13,
    right: 14,
    color: '#D7F36A',
    fontSize: 18,
  },
  suggestions: {
    marginTop: 6,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#14101B',
    borderWidth: 1,
    borderColor: '#2D3932',
  },
  suggestion: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  suggestionPin: { color: '#D7F36A', fontSize: 11 },
  suggestionText: { color: '#FFFFFF', fontSize: 14, flex: 1 },
  attribution: { color: '#ACB6AD', fontSize: 10, textAlign: 'right', padding: 6, paddingHorizontal: 10 },
  searchError: { marginTop: 6, borderRadius: 10, padding: 9, color: '#FFD0D0', fontSize: 12, backgroundColor: 'rgba(80,15,15,0.92)' },
  hint: {
    position: 'absolute',
    bottom: 12,
    left: 10,
          right: Platform.OS === 'ios' ? 10 : 160,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(9, 7, 15, 0.9)',
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  streetViewButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#D7F36A',
  },
  streetViewText: {
    color: '#0B1110',
    fontSize: 13,
    fontWeight: '700',
  },
});
