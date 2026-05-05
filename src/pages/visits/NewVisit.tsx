import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { useDebug } from '../../components/debug/DebugProvider';
import { useGeolocation } from '../../hooks/useGeolocation';
import { MapPin, Camera, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NewVisit() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  const navigate = useNavigate();
  
  // Geolocation
  const { lat, lng, timestamp, error: geoError, isLoading: isGeoLoading, getLocation } = useGeolocation();

  // Form State
  const [clientId, setClientId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [visitType, setVisitType] = useState('routine');
  const [salesAmount, setSalesAmount] = useState<number>(0);
  const [collectionAmount, setCollectionAmount] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [nextAppointment, setNextAppointment] = useState('');
  
  // File State
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [receiptPhotoFile, setReceiptPhotoFile] = useState<File | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (clientId && clients.length > 0) {
      const client = clients.find(c => c.id === clientId);
      setSelectedClient(client || null);
    } else {
      setSelectedClient(null);
    }
  }, [clientId, clients]);

  useEffect(() => {
    // Load clients for the dropdown
    const loadClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select(`
            id, 
            name_ar, 
            category, 
            legacy_code, 
            latitude,
            longitude,
            district_id, 
            districts(name_ar), 
            region_id, 
            regions(name_ar)
          `)
          .eq('company_id', profile?.company_id);
        
        if (error) throw error;
        setClients(data || []);
      } catch (err) {
        logError('Error fetching clients', err);
      }
    };
    
    if (profile?.company_id) {
      loadClients();
    }
  }, [profile]);

  // Removed auto-location fetch so user must manually capture location & time

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>, isReceipt = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (isReceipt) {
        setReceiptPhotoFile(file);
        setReceiptPreviewUrl(URL.createObjectURL(file));
        logInfo('Receipt photo captured');
      } else {
        setPhotoFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        logInfo('Store photo captured');
      }
    }
  };

  const clearPhoto = (isReceipt = false) => {
    if (isReceipt) {
      setReceiptPhotoFile(null);
      setReceiptPreviewUrl(null);
      if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
    } else {
      setPhotoFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uploadPhoto = async (visitId: string, prefix: string, file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${visitId}_${prefix}_${Date.now()}.${fileExt}`;
    const filePath = `${profile?.company_id}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('visit_photos')
      .upload(filePath, file);
      
    if (uploadError) {
      logError(`Photo upload failed for ${prefix}`, uploadError);
      throw uploadError;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('visit_photos')
      .getPublicUrl(filePath);
      
    return publicUrl;
  };

  // Haversine formula: returns distance in meters between two lat/lng points
  const getDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const MAX_DISTANCE_METERS = 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
        logError('Client ID is missing');
        alert('يرجى اختيار العميل');
        return;
    }
    
    if (!lat || !lng || !timestamp) {
      alert('يجب التقاط الموقع الجغرافي والوقت للزيارة أولاً');
      return;
    }

    // Proximity check: user must be within 500m of the selected client
    if (selectedClient?.latitude && selectedClient?.longitude) {
      const distance = getDistanceMeters(lat, lng, Number(selectedClient.latitude), Number(selectedClient.longitude));
      if (distance > MAX_DISTANCE_METERS) {
        alert(`أنت بعيد عن موقع العميل بمسافة ${Math.round(distance)} متر. يجب أن تكون على بعد ${MAX_DISTANCE_METERS} متر أو أقل من موقع العميل لتسجيل الزيارة.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      
      // 1. Create Visit Record
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          company_id: profile?.company_id,
          rep_id: profile?.id,
          client_id: clientId,
          visit_date: timestamp,
          latitude: lat,
          longitude: lng,
          purpose,
          notes,
          status: 'completed',
          visit_type: visitType,
          sales_amount: salesAmount,
          collection_amount: collectionAmount,
          invoice_number: invoiceNumber,
          next_appointment: nextAppointment || null,
          is_verified: true
        })
        .select()
        .single();
        
      if (visitError) throw visitError;
      
      logInfo('Visit created', visit);

      // 2. Upload Photos if present
      const uploadAndLinkPhoto = async (file: File, type: string) => {
        const url = await uploadPhoto(visit.id, type, file);
        if (url) {
          const { error } = await supabase.from('visit_photos').insert({
            visit_id: visit.id,
            photo_url: url,
            photo_type: type,
            latitude: lat,
            longitude: lng
          });
          if (error) throw error;
        }
      };

      if (photoFile && visit) {
        await uploadAndLinkPhoto(photoFile, 'store_photo');
      }
      
      if (receiptPhotoFile && visit) {
        await uploadAndLinkPhoto(receiptPhotoFile, 'receipt_photo');
      }

      navigate('/visits');
    } catch (err) {
      logError('Error submitting visit', err);
      alert('حدث خطأ أثناء حفظ الزيارة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">تسجيل زيارة جديدة</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        
        {/* GPS Location Panel */}
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-2">الموقع الجغرافي والوقت</h4>
            
            {!lat || !lng ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-blue-700 mb-1">يجب التقاط الموقع الحالي ووقت الزيارة للمتابعة</p>
                <button 
                  type="button" 
                  onClick={getLocation} 
                  disabled={isGeoLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 w-fit disabled:opacity-50"
                >
                  {isGeoLoading ? 'جاري تحديد الموقع...' : 'التقاط الموقع والوقت'}
                </button>
                {geoError && <p className="text-sm text-red-600 mt-1">{geoError}</p>}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-green-700 font-mono">
                  إحداثيات: {lat.toFixed(6)}, {lng.toFixed(6)}
                </p>
                {timestamp && (
                  <p className="text-sm text-green-700">
                    وقت الالتقاط: {new Date(timestamp).toLocaleString('ar-SA')}
                  </p>
                )}
                <button type="button" onClick={getLocation} disabled={isGeoLoading} className="text-blue-600 underline text-xs mt-2 inline-block">
                  {isGeoLoading ? 'جاري التحديث...' : 'تحديث الموقع'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">العميل</label>
          <select 
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100"
          >
            <option value="">اختر العميل...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name_ar}</option>
            ))}
          </select>
          {clients.length === 0 && (
             <p className="text-xs text-orange-500 mt-1">لا يوجد عملاء مضافين. يرجى إضافة عملاء أولاً.</p>
          )}
        </div>

        {selectedClient && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm mt-3">
            <div>
              <span className="text-gray-500 block mb-1">تصنيف العميل</span>
              <span className="font-semibold text-gray-900">
                {selectedClient.category === 'beauty' ? 'تجميل' : 
                 selectedClient.category === 'optics' ? 'بصريات' : 
                 selectedClient.category === 'pharmacies' ? 'صيدليات' : 'غير محدد'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">كود العميل</span>
              <span className="font-semibold text-gray-900">{selectedClient.legacy_code || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">الفرع</span>
              <span className="font-semibold text-gray-900">{selectedClient.regions?.name_ar || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">الحي</span>
              <span className="font-semibold text-gray-900">{selectedClient.districts?.name_ar || '-'}</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">نوع الزيارة</label>
          <select 
            required
            value={visitType}
            onChange={(e) => setVisitType(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="routine">روتينية</option>
            <option value="collection">تحصيل</option>
            <option value="sales">مبيعات</option>
            <option value="delivery">توصيل</option>
          </select>
        </div>

        {(visitType === 'sales' || visitType === 'collection') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visitType === 'sales' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">قيمة المبيعات</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  required
                  value={salesAmount}
                  onChange={(e) => setSalesAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            )}
            
            {(visitType === 'collection' || visitType === 'sales') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">قيمة التحصيلات</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  required={visitType === 'collection'}
                  value={collectionAmount}
                  onChange={(e) => setCollectionAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            )}
            
            <div className="md:col-span-2 text-red-500">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-black">رقم الفاتورة (إن وجد)</label>
              <input 
                type="text" 
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="رقم الفاتورة أو السند"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الغرض من الزيارة</label>
          <input 
            type="text" 
            required
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="مثال: عرض منتجات جديدة، متابعة مديونية..."
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات الزيارة</label>
          <textarea 
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="دون أهم مجريات الزيارة والطلبات..."
          ></textarea>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">موعد الزيارة القادمة (إن وجد)</label>
          <input 
            type="datetime-local" 
            value={nextAppointment}
            onChange={(e) => setNextAppointment(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Photo Capture */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">صورة المحل / العميل</label>
          
          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-primary hover:text-primary transition-colors gap-3"
            >
              <Camera className="w-8 h-8" />
              <span>التقط صورة للمحل (أو اختر من المعرض)</span>
            </button>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-gray-200">
              <img src={previewUrl} alt="Preview" className="w-full h-64 object-cover" />
              <button
                type="button"
                onClick={() => clearPhoto(false)}
                className="absolute top-2 left-2 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Hidden file input with "capture" triggers mobile camera specifically */}
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={fileInputRef}
            onChange={(e) => handlePhotoCapture(e, false)}
          />
        </div>

        {/* Receipt Photo Capture */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">صورة المستند أو الفاتورة</label>
          
          {!receiptPreviewUrl ? (
            <button
              type="button"
              onClick={() => receiptFileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-primary hover:text-primary transition-colors gap-3"
            >
              <Camera className="w-8 h-8" />
              <span>التقط صورة للمستند (أو اختر من المعرض)</span>
            </button>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-gray-200">
              <img src={receiptPreviewUrl} alt="Preview" className="w-full h-64 object-cover" />
              <button
                type="button"
                onClick={() => clearPhoto(true)}
                className="absolute top-2 left-2 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={receiptFileInputRef}
            onChange={(e) => handlePhotoCapture(e, true)}
          />
        </div>

        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitting || !lat || !lng || !timestamp}
            className="w-full bg-primary text-white py-3 px-4 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {isSubmitting ? (
              <span>جاري الحفظ والرفع...</span>
            ) : (
              <>
               <Save className="w-5 h-5" />
               <span>حفظ الزيارة</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
