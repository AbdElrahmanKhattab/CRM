import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Client, Prospect, Region } from '../../types';
import { MapPin, Navigation, User, Layers, Filter } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

// GPS Validation
function isValidKSACoordinate(lat?: number, lng?: number) {
  const KSA = { lat: { min: 16.0, max: 32.5 }, lng: { min: 34.5, max: 56.0 } };
  if (!lat || !lng || (lat === 0 && lng === 0)) return false;
  if (lat < KSA.lat.min || lat > KSA.lat.max) return false;
  if (lng < KSA.lng.min || lng > KSA.lng.max) return false;
  return true;
}

// Marker Icon Factory
const createMarkerIcon = (colorClass: string, isRing: boolean = false) => {
  const html = isRing 
    ? `<div class="w-4 h-4 rounded-full border-4 ${colorClass} bg-transparent shadow-sm"></div>`
    : `<div class="w-4 h-4 rounded-full ${colorClass} shadow-md border-2 border-white"></div>`;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
};

const categoryColors: Record<string, string> = {
  optics: 'bg-blue-500 border-blue-500',
  pharmacies: 'bg-green-500 border-green-500',
  beauty: 'bg-orange-500 border-orange-500',
  distribution: 'bg-gray-500 border-gray-500',
  default: 'bg-indigo-500 border-indigo-500'
};

const getNavigateUrl = (lat: number, lng: number) => {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
};

// Component to force interaction settings on the Leaflet instance
function MapInteractionEnabler() {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      if ('tap' in map) (map as any).tap.enable();
    }
  }, [map]);
  return null;
}

