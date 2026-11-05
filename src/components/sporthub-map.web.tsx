import { useState } from 'react';
import { useRouter } from 'expo-router';
import { APIProvider, AdvancedMarker, InfoWindow, Map } from '@vis.gl/react-google-maps';

import type { SportMapEvent } from '@/components/sporthub-map';

const API_KEY = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();

export default function SportHubMap({ events, detailsLabel = 'View details', userLocation }: { events: SportMapEvent[]; detailsLabel?: string; userLocation?: { latitude: number; longitude: number } | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<SportMapEvent | null>(null);
  const initial = events[0];
  if (!API_KEY) {
    return <div style={styles.message}>
      <strong style={{ fontSize: 18 }}>Google Maps web key is missing</strong>
      <span style={{ color: '#ACB6AD', lineHeight: 1.5 }}>Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to display the event map.</span>
    </div>;
  }

  return (
    <div style={styles.container}>
      <APIProvider apiKey={API_KEY} libraries={['marker']}>
        <Map
          key={userLocation ? `${userLocation.latitude},${userLocation.longitude}` : 'no-location'}
          defaultCenter={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : { lat: initial?.latitude ?? 42.6977, lng: initial?.longitude ?? 23.3219 }}
          defaultZoom={userLocation ? 14 : 12}
          gestureHandling="greedy"
          mapId="sporthub-map"
          style={{ width: '100%', height: '100%' }}
        >
          {userLocation ? <AdvancedMarker position={{ lat: userLocation.latitude, lng: userLocation.longitude }} title="Your location" /> : null}
          {events.map((event) => <AdvancedMarker key={event.id} position={{ lat: event.latitude, lng: event.longitude }} onClick={() => setSelected(event)} />)}
          {selected ? <InfoWindow position={{ lat: selected.latitude, lng: selected.longitude }} onCloseClick={() => setSelected(null)}>
            <div style={{ color: '#0B1110', padding: 4, display: 'grid', gap: 8 }}>
              <strong>{selected.title}</strong>
              {selected.venue ? <span>{selected.venue}</span> : null}
              <button type="button" onClick={() => router.push(`/event/${selected.id}`)} style={styles.button}>{detailsLabel}</button>
            </div>
          </InfoWindow> : null}
        </Map>
      </APIProvider>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: '100%', height: 420, borderRadius: 20, overflow: 'hidden', border: '1px solid #2D3932', background: '#0B1110' },
  message: { width: '100%', minHeight: 350, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, borderRadius: 20, background: '#151D1B', border: '1px solid #2D3932', color: '#FFFFFF', textAlign: 'center' },
  button: { border: 0, borderRadius: 9, padding: '8px 10px', color: '#0B1110', background: '#D7F36A', fontWeight: 700, cursor: 'pointer' },
};
