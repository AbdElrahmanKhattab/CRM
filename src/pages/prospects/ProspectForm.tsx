import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Prospect, Region, ClientCategory, LeadStatus, LeadSource, InterestLevel } from '../../types';
import { Save, ArrowRight, Target, User, MapPin, Building2, Phone, Briefcase, Globe } from 'lucide-react';
import { useForm as useHookForm } from 'react-hook-form';
import LocationPicker from '../../components/map/LocationPicker';

type FormData = Omit<Prospect, 'id' | 'company_id' | 'user_id' | 'created_at' | 'updated_at' | 'converted_client_id'>;

const CATEGORIES: { value: ClientCategory; label: string }[] = [
  { value: 'pharmacies', label: 'صيدليات' },
  { value: 'optics', label: 'بصريات' },
  { value: 'beauty', label: 'تجميل' },
  { value: 'distribution', label: 'توزيع' },
];

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'targeted', label: 'مستهدف' },
  { value: 'potential', label: 'عميل محتمل' },
  { value: 'field_visit', label: 'زيارة ميدانية' },
  { value: 'contacted', label: 'تم التواصل' },
];

const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'social_media', label: 'سوشيال ميديا' },
  { value: 'field_visit', label: 'زيارة ميدانية' },
  { value: 'referral', label: 'ترشيح' },
  { value: 'personal_visit', label: 'زيارة شخصية' },
  { value: 'other', label: 'أخرى' },
];

const INTEREST_LEVELS: { value: InterestLevel; label: string }[] = [
  { value: 'interested', label: 'مهتم' },
  { value: 'needs_follow_up', label: 'يحتاج متابعة' },
  { value: 'potential', label: 'محتمل' },
  { value: 'not_interested', label: 'غير مهتم' },
];

export default function ProspectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  const isEditing = Boolean(id);

  const [regions, setRegions] = useState<Region[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);

  const { register, handleSubmit, formState: { errors }, reset, control, setValue, watch } = useHookForm<FormData>({
    defaultValues: {
      lead_status: 'potential',
      lead_source: 'field_visit',
      branch_count: 1,
    }
  });

  useEffect(() => {
    if (profile?.company_id) {
      loadRegions();
      if (isEditing) {
        loadProspect();
      }
    }
  }, [profile?.company_id, id]);

  const loadRegions = async () => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('name_ar');

      if (error) throw error;
      setRegions(data || []);
    } catch (error) {
      logError('Error loading regions', error);
    }
  };

  const loadProspect = async () => {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        reset(data);
      }
    } catch (error) {
      logError('Error loading prospect', error);
      navigate('/prospects');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!profile?.company_id || !profile?.id) return;
    setIsSubmitting(true);

    try {
      const payload = {
        ...data,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
        company_id: profile.company_id,
        user_id: profile.id, // Prospect belongs to the creator
        visit_date: new Date().toISOString(), // automatically track interaction
      };

      if (isEditing) {
        const { error } = await supabase
          .from('prospects')
          .update(payload)
          .eq('id', id);

        if (error) throw error;
        logInfo('Prospect updated', { id });
      } else {
        const { error } = await supabase
          .from('prospects')
          .insert([payload]);

        if (error) throw error;
        logInfo('Prospect created', { name: data.target_client_name });
      }

      navigate('/prospects');
    } catch (error) {
      logError('Error saving prospect', error);
      alert('حدث خطأ أثناء حفظ البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <button
          onClick={() => navigate('/prospects')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-cairo text-gray-900">
            {isEditing ? 'تعديل عميل مستهدف' : 'إضافة عميل مستهدف جديد'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">أدخل بيانات العميل المستهدف لبدء المتابعة</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Pipeline Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            حالة المتابعة
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المرحلة</label>
              <select
                {...register('lead_status', { required: true })}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
              >
                {LEAD_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">مصدر العميل</label>
              <select
                {...register('lead_source')}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
              >
                {LEAD_SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">درجة الاهتمام</label>
              <select
                {...register('interest_level')}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
              >
                <option value="">-- اختر --</option>
                {INTEREST_LEVELS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            البيانات الأساسية
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">اسم النشاط <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="text"
                  {...register('target_client_name', { required: 'الاسم مطلوب' })}
                  className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50 pr-10"
                  placeholder="مثال: بصريات المها"
                />
                <Building2 className="w-5 h-5 text-gray-400 absolute right-3 top-3.5" />
              </div>
              {errors.target_client_name && <p className="mt-1 text-sm text-red-600">{errors.target_client_name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">التصنيف</label>
              <div className="relative">
                <select
                  {...register('category')}
                  className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50 pr-10"
                >
                  <option value="">-- اختر تصنيف --</option>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <Briefcase className="w-5 h-5 text-gray-400 absolute right-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">عدد الفروع</label>
              <input
                type="number"
                min="1"
                {...register('branch_count')}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">الشخص المسؤول</label>
              <div className="relative">
                <input
                  type="text"
                  {...register('contact_person')}
                  className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50 pr-10"
                  placeholder="اسم المسؤول"
                />
                <User className="w-5 h-5 text-gray-400 absolute right-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">رقم الجوال</label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  {...register('phone')}
                  className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50 pl-10 text-right"
                  placeholder="05xxxxxxxx"
                />
                <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            العنوان والموقع
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المنطقة</label>
              <select
                {...register('region_id')}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
              >
                <option value="">-- اختر منطقة --</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>{r.name_ar}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">الحي</label>
              <input
                type="text"
                {...register('district_name')}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">العنوان بالتفصيل</label>
              <input
                type="text"
                {...register('address')}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
              />
            </div>
            
            <div className="md:col-span-2 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">الإحداثيات الجغرافية (تحديد على الخريطة خياري)</label>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">خط العرض (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    {...register('latitude', { valueAsNumber: true })}
                    className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
                    placeholder="24.7136"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">خط الطول (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    {...register('longitude', { valueAsNumber: true })}
                    className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
                    placeholder="46.6753"
                  />
                </div>
              </div>
              
              <LocationPicker 
                latitude={watch('latitude') && !isNaN(watch('latitude') as number) ? Number(watch('latitude')) : undefined} 
                longitude={watch('longitude') && !isNaN(watch('longitude') as number) ? Number(watch('longitude')) : undefined}
                onChange={(lat, lng) => {
                  setValue('latitude', Number(lat.toFixed(6)), { shouldValidate: true, shouldDirty: true });
                  setValue('longitude', Number(lng.toFixed(6)), { shouldValidate: true, shouldDirty: true });
                }}
              />
              <p className="text-xs text-gray-400 mt-2">انقر على الخريطة لتحديد الموقع أو قم بإدخال الإحداثيات يدوياً.</p>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-500" /> الموقع الإلكتروني (اختياري)
              </label>
              <input
                type="url"
                dir="ltr"
                {...register('website')}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50 text-right"
                placeholder="https://"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات والتفاصيل</label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full rounded-xl border-gray-300 focus:border-primary focus:ring-primary text-gray-900 p-3 bg-gray-50/50"
                placeholder="تفاصيل التحدث الأولي أو أي معلومات أخرى..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/prospects')}
            className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors font-medium disabled:opacity-70"
          >
            <Save className="w-5 h-5" />
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ البيانات'}
          </button>
        </div>
      </form>
    </div>
  );
}
