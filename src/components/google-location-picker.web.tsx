import { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';

type Props = {
  venue: string;
  onVenueChange: (venue: string) => void;
  latitude: number | null;
  longitude: number | null;
  onSelect: (latitude: number, longitude: number, address?: string) => void;
};

function MapControls({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const map = useMap();
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [streetViewError, setStreetViewError] = useState('');

  const toggleStreetView = () => {
    if (!map) return;
    if (streetViewOpen) {
      map.getStreetView().setVisible(false);
      setStreetViewOpen(false);
      return;
    }
    map.getStreetView().setPosition({
      lat: latitude ?? map.getCenter()?.lat() ?? 42.6977,
      lng: longitude ?? map.getCenter()?.lng() ?? 23.3219,
    });
    map.getStreetView().setPov({ heading: 0, pitch: 0 });
    map.getStreetView().setVisible(true);
    setStreetViewOpen(true);
  };

  useEffect(() => {
    if (!map) return;
    const panorama = map.getStreetView();
    const listener = panorama.addListener('visible_changed', () => {
      const visible = panorama.getVisible();
      setStreetViewOpen(visible);
      setStreetViewError(visible && panorama.getStatus() === google.maps.StreetViewStatus.ZERO_RESULTS ? 'Няма Street View за това място.' : '');
    });
    return () => listener.remove();
  }, [map]);

  return <div style={styles.controls}>
    {streetViewError ? <div role="status" style={styles.error}>{streetViewError}</div> : null}
    <button type="button" onClick={toggleStreetView} style={styles.streetViewButton}>
      {streetViewOpen ? '← Обратно към картата' : '◉ Street View'}
    </button>
  </div>;
}

function LocationMap({ venue, onVenueChange, latitude, longitude, onSelect }: Props) {
  const map = useMap();
  const places = useMapsLibrary('places');
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestId = useRef(0);
  const [predictions, setPredictions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const thisRequest = ++requestId.current;
    const input = venue.trim();
    if (!places || input.length < 3) {
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      sessionToken.current ??= new places.AutocompleteSessionToken();
      try {
        const result = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionToken.current,
          language: 'bg',
          region: 'BG',
        });
        if (thisRequest !== requestId.current) return;
        setPredictions((result.suggestions ?? []).flatMap((suggestion) => suggestion.placePrediction ? [suggestion.placePrediction] : []));
      } catch {
        if (thisRequest === requestId.current) {
          setPredictions([]);
          setSearchError('Търсенето не успя. Провери дали Places API (New) е включен.');
        }
      } finally {
        if (thisRequest === requestId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [places, venue]);

  useEffect(() => {
    if (map && latitude !== null && longitude !== null) {
      map.panTo({ lat: latitude, lng: longitude });
      map.setZoom(16);
    }
  }, [map, latitude, longitude]);

  async function selectPrediction(prediction: google.maps.places.PlacePrediction) {
    setSearching(true);
    setSearchError('');
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location'] });
      if (!place.location) throw new Error('Google не върна координати за това място.');
      const address = place.formattedAddress ?? prediction.text.toString();
      onVenueChange(address);
      onSelect(place.location.lat(), place.location.lng(), address);
      map?.panTo(place.location);
      map?.setZoom(16);
      setPredictions([]);
      sessionToken.current = null;
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Не успях да избера това място.');
    } finally {
      setSearching(false);
    }
  }

  const center = { lat: latitude ?? 42.6977, lng: longitude ?? 23.3219 };

  return <div style={styles.container}>
    <Map
      defaultCenter={center}
      defaultZoom={latitude === null ? 11 : 16}
      mapId="sporthub-location-map"
      gestureHandling="greedy"
      clickableIcons={false}
      onClick={(event) => {
        const point = event.detail.latLng;
        if (point) onSelect(point.lat, point.lng);
      }}
      style={{ width: '100%', height: '100%' }}
    >
      {latitude !== null && longitude !== null ? <Marker position={{ lat: latitude, lng: longitude }} /> : null}
      <MapControls latitude={latitude} longitude={longitude} />
    </Map>

    <div style={styles.searchPanel}>
      <input
        value={venue}
        onChange={(event) => {
          onVenueChange(event.target.value);
          setPredictions([]);
          setSearchError('');
          if (!event.target.value.trim()) sessionToken.current = null;
        }}
        placeholder="Търси адрес или място"
        aria-label="Търси адрес в Google Maps"
        autoComplete="off"
        style={styles.searchInput}
      />
      {searching ? <span style={styles.spinner}>…</span> : null}
      {predictions.length > 0 ? <div style={styles.predictions} role="listbox">
        {predictions.map((prediction) => <button key={prediction.placeId} type="button" role="option" onClick={() => void selectPrediction(prediction)} style={styles.prediction}>
          <span style={styles.pin}>●</span><span>{prediction.text.toString()}</span>
        </button>)}
        <div style={styles.attribution}>Powered by Google</div>
      </div> : null}
      {searchError ? <div role="status" style={styles.searchError}>{searchError}</div> : null}
    </div>
  </div>;
}

export default function GoogleLocationPicker(props: Props) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  if (!apiKey) return <div style={styles.message}>Добави EXPO_PUBLIC_GOOGLE_MAPS_API_KEY във файла .env.</div>;
  return <APIProvider apiKey={apiKey} language="bg" region="BG" libraries={['places']}><LocationMap {...props} /></APIProvider>;
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: '100%', height: 420, borderRadius: 20, overflow: 'hidden', position: 'relative', background: '#151D1B' },
  searchPanel: { position: 'absolute', top: 10, left: 10, right: 10, zIndex: 10 },
  searchInput: { width: '100%', minHeight: 48, boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 14, padding: '0 38px 0 14px', color: '#FFFFFF', background: 'rgba(9,7,15,0.97)', fontSize: 15, outline: 'none' },
  spinner: { position: 'absolute', top: 11, right: 14, color: '#D7F36A', fontSize: 19 },
  predictions: { marginTop: 6, maxHeight: 236, overflowY: 'auto', border: '1px solid #2D3932', borderRadius: 14, background: '#14101B', boxShadow: '0 8px 22px rgba(0,0,0,0.35)' },
  prediction: { width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '9px 13px', color: '#FFFFFF', background: 'transparent', fontSize: 14, cursor: 'pointer' },
  pin: { color: '#D7F36A', fontSize: 11 },
  attribution: { padding: '6px 10px', color: '#ACB6AD', textAlign: 'right', fontSize: 10 },
  searchError: { marginTop: 6, borderRadius: 10, padding: 9, color: '#FFD0D0', fontSize: 12, background: 'rgba(80,15,15,0.92)' },
  controls: { position: 'absolute', left: 12, bottom: 12, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, maxWidth: 'calc(100% - 24px)' },
  streetViewButton: { border: '1px solid #DEC6FF', borderRadius: 14, padding: '12px 16px', background: '#D7F36A', color: '#0B1110', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,0.35)' },
  error: { padding: 10, borderRadius: 10, background: '#0B1110', color: '#FFFFFF', fontSize: 12, maxWidth: 230 },
  message: { padding: 16, borderRadius: 12, color: '#FFFFFF', background: '#151D1B' },
};
