import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, UserProfile } from '../components/auth/AuthProvider';
import { useDebug } from '../components/debug/DebugProvider';
import { Plus, UserX, Shield, Briefcase } from 'lucide-react';

export default function UsersList() {
  const { profile } = useAuth();
  const { logError, logInfo } = useDebug();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

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
    } catch (error) {
      logError('Error loading users', error);
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
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
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
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
            <p className="text-sm text-gray-500 mb-6">
              ملاحظة: في المرحلة الحالية، يرجى إرسال دعوة للمستخدم عبر لوحة تحكم Supabase، ثم إضافة بياناته هنا.
            </p>
            <div className="flex justify-end pt-4 border-t">
              <button 
                onClick={() => setIsAddUserModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
