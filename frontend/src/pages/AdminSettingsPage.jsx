import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, Check, AlertCircle, Save, ExternalLink, QrCode,
  Users, Plus, Trash2, ToggleLeft, ToggleRight, Edit2, Upload,
  Copy, RefreshCw, Sparkles, X, ShieldCheck, ArrowRight, Image as ImageIcon
} from 'lucide-react';
import failoverApi from '../api/failoverClient.js';
import { useApp } from '../context/AppContext.jsx';

export default function AdminSettingsPage() {
  const { adminToken, fetchStats, setWhatsappLink } = useApp();

  // General Settings State
  const [generalForm, setGeneralForm] = useState({
    isOpen: true,
    registrationLimit: 500,
    fee: 350,
    whatsappLink: 'https://chat.whatsapp.com/invite/AgriVerseUECourse2026'
  });

  // Multiple QR Codes State
  const [qrList, setQrList] = useState([]);
  const [qrFiles, setQrFiles] = useState([]);
  const [qrTitle, setQrTitle] = useState('');
  const [qrUpiId, setQrUpiId] = useState('');
  const [editingQr, setEditingQr] = useState(null);
  const fileInputRef = useRef(null);

  // WhatsApp Groups State
  const [waGroups, setWaGroups] = useState([]);
  const [newWaGroup, setNewWaGroup] = useState({
    name: '',
    inviteUrl: '',
    priority: 1
  });
  const [editingWaGroup, setEditingWaGroup] = useState(null);

  // Feedback & Loading States
  const [loading, setLoading] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [uploadingQrs, setUploadingQrs] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedUpi, setCopiedUpi] = useState('');

  // Fetch complete settings
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await failoverApi.get('v1/admin/settings');
      if (res.data?.success && res.data.settings) {
        const s = res.data.settings;
        setGeneralForm({
          isOpen: s.isOpen !== false,
          registrationLimit: s.registrationLimit || s.totalSeats || 500,
          fee: s.fee !== undefined ? s.fee : 350,
          whatsappLink: s.whatsappLink || 'https://chat.whatsapp.com/invite/AgriVerseUECourse2026'
        });
        setQrList(s.qrCodes || []);
        setWaGroups(s.whatsappGroups || []);
        if (s.whatsappLink) setWhatsappLink(s.whatsappLink);
      }
    } catch (err) {
      console.warn('Settings load notice:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const clearAlertsAfterDelay = () => {
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 4000);
  };

  // 1. SAVE GENERAL SETTINGS
  const handleToggleGate = async () => {
    const nextState = !generalForm.isOpen;
    setGeneralForm((prev) => ({ ...prev, isOpen: nextState }));
    try {
      await failoverApi.patch('v1/admin/event/status', { isOpen: nextState });
      await failoverApi.put('v1/admin/settings', { ...generalForm, isOpen: nextState });
      fetchStats();
      setMessage(`Registrations are now ${nextState ? 'OPEN' : 'CLOSED'} globally.`);
      clearAlertsAfterDelay();
    } catch (err) {
      console.warn('Live gate toggle notice:', err.message);
    }
  };

  const handleSaveGeneral = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingGeneral(true);
    setMessage('');
    setError('');

    try {
      const res = await failoverApi.put('v1/admin/settings', {
        ...generalForm,
        registrationLimit: Number(generalForm.registrationLimit),
        fee: Number(generalForm.fee),
        registrationFee: Number(generalForm.fee),
        totalSeats: Number(generalForm.registrationLimit)
      });
      await failoverApi.patch('v1/admin/event/status', { isOpen: generalForm.isOpen }).catch(() => {});

      if (res.data?.success) {
        setMessage('Configuration saved successfully!');
        setWhatsappLink(generalForm.whatsappLink);
        fetchStats();
        clearAlertsAfterDelay();
      } else {
        setError(res.data?.error || 'Failed to update settings');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Server error');
    } finally {
      setSavingGeneral(false);
    }
  };

  // 2. MULTIPLE QR CODES HANDLERS
  const handleQrFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 10) {
      alert('You can select a maximum of 10 QR code images at once.');
      setQrFiles(files.slice(0, 10));
    } else {
      setQrFiles(files);
    }
  };

  const handleUploadQrs = async (e) => {
    e.preventDefault();
    if (qrFiles.length === 0) {
      setError('Please select at least one QR image file to upload.');
      return;
    }

    setUploadingQrs(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      qrFiles.forEach((file) => {
        formData.append('qrImages', file);
      });
      if (qrTitle.trim()) formData.append('title', qrTitle.trim());
      if (qrUpiId.trim()) formData.append('upiId', qrUpiId.trim());

      const res = await failoverApi.post('v1/admin/settings/qrs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setMessage(res.data.message || 'QR code(s) uploaded successfully!');
        setQrFiles([]);
        setQrTitle('');
        setQrUpiId('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchSettings();
        clearAlertsAfterDelay();
      } else {
        setError(res.data?.error || 'Failed to upload QR code(s)');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploadingQrs(false);
    }
  };

  const handleToggleQr = async (id) => {
    try {
      const res = await failoverApi.patch(`v1/admin/settings/qrs/${id}/toggle`);
      if (res.data?.success && res.data.qrCode) {
        setQrList((prev) =>
          prev.map((q) => (q.id === id ? res.data.qrCode : q))
        );
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle QR code');
    }
  };

  const handleDeleteQr = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title || 'this QR code'}"? The image asset will be purged automatically from storage.`)) {
      return;
    }

    try {
      const res = await failoverApi.delete(`v1/admin/settings/qrs/${id}`);
      if (res.data?.success) {
        setQrList((prev) => prev.filter((q) => q.id !== id));
        setMessage('QR code deleted and storage asset cleaned up.');
        clearAlertsAfterDelay();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete QR code');
    }
  };

  const handleSaveEditQr = async (e) => {
    e.preventDefault();
    if (!editingQr) return;

    try {
      const res = await failoverApi.patch(`v1/admin/settings/qrs/${editingQr.id}`, {
        title: editingQr.title,
        upiId: editingQr.upiId,
        isActive: editingQr.isActive
      });
      if (res.data?.success && res.data.qrCode) {
        setQrList((prev) =>
          prev.map((q) => (q.id === editingQr.id ? res.data.qrCode : q))
        );
        setEditingQr(null);
        setMessage('QR code details updated.');
        clearAlertsAfterDelay();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update QR code');
    }
  };

  // 3. WHATSAPP GROUPS HANDLERS
  const handleAddWaGroup = async (e) => {
    e.preventDefault();
    if (!newWaGroup.name.trim() || !newWaGroup.inviteUrl.trim()) {
      setError('Community group name and valid invite URL are required.');
      return;
    }

    try {
      const res = await failoverApi.post('v1/admin/settings/whatsapp-groups', {
        name: newWaGroup.name.trim(),
        inviteUrl: newWaGroup.inviteUrl.trim(),
        priority: Number(newWaGroup.priority) || 1
      });

      if (res.data?.success && res.data.group) {
        setWaGroups((prev) => [...prev, res.data.group]);
        setNewWaGroup({ name: '', inviteUrl: '', priority: 1 });
        setMessage('New WhatsApp community group added!');
        clearAlertsAfterDelay();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add WhatsApp group');
    }
  };

  const handleToggleWaGroup = async (id) => {
    try {
      const res = await failoverApi.patch(`v1/admin/settings/whatsapp-groups/${id}/toggle`);
      if (res.data?.success && res.data.group) {
        setWaGroups((prev) =>
          prev.map((g) => (g.id === id ? res.data.group : g))
        );
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle group');
    }
  };

  const handleDeleteWaGroup = async (id, name) => {
    if (!window.confirm(`Delete WhatsApp group "${name}"?`)) return;

    try {
      const res = await failoverApi.delete(`v1/admin/settings/whatsapp-groups/${id}`);
      if (res.data?.success) {
        setWaGroups((prev) => prev.filter((g) => g.id !== id));
        setMessage('WhatsApp community group removed.');
        clearAlertsAfterDelay();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const handleSaveEditWaGroup = async (e) => {
    e.preventDefault();
    if (!editingWaGroup) return;

    try {
      const res = await failoverApi.patch(`v1/admin/settings/whatsapp-groups/${editingWaGroup.id}`, {
        name: editingWaGroup.name,
        inviteUrl: editingWaGroup.inviteUrl,
        priority: Number(editingWaGroup.priority) || 1,
        isActive: editingWaGroup.isActive
      });

      if (res.data?.success && res.data.group) {
        setWaGroups((prev) =>
          prev.map((g) => (g.id === editingWaGroup.id ? res.data.group : g))
        );
        setEditingWaGroup(null);
        setMessage('WhatsApp group updated successfully.');
        clearAlertsAfterDelay();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update group');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedUpi(id);
    setTimeout(() => setCopiedUpi(''), 2000);
  };

  const activeQrCount = qrList.filter((q) => q.isActive !== false && q.active !== false).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF4F4] border border-[#CCE3DE] text-[#15803D] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#84CC16]" />
            <span>AgriVerse Configuration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A3C34] tracking-tight">
            Event Settings &amp; Live Controls
          </h1>
          <p className="text-xs sm:text-sm text-[#3D6153] mt-1">
            Configure registration limits, registration fees, dynamic QR code hot-swapper, and WhatsApp communities.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[#CCE3DE] hover:bg-[#F4F9F6] text-[#1A3C34] text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
          title="Refresh All Settings"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Alerts */}
      {message && (
        <div className="p-4 rounded-2xl bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="cursor-pointer opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="cursor-pointer opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================================
          1. REGISTRATION QUOTA & FEE PARAMETERS
          ====================================================================== */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#CCE3DE] shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#CCE3DE]/70 pb-4">
          <h2 className="text-base sm:text-lg font-black text-[#1A3C34] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#15803D]" />
            <span>Registration Quota &amp; Fee Parameters</span>
          </h2>

          <button
            type="button"
            onClick={handleSaveGeneral}
            disabled={savingGeneral}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#1E5D39] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingGeneral ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Field 1: PARTICIPANT REGISTRATION CAPACITY (LIMIT) */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#6B9080] mb-1.5">
                PARTICIPANT REGISTRATION CAPACITY (LIMIT)
              </label>
              <input
                type="number"
                min="1"
                max="5000"
                required
                value={generalForm.registrationLimit}
                onChange={(e) =>
                  setGeneralForm((prev) => ({
                    ...prev,
                    registrationLimit: Number(e.target.value)
                  }))
                }
                className="w-full px-4 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-sm font-bold text-[#1A3C34] outline-none focus:border-[#15803D]"
              />
              <span className="block text-[10px] text-[#6B9080] mt-1">
                Maximum number of participants admitted
              </span>
            </div>

            {/* Field 2: REGISTRATION FEE (INR PER PARTICIPANT) */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#6B9080] mb-1.5">
                REGISTRATION FEE (₹ INR PER PARTICIPANT)
              </label>
              <input
                type="number"
                min="0"
                max="10000"
                required
                value={generalForm.fee}
                onChange={(e) =>
                  setGeneralForm((prev) => ({
                    ...prev,
                    fee: Number(e.target.value)
                  }))
                }
                className="w-full px-4 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-sm font-bold text-[#1A3C34] outline-none focus:border-[#15803D]"
              />
              <span className="block text-[10px] text-[#6B9080] mt-1">
                Charged per participant (enter 0 for free event)
              </span>
            </div>
          </div>

          {/* Sub-Card: Registrations Toggle Switch */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F4F9F6] border border-[#CCE3DE] flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-[#1A3C34]">Registrations</h3>
              <p className="text-xs text-[#3D6153] mt-0.5">
                Enable or disable submissions on the public portal.
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleGate}
              className={`relative inline-flex items-center h-7 w-14 rounded-full transition-colors cursor-pointer shrink-0 ${
                generalForm.isOpen ? 'bg-[#15803D]' : 'bg-[#6B7280]'
              }`}
            >
              <span
                className={`inline-block w-5 h-5 transform rounded-full bg-white shadow-md transition-transform flex items-center justify-center text-[9px] font-black ${
                  generalForm.isOpen
                    ? 'translate-x-8 text-[#15803D]'
                    : 'translate-x-1 text-[#6B7280]'
                }`}
              >
                {generalForm.isOpen ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* ======================================================================
          2. PAYMENT QR CODES (MULTI-ACCOUNT & FAILOVER)
          ====================================================================== */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#CCE3DE] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CCE3DE]/70 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1A3C34] flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#15803D]" />
              <span>Payment QR Codes (Multi-Account &amp; Failover)</span>
            </h2>
            <p className="text-xs text-[#3D6153] mt-0.5">
              Upload multiple QR codes. All active QRs appear on the registration form so students can switch if one account hits its receiver limit.
            </p>
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]/60 self-start sm:self-auto shrink-0">
            {activeQrCount} Active QRs
          </span>
        </div>

        {/* Sub-Card: Upload New Payment QR Code */}
        <form onSubmit={handleUploadQrs} className="p-4 sm:p-5 rounded-2xl bg-[#F4F9F6] border border-[#CCE3DE] space-y-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#15803D]">
            + UPLOAD NEW PAYMENT QR CODE
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B9080] mb-1">
                Account / QR Name
              </label>
              <input
                type="text"
                placeholder="e.g. Account 1 / GPay Primary"
                value={qrTitle}
                onChange={(e) => setQrTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#CCE3DE] text-xs font-medium text-[#1A3C34] outline-none focus:border-[#15803D]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B9080] mb-1">
                UPI ID / VPA (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. organizer@okaxis"
                value={qrUpiId}
                onChange={(e) => setQrUpiId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#CCE3DE] text-xs font-mono text-[#1A3C34] outline-none focus:border-[#15803D]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B9080] mb-1">
                QR Image File(s) *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleQrFilesChange}
                className="block w-full text-xs text-[#3D6153] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#15803D] file:text-white hover:file:bg-[#1E5D39] cursor-pointer"
              />
              <span className="block text-[9px] text-[#6B9080] mt-1">
                Select one or multiple QR screenshots (or upload one after another).
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={uploadingQrs || qrFiles.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#1E5D39] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {uploadingQrs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-[#84CC16]" />}
              <span>{uploadingQrs ? 'Uploading...' : 'Upload & Add QR'}</span>
            </button>
          </div>
        </form>

        {/* ACTIVE & CONFIGURED QR CODES Grid */}
        <div className="space-y-3">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A3C34]">
            ACTIVE &amp; CONFIGURED QR CODES
          </div>

          {qrList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B9080] bg-[#F4F9F6] rounded-2xl border border-[#CCE3DE]">
              No payment QR codes configured yet. Upload a QR code above.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {qrList.map((qr, idx) => {
                const isActive = qr.isActive !== false && qr.active !== false;
                const qrImageSrc = qr.imageUrl || qr.url;
                return (
                  <div
                    key={qr.id || idx}
                    className="p-3.5 rounded-2xl bg-white border border-[#CCE3DE] shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    {/* Top Row: Title + Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#1A3C34] truncate">
                        {qr.title || `QR (${idx + 1})`}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isActive
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}
                      >
                        {isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    {/* QR Code Preview Frame */}
                    <div className="aspect-square bg-white border border-[#CCE3DE]/70 rounded-xl p-3 flex items-center justify-center overflow-hidden">
                      {qrImageSrc ? (
                        <img
                          src={qrImageSrc}
                          alt={qr.title || 'QR Code'}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-[#6B9080]" />
                      )}
                    </div>

                    {/* Bottom Actions Row: Disable/Enable + Remove */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#CCE3DE]/50 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleQr(qr.id)}
                        className="font-bold text-xs text-[#1A3C34] hover:text-[#15803D] cursor-pointer"
                      >
                        {isActive ? 'Disable' : 'Enable'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteQr(qr.id, qr.title)}
                        className="inline-flex items-center gap-1 font-bold text-xs text-[#DC2626] hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================================
          3. OFFICIAL PARTICIPANT WHATSAPP GROUPS
          ====================================================================== */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#CCE3DE] shadow-sm space-y-6">
        <div className="border-b border-[#CCE3DE]/70 pb-4">
          <h2 className="text-base sm:text-lg font-black text-[#1A3C34] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#15803D]" />
            <span>Official Participant WhatsApp Groups</span>
          </h2>
        </div>

        {/* List of Configured Groups */}
        <div className="space-y-3">
          {waGroups.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6B9080] bg-[#F4F9F6] rounded-2xl border border-[#CCE3DE]">
              No WhatsApp groups added yet. Add an invite link below.
            </div>
          ) : (
            waGroups.map((g) => {
              const isActive = g.isActive !== false && g.active !== false;
              const linkUrl = g.inviteUrl || g.url;
              return (
                <div
                  key={g.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#F4F9F6] border border-[#CCE3DE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-[#1A3C34]">
                        {g.name || 'Group Link'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}
                      >
                        {isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>

                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#15803D] hover:underline flex items-center gap-1 font-mono break-all"
                    >
                      <span>{linkUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleToggleWaGroup(g.id)}
                      className="px-3.5 py-1.5 rounded-xl border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] hover:bg-[#EAF4F4] transition-colors cursor-pointer"
                    >
                      {isActive ? 'Deactivate' : 'Activate'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteWaGroup(g.id, g.name)}
                      className="p-2 rounded-xl text-[#DC2626] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                      title="Delete WhatsApp Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sub-Card: ADD NEW WHATSAPP GROUP */}
        <form onSubmit={handleAddWaGroup} className="space-y-3 pt-2">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A3C34]">
            ADD NEW WHATSAPP GROUP
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              required
              placeholder="Group Name (e.g. Agri-Genomics Track)"
              value={newWaGroup.name}
              onChange={(e) => setNewWaGroup({ ...newWaGroup, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-medium text-[#1A3C34] outline-none focus:border-[#15803D]"
            />

            <input
              type="url"
              required
              placeholder="WhatsApp Invite URL (https://chat.whatsapp.com/...)"
              value={newWaGroup.inviteUrl}
              onChange={(e) => setNewWaGroup({ ...newWaGroup, inviteUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-medium text-[#1A3C34] outline-none focus:border-[#15803D]"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#1E5D39] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add WhatsApp Channel</span>
            </button>
          </div>
        </form>
      </div>

      {/* ======================================================================
          MODAL: EDIT QR CODE
          ====================================================================== */}
      {editingQr && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#CCE3DE] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#CCE3DE] pb-3">
              <h3 className="font-bold text-base text-[#1A3C34]">Edit QR Code</h3>
              <button onClick={() => setEditingQr(null)} className="cursor-pointer text-[#6B9080] hover:text-[#1A3C34]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditQr} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A3C34] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingQr.title || ''}
                  onChange={(e) => setEditingQr({ ...editingQr, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A3C34] mb-1">UPI ID</label>
                <input
                  type="text"
                  required
                  value={editingQr.upiId || ''}
                  onChange={(e) => setEditingQr({ ...editingQr, upiId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-mono font-bold text-[#1A3C34] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#CCE3DE]">
                <button
                  type="button"
                  onClick={() => setEditingQr(null)}
                  className="px-4 py-2 rounded-xl bg-[#EAF4F4] text-xs font-bold text-[#1A3C34] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1A3C34] text-xs font-bold text-white uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL: EDIT WHATSAPP GROUP
          ====================================================================== */}
      {editingWaGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#CCE3DE] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#CCE3DE] pb-3">
              <h3 className="font-bold text-base text-[#1A3C34]">Edit WhatsApp Group</h3>
              <button onClick={() => setEditingWaGroup(null)} className="cursor-pointer text-[#6B9080] hover:text-[#1A3C34]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditWaGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A3C34] mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={editingWaGroup.name || ''}
                  onChange={(e) => setEditingWaGroup({ ...editingWaGroup, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A3C34] mb-1">Invite URL</label>
                <input
                  type="url"
                  required
                  value={editingWaGroup.inviteUrl || ''}
                  onChange={(e) => setEditingWaGroup({ ...editingWaGroup, inviteUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs text-[#1A3C34] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A3C34] mb-1">Priority</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={editingWaGroup.priority || 1}
                  onChange={(e) => setEditingWaGroup({ ...editingWaGroup, priority: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#CCE3DE]">
                <button
                  type="button"
                  onClick={() => setEditingWaGroup(null)}
                  className="px-4 py-2 rounded-xl bg-[#EAF4F4] text-xs font-bold text-[#1A3C34] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1A3C34] text-xs font-bold text-white uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
