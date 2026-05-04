import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MapPin, Calendar, Clock, User, FileText, ArrowRight, Image as ImageIcon } from 'lucide-react';

export default function VisitDetails() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  const navigate = useNavigate();
  
  const [visit, setVisit] = useState<any>(null);
  const [photo, setPhoto] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id && profile?.company_id) {
      loadVisitDetails();
    }
  }, [id, profile]);

  const loadVisitDetails = async () => {
    try {
      setIsLoading(true);
      
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .select(`
          *,
          client:clients(name, phone, address),
          rep:user_profiles!visits_rep_id_fkey(full_name)
        `)
        .eq('id', id)
        .eq('company_id', profile!.company_id)
        .single();
        
      if (visitError) throw visitError;
      setVisit(visitData);

      // Load associated photos if any
      const { data: photoData, error: photoError } = await supabase
        .from('visit_photos')
        .select('*')
        .eq('visit_id', id)
        .limit(1)
        .maybeSingle();

      if (photoError) throw photoError;
      setPhoto(photoData);

      logInfo('Visit details loaded', { visitData, photoData });
    } catch (error) {
      logError('Error loading visit details', error);
      navigate('/visits');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-500">جاري تحميل تفاصيل الزيارة...</div>;
  }

  if (!visit) {
    return <div className="p-12 text-center text-red-500">الزيارة غير موجودة</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/visits" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">تفاصيل الزيارة</h2>
          <p className="text-sm text-gray-500 mt-1">
            تمت بواسطة {visit.rep?.full_name} في {format(new Date(visit.visit_date), 'd MMMM yyyy', { locale: ar })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Details Panel */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">معلومات العميل</h3>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-bold text-lg text-gray-900">{visit.client?.name || 'عميل غير محدد'}</div>
                  <div className="text-gray-600 text-sm mt-1">{visit.client?.phone || 'لا يوجد رقم هاتف'}</div>
                  <div className="text-gray-500 text-sm mt-1">{visit.client?.address || 'لا يوجد عنوان'}</div>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100"></div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">وصف الزيارة</h3>
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-900">{visit.purpose}</div>
                  {visit.notes && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-gray-700 text-sm leading-relaxed border border-gray-100">
                      {visit.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar details */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">الحالة والموقع</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">الحالة</span>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                visit.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {visit.status === 'completed' ? 'مكتملة' : 'مجدولة'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">التوثيق</span>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                visit.is_verified ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {visit.is_verified ? 'موثق' : 'غير موثق'}
              </span>
            </div>

            {(visit.latitude && visit.longitude) && (
              <div className="pt-4 border-t border-gray-100">
                <a 
                  href={`https://maps.google.com/?q=${visit.latitude},${visit.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between w-full p-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">عرض على الخريطة</span>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Photo Panel */}
          {photo && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> صورة الزيارة
              </h3>
              <a href={photo.photo_url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg">
                <img src={photo.photo_url} alt="الزيارة" className="w-full h-48 object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="text-white opacity-0 group-hover:opacity-100 font-medium bg-black/60 px-3 py-1.5 rounded-full text-sm">عرض بالحجم الكامل</span>
                </div>
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
