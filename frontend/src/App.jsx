import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';

// Layouts
import PublicLayout from './layouts/PublicLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';

// Guards
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Pages
import HomePage from './pages/HomePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import StatusPage from './pages/StatusPage.jsx';
import IdCardPage from './pages/IdCardPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import AdminRegistrationsPage from './pages/AdminRegistrationsPage.jsx';
import AdminStudentsPage from './pages/AdminStudentsPage.jsx';
import AdminSettingsPage from './pages/AdminSettingsPage.jsx';
import SuccessPage from './pages/SuccessPage.jsx';
import TeamPaymentPage from './pages/TeamPaymentPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <Routes>
          {/* Public Layout with Nested Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="agrigenevent/registerationforstudent" element={<RegisterPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="team-payment" element={<TeamPaymentPage />} />
            <Route path="pay-now" element={<Navigate to="/team-payment" replace />} />
            <Route path="participant-payment" element={<Navigate to="/team-payment" replace />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="check-status" element={<Navigate to="/status" replace />} />
            <Route path="id-card" element={<IdCardPage />} />
            <Route path="pass" element={<Navigate to="/id-card" replace />} />
            <Route path="success/:registrationId" element={<SuccessPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Master Login Portal */}
          <Route path="/master/login" element={<AdminLoginPage />} />

          {/* Protected Master Layout with Nested Routes */}
          <Route
            path="/master"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/master/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="registrations" element={<AdminRegistrationsPage />} />
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="cluster" element={<Navigate to="/master/dashboard" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
