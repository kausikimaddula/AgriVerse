import React, { useState } from 'react';
import {
  ZoomIn, ZoomOut, X, AlertTriangle, CheckCircle2, XCircle,
  Copy, Check, User, CreditCard, ExternalLink, RefreshCw,
  Building, Calendar, Phone, Mail, ShieldAlert, Sparkles, ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export default function ImageViewerModal() {
  const {
    selectedProofLightbox,
    setSelectedProofLightbox,
    lightboxZoom,
    setLightboxZoom,
    adminActionLoading,
    handleVerifyRegistration,
    handleRejectRegistration,
    handleAdminUpdateStatus
  } = useApp();

  const [copiedTxn, setCopiedTxn] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Transaction ID does not match the screenshot provided');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [directStatus, setDirectStatus] = useState('');

  if (!selectedProofLightbox) return null;

  const reg = selectedProofLightbox;
  const regId = reg.id || reg._id || reg.regNo || reg.registrationId;
  const txnId = reg.transactionId || reg.txnId || 'N/A';
  const proofUrl =
    reg.paymentScreenshot?.url ||
    reg.proofUrl ||
    reg.idProof ||
    reg.paymentProofUrl ||
    (reg.screenshotPath ? `${(import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5050').replace(/\/+$/, '')}/${reg.screenshotPath.replace(/^public\//, '')}` : '');

  const isVerified =
    reg.verificationStatus === 'VERIFIED' ||
    reg.status === 'VERIFIED' ||
    reg.status === 'CONFIRMED';
  const isRejected =
    reg.verificationStatus === 'REJECTED' ||
    reg.status === 'REJECTED';
  const isPending = !isVerified && !isRejected;

  const handleCopyTxn = () => {
    if (txnId && txnId !== 'N/A') {
      navigator.clipboard.writeText(txnId);
      setCopiedTxn(true);
      setTimeout(() => setCopiedTxn(false), 2000);
    }
  };

  const onConfirmVerify = async () => {
    const res = await handleVerifyRegistration(regId);
    if (res?.success) {
      setSelectedProofLightbox(null);
    }
  };

  const onConfirmReject = async () => {
    const finalReason = (customRejectReason.trim() || rejectReason).trim();
    if (!finalReason) {
      alert('Please provide a reason for rejection.');
      return;
    }
    const res = await handleRejectRegistration(regId, finalReason);
    if (res?.success) {
      setShowRejectModal(false);
      setSelectedProofLightbox(null);
    }
  };

  const onDirectStatusChange = async (newStatus) => {
    setDirectStatus(newStatus);
    await handleAdminUpdateStatus(regId, newStatus, `Manually toggled to ${newStatus} via status dropdown`);
  };

  const predefinedReasons = [
    'Transaction ID does not match the screenshot provided',
    'Screenshot shows incomplete transaction',
    'Payment amount is less than ₹350',
    'Screenshot is blurry or illegible',
    'Duplicate transaction reference already utilized'
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in overflow-y-auto">
      <div className="bg-[#0C1513] text-white w-full max-w-5xl rounded-xl border border-white/20 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#132A24]/90">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[#27784A] text-[#84CC16] font-bold">
              {reg.id || reg.registrationId || reg.regNo}
            </span>
            <div>
              <h2 className="font-black text-base sm:text-lg text-white flex items-center gap-2">
                <span>{reg.name || reg.fullName}</span>
                <span className="text-xs font-normal text-[#CCE3DE]">({reg.regNo || reg.registerNumber})</span>
              </h2>
              <p className="text-[11px] text-[#CCE3DE]">
                Verification Audit Lightbox • Submitted Transaction Vetting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Badge */}
            {isVerified && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs font-bold">
                <span>🟢 VERIFIED ✓</span>
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs font-bold">
                <span>🟡 PENDING REVIEW</span>
              </span>
            )}
            {isRejected && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEE2E2] text-[#DC2626] text-xs font-bold">
                <span>🔴 REJECTED</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setSelectedProofLightbox(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Side-by-Side View */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto">
          
          {/* Left Column: Student Profile & Entered UTR Details (md:col-span-5) */}
          <div className="md:col-span-5 p-6 border-b md:border-b-0 md:border-r border-white/10 space-y-5 bg-[#101D19]">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#84CC16] flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Student Enrollment Profile</span>
              </h3>
            </div>

            {/* Profile Grid */}
            <div className="space-y-3 text-xs bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-[#CCE3DE]">Full Name:</span>
                <span className="font-bold text-white text-right">{reg.name || reg.fullName}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-[#CCE3DE]">Register Number:</span>
                <span className="font-mono font-bold text-[#84CC16] text-right">{reg.regNo || reg.registerNumber}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-[#CCE3DE]">Email:</span>
                <span className="font-medium text-white truncate max-w-[200px] text-right">{reg.email}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-[#CCE3DE]">Phone Number:</span>
                <span className="font-mono text-white text-right">{reg.phone}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-[#CCE3DE]">Department:</span>
                <span className="font-bold text-white text-right">{reg.department || reg.branch || 'CSE'}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-[#CCE3DE]">Section &amp; Year:</span>
                <span className="text-white text-right">
                  Sec {reg.section || 'A'} • {reg.year || reg.academicYear || '1st Year'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#CCE3DE]">Residency Status:</span>
                <span className="font-bold text-white text-right">
                  {reg.residency || reg.residencyStatus || 'Day Scholar'}
                </span>
              </div>
            </div>

            {/* Entered Transaction ID Card */}
            <div className="p-4 rounded-xl bg-[#1A3C34] border border-[#27784A] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold text-[#CCE3DE] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#84CC16]" />
                  <span>Entered Transaction / UTR ID</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyTxn}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-mono text-[#84CC16] transition-all cursor-pointer"
                  title="Copy UTR to clipboard"
                >
                  {copiedTxn ? <Check className="w-3 h-3 text-[#84CC16]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTxn ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0C1513] border border-white/10">
                <span className="font-mono font-black text-base text-[#84CC16] tracking-wider block break-all">
                  {txnId}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#CCE3DE] pt-1">
                <span>Fee Amount: <strong>₹350</strong></span>
                <span>Payment: <strong className={isVerified ? 'text-[#84CC16]' : 'text-[#FCD34D]'}>{reg.paymentStatus || 'UNPAID'}</strong></span>
              </div>
            </div>

            {/* Existing Rejection Reason Display if any */}
            {reg.rejectionReason && (
              <div className="p-3.5 rounded-xl bg-[#FEE2E2]/10 border border-[#DC2626]/40 text-xs space-y-1">
                <span className="text-[#DC2626] font-bold block flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Current Rejection Flag:</span>
                </span>
                <p className="font-mono text-[#FCA5A5] text-[11px]">{reg.rejectionReason}</p>
              </div>
            )}

            {/* Direct Status Dropdown */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#CCE3DE] block">
                Direct Status Dropdown:
              </label>
              <div className="relative">
                <select
                  value={directStatus || (isVerified ? 'VERIFIED' : isRejected ? 'REJECTED' : 'PENDING')}
                  onChange={(e) => onDirectStatusChange(e.target.value)}
                  disabled={adminActionLoading}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs font-bold text-white outline-none focus:border-[#84CC16] cursor-pointer"
                >
                  <option value="PENDING" className="bg-[#1A3C34] text-white">🟡 PENDING (Reset back to audit queue)</option>
                  <option value="VERIFIED" className="bg-[#1A3C34] text-white">🟢 VERIFIED (Confirm payment)</option>
                  <option value="REJECTED" className="bg-[#1A3C34] text-white">🔴 REJECTED (Flag invalid proof)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#CCE3DE] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Right Column: Zoomable Payment Receipt Image Lightbox (md:col-span-7) */}
          <div className="md:col-span-7 p-6 flex flex-col bg-[#070D0C]">
            
            {/* Image Canvas Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#CCE3DE]">
                UPI Proof Screenshot
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 min-w-12 text-center">
                  {Math.round(lightboxZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.min(3.5, z + 0.25))}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxZoom(1)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold cursor-pointer"
                >
                  Reset
                </button>
                {proofUrl && (
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center cursor-pointer ml-1"
                    title="Open full image in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Image Viewport */}
            <div className="flex-1 min-h-[350px] overflow-auto flex items-center justify-center bg-black/60 rounded-xl border border-white/10 p-3 relative">
              {proofUrl ? (
                <img
                  src={proofUrl}
                  alt="Payment Receipt Screenshot"
                  style={{
                    transform: `scale(${lightboxZoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out'
                  }}
                  className="max-h-[50vh] max-w-full object-contain rounded-xl shadow-2xl select-none"
                />
              ) : (
                <div className="text-center p-8 text-[#CCE3DE] space-y-2">
                  <AlertTriangle className="w-10 h-10 mx-auto text-[#D97706]" />
                  <p className="font-bold text-sm">No payment screenshot attached</p>
                  <p className="text-xs text-[#84CC16]">
                    This delegate registered without attaching an immediate receipt (Deferred Payment).
                  </p>
                </div>
              )}
            </div>

            {/* Inline Reject Modal / Form */}
            {showRejectModal && (
              <div className="mt-4 p-4 rounded-xl bg-[#FEE2E2]/15 border border-[#DC2626] space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#DC2626] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Select or Enter Rejection Reason</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="text-[#FCA5A5] hover:text-white text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1.5">
                  <select
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#132A24] border border-white/20 text-xs text-white outline-none"
                  >
                    {predefinedReasons.map((r, i) => (
                      <option key={i} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Or type a custom rejection note to display to student..."
                    value={customRejectReason}
                    onChange={(e) => setCustomRejectReason(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white outline-none placeholder:text-white/40 focus:border-[#DC2626]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={adminActionLoading}
                    onClick={onConfirmReject}
                    className="px-4 py-1.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    {adminActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>Confirm Rejection (PATCH /api/v1/admin/registrations/:id/reject)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-[#132A24] border-t border-white/10">
          <div className="text-xs text-[#CCE3DE]">
            Comparing student's UTR <strong>{txnId}</strong> against screenshot image.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Reject Button: Opens inline reason modal */}
            <button
              type="button"
              disabled={adminActionLoading}
              onClick={() => setShowRejectModal(true)}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject Proof</span>
            </button>

            {/* Verify Button: Calls PATCH /api/v1/admin/registrations/:id/verify */}
            <button
              type="button"
              disabled={adminActionLoading}
              onClick={onConfirmVerify}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {adminActionLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Registration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
