import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Region } from '../../types';
import { Plus, Edit2, Trash2, Building2, Users, Briefcase, X } from 'lucide-react';
import clsx from 'clsx';

interface BranchStats {
  id: string;
  name_ar: string;
  name_en: string | null;
  clientCount: number;
  repCount: number;
  totalVisits: number;
  totalCollections: number;
}

export default function BranchManagement() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const [branches, setBranches] = useState<BranchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Region | null>(null);
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.company_id) loadBranches();
  }, [profile]);

  const loadBranches = async () => {
    try {
      setIsLoading(true);

      // Load regions
      const { data: regionsData, error: regErr } = await supabase
        .from('regions')
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('name_ar');
      if (regErr) throw regErr;

      // Load client counts per region
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, region_id')
        .eq('company_id', profile!.company_id);

      // Load rep counts per region
      const { data: repsData } = await supabase
        .from('user_profiles')
        .select('id, region_id')
        .eq('company_id', profile!.company_id)
        .eq('role', 'rep');

      // Load visits
      const { data: visitsData } = await supabase
        .from('visits')
        .select('id, client_id, collection_amount')
        .eq('company_id', profile!.company_id);

      const clientRegionMap = new Map<string, string>();
      (clientsData || []).forEach((c: any) => { if (c.region_id) clientRegionMap.set(c.id, c.region_id); });

      const stats: BranchStats[] = (regionsData || []).map((r: any) => {
        const branchVisits = (visitsData || []).filter((v: any) => clientRegionMap.get(v.client_id) === r.id);
        
        return {
          id: r.id,
          name_ar: r.name_ar,
          name_en: r.name_en,
          clientCount: (clientsData || []).filter((c: any) => c.region_id === r.id).length,
          repCount: (repsData || []).filter((rp: any) => rp.region_id === r.id).length,
          totalVisits: branchVisits.length,
          totalCollections: branchVisits.reduce((sum: number, v: any) => sum + (Number(v.collection_amount) || 0), 0)
        };
      });

      setBranches(stats);
      logInfo('Branches loaded', { count: stats.length });
    } catch (err) {
      logError('Error loading branches', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingBranch(null);
    setFormNameAr('');
    setFormNameEn('');
    setIsModalOpen(true);
  };

  const openEditModal = (b: BranchStats) => {
    setEditingBranch({ id: b.id, company_id: profile!.company_id, name_ar: b.name_ar, name_en: b.name_en || undefined });
    setFormNameAr(b.name_ar);
    setFormNameEn(b.name_en || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNameAr.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingBranch) {
        const { error } = await supabase
          .from('regions')
          .update({ name_ar: formNameAr.trim(), name_en: formNameEn.trim() || null })
          .eq('id', editingBranch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('regions')
          .insert({ company_id: profile!.company_id, name_ar: formNameAr.trim(), name_en: formNameEn.trim() || null });
        if (error) throw error;
      }
      setIsModalOpen(false);
      await loadBranches();
    } catch (err) {
      logError('Error saving branch', err);
      alert('حدث خطأ أثناء حفظ الفرع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const branch = branches.find(b => b.id === id);
    if (branch && (branch.clientCount > 0 || branch.repCount > 0)) {
      alert('لا يمكن حذف فرع لديه عملاء أو مناديب مرتبطين. يرجى نقلهم أولاً.');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف فرع "${name}"؟`)) return;
    try {
      const { error } = await supabase.from('regions').delete().eq('id', id);
      if (error) throw error;
      await loadBranches();
    } catch (err) {
      logError('Error deleting branch', err);
      alert('حدث خطأ أثناء حذف الفرع');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">إدارة الفروع</h2>
          <p className="text-gray-500 mt-1 text-sm">إضافة وتعديل فروع الشركة</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          إضافة فرع
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">لا توجد فروع</h3>
          <p className="text-gray-500 mt-1">ابدأ بإضافة فروع الشركة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((b) => (
            <div key={b.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{b.name_ar}</h3>
                    {b.name_en && <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{b.name_en}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(b)}
                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    title="تعديل"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id, b.name_ar)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>{b.clientCount} عميل</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Briefcase className="w-4 h-4 text-green-500" />
                  <span>{b.repCount} مندوب</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  <span>{b.totalVisits} زيارة</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                  <span>{b.totalCollections.toFixed(0)} ر.س محصلة</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingBranch ? 'تعديل الفرع' : 'إضافة فرع جديد'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفرع (عربي)</label>
                <input
                  type="text"
                  required
                  value={formNameAr}
                  onChange={(e) => setFormNameAr(e.target.value)}
                  placeholder="مثال: فرع جدة"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفرع (إنجليزي) — اختياري</label>
                <input
                  type="text"
                  value={formNameEn}
                  onChange={(e) => setFormNameEn(e.target.value)}
                  placeholder="e.g. Jeddah Branch"
                  dir="ltr"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editingBranch ? 'حفظ التعديلات' : 'إضافة الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
