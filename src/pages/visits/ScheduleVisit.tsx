import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Calendar, User, FileText, Save, X, Building2 } from 'lucide-react';

export default function ScheduleVisit() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const clientIdParam = searchParams.get('client_id');
  const prospectIdParam = searchParams.get('prospect_id');

  const [clients, setClients] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState(clientIdParam || '');
  const [selectedProspectId, setSelectedProspectId] = useState(prospectIdParam || '');
  const [selectedRepId, setSelectedRepId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [visitType, setVisitType] = useState('routine');

  const isManager = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'supervisor';

  useEffect(() => {
    if (!profile?.company_id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [clientsRes, prospectsRes, repsRes] = await Promise.all([
          supabase
            .from('clients')
            .select('id, name_ar, rep_id')
            .eq('company_id', profile.company_id),
          supabase
            .from('prospects')
            .select('id, name_ar, rep_id')
            .eq('company_id', profile.company_id),
          isManager 
            ? supabase
                .from('user_profiles')
                .select('id, full_name')
                .eq('company_id', profile.company_id)
                .eq('role', 'rep')
                .eq('is_active', true)
            : Promise.resolve({ data: [] })
        ]);

        if (clientsRes.data) setClients(clientsRes.data);
        if (prospectsRes.data) setProspects(prospectsRes.data);
        if (repsRes.data) setReps(repsRes.data);

        // Auto-set the rep if client/prospect is pre-selected
        if (clientIdParam && clientsRes.data) {
          const client = clientsRes.data.find(c => c.id === clientIdParam);
          if (client?.rep_id) setSelectedRepId(client.rep_id);
        } else if (prospectIdParam && prospectsRes.data) {
          const prospect = prospectsRes.data.find(p => p.id === prospectIdParam);
          if (prospect?.rep_id) setSelectedRepId(prospect.rep_id);
        } else if (!isManager) {
          setSelectedRepId(profile.id);
        }

      } catch (err) {
        logError('Error loading scheduling data', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [profile, isManager, clientIdParam, prospectIdParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate) {
      alert('يرجى اختيار موعد الزيارة');
      return;
    }
    if (!selectedRepId) {
      alert('يرجى اختيار المندوب');
      return;
    }
    if (!selectedClientId && !selectedProspectId) {
      alert('يرجى اختيار العميل أو العميل المحتمل');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('visits')
        .insert({
          company_id: profile?.company_id,
          rep_id: selectedRepId,
          client_id: selectedClientId || null,
          prospect_id: selectedProspectId || null,
          visit_date: scheduledDate, // Use scheduled date as visit_date for calendar
          scheduled_at: scheduledDate,
          purpose: purpose || 'زيارة مجدولة من الإدارة',
          notes,
          visit_type: visitType,
          status: 'planned', // This status makes it appear differently in calendar
          is_verified: false
        });

      if (error) throw error;
      
      logInfo('Visit scheduled successfully');
      navigate('/calendar');
    } catch (err) {
      logError('Error scheduling visit', err);
      alert('حدث خطأ أثناء جدولة الزيارة');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">جدولة موعد زيارة</h2>
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        
        {/* Date/Time Picker */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">موعد الزيارة</label>
          <div className="relative">
            <Calendar className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="datetime-local"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Rep Selection (Only for managers) */}
        {isManager ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">المندوب المسؤول</label>
            <div className="relative">
              <User className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
              <select
                required
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary bg-white"
              >
                <option value="">اختر المندوب...</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
            سيتم جدولة الزيارة لجدولك الـخاص
          </div>
        )}

        {/* Client Selection */}
        {!prospectIdParam && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">العميل</label>
            <div className="relative">
              <Building2 className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedProspectId('');
                  const client = clients.find(c => c.id === e.target.value);
                  if (isManager && client?.rep_id) setSelectedRepId(client.rep_id);
                }}
                className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary bg-white disabled:opacity-50"
                disabled={!!clientIdParam}
              >
                <option value="">اختر العميل...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name_ar}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Prospect Selection */}
        {(prospectIdParam || (!clientIdParam && !selectedClientId)) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">العميل المحتمل</label>
            <div className="relative">
              <Building2 className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
              <select
                value={selectedProspectId}
                onChange={(e) => {
                  setSelectedProspectId(e.target.value);
                  setSelectedClientId('');
                  const prospect = prospects.find(p => p.id === e.target.value);
                  if (isManager && prospect?.rep_id) setSelectedRepId(prospect.rep_id);
                }}
                className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary bg-white disabled:opacity-50"
                disabled={!!prospectIdParam}
              >
                <option value="">اختر عميل محتمل...</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name_ar}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Visit Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">نوع الزيارة</label>
          <select
            value={visitType}
            onChange={(e) => setVisitType(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          >
            <option value="routine">روتينية</option>
            <option value="collection">تحصيل</option>
            <option value="sales">مبيعات</option>
            <option value="delivery">توصيل</option>
          </select>
        </div>

        {/* Purpose */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">الغرض من الزيارة</label>
          <div className="relative">
            <FileText className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="مثال: متابعة توريد، عرض عينات..."
              className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">ملاحظات إضافية</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="تعليمات خاصة للمندوب..."
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          <span>جدولة الموعد</span>
        </button>
      </form>
    </div>
  );
}
