import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchFollowupAlerts, dismissAlert, FollowupAlert } from '../../lib/alerts';
import { AlertCircle, Calendar, Phone, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AlertsCard() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<FollowupAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-refresh timer to load alerts if left open
  useEffect(() => {
    if (profile?.company_id && profile?.id) {
      loadAlerts();
    }
  }, [profile]);

  const loadAlerts = async () => {
    setLoading(true);
    const data = await fetchFollowupAlerts(profile!.company_id, profile!.id, profile!.role);
    setAlerts(data);
    setLoading(false);
  };

  const handleDismiss = async (alert: FollowupAlert) => {
    try {
      await dismissAlert(profile!.company_id, profile!.id, alert.alert_type, alert.reference_id);
      setAlerts(prev => prev.filter(a => !(a.alert_type === alert.alert_type && a.reference_id === alert.reference_id)));
    } catch(err) {
      console.error(err);
    }
  };

  if (loading) return null;
  if (alerts.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <h3 className="text-lg font-bold text-gray-800">تنبيهات المتابعة</h3>
        <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full mr-2">
          {alerts.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {alerts.map((alert) => (
          <div key={`${alert.alert_type}-${alert.reference_id}`} className="p-4 border border-red-200 bg-red-50 rounded-xl flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded">
                  {alert.subtitle}
                </span>
                <span className="text-red-700 text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {alert.days_count} يوم
                </span>
              </div>
              
              <h4 className="font-bold text-gray-900 mb-1 line-clamp-1" title={alert.title}>
                {alert.title}
              </h4>
              <p className="text-xs text-gray-600 mb-4">
                المندوب: <span className="font-semibold">{alert.assigned_to || 'غير محدد'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 mt-auto">
              <button 
                onClick={() => window.alert('اتصال مباشر غير مدعوم في النسخة الحالية')}
                className="flex-1 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-medium rounded-lg text-sm px-3 py-2 text-center inline-flex items-center justify-center gap-1 transition-colors"
                title="اتصال"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">اتصال</span>
              </button>
              
              <Link 
                to={`/visits/schedule?${alert.alert_type === 'prospect_followup' ? 'prospect_id' : 'client_id'}=${alert.reference_id}`}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors"
                title="جدولة زيارة"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">جدولة موعد</span>
              </Link>

              <button 
                onClick={() => handleDismiss(alert)}
                className="text-gray-400 hover:text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg p-2 transition-colors relative group"
                title="إخفاء (7 أيام)"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  إخفاء 7 أيام
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
