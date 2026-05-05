import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth, UserProfile } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Briefcase, Users, UserPlus, ChevronLeft, MapPin, Building2 } from 'lucide-react';
import { Client, Region } from '../../types';
import clsx from 'clsx';

export default function RepsList() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  
  const [reps, setReps] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Assignment Modal State
  const [selectedRep, setSelectedRep] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignedClientIds, setAssignedClientIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  useEffect(() => {
    if (profile?.company_id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // 1. Fetch all reps
      const { data: repsData, error: repsError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile!.company_id)
        .eq('role', 'rep')
        .order('full_name');

      if (repsError) throw repsError;
      
      // 2. Fetch all clients to know assignments
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*, region:regions(name_ar)')
        .eq('company_id', profile!.company_id)
        .order('name_ar');
        
      if (clientsError) throw clientsError;

      // 3. Load branches
      const { data: regionsData } = await supabase
        .from('regions')
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('name_ar');

      setReps(repsData as UserProfile[]);
      setClients(clientsData as Client[]);
      setRegions((regionsData || []) as Region[]);
      logInfo('Reps data loaded', { reps: repsData.length, clients: clientsData.length });
    } catch (error) {
      logError('Error loading reps', error);
      console.error('Error loading reps:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAssignmentModal = (rep: UserProfile) => {
    setSelectedRep(rep);
    const assigned = clients.filter(c => c.assigned_rep_id === rep.id).map(c => c.id);
    setAssignedClientIds(new Set(assigned));
    setIsModalOpen(true);
  };

  const toggleClientAssignment = (clientId: string) => {
    setAssignedClientIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const saveAssignments = async () => {
    if (!selectedRep) return;
    
    try {
      setIsLoading(true);
      
      // We need to update clients.
      // 1. Unassign all clients currently assigned to this rep (if not in the new set)
      const currentAssigned = clients.filter(c => c.assigned_rep_id === selectedRep.id).map(c => c.id);
      const toRemove = currentAssigned.filter(id => !assignedClientIds.has(id));
      const toAdd = Array.from(assignedClientIds).filter(id => !currentAssigned.includes(id));
      
      if (toRemove.length > 0) {
        await supabase
          .from('clients')
          .update({ assigned_rep_id: null })
          .in('id', toRemove);
      }
      
      if (toAdd.length > 0) {
        await supabase
          .from('clients')
          .update({ assigned_rep_id: selectedRep.id })
          .in('id', toAdd);
      }
      
      // Unassign prospects as well if we were doing prospects, but we'll stick to clients for MVP
      
      await loadData(); // Reload to refresh counts
      setIsModalOpen(false);
    } catch (error) {
      logError('Error saving assignments', error);
      alert('حدث خطأ أثناء حفظ التعيينات');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">إدارة المناديب</h2>
          <p className="text-gray-500 mt-1 text-sm">إدارة مبيعات الميدان وتعيين العملاء لهم</p>
        </div>
        <button
          onClick={() => alert('يرجى إضافة المندوب كـ"مستخدم جديد" من صفحة "إدارة المستخدمين" ثم تحديد دوره كمندوب مبيعات.')}
          className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          إضافة مندوب
        </button>
        {regions.length > 0 && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          >
            <option value="all">كل الفروع</option>
            {regions.map(r => (
              <option key={r.id} value={r.id}>{r.name_ar}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading && reps.length === 0 ? (
          <div className="col-span-full flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : reps.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">لا يوجد مناديب</h3>
            <p className="text-gray-500 mt-1">لم يتم إضافة أي مندوب مبيعات حتى الآن.</p>
          </div>
        ) : (
          reps
          .filter(rep => selectedBranch === 'all' || (rep as any).region_id === selectedBranch)
          .map(rep => {
            const repClientsCount = clients.filter(c => c.assigned_rep_id === rep.id).length;
            const repBranch = regions.find(r => r.id === (rep as any).region_id);
            
            return (
              <div key={rep.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {rep.full_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{rep.full_name}</h3>
                    <p className="text-sm text-gray-500">{rep.email}</p>
                    {rep.is_active ? (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">نشط</span>
                    ) : (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full">غير نشط</span>
                    )}
                    {repBranch && (
                      <span className="inline-block mt-1 mr-1 px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">
                        <Building2 className="w-3 h-3 inline-block ml-0.5" />{repBranch.name_ar}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-2">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{repClientsCount} عميل مرتبط</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Link 
                      to={`/reps/${rep.id}`}
                      className="text-gray-600 hover:text-primary font-medium text-sm flex items-center gap-1 bg-gray-100 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      عرض الملف
                    </Link>
                    <button 
                      onClick={() => openAssignmentModal(rep)}
                      className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1 bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      توزيع العملاء
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Assignment Modal */}
      {isModalOpen && selectedRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">تعيين العملاء</h3>
                <p className="text-sm text-gray-500">للمندوب: {selectedRep.full_name}</p>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-bold">
                {assignedClientIds.size} محدد
              </div>
            </div>
            
            <div className="p-4 border-b border-gray-100">
              <input
                type="text"
                placeholder="ابحث عن عميل بالاسم أو المنطقة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                {clients
                  .filter(c => {
                    const repRegionId = (selectedRep as any)?.region_id;
                    if (repRegionId && c.region_id !== repRegionId) {
                      return false; // Skip if client is not in the rep's branch
                    }
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      return c.name_ar.toLowerCase().includes(q) || (c.region?.name_ar.toLowerCase().includes(q));
                    }
                    return true;
                  })
                  .map(client => {
                    const isAssignedToThis = assignedClientIds.has(client.id);
                    const isAssignedToOther = !isAssignedToThis && client.assigned_rep_id && client.assigned_rep_id !== selectedRep.id;
                    
                    return (
                      <div 
                        key={client.id}
                        onClick={() => toggleClientAssignment(client.id)}
                        className={clsx(
                          "p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3",
                          isAssignedToThis 
                            ? "border-primary bg-primary/5" 
                            : isAssignedToOther 
                              ? "border-amber-200 bg-amber-50 opacity-80" 
                              : "border-gray-100 hover:border-gray-300"
                        )}
                      >
                        <div className={clsx(
                          "w-5 h-5 rounded border mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors",
                          isAssignedToThis ? "bg-primary border-primary" : "border-gray-300 bg-white"
                        )}>
                          {isAssignedToThis && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-gray-900 truncate">{client.name_ar}</h4>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {client.region?.name_ar || 'منطقة غير محددة'}
                          </p>
                          {isAssignedToOther && (
                            <p className="text-[10px] font-bold text-amber-700 mt-1 bg-amber-100 w-fit px-1.5 py-0.5 rounded">
                              معين حالياً لمندوب آخر
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isLoading}
              >
                إلغاء
              </button>
              <button 
                onClick={saveAssignments}
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                حفظ التعيينات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
