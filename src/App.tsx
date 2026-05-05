import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AuthProvider } from './components/auth/AuthProvider';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import UpdatePassword from './pages/UpdatePassword';
import UsersList from './pages/UsersList';
import VisitsList from './pages/visits/VisitsList';
import NewVisit from './pages/visits/NewVisit';
import VisitDetails from './pages/visits/VisitDetails';
import ClientsList from './pages/clients/ClientsList';
import ClientDetails from './pages/clients/ClientDetails';
import ClientForm from './pages/clients/ClientForm';
import ProspectsBoard from './pages/prospects/ProspectsBoard';
import ProspectDetails from './pages/prospects/ProspectDetails';
import ProspectForm from './pages/prospects/ProspectForm';
import MapExplorer from './pages/map/MapExplorer';
import RepsList from './pages/reps/RepsList';
import RepDetails from './pages/reps/RepDetails';
import CalendarView from './pages/calendar/CalendarView';
import ManagerVisits from './pages/visits/ManagerVisits';
import ScheduleVisit from './pages/visits/ScheduleVisit';
import BranchManagement from './pages/branches/BranchManagement';
import BranchReport from './pages/branches/BranchReport';
import { NotificationProvider } from './components/notifications/NotificationProvider';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            
            {/* Protected Routes Wrapper */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<ProtectedRoute allowedRoles={['owner', 'manager']} />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['owner', 'manager', 'supervisor']} />}>
                   <Route path="/users" element={<UsersList />} />
                   <Route path="/reps" element={<RepsList />} />
                   <Route path="/reps/:id" element={<RepDetails />} />
                   <Route path="/manager-visits" element={<ManagerVisits />} />
                   <Route path="/branches" element={<BranchManagement />} />
                   <Route path="/branch-report" element={<BranchReport />} />
                </Route>
                <Route path="/visits" element={<VisitsList />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/visits/new" element={<NewVisit />} />
                <Route path="/visits/schedule" element={<ScheduleVisit />} />
                <Route path="/visits/:id" element={<VisitDetails />} />
                
                <Route path="/clients" element={<ClientsList />} />
                <Route path="/clients/new" element={<ClientForm />} />
                <Route path="/clients/:id" element={<ClientDetails />} />
                <Route path="/clients/:id/edit" element={<ClientForm />} />
  
                <Route path="/prospects" element={<ProspectsBoard />} />
                <Route path="/prospects/new" element={<ProspectForm />} />
                <Route path="/prospects/:id" element={<ProspectDetails />} />
                <Route path="/prospects/:id/edit" element={<ProspectForm />} />
                
                <Route path="/map" element={<MapExplorer />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
