import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './modules/dashboard/Dashboard';
import Workflow from './modules/documents/Workflow';
import TaskManager from './modules/tasks/TaskManager';
import UserManagement from './modules/hr/UserManagement';
import Reports from './modules/documents/Reports';
import Income from './modules/finance/Income';
import MyBirthdayWishes from './modules/hr/MyBirthdayWishes';
import SettingsPage from './modules/settings/Settings';
import Login from './modules/auth/Login';
import MeetingSchedule from './modules/schedule/MeetingSchedule';
import ConclusionDocs from './modules/documents/ConclusionDocs';
import AdminLogin from './modules/auth/AdminLogin';
import AIChat from './modules/communication/AIChat';
import AdminPanel from './modules/admin/AdminPanel';
import AppsPortal from './modules/apps/AppsPortal';
import ExecutiveDirectives from './modules/documents/ExecutiveDirectives';
import BusinessFund from './modules/finance/BusinessFund';
import ErrorBoundary from './components/ErrorBoundary';
import BiometricSetupPrompt from './components/BiometricSetupPrompt';
import UpdateNotification from './components/UpdateNotification';
import Timekeeping from './modules/timekeeping/TimekeepingLayout';

import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { DataProvider, useData, initialUsers } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isBiometricEnabled, isPlatformAuthenticatorAvailable, isWebAuthnSupported } from './utils/biometricAuth';

// Constants for localStorage keys
const FIRST_LOGIN_KEY = 'avgflow_first_login_done';
const BIOMETRIC_PROMPT_KEY = 'avgflow_biometric_prompt_shown';

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
        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold border border-indigo-500/50 flex items-center gap-2"
      >
        Đăng nhập bằng tài khoản khác
      </button>
    </div>
  )
};

const MainContent = () => {
  const { currentUser, loading } = useAuth();
  const { users, isLoaded } = useData();

  // State for biometric setup prompt
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  // Effect to check for first login and show biometric prompt
  useEffect(() => {
    const checkFirstLogin = async () => {
      if (!currentUser) return;

      const isFirstLogin = localStorage.getItem(FIRST_LOGIN_KEY) !== 'true';
      const promptShown = localStorage.getItem(BIOMETRIC_PROMPT_KEY) === 'true';
      const biometricAlreadyEnabled = isBiometricEnabled();

      // Check if biometric is available
      const supported = isWebAuthnSupported();
      const available = await isPlatformAuthenticatorAvailable();

      // If first login, mark it as done
      if (isFirstLogin) {
        localStorage.setItem(FIRST_LOGIN_KEY, 'true');
      }

      // Show biometric prompt if:
      // 1. First login OR prompt never shown
      // 2. Biometric is available but not enabled
      // 3. Device supports biometric
      if ((isFirstLogin || !promptShown) && !biometricAlreadyEnabled && supported && available) {
        // Small delay to let the app load
        setTimeout(() => {
          setShowBiometricPrompt(true);
        }, 1500);
      }
    };

    checkFirstLogin();
  }, [currentUser]);

  const handleBiometricPromptClose = () => {
    setShowBiometricPrompt(false);
    localStorage.setItem(BIOMETRIC_PROMPT_KEY, 'true');
  };

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
  const isSuperAdminEmail = ['mcngocsonvualoidan@gmail.com', 'ccmartech.com@gmail.com'].includes((currentUser.email || '').toLowerCase());

  const authorizedUser = users.find(u => u.email.toLowerCase() === currentUser.email?.toLowerCase()) ||
    initialUsers.find(u => u.email.toLowerCase() === currentUser.email?.toLowerCase()) || isSuperAdminEmail; // Allow if Super Admin

  if (!authorizedUser) {
    return <AccessDenied />;
  }

  return (
    <>
      {/* Biometric Setup Prompt */}
      <BiometricSetupPrompt
        isOpen={showBiometricPrompt}
        onClose={handleBiometricPromptClose}
        onSkip={handleBiometricPromptClose}
      />

      <Layout>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="workflow" element={<ErrorBoundary><Workflow /></ErrorBoundary>} />
          <Route path="tasks" element={<ErrorBoundary><TaskManager /></ErrorBoundary>} />
          <Route path="schedule" element={<MeetingSchedule />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="timesheet" element={<Timekeeping />} />
          <Route path="reports" element={<Reports />} />
          <Route path="conclusion-docs" element={<ConclusionDocs />} />
          <Route path="income" element={<Income />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="my-wishes" element={<MyBirthdayWishes />} />
          <Route path="my-wishes" element={<MyBirthdayWishes />} />
          <Route path="ai-chat" element={<AIChat />} />
          <Route path="apps" element={<AppsPortal />} />
          <Route path="executive-directives" element={<ExecutiveDirectives />} />
          <Route path="business-fund" element={<BusinessFund />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Layout>
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <DataProvider>
            <BrowserRouter>
              <UpdateNotification />
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
    </ThemeProvider>
  )
}

export default App;
