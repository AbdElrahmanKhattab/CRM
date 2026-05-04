import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useDebug } from '../components/debug/DebugProvider';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const { logError, logInfo } = useDebug();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Create Company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName })
        .select()
        .single();
        
      if (companyError) throw companyError;
      logInfo('Company created', company);

      // 2. Sign Up User with metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_id: company.id,
            role: 'owner'
          }
        }
      });

      if (authError) throw authError;
      
      logInfo('User signed up', authData);
      setSuccess(true);
      
      // Note: If email confirmation is enabled, user needs to check email.
      // If disabled, they are logged in or can login.
      if (authData.session) {
          navigate('/dashboard');
      }

    } catch (err: any) {
      logError('Registration failed', err);
      setError(err.message || 'حدث خطأ أثناء التسجيل');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white p-8 shadow rounded-lg text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">تم إنشاء الحساب بنجاح!</h2>
          <p className="text-gray-600 mb-6">
            يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب (إذا كان التفعيل مطلوباً)، ثم سجل الدخول.
          </p>
          <Link to="/login" className="text-primary font-bold hover:underline">
            الانتقال لصفحة تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-extrabold text-gray-900">إنشاء حساب جديد</h2>
        <p className="mt-2 text-sm text-gray-600">سجل شركتك وابدأ إدارة المبيعات</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100 text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشركة</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                dir="ltr"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
              >
                {isLoading ? 'جاري الإنشاء...' : 'إنشاء الحساب والشركة'}
              </button>
            </div>

            <div className="text-center text-sm text-gray-500 mt-4">
              لديك حساب بالفعل؟{' '}
              <Link to="/login" className="text-primary font-bold hover:underline">
                سجل دخولك هنا
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
