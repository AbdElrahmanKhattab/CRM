import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { UserProfile } from '../../components/auth/AuthProvider';
import { Client, Visit, Region } from '../../types';
import { 
  ArrowRight, 
  Users, 
  MapPin, 
  Building2, 
  Calendar, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Briefcase,
  ExternalLink,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import clsx from 'clsx';

export default function RepDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const [rep, setRep] = useState<UserProfile | null>(null);
  const [repBranch, setRepBranch] = useState<Region | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState({
    totalVisits: 0,
    totalSales: 0,
    totalCollections: 0
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
      // 1. Load Rep Profile
      const { data: repData, error: repError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .eq('company_id', profile!.company_id)
        .single();

      if (repError) throw repError;
      setRep(repData as UserProfile);

      // 2. Load Branch Info
      if ((repData as any).region_id) {
        const { data: regionData } = await supabase
          .from('regions')
          .select('*')
          .eq('id', (repData as any).region_id)
          .single();
        setRepBranch(regionData as Region);
      }

      // 3. Load Assigned Clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*, region:regions(name_ar)')
        .eq('assigned_rep_id', id)
        .order('name_ar');

      if (clientsError) throw clientsError;
      setClients(clientsData as Client[]);

      // 4. Load Recent Visits
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('*, client:clients(name_ar)')
        .eq('rep_id', id)
        .order('visit_date', { ascending: false });

      if (visitsError) throw visitsError;
      setVisits(visitsData as Visit[]);

      // 5. Calculate Stats
      const totalSales = visitsData.reduce((sum, v) => sum + (v.sales_amount || 0), 0);
      const totalCollections = visitsData.reduce((sum, v) => sum + (v.collection_amount || 0), 0);
      
      setStats({
        totalVisits: visitsData.length,
        totalSales,
        totalCollections
      });

      logInfo('Rep details loaded', { repId: id });
    } catch (error) {
      logError('Error loading rep details', error);
      navigate('/reps');
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

  if (!rep) return null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/reps')}
          className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
        >
          <ArrowRight className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-sm border border-blue-200">
            {rep.full_name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{rep.full_name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-sm text-gray-500">{rep.email}</span>
              <span className={clsx(
                "px-2 py-0.5 text-xs font-semibold rounded-full",
                rep.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              )}>
                {rep.is_active ? 'نشط' : 'غير نشط'}
              </span>
              {repBranch && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">
                  <Building2 className="w-3 h-3" />
                  {repBranch.name_ar}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">إجمالي الزيارات</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalVisits}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">المبيعات</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSales.toLocaleString()} <span className="text-xs font-normal">SAR</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">التحصيلات</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCollections.toLocaleString()} <span className="text-xs font-normal">SAR</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Clients */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                العملاء المرتبطون ({clients.length})
              </h3>
            </div>
            <div className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
              {clients.length === 0 ? (
                <div className="p-8 text-center text-gray-400">لا يوجد عملاء مرتبطون</div>
              ) : (
                clients.map(client => (
                  <Link 
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-gray-900 group-hover:text-primary transition-colors">{client.name_ar}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {(client as any).region?.name_ar || "غير محدد"}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Visit History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                سجل الزيارات
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {visits.length === 0 ? (
                <div className="p-12 text-center text-gray-400">لا توجد زيارات مسجلة</div>
              ) : (
                visits.map(visit => (
                  <Link 
                    key={visit.id}
                    to={`/visits/${visit.id}`}
                    className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className={clsx(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      visit.status === "completed" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                    )}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="font-bold text-gray-900 truncate">{(visit as any).client?.name_ar || 'بدون عميل'}</h4>
                        <span className="text-xs text-gray-400 shrink-0">
                          {format(new Date(visit.visit_date!), "d MMM yyyy", { locale: ar })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {format(new Date(visit.visit_date!), "hh:mm a", { locale: ar })}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold">
                          {visit.visit_type === 'routine' ? 'روتينية' : 
                           visit.visit_type === 'collection' ? 'تحصيل' : 
                           visit.visit_type === 'sales' ? 'مبيعات' : 'توصيل'}
                        </span>
                        {(visit.sales_amount > 0 || visit.collection_amount > 0) && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            {visit.sales_amount > 0 ? `مبيعات: ${visit.sales_amount}` : `تحصيل: ${visit.collection_amount}`}
                          </span>
                        )}
                      </div>
                      {visit.purpose && (
                        <p className="text-xs text-gray-500 mt-2 truncate line-clamp-1">{visit.purpose}</p>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
