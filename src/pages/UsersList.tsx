import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth, UserProfile } from '../components/auth/AuthProvider';
import { useDebug } from '../components/debug/DebugProvider';
import { Plus, UserX, Shield, Briefcase, Building2 } from 'lucide-react';
import { Region } from '../types';

export default function UsersList() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  
  // New user form state
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'manager' | 'supervisor' | 'rep'>('rep');
  const [newUserBranch, setNewUserBranch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);

  // We create a secondary client so we don't log out the admin when creating a new user
  const secondarySupabase = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  );

  useEffect(() => {
    if (profile?.company_id) {
      loadUsers();
    }
  }, [profile]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data as UserProfile[]);
      logInfo('Users loaded', data);

      // Load branches
      const { data: regionsData } = await supabase
        .from('regions')
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('name_ar');
      setRegions((regionsData || []) as Region[]);
    } catch (error) {
      logError('Error loading users', error);
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: signUpError } = await secondarySupabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserFullName,
            company_id: profile!.company_id,
            role: newUserRole
          }
        }
      });
      
      if (signUpError) throw signUpError;
      
      // Delay slightly to give triggers time to create user_profile
      await new Promise(res => setTimeout(res, 500));

      // If a branch was selected, update the profile
      if (newUserBranch) {
        // Find the newly created profile by email
        const { data: newProfiles } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', newUserEmail)
          .limit(1);
        if (newProfiles && newProfiles.length > 0) {
          await supabase
            .from('user_profiles')
            .update({ region_id: newUserBranch })
            .eq('id', newProfiles[0].id);
        }
      }
      
      await loadUsers();
      closeModal();
    } catch (err: any) {
      logError('Error creating user', err);
      setError(err.message || 'حدث خطأ أثناء إنشاء المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsAddUserModalOpen(false);
    setNewUserFullName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole('rep');
    setNewUserBranch('');
    setError(null);
  };

  const roleText = {
    owner: 'مدير النظام',
    manager: 'مدير مبيعات',
    supervisor: 'مشرف',
    rep: 'مندوب مبيعات',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h2>
          <p className="text-gray-500 mt-1 text-sm">إدارة فريق العمل والصلاحيات</p>
        </div>
        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          إضافة مستخدم
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المستخدم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الدور
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الفرع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    لا يوجد مستخدمين مسجلين
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium text-lg">
                            {user.full_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm">
                        {user.role === 'owner' || user.role === 'manager' ? (
                          <Shield className="w-4 h-4 text-purple-500" />
                        ) : (
                          <Briefcase className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="text-gray-700">{roleText[user.role]}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {regions.find(r => r.id === (user as any).region_id)?.name_ar || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button className="text-gray-400 hover:text-red-600 transition-colors" title="إيقاف الحساب">
                        <UserX className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal Mock */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">إضافة مستخدم جديد</h3>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100 text-center">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور (دخول المستخدم)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">دور المستخدم</label>
                <select
                  required
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="rep">مندوب مبيعات (Rep)</option>
                  <option value="supervisor">مشرف (Supervisor)</option>
                  <option value="manager">مدير مبيعات (Manager)</option>
                </select>
                {newUserRole === 'rep' && (
                  <p className="text-xs text-gray-500 mt-1">
                    بعد إضافة المندوب، يمكنك تعيين العملاء له من صفحة "المناديب".
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفرع</label>
                <select
                  value={newUserBranch}
                  onChange={(e) => setNewUserBranch(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="">بدون فرع</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.name_ar}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-4 border-t gap-3">
                <button 
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'إضافة مستخدم'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
