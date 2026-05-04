import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there is an active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login');
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح. يتم توجيهك...' });
      setTimeout(() => {
         navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ. تأكد من أن الرابط صالح.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          تحديث كلمة المرور
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          أدخل كلمة مرور جديدة لحسابك
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {message && (
              <div className={`p-3 rounded-md text-sm border text-center ${
                message.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'
              }`}>
                {message.text}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                dir="ltr"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50"
              >
                {isLoading ? 'جاري التحديث...' : 'حفظ كلمة المرور'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
