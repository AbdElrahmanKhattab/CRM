import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const defaultCenter: [number, number] = [23.8859, 45.0792]; // KSA Geographic Center

const defaultIcon = L.divIcon({
  html: `<div class="w-4 h-4 rounded-full bg-red-500 shadow-md border-2 border-white"></div>`,
  className: 'custom-leaflet-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapEvents({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

interface Props {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
}

export default function LocationPicker({ latitude, longitude, onChange }: Props) {
  const mapRef = useRef<L.Map>(null);

  useEffect(() => {
    if (mapRef.current && latitude && longitude) {
      // Small timeout to allow the map container to render before panning
      setTimeout(() => {
        mapRef.current?.setView([latitude, longitude]);
      }, 0);
    }
  }, [latitude, longitude]);

  return (
    <div className="h-[300px] w-full rounded-lg overflow-hidden border border-gray-300 relative z-[1]">
      <MapContainer 
        center={latitude && longitude ? [latitude, longitude] : defaultCenter} 
        zoom={latitude && longitude ? 15 : 5} 
        ref={mapRef}
        className="w-full h-full"
        dragging={true}
        touchZoom={true}
        scrollWheelZoom={false}
      >
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
        />
        <MapEvents onLocationSelect={onChange} />
        {latitude && longitude && (
          <Marker position={[latitude, longitude]} icon={defaultIcon} />
        )}
      </MapContainer>
      <style>{`
        .leaflet-container { font-family: inherit; }
      `}</style>
    </div>
  );
}
