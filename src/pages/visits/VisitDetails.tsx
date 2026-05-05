import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MapPin, Calendar, Clock, User, FileText, ArrowRight, Image as ImageIcon, Briefcase, DollarSign, FileDigit } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const TYPE_LABELS: Record<string, string> = {
  routine: 'روتينية',
  collection: 'تحصيل',
  sales: 'مبيعات',
  delivery: 'توصيل',
};

export default function VisitDetails() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  const navigate = useNavigate();
  
  const [visit, setVisit] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
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
          client:clients(name_ar, phone, address),
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
        .eq('visit_id', id);

      if (photoError) throw photoError;
      setPhotos(photoData || []);

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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(amount || 0);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/visits" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">تفاصيل الزيارة</h2>
          <p className="text-sm text-gray-500 mt-1">
            تمت بواسطة {visit.rep?.full_name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Details Panel */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            
            {/* Client Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">معلومات العميل</h3>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-primary mt-0.5" />
                <div>
                   <div className="font-bold text-lg text-gray-900">{visit.client?.name_ar || 'عميل غير محدد'}</div>
                  <div className="text-gray-600 text-sm mt-1">{visit.client?.phone || 'لا يوجد رقم هاتف'}</div>
                  <div className="text-gray-500 text-sm mt-1">{visit.client?.address || 'لا يوجد عنوان'}</div>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100"></div>

            {/* Visit Data */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">بيانات الزيارة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <span className="block text-xs text-gray-500 mb-0.5">التاريخ والوقت</span>
                    <span className="font-medium text-gray-900 text-sm block" dir="ltr">
                      {format(new Date(visit.visit_date), 'd MMMM yyyy - hh:mm a', { locale: ar })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <Briefcase className="w-5 h-5 text-indigo-500 mt-0.5" />
                  <div>
                    <span className="block text-xs text-gray-500 mb-0.5">نوع الزيارة</span>
                    <span className="font-medium text-gray-900 text-sm block">
                      {TYPE_LABELS[visit.visit_type] || visit.visit_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financials if applicable */}
              {(visit.sales_amount > 0 || visit.collection_amount > 0 || visit.invoice_number) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  {visit.sales_amount > 0 && (
                    <div className="flex items-start gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                      <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <span className="block text-xs text-green-800 mb-0.5">المبيعات</span>
                        <span className="font-bold text-green-900 text-sm block">{formatCurrency(visit.sales_amount)}</span>
                      </div>
                    </div>
                  )}
                  {visit.collection_amount > 0 && (
                    <div className="flex items-start gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <span className="block text-xs text-blue-800 mb-0.5">التحصيلات</span>
                        <span className="font-bold text-blue-900 text-sm block">{formatCurrency(visit.collection_amount)}</span>
                      </div>
                    </div>
                  )}
                  {visit.invoice_number && (
                    <div className="flex items-start gap-3 bg-purple-50 p-3 rounded-lg border border-purple-100">
                      <FileDigit className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <span className="block text-xs text-purple-800 mb-0.5">رقم الفاتورة</span>
                        <span className="font-bold text-purple-900 text-sm block">{visit.invoice_number}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Next Appointment */}
              {visit.next_appointment && (
                <div className="flex items-start gap-3 bg-orange-50 p-3 rounded-lg border border-orange-100 mb-4">
                  <Clock className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <span className="block text-xs text-orange-800 mb-0.5">موعد الزيارة القادمة</span>
                    <span className="font-bold text-orange-900 text-sm block" dir="ltr">
                      {format(new Date(visit.next_appointment), 'd MMMM yyyy - hh:mm a', { locale: ar })}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="w-full">
                  <div className="font-medium text-gray-900">{visit.purpose}</div>
                  {visit.notes && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-gray-700 text-sm leading-relaxed border border-gray-100 w-full">
                      {visit.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Map Integration */}
            {(visit.latitude && visit.longitude) && (
              <>
                <div className="h-px bg-gray-100"></div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    الموقع الجغرافي
                  </h3>
                  <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-200 relative z-0">
                    <MapContainer 
                      center={[visit.latitude, visit.longitude]} 
                      zoom={15} 
                      style={{ height: '100%', width: '100%', zIndex: 1 }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      <Marker position={[visit.latitude, visit.longitude]}>
                        <Popup>موقع تسجيل الزيارة</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>
              </>
            )}

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
                    <span className="text-sm font-medium">فتح في خرائط جوجل</span>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Photo Panel */}
          {photos.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> المرفقات ({photos.length})
              </h3>
              
              <div className="space-y-5">
                {photos.map((p, index) => (
                  <div key={index} className="space-y-2">
                    <span className="inline-block text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                      {p.photo_type === 'store_photo' ? 'صورة المحل / العميل' : 
                       p.photo_type === 'receipt_photo' ? 'صورة المستند / الفاتورة' : 'صورة مرفقة'}
                    </span>
                    <a href={p.photo_url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg border border-gray-200">
                      <img src={p.photo_url} alt="الزيارة" className="w-full h-48 object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 font-medium bg-black/60 px-3 py-1.5 rounded-full text-sm">عرض بالحجم الكامل</span>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
