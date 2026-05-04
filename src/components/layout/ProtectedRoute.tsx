import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { session, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    // Redirect them to the /login page, but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Handle Role-based restrictions if allowedRoles are provided
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // If user's role is not allowed, redirect them to a default safe route based on their role
    if (profile.role === 'rep') {
      return <Navigate to="/visits" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
