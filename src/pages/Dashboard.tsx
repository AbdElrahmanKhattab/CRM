import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';
import { useDebug } from '../components/debug/DebugProvider';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { Activity, CircleDollarSign, AlertCircle, Users, Briefcase, Calendar, MapPin, RefreshCcw } from 'lucide-react';
import clsx from 'clsx';

type DateFilter = 'today' | 'week' | 'month' | 'year';

export default function Dashboard() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [targetDateRange, setTargetDateRange] = useState({ start: new Date(), end: new Date() });
  
  const [kpis, setKpis] = useState({
    total_visits: 0,
    total_sales: 0,
    total_collections: 0,
    outstanding: 0,
    active_reps: 0,
    unique_clients: 0
  });
  
  const [repVisits, setRepVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Derive target dates when filter changes
  useEffect(() => {
    const now = new Date();
    let start = now;
    let end = now;

    switch (dateFilter) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 6 }); // Saturday start in SA
        end = endOfWeek(now, { weekStartsOn: 6 });
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
    }
    setTargetDateRange({ start, end });
  }, [dateFilter]);

  useEffect(() => {
    if (profile?.company_id) {
      loadData();
    }
  }, [profile?.company_id, targetDateRange]);

  // Real-time subscription
  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('dashboard-visits')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'visits',
        filter: `company_id=eq.${profile.company_id}`
      }, () => {
        // Refresh data on any changes
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, targetDateRange]);

  const loadData = async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);

    try {
      // 1. Fetch KPIs
      const { data: kpiData, error: kpiError } = await supabase.rpc('get_dashboard_kpis', {
        p_company_id: profile.company_id,
        p_start_date: format(targetDateRange.start, 'yyyy-MM-dd'),
        p_end_date: format(targetDateRange.end, 'yyyy-MM-dd')
      });

      if (kpiError) throw kpiError;
      setKpis(kpiData || { total_visits: 0, total_sales: 0, total_collections: 0, outstanding: 0, active_reps: 0, unique_clients: 0 });

      // 2. Fetch rep stats
      const { data: repData, error: repError } = await supabase.rpc('get_visits_by_rep', {
        p_company_id: profile.company_id,
        p_start_date: format(targetDateRange.start, 'yyyy-MM-dd'),
        p_end_date: format(targetDateRange.end, 'yyyy-MM-dd')
      });

      if (repError) throw repError;
      setRepVisits(repData || []);

      logInfo('Dashboard data loaded', { dateFilter });
    } catch (error) {
      logError('Error loading dashboard data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(amount);
  };

  // Common styles for Recharts Tooltip
  const CustomTooltipMsg = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 text-sm" dir="rtl">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4">
              <span>{entry.name} :</span>
              <span className="font-bold">{entry.name.includes('مبيعات') || entry.name.includes('تحصيلات') ? formatCurrency(entry.value) : entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 p-4 sm:p-6 lg:p-8">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold font-cairo text-gray-900">لوحة التحليلات</h1>
          <p className="text-sm text-gray-500 mt-1">نظرة عامة على الأداء والمبيعات</p>
        </div>

        <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
          {([
            { id: 'today', label: 'اليوم' },
            { id: 'week', label: 'هذا الأسبوع' },
            { id: 'month', label: 'هذا الشهر' },
            { id: 'year', label: 'هذا العام' }
          ] as const).map((filter) => (
            <button
              key={filter.id}
              onClick={() => setDateFilter(filter.id)}
              className={clsx(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                dateFilter === filter.id
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">الزيارات</p>
                  <p className="text-3xl font-bold text-gray-900">{kpis.total_visits}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">المبيعات</p>
                  <p className="text-xl font-bold text-gray-900 border-b border-transparent hover:text-green-600 transition-colors">
                    {formatCurrency(kpis.total_sales)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                  <CircleDollarSign className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">التحصيلات</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(kpis.total_collections)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            </div>


          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart: Visits by Rep */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-6">الزيارات حسب المندوب</h3>
              <div className="h-80 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={repVisits} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" />
                    <YAxis dataKey="rep_name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <RechartsTooltip content={<CustomTooltipMsg />} />
                    <Bar dataKey="visit_count" name="عدد الزيارات" fill="#4F46E5" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart: Sales/Collections by Rep */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-6">المبيعات والتحصيلات حسب المندوب</h3>
              <div className="h-80 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={repVisits} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="rep_name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <RechartsTooltip content={<CustomTooltipMsg />} />
                    <Legend />
                    <Bar dataKey="total_sales" name="المبيعات" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="total_collections" name="التحصيلات" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Ensure lucide icon imports matching usage
import { CheckCircle2 } from 'lucide-react';
