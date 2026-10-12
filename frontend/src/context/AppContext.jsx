import React, { createContext, useContext, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import failoverApi from '../api/failoverClient.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Statistics State
  const [stats, setStats] = useState({
    totalFilled: 13,
    maxSeats: 250,
    seatsRemaining: 237,
    percentFilled: '5.2',
    database: 'Ready',
    serverNode: 'node-5000'
  });

  // Node & Gateway Failover State
  const [nodeState, setNodeState] = useState({
    activeEndpoint: 'http://localhost:5000/api',
    activeNode: { id: 'node-1', healthy: true, lastLatency: 12, lastStatus: 'ONLINE' },
    allNodes: []
  });

  // Dynamic Settings (WhatsApp community invite link, total seats)
  const [whatsappLink, setWhatsappLink] = useState('https://chat.whatsapp.com/invite/AgriVerseUECourse2026');
  const [settings, setSettings] = useState({
    whatsappLink: 'https://chat.whatsapp.com/invite/AgriVerseUECourse2026',
    totalSeats: 250,
    bookedSeats: 13
  });

  // Active Issued ID Card / Pass for current session
  const [issuedIdCard, setIssuedIdCard] = useState(() => {
    try {
      const saved = sessionStorage.getItem('agri_issued_pass');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const saveIssuedIdCard = (card) => {
    setIssuedIdCard(card);
    try {
      if (card) {
        sessionStorage.setItem('agri_issued_pass', JSON.stringify(card));
      } else {
        sessionStorage.removeItem('agri_issued_pass');
      }
    } catch {}
  };

  // QR Images for payments
  const [qrImages, setQrImages] = useState({ qr1: '' });

  const qrAccounts = [
    {
      id: 'qr1',
      name: 'AgriVerse UE',
      vpa: 'sundarrajan.it@okaxis',
      label: 'QR',
      holder: 'sundarrajan.it'
    }
  ];

  const generateQrs = async () => {
    try {
      const q1 = await QRCode.toDataURL(
        'upi://pay?pa=sundarrajan.it@okaxis&pn=sundarrajan.it&am=350&cu=INR&tn=AgriVerse_UE_Course',
        { width: 340, margin: 1 }
      );
      setQrImages({ qr1: q1 });
    } catch (err) {
      console.warn('QR generation note:', err);
    }
  };

  // Admin Auth State
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('agri_admin_token') || '');
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const saved = localStorage.getItem('agri_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setAdminAuth = (token, user) => {
    setAdminToken(token);
    setAdminUser(user);
    if (token) {
      localStorage.setItem('agri_admin_token', token);
      localStorage.setItem('adminToken', token);
      if (user) localStorage.setItem('agri_admin_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('agri_admin_token');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('agri_admin_user');
    }
  };

  const adminLogout = () => {
    setAdminAuth('', null);
  };

  // Admin Verification Lightbox State
  const [selectedProofLightbox, setSelectedProofLightbox] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [adminRejectNote, setAdminRejectNote] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  // Admin Registrations Roster & Detailed Stats
  const [registrationsList, setRegistrationsList] = useState([]);
  const [adminDashboardStats, setAdminDashboardStats] = useState({
    totalParticipants: 0,
    paidCount: 0,
    unpaidCount: 0,
    pendingVerification: 0,
    verifiedCount: 0,
    rejectedCount: 0,
    capacityLimit: 250,
    currentRegistrations: 13,
    remainingSlots: 237,
    percentFilled: '5.2',
    isOpen: true,
    recentRegistrations: []
  });
  const [exportingExcel, setExportingExcel] = useState(false);

  // Fetch Methods
  const fetchStats = async () => {
    try {
      const res = await failoverApi.get('stats');
      if (res.data) setStats(res.data);
    } catch (err) {
      console.warn('Stats fetch note:', err.message);
    }
  };

  const fetchAdminDashboardStats = async () => {
    try {
      const res = await failoverApi.get('v1/admin/stats');
      if (res.data?.success && res.data.stats) {
        setAdminDashboardStats(res.data.stats);
      }
    } catch (err) {
      console.warn('Admin stats fetch note:', err.message);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await failoverApi.get('settings');
      if (res.data) {
        setSettings(res.data);
        if (res.data.whatsappLink) setWhatsappLink(res.data.whatsappLink);
      }
    } catch (err) {}
  };

  const loadAdminRegistrations = async (token = adminToken) => {
    if (!token) return;
    try {
      const res = await failoverApi.get('v1/admin/registrations', {
        params: { limit: 'all' },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setRegistrationsList(res.data.registrations);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        adminLogout();
      }
    }
  };

  const handleVerifyRegistration = async (id) => {
    setAdminActionLoading(true);
    try {
      const res = await failoverApi.patch(`v1/admin/registrations/${id}/verify`);
      if (res.data?.success && res.data.registration) {
        setRegistrationsList((prev) =>
          prev.map((r) => (r.id === id || r._id === id || r.regNo === id ? res.data.registration : r))
        );
        if (selectedProofLightbox && (selectedProofLightbox.id === id || selectedProofLightbox._id === id)) {
          setSelectedProofLightbox(res.data.registration);
        }
        fetchAdminDashboardStats();
        fetchStats();
        return { success: true, registration: res.data.registration };
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to verify registration';
      alert(msg);
      return { success: false, error: msg };
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRejectRegistration = async (id, rejectionReason) => {
    setAdminActionLoading(true);
    try {
      const res = await failoverApi.patch(`v1/admin/registrations/${id}/reject`, {
        rejectionReason
      });
      if (res.data?.success && res.data.registration) {
        setRegistrationsList((prev) =>
          prev.map((r) => (r.id === id || r._id === id || r.regNo === id ? res.data.registration : r))
        );
        if (selectedProofLightbox && (selectedProofLightbox.id === id || selectedProofLightbox._id === id)) {
          setSelectedProofLightbox(res.data.registration);
        }
        fetchAdminDashboardStats();
        fetchStats();
        return { success: true, registration: res.data.registration };
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to reject registration';
      alert(msg);
      return { success: false, error: msg };
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleToggleEventRegistration = async (isOpen) => {
    const token = adminToken || localStorage.getItem('agri_admin_token') || localStorage.getItem('adminToken');
    try {
      const res = await failoverApi.patch(
        'v1/admin/event/status',
        { isOpen },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      if (res.data?.success) {
        setAdminDashboardStats((prev) => ({ ...prev, isOpen: res.data.isOpen }));
        fetchAdminDashboardStats();
        fetchStats();
        return { success: true, isOpen: res.data.isOpen };
      }
    } catch (err) {
      console.error('Toggle event status error:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to toggle registrations';
      alert(msg);
      return { success: false, error: msg };
    }
  };

  const handleManualRegisterStudent = async (studentData) => {
    setAdminActionLoading(true);
    try {
      const res = await failoverApi.post('v1/admin/students', studentData);
      if (res.data?.success && res.data.registration) {
        setRegistrationsList((prev) => [res.data.registration, ...prev]);
        fetchAdminDashboardStats();
        fetchStats();
        return { success: true, registration: res.data.registration };
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create offline registration';
      return { success: false, error: msg };
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleEditStudent = async (id, studentData) => {
    setAdminActionLoading(true);
    try {
      const res = await failoverApi.patch(`v1/admin/students/${id}`, studentData);
      if (res.data?.success && res.data.registration) {
        setRegistrationsList((prev) =>
          prev.map((r) => (r.id === id || r._id === id || r.regNo === id ? res.data.registration : r))
        );
        fetchAdminDashboardStats();
        return { success: true, registration: res.data.registration };
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update student details';
      return { success: false, error: msg };
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminUpdateStatus = async (id, status, notes = '') => {
    setAdminActionLoading(true);
    try {
      const res = await failoverApi.patch(
        `v1/admin/registrations/${id}/status`,
        { status, adminNotes: notes, rejectionReason: notes }
      );
      if (res.data?.success && res.data.registration) {
        setRegistrationsList((prev) =>
          prev.map((r) => (r.id === id || r._id === id ? res.data.registration : r))
        );
        if (selectedProofLightbox && (selectedProofLightbox.id === id || selectedProofLightbox._id === id)) {
          setSelectedProofLightbox(res.data.registration);
        }
        fetchAdminDashboardStats();
        fetchStats();
        return { success: true };
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
      return { success: false, error: err.response?.data?.error };
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleExportExcel = async (status = 'ALL', residency = 'ALL') => {
    setExportingExcel(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const statusPart = (status || 'ALL').toUpperCase().replace(/\s+/g, '_');
      const residencyPart = (residency || 'ALL').toUpperCase().replace(/\s+/g, '_');
      const defaultFilename = `Team_Registrations_${statusPart}_${residencyPart}_${dateStr}.xlsx`;

      const res = await failoverApi.get('v1/admin/export/excel', {
        params: { status, residency },
        headers: { Authorization: `Bearer ${adminToken}` },
        responseType: 'blob'
      });

      let filename = defaultFilename;
      const disposition = res.headers['content-disposition'] || res.headers['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to stream Excel report: ' + (err.response?.data?.error || err.message));
    } finally {
      setExportingExcel(false);
    }
  };

  // Subscriptions & Lifecycle
  useEffect(() => {
    const unsubscribe = failoverApi.subscribe((state) => {
      setNodeState(state);
    });

    fetchStats();
    fetchSettings();
    generateQrs();

    const interval = setInterval(fetchStats, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        stats,
        fetchStats,
        nodeState,
        whatsappLink,
        setWhatsappLink,
        settings,
        fetchSettings,
        issuedIdCard,
        setIssuedIdCard: saveIssuedIdCard,
        qrAccounts,
        qrImages,
        generateQrs,
        adminToken,
        adminUser,
        setAdminAuth,
        adminLogout,
        selectedProofLightbox,
        setSelectedProofLightbox,
        lightboxZoom,
        setLightboxZoom,
        adminRejectNote,
        setAdminRejectNote,
        adminActionLoading,
        handleAdminUpdateStatus,
        handleVerifyRegistration,
        handleRejectRegistration,
        handleToggleEventRegistration,
        handleManualRegisterStudent,
        handleEditStudent,
        adminDashboardStats,
        fetchAdminDashboardStats,
        registrationsList,
        setRegistrationsList,
        loadAdminRegistrations,
        exportingExcel,
        handleExportExcel
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
