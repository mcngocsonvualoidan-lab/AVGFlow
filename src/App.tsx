import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Workflow from './pages/Workflow';
import TaskManager from './pages/TaskManager';
import UserManagement from './pages/UserManagement';
import Reports from './pages/Reports';
import Income from './pages/Income';
import MyBirthdayWishes from './pages/MyBirthdayWishes';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import MeetingSchedule from './pages/MeetingSchedule';
import ConclusionDocs from './pages/ConclusionDocs';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';

import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { DataProvider, useData, initialUsers } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

const AccessDenied = () => {
  const { logout, currentUser } = useAuth();
  const { t } = useLanguage();
  return (
    <div className="h-screen w-full bg-[#0f172a] flex flex-col items-center justify-center text-white p-4">
      <ShieldAlert size={64} className="text-red-500 mb-6" />
      <h1 className="text-2xl font-bold mb-2 text-center text-red-400">Access Denied</h1>
      <p className="text-slate-400 mb-2 text-center max-w-md">
        {t.auth.permissionDenied}
      </p>
      <div className="mb-8 p-3 bg-white/5 rounded-lg border border-white/10 text-center">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Account</p>
        <p className="font-mono text-emerald-400">{currentUser?.email}</p>
        <p className="text-[10px] text-slate-500 mt-2">Please contact Admin to authorize this email.</p>
      </div>
      <button
        onClick={logout}
        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-sm font-bold border border-white/10"
      >
        {t.auth.logout}
      </button>
    </div>
  )
};

const MainContent = () => {
  const { currentUser, loading } = useAuth();
  const { users, isLoaded } = useData();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading || (currentUser && !isLoaded)) {
    return (
      <div className="h-screen w-full bg-[#0f172a] flex items-center justify-center">
        <Loader2 size={40} className="text-indigo-500 animate-spin" />
        {currentUser && !isLoaded && <p className="ml-3 text-slate-400">Loading system data...</p>}
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  // Check if user exists in our system (Admin Control)
  const authorizedUser = users.find(u => u.email.toLowerCase() === currentUser.email?.toLowerCase()) ||
    initialUsers.find(u => u.email.toLowerCase() === currentUser.email?.toLowerCase());

  if (!authorizedUser) {
    return <AccessDenied />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'workflow' && <Workflow />}
      {activeTab === 'tasks' && <TaskManager />}
      {activeTab === 'schedule' && <MeetingSchedule />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'reports' && <Reports />}
      {activeTab === 'conclusion-docs' && <ConclusionDocs />}
      {activeTab === 'income' && <Income />}
      {activeTab === 'settings' && <SettingsPage />}
      {activeTab === 'my-wishes' && <MyBirthdayWishes />}
    </Layout>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              {/* Admin System Routes */}
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin-panel/:section?" element={<AdminPanel />} />

              {/* Main App Route - Catch All */}
              <Route path="/*" element={<MainContent />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App;
