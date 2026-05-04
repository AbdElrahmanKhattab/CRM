import { useState, useEffect } from 'react';

interface LocationState {
  lat: number | null;
  lng: number | null;
  timestamp: string | null;
  error: string | null;
  isLoading: boolean;
}

export function useGeolocation() {
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    timestamp: null,
    error: null,
    isLoading: false,
  });

  const getLocation = () => {
    setIsLoading(true);
    if (!navigator.geolocation) {
      setLocation({
        lat: null,
        lng: null,
        timestamp: null,
        error: 'تحديد الموقع غير مدعوم في هذا المتصفح',
        isLoading: false,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: new Date(position.timestamp).toISOString(),
          error: null,
          isLoading: false,
        });
      },
      (error) => {
        let errorMsg = 'حدث خطأ غير معروف.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'الرجاء السماح بصلاحيات الموقع.';
            break;
        }
        setLocation({
          lat: null,
          lng: null,
          timestamp: null,
          error: errorMsg,
          isLoading: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const setIsLoading = (loading: boolean) => setLocation(prev => ({ ...prev, isLoading: loading }));

  return { ...location, getLocation };
}
