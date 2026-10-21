
import { useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
} from '@vis.gl/react-google-maps';

const API_KEY = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();

const events = [
  {
    id: '1',
    title: 'Бягане в Борисовата градина',
    lat: 42.6849,
    lng: 23.3342,
  },
  {
    id: '2',
    title: 'Футбол в София',
    lat: 42.6867,
    lng: 23.3367,
  },
  {
    id: '3',
    title: 'Колоездене в Витоша',
    lat: 42.6659,
    lng: 23.2939,
  },
];

export default function SportHubMap() {
  const [selected, setSelected] = useState<(typeof events)[number] | null>(null);

  if (!API_KEY) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          borderRadius: 20,
          background: '#121A15',
          border: '1px solid #29332B',
          color: '#F4F7F4',
          textAlign: 'center',
        }}
      >
        <strong style={{ fontSize: 18 }}>Google Maps web key is missing</strong>
        <span style={{ color: '#A1ADA4', lineHeight: 1.5 }}>
          Add a valid EXPO_PUBLIC_GOOGLE_MAPS_API_KEY and enable the Google Maps JavaScript API for http://localhost:8081/*.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: 420,
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid #29332B',
        background: '#080B09',
      }}
    >
      <APIProvider apiKey={API_KEY} language="bg" libraries={['marker']}>
        <Map
          defaultCenter={{ lat: 42.6977, lng: 23.3219 }}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="sporthub-map"
          style={{ width: '100%', height: '100%' }}
        >
          {events.map((event) => (
            <AdvancedMarker
              key={event.id}
              position={{ lat: event.lat, lng: event.lng }}
              onClick={() => setSelected(event)}
            />
          ))}

          {selected && (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelected(null)}
            >
              <div style={{ color: '#080B09', padding: 4 }}>
                <strong>{selected.title}</strong>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
