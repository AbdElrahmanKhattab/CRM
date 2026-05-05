import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { useAuth, UserProfile } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Client, Prospect, Region, Visit } from '../../types';
import { 
  MapPin, 
  Navigation, 
  User, 
  Layers, 
  Filter, 
  X, 
  Phone, 
  ExternalLink, 
  Calendar, 
  Clock, 
  Building2,
  ChevronLeft,
  Briefcase,
  UserPlus
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';

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
    ? `<div class="w-5 h-5 rounded-full border-4 ${colorClass} bg-transparent shadow-sm"></div>`
    : `<div class="w-5 h-5 rounded-full ${colorClass} shadow-md border-2 border-white"></div>`;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
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
  const [reps, setReps] = useState<UserProfile[]>([]);
  
  // Selection
  const [selectedEntity, setSelectedEntity] = useState<{ type: 'client' | 'prospect', data: any } | null>(null);
  const [entityVisits, setEntityVisits] = useState<Visit[]>([]);
  const [isVisitsLoading, setIsVisitsLoading] = useState(false);

  // Filters
  const [showClients, setShowClients] = useState(true);
  const [showProspects, setShowProspects] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedRep, setSelectedRep] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);

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
          .neq('lead_status', 'active'),
        supabase
          .from('regions')
          .select('*')
          .eq('company_id', profile!.company_id)
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (prospectsRes.error) throw prospectsRes.error;
      if (regionsRes.error) throw regionsRes.error;

      if (['owner', 'manager', 'supervisor'].includes(profile!.role)) {
        const { data: repsData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('company_id', profile!.company_id)
          .eq('role', 'rep')
          .order('full_name');
        if (repsData) setReps(repsData as UserProfile[]);
      }

      setClients(clientsRes.data as Client[]);
      setProspects(prospectsRes.data as Prospect[]);
      setRegions(regionsRes.data as Region[]);
    } catch (error) {
      logError('Error loading map data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVisits = async (clientId: string) => {
    setIsVisitsLoading(true);
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('client_id', clientId)
        .order('visit_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setEntityVisits(data as Visit[]);
    } catch (error) {
      logError('Error loading client visits', error);
    } finally {
      setIsVisitsLoading(false);
    }
  };

  const handleEntityClick = (type: 'client' | 'prospect', data: any) => {
    setSelectedEntity({ type, data });
    setEntityVisits([]);
    if (type === 'client') {
      loadVisits(data.id);
    }
  };

  const visibleClients = useMemo(() => {
    if (!showClients) return [];
    return clients.filter(c => {
      const validGPS = isValidKSACoordinate(c.latitude, c.longitude);
      const matchesRegion = !selectedRegion || c.region_id === selectedRegion;
      const matchesCategory = !selectedCategory || c.category === selectedCategory;
      const matchesRep = profile?.role === 'rep' ? c.assigned_rep_id === profile.id : (!selectedRep || c.assigned_rep_id === selectedRep);
      return validGPS && matchesRegion && matchesCategory && matchesRep;
    });
  }, [clients, showClients, selectedRegion, selectedCategory, selectedRep, profile]);

  const visibleProspects = useMemo(() => {
    if (!showProspects) return [];
    return prospects.filter(p => {
      const validGPS = isValidKSACoordinate(p.latitude, p.longitude);
      const matchesRegion = !selectedRegion || p.region_id === selectedRegion;
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      const matchesRep = profile?.role === 'rep' ? p.assigned_rep_id === profile.id : (!selectedRep || p.assigned_rep_id === selectedRep);
      return validGPS && matchesRegion && matchesCategory && matchesRep;
    });
  }, [prospects, showProspects, selectedRegion, selectedCategory, selectedRep, profile]);

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen w-full flex relative overflow-hidden font-sans" dir="rtl">
      
      {/* Sidebar Content (Visible when an entity is selected) */}
      <div className={clsx(
        "fixed inset-y-0 right-0 z-[2000] w-full sm:w-96 bg-white shadow-2xl border-l border-gray-100 transform transition-transform duration-300 ease-in-out flex flex-col",
        selectedEntity ? "translate-x-0" : "translate-x-full"
      )}>
        {selectedEntity && (
          <>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                {selectedEntity.type === 'client' ? <Building2 className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-orange-500" />}
                {selectedEntity.type === 'client' ? 'تفاصيل العميل' : 'تفاصيل المستهدف'}
              </h2>
              <button 
                onClick={() => setSelectedEntity(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Header Info */}
              <div className="space-y-2">
                <h1 className="text-xl font-black text-gray-900">
                  {selectedEntity.type === 'client' ? selectedEntity.data.name_ar : selectedEntity.data.target_client_name}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">
                    {selectedEntity.data.category === 'optics' ? 'بصريات' : 
                     selectedEntity.data.category === 'pharmacies' ? 'صيدليات' : 
                     selectedEntity.data.category === 'beauty' ? 'تجميل' : 'توزيع'}
                  </span>
                  {selectedEntity.type === 'client' && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-bold">
                      فئة {selectedEntity.data.grade}
                    </span>
                  )}
                  {selectedEntity.type === 'prospect' && (
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-bold">
                      مستهدف - {selectedEntity.data.lead_status}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <a 
                  href={getNavigateUrl(selectedEntity.data.latitude, selectedEntity.data.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  الملاحة
                </a>
                {selectedEntity.type === 'client' && (
                  <Link 
                    to={`/clients/${selectedEntity.data.id}`}
                    className="flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-200 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    الملف الكامل
                  </Link>
                )}
              </div>

              {/* Basic Details */}
              <div className="space-y-4 pt-4 border-t border-gray-50">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">الشخص المسؤول</p>
                    <p className="text-sm font-bold text-gray-700">{selectedEntity.data.contact_person || 'غير محدد'}</p>
                  </div>
                </div>
                {selectedEntity.data.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400">رقم الهاتف</p>
                      <p className="text-sm font-bold text-gray-700" dir="ltr">{selectedEntity.data.phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">المنطقة / العنوان</p>
                    <p className="text-sm font-bold text-gray-700">
                      {selectedEntity.data.region?.name_ar || 'غير محدد'} 
                      {selectedEntity.data.address ? ` - ${selectedEntity.data.address}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Visit History (Clients Only) */}
              {selectedEntity.type === 'client' && (
                <div className="pt-6 border-t border-gray-50">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" />
                    سجل الزيارات الأخيرة
                  </h3>
                  
                  {isVisitsLoading ? (
                    <div className="flex justify-center p-4">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : entityVisits.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">لا توجد زيارات سابقة</p>
                  ) : (
                    <div className="space-y-3">
                      {entityVisits.map(visit => (
                        <div key={visit.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary/20 transition-all group">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-gray-700">
                              {format(new Date(visit.visit_date!), 'd MMM yyyy', { locale: ar })}
                            </span>
                            <span className={clsx(
                              "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                              visit.status === 'completed' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {visit.visit_type === 'routine' ? 'روتينية' : 
                               visit.visit_type === 'collection' ? 'تحصيل' : 'مبيعات'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(visit.visit_date!), 'hh:mm a', { locale: ar })}
                            </span>
                            {(visit.sales_amount > 0 || visit.collection_amount > 0) && (
                              <span className="text-green-600 font-bold">
                                {visit.sales_amount > 0 ? `مبيعات: ${visit.sales_amount}` : `تحصيل: ${visit.collection_amount}`}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer Navigation */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
               <button 
                onClick={() => setSelectedEntity(null)}
                className="w-full py-2.5 text-gray-500 font-bold text-sm hover:text-gray-900 transition-colors"
               >
                 إغلاق
               </button>
            </div>
          </>
        )}
      </div>

      {/* Main Map UI */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* HUD Controls */}
        <div className="absolute top-20 right-4 sm:right-auto sm:top-6 sm:left-1/2 sm:-translate-x-1/2 z-[1000] w-[calc(100%-2rem)] sm:w-auto pointer-events-none">
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
                  العملاء
                </button>
                <button
                  onClick={() => setShowProspects(!showProspects)}
                  className={clsx(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1",
                    showProspects ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  )}
                >
                  <div className="w-2 h-2 rounded-full border-2 border-orange-500" />
                  المستهدفين
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
                  className="bg-transparent font-bold focus:outline-none text-gray-600 border-b border-dashed border-gray-300 pb-0.5"
                >
                  <option value="">كل المناطق</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.name_ar}</option>
                  ))}
                </select>
              </div>

              {['owner', 'manager', 'supervisor'].includes(profile?.role || '') && (
                <div className="flex items-center gap-2 text-sm border-r border-gray-200 pr-3">
                  <User className="w-4 h-4 text-gray-400" />
                  <select
                    value={selectedRep}
                    onChange={(e) => setSelectedRep(e.target.value)}
                    className="bg-transparent font-bold focus:outline-none text-gray-600 border-b border-dashed border-gray-300 pb-0.5"
                  >
                    <option value="">كل المناديب</option>
                    {reps.map(rep => (
                      <option key={rep.id} value={rep.id}>{rep.full_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm border-r border-gray-200 pr-3">
                <Layers className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent font-bold focus:outline-none text-gray-600 border-b border-dashed border-gray-300 pb-0.5"
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
              zoomControl={false}
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
                    eventHandlers={{
                      click: () => handleEntityClick('client', client)
                    }}
                  />
                ))}

                {visibleProspects.map(prospect => (
                  <Marker
                    key={`prospect-${prospect.id}`}
                    position={[prospect.latitude!, prospect.longitude!]}
                    icon={createMarkerIcon(categoryColors[prospect.category || 'default'], true)}
                    eventHandlers={{
                      click: () => handleEntityClick('prospect', prospect)
                    }}
                  />
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}
