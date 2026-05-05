import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CircleDollarSign,
  Briefcase,
  CheckCircle2,
  Filter,
  Calendar,
  User,
  Building2,
} from 'lucide-react';
import { Region } from '../../types';
import clsx from 'clsx';

interface ManagerVisit {
  id: string;
  visit_date: string;
  status: string;
  visit_type: string;
  purpose: string | null;
  sales_amount: number;
  collection_amount: number;
  rep_id: string;
  client: { name_ar: string } | null;
  rep: { full_name: string } | null;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  completed: { label: 'مكتملة', cls: 'bg-green-100 text-green-800' },
  planned: { label: 'مجدولة', cls: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'جارية', cls: 'bg-amber-100 text-amber-800' },
  cancelled: { label: 'ملغاة', cls: 'bg-red-100 text-red-800' },
};

const TYPE_LABELS: Record<string, string> = {
  routine: 'روتينية',
  collection: 'تحصيل',
  sales: 'مبيعات',
  delivery: 'توصيل',
};

export default function ManagerVisits() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  const navigate = useNavigate();

  // Filters
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filterRepId, setFilterRepId] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [visits, setVisits] = useState<ManagerVisit[]>([]);
  const [reps, setReps] = useState<{ id: string; full_name: string }[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [filterBranchId, setFilterBranchId] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Load reps and branches
  useEffect(() => {
    if (!profile?.company_id) return;
    const loadFiltersData = async () => {
      const [{ data: repsData }, { data: regionsData }] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('company_id', profile.company_id)
          .eq('role', 'rep')
          .eq('is_active', true),
        supabase
          .from('regions')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('name_ar')
      ]);
      
      if (repsData) setReps(repsData);
      if (regionsData) setRegions(regionsData as Region[]);
    };
    loadFiltersData();
  }, [profile]);

  // Load visits
  useEffect(() => {
    if (!profile?.company_id) return;
    const loadVisits = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('visits')
          .select(`
            id, visit_date, status, visit_type, purpose,
            sales_amount, collection_amount, rep_id,
            client:clients(name_ar),
            rep:user_profiles!visits_rep_id_fkey(full_name)
          `)
          .eq('company_id', profile.company_id)
          .order('visit_date', { ascending: false });

        if (dateFrom) {
          query = query.gte('visit_date', dateFrom);
        }
        if (dateTo) {
          query = query.lte('visit_date', dateTo + 'T23:59:59');
        }

        if (filterRepId !== 'all') {
          query = query.eq('rep_id', filterRepId);
        } else if (filterBranchId !== 'all') {
          // Filter by joined rep's region_id
          query = query.eq('rep.region_id', filterBranchId);
        }

        if (filterType !== 'all') query = query.eq('visit_type', filterType);
        if (filterStatus !== 'all') query = query.eq('status', filterStatus);

        const { data, error } = await query;
        if (error) throw error;
        setVisits((data as unknown as ManagerVisit[]) || []);
        logInfo('Manager visits loaded', { count: data?.length });
      } catch (err) {
        logError('Error loading manager visits', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadVisits();
  }, [profile, dateFrom, dateTo, filterRepId, filterType, filterStatus, filterBranchId]);

  // KPIs
  const kpis = useMemo(() => {
    const total = visits.length;
    const completed = visits.filter((v) => v.status === 'completed').length;
    const planned = visits.filter((v) => v.status === 'planned').length;
    const totalSales = visits.reduce((sum, v) => sum + (v.sales_amount || 0), 0);
    const totalCollections = visits.reduce((sum, v) => sum + (v.collection_amount || 0), 0);
    return { total, completed, planned, totalSales, totalCollections };
  }, [visits]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">متابعة الزيارات</h2>
        <p className="text-gray-500 mt-1 text-sm">نظرة شاملة على جميع زيارات المناديب</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">إجمالي الزيارات</p>
              <p className="text-3xl font-bold text-gray-900">{kpis.total}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">مكتملة</p>
              <p className="text-3xl font-bold text-green-600">{kpis.completed}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">مجدولة</p>
              <p className="text-3xl font-bold text-blue-600">{kpis.planned}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">المبيعات</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(kpis.totalSales)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">التحصيلات</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(kpis.totalCollections)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {/* Quick Date Filters Header */}
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-white hover:border-primary hover:text-primary border border-transparent rounded-lg transition-all text-gray-700 font-medium">كل الوقت</button>
          <button onClick={() => { setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-white hover:border-primary hover:text-primary border border-transparent rounded-lg transition-all text-gray-700 font-medium">هذا الشهر</button>
          <button onClick={() => { setDateFrom(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-white hover:border-primary hover:text-primary border border-transparent rounded-lg transition-all text-gray-700 font-medium">الشهر السابق</button>
          <button onClick={() => { setDateFrom(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-white hover:border-primary hover:text-primary border border-transparent rounded-lg transition-all text-gray-700 font-medium">آخر 6 أشهر</button>
        </div>
      </div>
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">من تاريخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">إلى تاريخ</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">المندوب</label>
          <select
            value={filterRepId}
            onChange={(e) => setFilterRepId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          >
            <option value="all">كل المناديب</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">الفرع</label>
          <select
            value={filterBranchId}
            onChange={(e) => {
              setFilterBranchId(e.target.value);
              if (e.target.value !== 'all') setFilterRepId('all');
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          >
            <option value="all">كل الفروع</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name_ar}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">نوع الزيارة</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          >
            <option value="all">الكل</option>
            <option value="routine">روتينية</option>
            <option value="collection">تحصيل</option>
            <option value="sales">مبيعات</option>
            <option value="delivery">توصيل</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">الحالة</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          >
            <option value="all">الكل</option>
            <option value="completed">مكتملة</option>
            <option value="planned">مجدولة</option>
            <option value="in_progress">جارية</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </div>
      </div>

      {/* Visits Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المندوب</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العميل</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">النوع</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المبيعات</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التحصيلات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    لا توجد زيارات في الفترة المحددة
                  </td>
                </tr>
              ) : (
                visits.map((v) => {
                  const st = STATUS_LABELS[v.status] || STATUS_LABELS.planned;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => navigate(`/visits/${v.id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{v.rep?.full_name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {v.client?.name_ar || 'بدون عميل'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(v.visit_date), 'd MMM yyyy', { locale: ar })}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                          {TYPE_LABELS[v.visit_type] || v.visit_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm">
                        <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', st.cls)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {v.sales_amount > 0 ? formatCurrency(v.sales_amount) : '-'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {v.collection_amount > 0 ? formatCurrency(v.collection_amount) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
