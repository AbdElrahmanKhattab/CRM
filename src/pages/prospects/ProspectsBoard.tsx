import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Prospect, LeadStatus, InterestLevel } from '../../types';
import { Plus, Building2, MapPin, Target, UserCircle2, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface KanbanColumn {
  id: LeadStatus;
  title: string;
  color: string;
  icon: any;
}

const COLUMNS: KanbanColumn[] = [
  { id: 'targeted', title: 'مستهدف', color: 'bg-gray-100 border-gray-300', icon: Target },
  { id: 'potential', title: 'عميل محتمل', color: 'bg-blue-100 border-blue-300', icon: Building2 },
  { id: 'field_visit', title: 'زيارة ميدانية', color: 'bg-indigo-100 border-indigo-300', icon: MapPin },
  { id: 'contacted', title: 'تم التواصل', color: 'bg-amber-100 border-amber-300', icon: UserCircle2 },
  { id: 'active', title: 'مكتمل (عميل)', color: 'bg-green-100 border-green-300', icon: ShieldAlert },
];

const interestColors: Record<InterestLevel, string> = {
  interested: 'bg-green-100 text-green-700',
  needs_follow_up: 'bg-orange-100 text-orange-700',
  potential: 'bg-blue-100 text-blue-700',
  not_interested: 'bg-red-100 text-red-700',
};

const interestLabels: Record<InterestLevel, string> = {
  interested: 'مهتم',
  needs_follow_up: 'يحتاج متابعة',
  potential: 'محتمل',
  not_interested: 'غير مهتم',
};

export default function ProspectsBoard() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.company_id) {
      loadProspects();
    }
  }, [profile?.company_id]);

  const loadProspects = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select(`
          *,
          user:user_profiles(full_name),
          region:regions(name_ar)
        `)
        .eq('company_id', profile!.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProspects(data as Prospect[]);
      logInfo('Prospects loaded', { count: data.length });
    } catch (error) {
      logError('Error loading prospects', error);
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

  // Group prospects by status
  const groupedProspects = COLUMNS.reduce((acc, col) => {
    acc[col.id] = prospects.filter(p => (p.lead_status || 'potential') === col.id);
    return acc;
  }, {} as Record<LeadStatus, Prospect[]>);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">العملاء المحتملين</h1>
          <p className="text-sm text-gray-500 mt-1">تتبع رحلة العملاء المستهدفين (Pipeline)</p>
        </div>
        
        <Link
          to="/prospects/new"
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة مستهدف</span>
        </Link>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full">
          {COLUMNS.map(column => {
            const columnProspects = groupedProspects[column.id] || [];
            const Icon = column.icon;
            
            return (
              <div 
                key={column.id} 
                className="w-80 flex flex-col bg-gray-50/50 rounded-2xl border border-gray-200 shrink-0"
              >
                {/* Column Header */}
                <div className={clsx(
                  "p-4 rounded-t-2xl border-b flex items-center justify-between",
                  column.color
                )}>
                  <div className="flex items-center gap-2 font-bold text-gray-800">
                    <Icon className="w-5 h-5 opacity-75" />
                    {column.title}
                  </div>
                  <span className="bg-white/50 text-gray-800 text-xs font-bold px-2 py-1 rounded-full">
                    {columnProspects.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-[500px]">
                  {columnProspects.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                      لا يوجد
                    </div>
                  ) : (
                    columnProspects.map(prospect => (
                      <Link
                        key={prospect.id}
                        to={`/prospects/${prospect.id}`}
                        className="block bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-primary/40 transition-all text-right"
                      >
                        <h4 className="font-bold text-gray-900 mb-1 leading-tight">
                          {prospect.target_client_name}
                        </h4>
                        
                        <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{prospect.region?.name_ar || 'غير محدد'}</span>
                          {prospect.district_name && ` - ${prospect.district_name}`}
                        </div>

                        {prospect.interest_level && (
                          <div className="mb-3">
                            <span className={clsx(
                              "text-[10px] px-2 py-0.5 rounded-full font-bold",
                              interestColors[prospect.interest_level]
                            )}>
                              {interestLabels[prospect.interest_level]}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-1">
                          <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
                            {/* @ts-ignore - joined user */}
                            M: {prospect.user?.full_name || 'غير معروف'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {format(new Date(prospect.created_at!), 'MMM d', { locale: ar })}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
