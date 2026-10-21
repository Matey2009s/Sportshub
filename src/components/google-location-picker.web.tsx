import { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMap,
} from '@vis.gl/react-google-maps';

type Props = {
  latitude: number | null;
  longitude: number | null;
  onSelect: (latitude: number, longitude: number) => void;
};

function MapControls({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const map = useMap();
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [streetViewError, setStreetViewError] = useState('');

  const openStreetView = () => {
    if (!map) return;

    const position = {
      lat: latitude ?? map.getCenter()?.lat() ?? 42.6977,
      lng: longitude ?? map.getCenter()?.lng() ?? 23.3219,
    };

    const panorama = map.getStreetView();

    panorama.setPosition(position);
    panorama.setPov({
      heading: 0,
      pitch: 0,
    });
    panorama.setVisible(true);

    setStreetViewError('');
    setStreetViewOpen(true);
  };

  const closeStreetView = () => {
    if (!map) return;

    map.getStreetView().setVisible(false);
    setStreetViewOpen(false);
    setStreetViewError('');
  };

  useEffect(() => {
    if (!map) return;

    const panorama = map.getStreetView();

    const listener = panorama.addListener('visible_changed', () => {
      const visible = panorama.getVisible();
      setStreetViewOpen(visible);

      if (visible) {
        const status = panorama.getStatus();

        if (
          status === google.maps.StreetViewStatus.ZERO_RESULTS
        ) {
          setStreetViewError(
            'Няма налична Street View панорама за това място.',
          );
        } else {
          setStreetViewError('');
        }
      } else {
        setStreetViewError('');
      }
    });

    return () => listener.remove();
  }, [map]);

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 8,
          maxWidth: 'calc(100% - 24px)',
        }}
      >
        {streetViewError !== '' && (
          <div
            role="status"
            style={errorStyle}
          >
            {streetViewError}
          </div>
        )}

        <button
          type="button"
          onClick={streetViewOpen ? closeStreetView : openStreetView}
          style={buttonStyle}
        >
          {streetViewOpen
            ? '← Обратно към картата'
            : '◎ Street View'}
        </button>
      </div>
    </>
  );
}

function LocationMap({
  latitude,
  longitude,
  onSelect,
}: Props) {
  const map = useMap();
  const previousPosition = useRef('');

  const center = {
    lat: latitude ?? 42.6977,
    lng: longitude ?? 23.3219,
  };

  useEffect(() => {
    if (!map || latitude === null || longitude === null) return;

    const positionKey = `${latitude},${longitude}`;

    if (previousPosition.current !== positionKey) {
      map.panTo({
        lat: latitude,
        lng: longitude,
      });

      previousPosition.current = positionKey;
    }
  }, [map, latitude, longitude]);

  return (
    <div
      style={{
        width: '100%',
        height: 360,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        background: '#141915',
      }}
    >
      <Map
        defaultCenter={center}
        defaultZoom={latitude === null ? 11 : 16}
        mapId="sporthub-location-map"
        gestureHandling="greedy"
        clickableIcons={false}
        onClick={(event) => {
          const point = event.detail.latLng;

          if (point) {
            onSelect(point.lat, point.lng);
          }
        }}
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        {latitude !== null && longitude !== null && (
          <Marker
            position={{
              lat: latitude,
              lng: longitude,
            }}
          />
        )}

        <MapControls
          latitude={latitude}
          longitude={longitude}
        />
      </Map>
    </div>
  );
}

export default function GoogleLocationPicker(props: Props) {
  const apiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  if (!apiKey) {
    return (
      <div style={messageStyle}>
        Липсва Google Maps API ключ. Провери
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <LocationMap {...props} />
    </APIProvider>
  );
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid #D5FF91',
  borderRadius: 14,
  padding: '12px 16px',
  background: '#B8FF4D',
  color: '#080B09',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
};

const errorStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: '#080B09',
  color: '#FFFFFF',
  fontSize: 12,
  maxWidth: 230,
};

const messageStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 12,
  color: '#FFFFFF',
  background: '#141915',
};