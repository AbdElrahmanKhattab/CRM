import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, Calendar, MapPin, Clock, User, Filter, Building2 } from 'lucide-react';
import { Region } from '../../types';
import clsx from 'clsx';

interface CalendarVisit {
  id: string;
  visit_date: string;
  scheduled_at: string | null;
  next_appointment: string | null;
  status: string;
  visit_type: string;
  purpose: string | null;
  sales_amount: number;
  collection_amount: number;
  rep_id: string;
  client: { name_ar: string } | null;
  rep: { full_name: string } | null;
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  completed: { dot: 'bg-green-500', bg: 'bg-green-500', text: 'text-white', label: 'مكتملة' },
  planned:   { dot: 'bg-blue-500',  bg: 'bg-blue-500',  text: 'text-white',  label: 'مجدولة' },
  in_progress: { dot: 'bg-amber-500', bg: 'bg-amber-500', text: 'text-white', label: 'جارية' },
  cancelled: { dot: 'bg-red-500',   bg: 'bg-red-500',   text: 'text-white',   label: 'ملغاة' },
};

const VISIT_TYPE_LABELS: Record<string, string> = {
  routine: 'روتينية',
  collection: 'تحصيل',
  sales: 'مبيعات',
  delivery: 'توصيل',
};

const WEEKDAYS = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