export default function MapExplorer() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const [clients, setClients] = useState<Client[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  
  // Filters
  const [showClients, setShowClients] = useState(true);
  const [showProspects, setShowProspects] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);

  // KSA Center Default
  const centerPosition: [number, number] = [23.8859, 45.0792];

  useEffect(() => {
    if (profile?.company_id) {
      loadData();
    }
  }, [profile?.company_id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsRes, prospectsRes, regionsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('*, region:regions(name_ar)')
          .eq('company_id', profile!.company_id)
          .eq('is_active', true),
        supabase
          .from('prospects')
          .select('*, region:regions(name_ar)')
          .eq('company_id', profile!.company_id)
          .neq('lead_status', 'active'), // Exclude converted ones
        supabase
          .from('regions')
          .select('*')
          .eq('company_id', profile!.company_id)
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (prospectsRes.error) throw prospectsRes.error;
      if (regionsRes.error) throw regionsRes.error;

      setClients(clientsRes.data as Client[]);
      setProspects(prospectsRes.data as Prospect[]);
      setRegions(regionsRes.data as Region[]);
      logInfo('Map data loaded', { clients: clientsRes.data.length, prospects: prospectsRes.data.length });
    } catch (error) {
      logError('Error loading map data', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter Data
  const visibleClients = useMemo(() => {
    if (!showClients) return [];
    return clients.filter(c => {
      const validGPS = isValidKSACoordinate(c.latitude, c.longitude);
      const matchesRegion = !selectedRegion || c.region_id === selectedRegion;
      const matchesCategory = !selectedCategory || c.category === selectedCategory;
      return validGPS && matchesRegion && matchesCategory;
    });
  }, [clients, showClients, selectedRegion, selectedCategory]);

  const visibleProspects = useMemo(() => {
    if (!showProspects) return [];
    return prospects.filter(p => {
      const validGPS = isValidKSACoordinate(p.latitude, p.longitude);
      const matchesRegion = !selectedRegion || p.region_id === selectedRegion;
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return validGPS && matchesRegion && matchesCategory;
    });
  }, [prospects, showProspects, selectedRegion, selectedCategory]);

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen w-full flex flex-col pt-4 sm:pt-0 relative overflow-hidden">
      
      {/* HUD Controls */}
      <div className="absolute top-20 right-4 sm:right-auto sm:top-24 sm:left-1/2 sm:-translate-x-1/2 z-[1000] w-[calc(100%-2rem)] sm:w-auto pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 p-4 space-y-4 pointer-events-auto">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <MapPin className="w-5 h-5 text-primary" />
              الخريطة والتغطية
            </h1>
            
            {/* Layers Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setShowClients(!showClients)}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1",
                  showClients ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                )}
              >
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                عملاء حصريون
              </button>
              <button
                onClick={() => setShowProspects(!showProspects)}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1",
                  showProspects ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                )}
              >
                <div className="w-2 h-2 rounded-full border-2 border-orange-500" />
                مستهدفين
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-transparent font-medium focus:outline-none text-gray-600 border-b border-dashed border-gray-300 pb-0.5"
              >
                <option value="">كل المناطق</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>{r.name_ar}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-sm border-r border-gray-200 pr-3">
              <Layers className="w-4 h-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent font-medium focus:outline-none text-gray-600 border-b border-dashed border-gray-300 pb-0.5"
              >
                <option value="">كل التصنيفات</option>
                <option value="optics">بصريات</option>
                <option value="pharmacies">صيدليات</option>
                <option value="beauty">تجميل</option>
                <option value="distribution">شركات توزيع</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex justify-center items-center bg-gray-50">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="flex-1 relative z-[1]">
          <MapContainer 
            center={centerPosition} 
            zoom={6} 
            className="w-full h-full"
            zoomControl={true}
            dragging={true}
            touchZoom={true}
            scrollWheelZoom={true}
          >
            <MapInteractionEnabler />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            
            <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
              {visibleClients.map(client => (
                <Marker
                  key={`client-${client.id}`}
                  position={[client.latitude!, client.longitude!]}
                  icon={createMarkerIcon(categoryColors[client.category] || categoryColors.default, false)}
                >
                  <Popup className="custom-popup">
                    <div dir="rtl" className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-gray-900 text-sm mb-1">{client.name_ar}</h3>
                      <p className="text-xs text-gray-500 mb-3 flex gap-1">
                        <span className="bg-gray-100 px-1.5 rounded">{client.category}</span>
                        <span className="bg-indigo-50 text-indigo-700 px-1.5 rounded">فئة {client.grade}</span>
                      </p>
                      
                      <div className="space-y-1.5 mb-4">
                        <p className="text-xs text-gray-600 flex items-center gap-1.5">
                          <User className="w-3 h-3" /> {client.contact_person || 'غير محدد'}
                        </p>
                        {client.updated_at && (
                          <p className="text-[10px] text-gray-400">
                            آخر نشاط: {formatDistanceToNow(new Date(client.updated_at), { addSuffix: true, locale: ar })}
                          </p>
                        )}
                      </div>

                      <a 
                        href={getNavigateUrl(client.latitude!, client.longitude!)}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full bg-primary text-white text-xs font-bold py-2 rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        الإتجاهات (ملاحة)
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {visibleProspects.map(prospect => (
                <Marker
                  key={`prospect-${prospect.id}`}
                  position={[prospect.latitude!, prospect.longitude!]}
                  icon={createMarkerIcon(categoryColors[prospect.category || 'default'], true)}
                >
                  <Popup className="custom-popup">
                    <div dir="rtl" className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-gray-900 text-sm mb-1">{prospect.target_client_name}</h3>
                      <p className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded inline-block mb-3 font-bold">
                        مستهدف ({prospect.lead_status})
                      </p>
                      
                      <div className="space-y-1 mb-4">
                        <p className="text-xs text-gray-600 flex items-center gap-1.5">
                          <User className="w-3 h-3" /> {prospect.contact_person || 'غير محدد'}
                        </p>
                      </div>

                      <a 
                        href={getNavigateUrl(prospect.latitude!, prospect.longitude!)}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full bg-gray-900 text-white text-xs font-bold py-2 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        الإتجاهات (ملاحة)
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      )}

      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 4px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        .custom-popup .leaflet-popup-tip-container {
          display: none;
        }
        .custom-popup .leaflet-popup-content {
          margin: 8px;
        }
      `}</style>
    </div>
  );
}
