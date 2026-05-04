import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Prospect } from '../../types';
import { Building2, MapPin, Phone, User, Calendar, Target, Globe, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import clsx from 'clsx';

export default function ProspectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);

  const canConvert = profile && ['owner', 'manager', 'supervisor'].includes(profile.role);

  useEffect(() => {
    if (id) loadProspect();
  }, [id]);

  const loadProspect = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select(`
          *,
          region:regions(name_ar),
          creator:user_profiles!user_id(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setProspect(data as Prospect);
    } catch (error) {
      logError('Error loading prospect details', error);
      navigate('/prospects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertToClient = async () => {
    if (!prospect || !profile?.company_id) return;
    
    const confirmConvert = window.confirm('هل أنت متأكد من تحويل هذا المستهدف إلى عميل فعلي؟ (لا يمكن التراجع عن هذه الخطوة)');
    if (!confirmConvert) return;

    setIsConverting(true);
    try {
      // 1. Check if similar client exists (Duplicate check MVP logic)
      const { data: existingClients, error: searchError } = await supabase
        .from('clients')
        .select('id, name_ar')
        .eq('company_id', profile.company_id)
        .eq('name_ar', prospect.target_client_name);

      if (searchError) throw searchError;
      
      if (existingClients && existingClients.length > 0) {
        const proceed = window.confirm(`يوجد بالفعل عميل بهذا الاسم (${existingClients[0].name_ar}). هل تريد المتابعة وإنشاء عميل جديد؟`);
        if (!proceed) {
          setIsConverting(false);
          return;
        }
      }

      // 2. Insert into clients
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert([{
          company_id: prospect.company_id,
          name_ar: prospect.target_client_name,
          category: prospect.category,
          region_id: prospect.region_id,
          district_name: prospect.district_name,
          phone: prospect.phone,
          contact_person: prospect.contact_person,
          location_lat: prospect.latitude,
          location_lng: prospect.longitude,
          is_active: true
        }])
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 3. Update prospect
      const { error: updateError } = await supabase
        .from('prospects')
        .update({
          lead_status: 'active',
          converted_client_id: newClient.id
        })
        .eq('id', prospect.id);

      if (updateError) {
        // Rollback strategy is missing for true atomicity, but adequate for MVP
        throw updateError;
      }

      logInfo('Prospect converted to Client', { prospect_id: prospect.id, client_id: newClient.id });
      
      // Reload prospect data
      await loadProspect();
      
      // Optionally navigate to client page
      // navigate(`/clients/${newClient.id}`);
    } catch (error) {
      logError('Error converting prospect', error);
      alert('حدث خطأ أثناء تحويل العميل المستهدف');
    } finally {
      setIsConverting(false);
    }
  };

  if (isLoading || !prospect) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isConverted = prospect.lead_status === 'active' && prospect.converted_client_id;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 sm:p-8 flex items-start justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/prospects')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 h-fit"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-cairo text-gray-900 mb-2">
                {prospect.target_client_name}
              </h1>
              <div className="flex flex-wrap gap-2 items-center text-sm">
                <span className={clsx(
                  "px-3 py-1 rounded-full font-bold",
                  isConverted ? "bg-green-100 text-green-700" : "bg-blue-100 text-primary"
                )}>
                  {isConverted ? 'عميل فعلي' : 'مستهدف'}
                </span>
                {prospect.category && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full flex items-center gap-1">
                    {prospect.category}
                  </span>
                )}
                {prospect.interest_level && !isConverted && (
                  <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full flex items-center gap-1">
                    {prospect.interest_level === 'interested' ? 'مهتم' : prospect.interest_level === 'needs_follow_up' ? 'محتاج متابعة' : prospect.interest_level === 'not_interested' ? 'غير مهتم' : 'محتمل'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            {!isConverted && (
              <Link
                to={`/prospects/${prospect.id}/edit`}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors text-center"
              >
                تعديل البيانات
              </Link>
            )}
            
            {isConverted ? (
              <Link
                 to={`/clients/${prospect.converted_client_id}`}
                 className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm font-medium border border-green-200"
              >
                <CheckCircle2 className="w-4 h-4" />
                تم التحويل لعميل
              </Link>
            ) : (
              canConvert && (
                <button
                  onClick={handleConvertToClient}
                  disabled={isConverting}
                  className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70"
                >
                  {isConverting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                  تحويل لعميل فعلي
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
              <Building2 className="w-5 h-5 text-primary" />
              تفاصيل المستهدف
            </h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-gray-500 mb-1">الشخص المسؤول</p>
                  <p className="font-medium text-gray-900">{prospect.contact_person || 'غير محدد'}</p>
                </div>
              </div>

              <div className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-gray-500 mb-1">رقم الجوال</p>
                  <p className="font-medium text-gray-900 text-left" dir="ltr">{prospect.phone || 'غير محدد'}</p>
                </div>
              </div>

              <div className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-gray-500 mb-1">الموقع (المنطقة / الحي)</p>
                  <p className="font-medium text-gray-900">
                    {/* @ts-ignore */}
                    {prospect.region?.name_ar || 'غير محدد'} 
                    {prospect.district_name && ` / ${prospect.district_name}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-gray-500 mb-1">الموقع الإلكتروني</p>
                  <p className="font-medium text-gray-900 break-all text-left" dir="ltr">
                    {prospect.website ? (
                      <a href={prospect.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {prospect.website}
                      </a>
                    ) : 'غير متوفر'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
              <Target className="w-5 h-5 text-primary" />
              ملاحظات وتاريخ المتابعة
            </h3>
            
            {prospect.notes ? (
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl text-sm">
                {prospect.notes}
              </p>
            ) : (
              <p className="text-gray-400 text-sm italic">لا توجد ملاحظات مسجلة.</p>
            )}
          </div>
        </div>

        {/* Right Column - System Info */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">معلومات النظام</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">تاريخ الإضافة</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {format(new Date(prospect.created_at!), 'dd MMMM yyyy', { locale: ar })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">تمت الإضافة بواسطة</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {/* @ts-ignore */}
                    {prospect.creator?.full_name || 'غير معروف'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
