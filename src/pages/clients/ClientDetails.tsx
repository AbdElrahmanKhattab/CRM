import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Client } from '../../types';
import { ChevronRight, ArrowRight, MapPin, Building2, Phone, Edit, CalendarClock, DollarSign, Wallet, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ClientStats {
  totalVisits: number;
  totalSales: number;
  totalCollections: number;
  outstanding: number;
}

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { logError } = useDebug();
  
  const [client, setClient] = useState<Client | null>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [stats, setStats] = useState<ClientStats>({
    totalVisits: 0,
    totalSales: 0,
    totalCollections: 0,
    outstanding: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id && profile?.company_id) {
      loadData();
    }
  }, [id, profile?.company_id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Load client info
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select(`
          *,
          region:regions(*),
          district:districts(*)
        `)
        .eq('id', id)
        .eq('company_id', profile!.company_id)
        .single();
        
      if (clientErr) throw clientErr;
      setClient(clientData as Client);

      // 2. Load visits to calculate stats & show history
      const { data: visitsData, error: visitsErr } = await supabase
        .from('visits')
        .select(`
          *,
          user:user_profiles(full_name)
        `)
        .eq('client_id', id)
        .order('check_in_time', { ascending: false });

      if (visitsErr) throw visitsErr;

      // Calculate stats
      let tSales = 0;
      let tCollections = 0;
      visitsData.forEach(v => {
        tSales += (v.sales_amount || 0);
        tCollections += (v.collection_amount || 0);
      });

      setStats({
        totalVisits: visitsData.length,
        totalSales: tSales,
        totalCollections: tCollections,
        outstanding: tSales - tCollections,
      });

      setRecentVisits(visitsData.slice(0, 10)); // keep last 10 in history
      
    } catch (error) {
      logError('Error loading client details', error);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">العميل غير موجود</h2>
        <button onClick={() => navigate('/clients')} className="text-primary mt-4">عودة للقائمة</button>
      </div>
    );
  }

  const categoryLabels = {
    beauty: 'تجميل',
    optics: 'بصريات',
    pharmacies: 'الصيدليات',
    distribution: 'توزيع'
  };

  const getVisitTypeBadge = (type: string) => {
    switch(type) {
      case 'sales': return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">مبيعات</span>;
      case 'collection': return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">تحصيل</span>;
      case 'followup': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">متابعة</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Back button */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
        >
          <ArrowRight className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {client.name_ar}
            {!client.is_active && (
              <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded-md font-bold">غير نشط</span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">ملف العميل التوضيحي</p>
        </div>
        
        {['owner', 'manager', 'supervisor'].includes(profile?.role || '') && (
          <Link
            to={`/clients/${client.id}/edit`}
            className="mr-auto flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">تعديل</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Main Info & Stats) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Info Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">الفئة والتصنيف</label>
                  <div className="flex gap-2">
                    <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                      {categoryLabels[client.category]}
                    </span>
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">
                      فئة {client.grade === 'unclassified' ? 'غير محدد' : client.grade}
                    </span>
                  </div>
                </div>
                
                {client.legacy_code && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">كود النظام القديم</label>
                    <p className="font-medium">#{client.legacy_code}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 block mb-1">المسؤول | رقم التواصل</label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <p dir="ltr" className="font-medium text-right">{client.contact_person || 'غير محدد'} - {client.phone || 'بدون رقم'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">المنطقة والحي</label>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <p className="font-medium">
                      {client.region?.name_ar || 'غير محدد'} <br />
                      <span className="text-sm text-gray-500">{client.district?.name_ar || ''}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">العنوان التفصيلي</label>
                  <p className="text-sm">{client.address || 'لا يوجد عنوان تفصيلي'}</p>
                </div>
              </div>
            </div>
            
            {client.notes && (
              <div className="mt-6 pt-4 border-t border-gray-50">
                <label className="text-xs text-gray-500 block mb-1">ملاحظات هامة</label>
                <p className="text-sm bg-yellow-50 p-3 rounded-lg text-yellow-800 border border-yellow-100">
                  {client.notes}
                </p>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
               <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                 <CalendarClock className="w-4 h-4" />
               </div>
               <p className="text-xs text-gray-500 mb-1">إجمالي الزيارات</p>
               <p className="text-xl font-bold">{stats.totalVisits}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
               <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-3">
                 <TrendingUp className="w-4 h-4" />
               </div>
               <p className="text-xs text-gray-500 mb-1">إجمالي المبيعات</p>
               <p className="text-xl font-bold">{stats.totalSales.toLocaleString()} <span className="text-xs font-normal">SAR</span></p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
               <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                 <Wallet className="w-4 h-4" />
               </div>
               <p className="text-xs text-gray-500 mb-1">إجمالي التحصيلات</p>
               <p className="text-xl font-bold">{stats.totalCollections.toLocaleString()} <span className="text-xs font-normal">SAR</span></p>
            </div>
            <div className={clsx(
              "p-4 rounded-xl border shadow-sm",
              stats.outstanding > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"
            )}>
               <div className={clsx(
                 "w-8 h-8 rounded-lg flex items-center justify-center mb-3",
                 stats.outstanding > 0 ? "bg-red-100 text-red-600" : "bg-gray-50 text-gray-600"
               )}>
                 <DollarSign className="w-4 h-4" />
               </div>
               <p className={clsx("text-xs mb-1", stats.outstanding > 0 ? "text-red-600" : "text-gray-500")}>المتبقي (مديونية)</p>
               <p className={clsx("text-xl font-bold", stats.outstanding > 0 ? "text-red-700" : "text-gray-900")}>
                 {stats.outstanding.toLocaleString()} <span className="text-xs font-normal">SAR</span>
               </p>
            </div>
          </div>
        </div>

        {/* Right Column (History & Map) */}
        <div className="space-y-6">
          
          {/* History */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              سجل الزيارات الأخيرة
            </h3>
            
            {recentVisits.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">لا توجد زيارات مسجلة حتى الآن.</p>
            ) : (
              <div className="space-y-4">
                {recentVisits.map((visit) => (
                  <Link 
                    key={visit.id} 
                    to={`/visits/${visit.id}`}
                    className="block p-3 border border-gray-50 rounded-lg hover:bg-gray-50 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-sm font-medium text-gray-900">{visit.user?.full_name}</span>
                       <span className="text-xs text-gray-500">
                         {format(new Date(visit.check_in_time), 'd MMM yyyy', { locale: ar })}
                       </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getVisitTypeBadge(visit.visit_type)}
                      {(visit.sales_amount > 0 || visit.collection_amount > 0) && (
                        <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                           {visit.sales_amount > 0 ? `مبيعات: ${visit.sales_amount}` : `تحصيل: ${visit.collection_amount}`}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
