import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Client, Region, ClientCategory, ClientGrade } from '../../types';
import { Search, Filter, Plus, ChevronLeft, MapPin, Building2, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const categoryLabels: Record<ClientCategory, string> = {
  beauty: 'تجميل',
  optics: 'بصريات',
  pharmacies: 'الصيدليات',
  distribution: 'شركات التوزيع',
};

const gradeColors: Record<ClientGrade, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-orange-100 text-orange-800',
  D: 'bg-red-100 text-red-800',
  unclassified: 'bg-gray-100 text-gray-800',
};

export default function ClientsList() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ClientCategory | ''>('');
  const [selectedGrade, setSelectedGrade] = useState<ClientGrade | ''>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [showDeactivated, setShowDeactivated] = useState(false);

  useEffect(() => {
    if (profile?.company_id) {
      loadData();
    }
  }, [profile?.company_id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load Regions for filter
      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('name_ar');

      if (regionsError) throw regionsError;
      setRegions(regionsData as Region[]);

      // Load Clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          *,
          region:regions(*),
          district:districts(*)
        `)
        .eq('company_id', profile!.company_id)
        .order('name_ar');

      if (clientsError) throw clientsError;
      
      setClients(clientsData as Client[]);
      logInfo('Clients and regions loaded', { clientsCount: clientsData.length });
    } catch (error) {
      logError('Error loading clients data', error);
      console.error('Error loading clients data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    if (!showDeactivated && !client.is_active) return false;
    if (selectedCategory && client.category !== selectedCategory) return false;
    if (selectedGrade && client.grade !== selectedGrade) return false;
    if (selectedRegion && client.region_id !== selectedRegion) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const codeMatch = client.legacy_code?.toLowerCase().includes(query) || false;
      const nameMatch = client.name_ar.toLowerCase().includes(query);
      return codeMatch || nameMatch;
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">دليل العملاء</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة بيانات وعناوين العملاء</p>
        </div>
        
        {['owner', 'manager', 'supervisor'].includes(profile?.role || '') && (
          <Link
            to="/clients/new"
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>إضافة عميل</span>
          </Link>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">الفئة</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ClientCategory | '')}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
            >
              <option value="">الكل</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-gray-500 mb-1">المنطقة</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
            >
              <option value="">الكل</option>
              {regions.map(region => (
                <option key={region.id} value={region.id}>{region.name_ar}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">التصنيف</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value as ClientGrade | '')}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
            >
              <option value="">الكل</option>
              <option value="A">فئة A</option>
              <option value="B">فئة B</option>
              <option value="C">فئة C</option>
              <option value="D">فئة D</option>
              <option value="unclassified">غير مصنف</option>
            </select>
          </div>
          
          <div className="flex items-end">
             <button
                onClick={() => setShowDeactivated(!showDeactivated)}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 p-2 border rounded-lg transition-colors",
                  showDeactivated ? "border-primary text-primary bg-primary/5" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                )}
             >
                {showDeactivated ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{showDeactivated ? 'إخفاء غير النشطين' : 'عرض غير النشطين'}</span>
             </button>
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">لا يوجد عملاء</h3>
          <p className="text-gray-500 mt-1">لم يتم العثور على عملاء مطابقين لبحثك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <Link 
              key={client.id}
              to={`/clients/${client.id}`}
              className={clsx(
                "block bg-white p-5 rounded-xl border shadow-sm transition-all hover:shadow-md",
                client.is_active ? "border-gray-100 hover:border-primary/30" : "border-gray-200 opacity-75"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{client.name_ar}</h3>
                    {!client.is_active && (
                       <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                         موقوف
                       </span>
                    )}
                  </div>
                  {client.legacy_code && (
                    <span className="text-xs text-gray-500 block mt-0.5">#{client.legacy_code}</span>
                  )}
                </div>
                <span className={clsx("text-xs font-bold px-2.5 py-1 rounded-full", gradeColors[client.grade])}>
                  فئة {client.grade === 'unclassified' ? '-' : client.grade}
                </span>
              </div>
              
              <div className="space-y-2 mt-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span>{categoryLabels[client.category]}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>
                    {client.region?.name_ar || 'منطقة غير محددة'}
                    {client.district && ` - ${client.district.name_ar}`}
                  </span>
                </div>
              </div>
              
              <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {/* Ideally, show last visit date. MVP: just 'Show details' */}
                  عرض التفاصيل
                </span>
                <ChevronLeft className="w-4 h-4 text-gray-400 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
