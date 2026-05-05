import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MapPin, Calendar, CheckCircle, Clock, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function VisitsList() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  useEffect(() => {
    if (profile?.company_id) {
      loadVisits();
    }
  }, [profile, dateFrom, dateTo]);

  const loadVisits = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('visits')
        .select(`
          id,
          visit_date,
          purpose,
          status,
          latitude,
          longitude,
          client:clients(name_ar)
        `)
        .eq('company_id', profile!.company_id)
        .order('visit_date', { ascending: false });
        
      // For Reps, only show their own visits. Managers/Owners see all.
      if (profile?.role === 'rep') {
        query = query.eq('rep_id', profile.id);
      }
      
      if (dateFrom) {
        query = query.gte('visit_date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('visit_date', dateTo + 'T23:59:59.999Z');
      }
        
      const { data, error } = await query;

      if (error) throw error;
      setVisits(data || []);
      logInfo('Visits loaded', data);
    } catch (error) {
      logError('Error loading visits', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">سجل الزيارات</h2>
          <p className="text-gray-500 mt-1 text-sm">متابعة زيارات العملاء الميدانية</p>
        </div>
        <div className="flex flex-col gap-3">
          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700">كل الوقت</button>
            <button onClick={() => { setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700">هذا الشهر</button>
            <button onClick={() => { setDateFrom(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700">الشهر السابق</button>
            <button onClick={() => { setDateFrom(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700">آخر 6 أشهر</button>
            
            <Link
              to="/visits/new"
              className="bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 mr-2"
            >
              <Plus className="w-4 h-4" />
              زيارة جديدة
            </Link>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">من</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary w-[140px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">إلى</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary w-[140px]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  العميل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ الزيارة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الغرض
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة / الموقع
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    لا يوجد زيارات مسجلة
                  </td>
                </tr>
              ) : (
                visits.map((visit) => (
                  <tr 
                    key={visit.id} 
                    onClick={() => navigate(`/visits/${visit.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">
                        {visit.client?.name_ar || 'عميل غير معروف'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">
                          {format(new Date(visit.visit_date), 'EEEE, d MMMM yyyy', { locale: ar })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-w-xs truncate">
                        {visit.purpose}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 min-w-[max-content]">
                          {visit.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3.5 h-3.5" />
                              مكتملة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Clock className="w-3.5 h-3.5" />
                              مجدولة
                            </span>
                          )}
                        </div>
                        {visit.latitude && visit.longitude && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500" dir="ltr">
                            <MapPin className="w-3.5 h-3.5 text-red-500" />
                            {visit.latitude.toFixed(4)}, {visit.longitude.toFixed(4)}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