export default function CalendarView() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [visits, setVisits] = useState<CalendarVisit[]>([]);
  const [reps, setReps] = useState<{ id: string; full_name: string }[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  const isManager = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'supervisor';

  // Load reps and branches for manager filter
  useEffect(() => {
    if (!isManager || !profile?.company_id) return;
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
  }, [profile, isManager]);

  // Load visits for the current month
  useEffect(() => {
    if (!profile?.company_id) return;
    const loadVisits = async () => {
      setIsLoading(true);
      try {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);

        const dateStart = format(monthStart, 'yyyy-MM-dd');
        const dateEnd = format(addDays(monthEnd, 1), 'yyyy-MM-dd');

        let query = supabase
          .from('visits')
          .select(`
            id, visit_date, scheduled_at, next_appointment, status, visit_type,
            purpose, sales_amount, collection_amount, rep_id,
            client:clients(name_ar),
            rep:user_profiles!visits_rep_id_fkey(full_name)
          `)
          .eq('company_id', profile.company_id)
          .or(`and(visit_date.gte.${dateStart},visit_date.lte.${dateEnd}),and(next_appointment.gte.${dateStart},next_appointment.lte.${dateEnd})`);

        if (!isManager) {
          query = query.eq('rep_id', profile.id);
        } else if (selectedRepId !== 'all') {
          query = query.eq('rep_id', selectedRepId);
        } else if (selectedBranchId !== 'all') {
          // Filter by rep's region_id
          query = query.eq('rep.region_id', selectedBranchId);
        }

        const { data, error } = await query.order('visit_date', { ascending: true });
        if (error) throw error;
        setVisits((data as unknown as CalendarVisit[]) || []);
        logInfo('Calendar visits loaded', { count: data?.length });
      } catch (err) {
        logError('Error loading calendar visits', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadVisits();
  }, [profile, currentMonth, selectedRepId, selectedBranchId, isManager]);

  // Build calendar grid days (Saturday-start weeks)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 6 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 6 });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Group visits by date string
  const visitsByDate = useMemo(() => {
    const map: Record<string, CalendarVisit[]> = {};
    visits.forEach((v) => {
      // 1. Add historical/completed visit
      if (v.visit_date) {
        const key = format(new Date(v.visit_date), 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];
        // Only add if it's in the current view's range (the query might return slightly more)
        map[key].push(v);
      }

      // 2. Add upcoming appointment (if different from visit date)
      if (v.next_appointment) {
        const key = format(new Date(v.next_appointment), 'yyyy-MM-dd');
        // Prevent duplicate if next_appointment is somehow same as visit_date (unlikely)
        const isSameAsVisit = v.visit_date && format(new Date(v.visit_date), 'yyyy-MM-dd') === key;
        
        if (!isSameAsVisit) {
          if (!map[key]) map[key] = [];
          map[key].push({
            ...v,
            status: 'planned', // Show as planned on the calendar
            purpose: `موعد قادم: ${v.purpose || ''}`,
            visit_date: v.next_appointment // Override for display sorting in day view
          });
        }
      }
    });
    return map;
  }, [visits]);

  // Visits for the selected date
  const selectedDayVisits = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return visitsByDate[key] || [];
  }, [selectedDate, visitsByDate]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">التقويم</h2>
          <p className="text-gray-500 mt-1 text-sm">عرض الزيارات على التقويم الشهري</p>
        </div>

        {/* Manager Filters */}
        {isManager && (
          <div className="flex items-center gap-3">
            {regions.length > 0 && (
               <div className="flex items-center gap-2">
                 <Building2 className="w-4 h-4 text-gray-400" />
                 <select
                   value={selectedBranchId}
                   onChange={(e) => {
                     setSelectedBranchId(e.target.value);
                     if (e.target.value !== 'all') setSelectedRepId('all');
                   }}
                   className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                 >
                   <option value="all">كل الفروع</option>
                   {regions.map((r) => (
                     <option key={r.id} value={r.id}>{r.name_ar}</option>
                   ))}
                 </select>
               </div>
            )}
            
            {reps.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="all">جميع المناديب</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>{r.full_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <h3 className="text-lg font-bold text-gray-900">
            {format(currentMonth, 'MMMM yyyy', { locale: ar })}
          </h3>
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 py-3 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayVisits = visitsByDate[key] || [];
                const inMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={clsx(
                      'relative min-h-[72px] md:min-h-[90px] p-2 border-b border-l border-gray-100 text-right transition-colors flex flex-col',
                      !inMonth && 'bg-gray-50/50',
                      inMonth && 'hover:bg-primary/5',
                      isSelected && 'bg-primary/10 ring-2 ring-primary ring-inset',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={clsx(
                          'text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full',
                          !inMonth && 'text-gray-300',
                          inMonth && !today && 'text-gray-700',
                          today && 'bg-primary text-white',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayVisits.length > 2 && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                          +{dayVisits.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Visit bars */}
                    <div className="mt-1 space-y-1 overflow-hidden">
                      {dayVisits.slice(0, 2).map((v) => {
                        const sc = STATUS_COLORS[v.status] || STATUS_COLORS.planned;
                        const time = format(new Date(v.visit_date), 'h:mm a', { locale: ar });
                        return (
                          <div
                            key={`${v.id}-${v.visit_date}`}
                            className={clsx(
                              'text-[10px] leading-tight p-1 rounded border shadow-sm truncate flex items-center gap-1',
                              sc.bg,
                              sc.text,
                              'border-opacity-50'
                            )}
                            title={`${v.client?.name_ar || 'بدون عميل'} - ${v.purpose || ''}`}
                          >
                            <span className="font-bold opacity-75 shrink-0">{time}</span>
                            <span className="truncate font-medium">{v.client?.name_ar || 'بدون عميل'}</span>
                          </div>
                        );
                      })}
                    </div>

                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected Day Detail Panel */}
      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {format(selectedDate, 'EEEE d MMMM yyyy', { locale: ar })}
            </h3>
            <span className="text-sm text-gray-500">
              {selectedDayVisits.length} {selectedDayVisits.length === 1 ? 'زيارة' : 'زيارات'}
            </span>
          </div>

          {selectedDayVisits.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">
              لا توجد زيارات في هذا اليوم
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {selectedDayVisits.map((v) => {
                const sc = STATUS_COLORS[v.status] || STATUS_COLORS.planned;
                return (
                  <a
                    key={v.id}
                    href={`/visits/${v.id}`}
                    className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Status dot */}
                    <div className={clsx('mt-1.5 w-3 h-3 rounded-full shrink-0', sc.dot)} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">
                          {v.client?.name_ar || 'بدون عميل'}
                        </span>
                        <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full border', sc.bg, sc.text)}>
                          {sc.label}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          {VISIT_TYPE_LABELS[v.visit_type] || v.visit_type}
                        </span>
                      </div>

                      {v.purpose && (
                        <p className="text-sm text-gray-500 mt-1 truncate">{v.purpose}</p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        {isManager && v.rep?.full_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {v.rep.full_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(v.visit_date), 'hh:mm a', { locale: ar })}
                        </span>
                        {(v.sales_amount > 0 || v.collection_amount > 0) && (
                          <span className="text-green-600 font-medium">
                            {v.sales_amount > 0 && `مبيعات: ${v.sales_amount.toLocaleString('ar-SA')}`}
                            {v.sales_amount > 0 && v.collection_amount > 0 && ' · '}
                            {v.collection_amount > 0 && `تحصيل: ${v.collection_amount.toLocaleString('ar-SA')}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
