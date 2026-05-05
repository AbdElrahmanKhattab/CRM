import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Building2, TrendingUp, Activity } from 'lucide-react';
import clsx from 'clsx';

interface BranchRow {
  id: string;
  name_ar: string;
  totalVisits: number;
  completedVisits: number;
  totalSales: number;
  totalCollections: number;
  clientCount: number;
  repCount: number;
}

export default function BranchReport() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.company_id) loadReport();
  }, [profile, dateFrom, dateTo]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      // 1. Regions
      const { data: regionsData, error: regErr } = await supabase
        .from('regions')
        .select('id, name_ar')
        .eq('company_id', profile!.company_id)
        .order('name_ar');
      if (regErr) throw regErr;
      if (!regionsData || regionsData.length === 0) {
        setRows([]);
        return;
      }

      // 2. Visits in date range
      const { data: visitsData, error: visErr } = await supabase
        .from('visits')
        .select('id, status, sales_amount, collection_amount, client_id, rep_id')
        .eq('company_id', profile!.company_id)
        .gte('visit_date', dateFrom)
        .lte('visit_date', dateTo + 'T23:59:59');
      if (visErr) throw visErr;

      // 3. Clients (to map client -> region)
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, region_id')
        .eq('company_id', profile!.company_id);

      // 4. Reps (to map rep -> region)
      const { data: repsData } = await supabase
        .from('user_profiles')
        .select('id, region_id')
        .eq('company_id', profile!.company_id)
        .eq('role', 'rep');

      const clientRegionMap = new Map<string, string>();
      (clientsData || []).forEach((c: any) => { if (c.region_id) clientRegionMap.set(c.id, c.region_id); });

      const repRegionMap = new Map<string, string>();
      (repsData || []).forEach((r: any) => { if (r.region_id) repRegionMap.set(r.id, r.region_id); });

      // Build rows
      const branchMap = new Map<string, BranchRow>();
      regionsData.forEach((r: any) => {
        branchMap.set(r.id, {
          id: r.id,
          name_ar: r.name_ar,
          totalVisits: 0,
          completedVisits: 0,
          totalSales: 0,
          totalCollections: 0,
          clientCount: 0,
          repCount: 0,
        });
      });

      // Count clients & reps per branch
      (clientsData || []).forEach((c: any) => {
        if (c.region_id && branchMap.has(c.region_id)) {
          branchMap.get(c.region_id)!.clientCount++;
        }
      });
      (repsData || []).forEach((r: any) => {
        if (r.region_id && branchMap.has(r.region_id)) {
          branchMap.get(r.region_id)!.repCount++;
        }
      });

      // Attribute visits to branches via client's region or rep's region
      (visitsData || []).forEach((v: any) => {
        const branchId = (v.client_id && clientRegionMap.get(v.client_id))
          || (v.rep_id && repRegionMap.get(v.rep_id));
        if (branchId && branchMap.has(branchId)) {
          const row = branchMap.get(branchId)!;
          row.totalVisits++;
          if (v.status === 'completed') row.completedVisits++;
          row.totalSales += Number(v.sales_amount) || 0;
          row.totalCollections += Number(v.collection_amount) || 0;
        }
      });

      const result = Array.from(branchMap.values()).sort((a, b) => b.totalSales - a.totalSales);
      setRows(result);
      logInfo('Branch report loaded', { branches: result.length });
    } catch (err) {
      logError('Error loading branch report', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = useMemo(() => ({
    visits: rows.reduce((s, r) => s + r.totalVisits, 0),
    sales: rows.reduce((s, r) => s + r.totalSales, 0),
    collections: rows.reduce((s, r) => s + r.totalCollections, 0),
  }), [rows]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 text-sm" dir="rtl">
        <p className="font-bold text-gray-800 mb-2">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
            <span>{entry.name} :</span>
            <span className="font-bold">{formatCurrency(entry.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">تقارير الفروع</h2>
          <p className="text-gray-500 mt-1 text-sm">مقارنة أداء الفروع من حيث المبيعات والزيارات</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">من</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">إلى</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Totals KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">إجمالي الزيارات</p>
            <p className="text-3xl font-bold text-gray-900">{totals.visits}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">إجمالي المبيعات</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.sales)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">إجمالي التحصيلات</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.collections)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">لا توجد فروع</h3>
          <p className="text-gray-500 mt-1">يرجى إضافة فروع أولاً من صفحة إدارة الفروع</p>
        </div>
      ) : (
        <>
          {/* Bar Chart — Sales & Collections by Branch */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6">المبيعات والتحصيلات حسب الفرع</h3>
            <div className="h-80 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name_ar" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="totalSales" name="المبيعات" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalCollections" name="التحصيلات" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الفرع</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الزيارات</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المكتملة</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المبيعات</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التحصيلات</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العملاء</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المناديب</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((r, i) => (
                    <tr key={r.id} className={clsx('hover:bg-gray-50 transition-colors', i === 0 && 'bg-green-50/50')}>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        {r.name_ar}
                        {i === 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">الأعلى</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">{r.totalVisits}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">{r.completedVisits}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">{formatCurrency(r.totalSales)}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">{formatCurrency(r.totalCollections)}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">{r.clientCount}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">{r.repCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
