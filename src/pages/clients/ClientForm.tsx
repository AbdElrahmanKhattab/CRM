import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { Region, District, ClientCategory, ClientGrade } from '../../types';
import { Save, ArrowRight, Building2, MapPin } from 'lucide-react';
import clsx from 'clsx';
import LocationPicker from '../../components/map/LocationPicker';

type ClientFormData = {
  name_ar: string;
  legacy_code: string;
  category: ClientCategory | '';
  grade: ClientGrade | '';
  region_id: string;
  district_id: string;
  address: string;
  contact_person: string;
  phone: string;
  notes: string;
  is_active: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

export default function ClientForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditing);
  
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ClientFormData>({
    defaultValues: {
      is_active: true,
      category: '',
      grade: 'unclassified',
    }
  });

  const selectedRegion = watch('region_id');

  useEffect(() => {
    loadRegions();
    if (isEditing) {
      loadClient();
    }
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      loadDistricts(selectedRegion);
    } else {
      setDistricts([]);
    }
  }, [selectedRegion]);

  const loadRegions = async () => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('name_ar');
      if (error) throw error;
      setRegions(data || []);
    } catch (err) {
      logError('Failed to load regions', err);
    }
  };

  const loadDistricts = async (regionId: string) => {
    try {
      const { data, error } = await supabase
        .from('districts')
        .select('*')
        .eq('region_id', regionId)
        .order('name_ar');
      if (error) throw error;
      setDistricts(data || []);
    } catch (err) {
      logError('Failed to load districts', err);
    }
  };

  const loadClient = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;

      setValue('name_ar', data.name_ar);
      setValue('legacy_code', data.legacy_code || '');
      setValue('category', data.category as ClientCategory);
      setValue('grade', data.grade as ClientGrade);
      setValue('region_id', data.region_id || '');
      
      // Load districts for the region before setting the district_id
      if (data.region_id) {
        await loadDistricts(data.region_id);
      }
      
      setValue('district_id', data.district_id || '');
      setValue('address', data.address || '');
      setValue('contact_person', data.contact_person || '');
      setValue('phone', data.phone || '');
      setValue('notes', data.notes || '');
      setValue('is_active', data.is_active);
      setValue('latitude', data.latitude || null);
      setValue('longitude', data.longitude || null);

    } catch (err) {
      logError('Failed to load client details for editing', err);
    } finally {
      setIsFetching(false);
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    try {
      const payload = {
        company_id: profile!.company_id,
        name_ar: data.name_ar,
        legacy_code: data.legacy_code || null,
        category: data.category,
        grade: data.grade,
        region_id: data.region_id || null,
        district_id: data.district_id || null,
        address: data.address,
        contact_person: data.contact_person,
        phone: data.phone,
        notes: data.notes,
        is_active: data.is_active,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
        logInfo('Client updated successfully');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([payload]);
        if (error) throw error;
        logInfo('Client created successfully');
      }

      navigate('/clients');
    } catch (err) {
      logError('Form submission failed', err);
      alert('حدث خطأ أثناء الحفظ. يرجى مراجعة الكود أو المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Guard: Only Supervisor+ can access
  if (['rep'].includes(profile?.role || '')) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-red-600">غير مصرح</h2>
        <p className="mt-2 text-gray-500">ليس لديك صلاحية لإضافة أو تعديل العملاء.</p>
        <button onClick={() => navigate('/clients')} className="mt-4 text-primary underline">عودة للعملاء</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
        >
          <ArrowRight className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {isEditing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        
        {/* Core Settings */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            البيانات الأساسية
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل (المنشأة) *</label>
              <input
                type="text"
                {...register('name_ar', { required: 'مطلوب' })}
                className={clsx(
                  "w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none",
                  errors.name_ar ? "border-red-500" : "border-gray-300"
                )}
              />
              {errors.name_ar && <span className="text-xs text-red-500">{errors.name_ar.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كود النظام القديم (اختياري)</label>
              <input
                type="text"
                {...register('legacy_code')}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="Ex. 1066"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الفئة (التخصص) *</label>
              <select
                {...register('category', { required: 'مطلوب' })}
                className={clsx(
                  "w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none",
                  errors.category ? "border-red-500" : "border-gray-300"
                )}
              >
                <option value="">-- اختر الفئة --</option>
                <option value="beauty">تجميل</option>
                <option value="optics">بصريات</option>
                <option value="pharmacies">صيدليات</option>
                <option value="distribution">شركات التوزيع</option>
              </select>
              {errors.category && <span className="text-xs text-red-500">{errors.category.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف (A/B/C/D) *</label>
              <select
                {...register('grade', { required: 'مطلوب' })}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="unclassified">غير مصنف</option>
                <option value="A">فئة A</option>
                <option value="B">فئة B</option>
                <option value="C">فئة C</option>
                <option value="D">فئة D</option>
              </select>
            </div>
          </div>
        </div>

        {/* Location Features */}
        <div className="space-y-4 pt-2">
          <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            الموقع الجغرافي
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الفرع</label>
              <select
                {...register('region_id')}
                className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- اختر الفرع --</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحي / المربع</label>
              <select
                {...register('district_id')}
                disabled={!selectedRegion || districts.length === 0}
                className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
              >
                <option value="">-- اختر الحي --</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">العنوان التفصيلي</label>
              <input
                type="text"
                {...register('address')}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="رقم المبنى، الشارع، المعالم القريبة..."
              />
            </div>
            
            <div className="md:col-span-2 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">الإحداثيات الجغرافية (خياري)</label>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">خط العرض (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    {...register('latitude', { valueAsNumber: true })}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary"
                    placeholder="24.7136"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">خط الطول (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    {...register('longitude', { valueAsNumber: true })}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary"
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
              <p className="text-xs text-gray-400 mt-1">انقر على الخريطة لتحديد الموقع أو قم بإدخال الإحداثيات يدوياً.</p>
            </div>
          </div>
        </div>

        {/* Contact Info & Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشخص المسؤول</label>
            <input
              type="text"
              {...register('contact_person')}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
            <input
              type="text"
              dir="ltr"
              {...register('phone')}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات هامة</label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="أي تفاصيل أخرى تخص زيارة العميل أو التوصيات المادية..."
            ></textarea>
          </div>
        </div>

        {/* Status Toggle */}
        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div>
            <h4 className="font-medium text-gray-900">حالة العميل</h4>
            <p className="text-xs text-gray-500">العميل غير النشط لن يظهر في قوائم الزيارات اليومية للمناديب.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input type="checkbox" {...register('is_active')} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
             <Save className="w-5 h-5" />
             {isLoading ? 'جاري الحفظ...' : 'حفظ بيانات العميل'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isLoading}
            className="flex-1 bg-white text-gray-700 border border-gray-300 py-3 rounded-lg font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
             إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
