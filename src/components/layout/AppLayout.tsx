import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Users, UserPlus, MapPin, LogOut, Menu, Map } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthProvider';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const navigation = [
    { name: 'الرئيسية', href: '/dashboard', icon: Home, roles: ['owner', 'manager'] },
    { name: 'الزيارات', href: '/visits', icon: MapPin, roles: ['owner', 'manager', 'supervisor', 'rep'] },
    { name: 'العملاء', href: '/clients', icon: Users, roles: ['owner', 'manager', 'supervisor'] },
    { name: 'العملاء المحتملين', href: '/prospects', icon: UserPlus, roles: ['owner', 'manager', 'supervisor', 'rep'] },
    { name: 'الخريطة', href: '/map', icon: Map, roles: ['owner', 'manager', 'supervisor', 'rep'] },
  ];

  const filteredNavigation = navigation.filter(item => 
    !profile || item.roles.includes(profile.role)
  );

  const handleLogout = async () => {
    try {
      await signOut();
      // Router will handle redirect via ProtectedRoute when session becomes null
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 md:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={clsx(
        "fixed md:static inset-y-0 right-0 z-30 w-64 shadow-xl bg-white border-l border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col",
        sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center justify-center p-6 border-b border-gray-100">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-primary to-blue-600">
            نظام المبيعات
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group text-base font-medium",
                      isActive 
                        ? "bg-primary/5 text-primary" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className={clsx(
                      "w-5 h-5",
                      isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-600"
                    )} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center md:hidden px-4">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-auto bg-gray-50">
          {/* Outlet renders the matched route component */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
