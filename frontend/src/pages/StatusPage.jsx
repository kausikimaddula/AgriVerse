import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, ArrowLeft, ArrowRight, RefreshCw, AlertCircle,
  Clock, AlertTriangle, Check, ExternalLink, Sparkles, QrCode,
  ShieldCheck, User, Building, Calendar, MapPin, Download,
  CheckCircle2, XCircle, CreditCard, FileImage
} from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import failoverApi from '../api/failoverClient.js';
import { useApp } from '../context/AppContext.jsx';

export default function StatusPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { whatsappLink, setIssuedIdCard } = useApp();

  const [statusQuery, setStatusQuery] = useState(
    searchParams.get('regId') || searchParams.get('query') || searchParams.get('registrationId') || ''
  );
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [passportQrUrl, setPassportQrUrl] = useState('');

  // Handle Search Execution
  const handleCheckStatus = async (lookupQuery) => {
    const query = (lookupQuery || statusQuery).trim();
    if (!query) {
      setStatusError('Please enter your Registration ID or Register / Roll Number.');
      setStatusResult(null);
      return;
    }

    setStatusLoading(true);
    setStatusError('');
    setStatusResult(null);
    setPassportQrUrl('');

    try {
      // Submits query to GET /api/v1/registrations/status/:registrationId
      const res = await failoverApi.get(`v1/registrations/status/${encodeURIComponent(query)}`);
      if (res.data && res.data.success && res.data.registration) {
        const reg = res.data.registration;
        setStatusResult(reg);

        // Generate Passport QR Token if verified or confirmed
        const isVer =
          reg.verificationStatus === 'VERIFIED' ||
          reg.status === 'CONFIRMED' ||
          reg.status === 'VERIFIED';

        if (isVer) {
          try {
            const qr = await QRCode.toDataURL(
              `AGRIVERSE|${reg.registrationId || reg.regNo}|${reg.name || reg.fullName}|VERIFIED`,
              { width: 240, margin: 1, color: { dark: '#1A3C34', light: '#FFFFFF' } }
            );
            setPassportQrUrl(qr);
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
          } catch (_) {}
          setIssuedIdCard(reg);
        }
      } else {
        setStatusError(res.data?.message || 'No registration record found for the provided details.');
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        `No registration found for '${query}'. Please check your credentials and try again.`;
      setStatusError(errMsg);
    } finally {
      setStatusLoading(false);
    }
  };

  // Auto-run if query param is present in URL
  useEffect(() => {
    const initial =
      searchParams.get('regId') || searchParams.get('query') || searchParams.get('registrationId');
    if (initial) {
      handleCheckStatus(initial);
    }
  }, [searchParams]);

  // Determine Exact Verification Status Category
  const isVerified =
    statusResult &&
    (statusResult.verificationStatus === 'VERIFIED' ||
      statusResult.status === 'CONFIRMED' ||
      statusResult.status === 'VERIFIED');

  const isRejected =
    statusResult &&
    (statusResult.verificationStatus === 'REJECTED' || statusResult.status === 'REJECTED');

  const isPending =
    statusResult &&
    !isVerified &&
    !isRejected &&
    (statusResult.verificationStatus === 'PENDING' ||
      statusResult.status === 'PENDING_AUDIT' ||
      statusResult.paymentStatus === 'PAID');

  const isUnpaid =
    statusResult &&
    !isVerified &&
    !isRejected &&
    !isPending &&
    (statusResult.paymentStatus === 'UNPAID' || statusResult.status === 'PENDING_PAYMENT');

  // Exact Rejection Reason
  const rejectionReasonText =
    statusResult?.rejectionReason ||
    statusResult?.adminNotes ||
    'Transaction ID does not match the screenshot provided';

  const handleOpenPass = () => {
    if (statusResult) {
      setIssuedIdCard(statusResult);
      navigate('/id-card');
    }
  };

  return (
    <div className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto min-h-[calc(100vh-160px)]">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#CCE3DE] text-[#1A3C34] text-xs font-semibold transition-all border border-[#CCE3DE] shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Course Overview</span>
        </Link>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#CCE3DE] text-xs font-semibold text-[#1A3C34]">
          <ShieldCheck className="w-4 h-4 text-[#15803D]" />
          <span>Registration Status</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="space-y-6">
        {/* ======================================================================
            1. STATUS SEARCH / LOOKUP CARD
            ====================================================================== */}
        <div className="bg-white p-6 sm:p-10 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="text-center sm:text-left space-y-2 border-b border-[#CCE3DE] pb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF4F4] text-[#15803D] text-xs font-bold uppercase tracking-wider">
              <Search className="w-3.5 h-3.5" />
              <span>Self-Service Status Lookup</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1A3C34]">
              Student Status Lookup &amp; Passport
            </h1>
            <p className="text-xs sm:text-sm text-[#3D6153]">
              Check your real-time enrollment and verification status anytime using your Registration ID or Register / Roll Number.
            </p>
          </div>

          {/* Search Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCheckStatus();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1A3C34] uppercase tracking-wider">
                Registration ID or Register / Roll Number <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#6B9080] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. 2300030001, 2200030243, or AGRI-2026-XXXX"
                  value={statusQuery}
                  onChange={(e) => {
                    setStatusQuery(e.target.value);
                    setStatusError('');
                  }}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs sm:text-sm font-mono font-bold text-[#1A3C34] outline-none focus:border-[#1A3C34] focus:ring-1 focus:ring-[#1A3C34] shadow-xs"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={statusLoading}
                className="flex-1 py-3.5 px-6 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {statusLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Checking Status (GET /api/v1/registrations/status)...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Check Status</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusQuery('');
                  setStatusResult(null);
                  setStatusError('');
                  setPassportQrUrl('');
                }}
                className="py-3.5 px-6 rounded-xl bg-white hover:bg-[#CCE3DE] border border-[#CCE3DE] text-[#1A3C34] text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Clear
              </button>
            </div>
          </form>

          {/* Not Found Error Alert */}
          {statusError && (
            <div className="p-4 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-start justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-[#DC2626] mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">{statusError}</p>
                  <p className="text-[#7F1D1D]">
                    Have not registered for AgriVerse 2026 yet? Complete your student enrollment now.
                  </p>
                </div>
              </div>
              <Link
                to="/agrigenevent/registerationforstudent"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A3C34] text-white font-bold text-xs hover:bg-[#132A24] shrink-0"
              >
                <span>Register Now</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* ======================================================================
            2. PASSPORT CARD & CONTEXTUAL STATUS DETAILS
            ====================================================================== */}
        {statusResult && (
          <div className="bg-white p-6 sm:p-10 rounded-xl border border-gray-200 shadow-sm space-y-6 animate-in fade-in">
            {/* Header with Verification Status Badge */}
            <div className="border-b border-[#CCE3DE] pb-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] uppercase font-bold text-[#6B9080] tracking-wider">
                  Official Delegate Enrollment Record
                </span>

                {/* VERIFICATION STATUS BADGES (SPECIFIED IN PROMPT) */}
                {isPending && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-xs font-bold shadow-xs">
                    <span className="text-base leading-none">🟡</span>
                    <span>VERIFICATION PENDING</span>
                  </div>
                )}

                {isVerified && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] text-xs font-bold shadow-xs">
                    <span className="text-base leading-none">🟢</span>
                    <span>VERIFIED ✓</span>
                  </div>
                )}

                {isRejected && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FEE2E2] border border-[#FCA5A5] text-[#DC2626] text-xs font-bold shadow-xs">
                    <span className="text-base leading-none">🔴</span>
                    <span>REJECTED</span>
                  </div>
                )}

                {isUnpaid && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] text-xs font-bold shadow-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>PAYMENT PENDING (₹350)</span>
                  </div>
                )}
              </div>

              {/* Title & Explanatory Banner */}
              <div>
                <h2 className="text-2xl font-black text-[#1A3C34]">
                  {statusResult.name || statusResult.fullName}
                </h2>
                <p className="text-xs sm:text-sm text-[#3D6153] mt-1">
                  {isVerified &&
                    'Payment verified and registration is confirmed. Your delegate seat is active.'}
                  {isPending &&
                    'Payment screenshot received and currently undergoing verification.'}
                  {isRejected &&
                    'An issue was found with your payment submission. Please review the reason below.'}
                  {isUnpaid &&
                    'Student profile is registered in the system. Fee payment of ₹350 is pending.'}
                </p>
              </div>

              {/* REJECTION REASON BANNER (EXACT REQUIREMENT) */}
              {isRejected && (
                <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#DC2626] text-[#991B1B] text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#DC2626]">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>Verification Issue:</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 border border-[#FCA5A5] font-mono text-xs text-[#7F1D1D]">
                    {rejectionReasonText}
                  </div>
                  <p className="text-[11px] text-[#991B1B]">
                    Please verify your transaction receipt, ensure the 12-digit UTR matches the screenshot, and re-submit your proof.
                  </p>
                  <div className="pt-1">
                    <Link
                      to={`/team-payment?regId=${encodeURIComponent(statusResult.registrationId || statusResult.regNo)}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-sm transition-all"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Re-submit Correct Proof / Pay Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* PASSPORT CARD DETAILS RENDERED */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A3C34] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#15803D]" />
                  <span>Participant Identification Passport</span>
                </span>
                <span className="text-xs font-mono font-bold text-[#1A3C34] bg-[#F4F9F6] px-3 py-1 rounded-lg border border-[#CCE3DE]">
                  ID: {statusResult.registrationId || statusResult.regNo}
                </span>
              </div>

              {/* Identification Grid */}
              <div className="p-5 sm:p-6 rounded-xl bg-[#F8FAF9] border border-[#DCE8E2] grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                {/* Full Name */}
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
                    Full Name
                  </span>
                  <span className="font-bold text-[#1A3C34] block text-sm">
                    {statusResult.name || statusResult.fullName}
                  </span>
                </div>

                {/* Register Number */}
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
                    Register / Roll No
                  </span>
                  <span className="font-mono font-bold text-[#1A3C34] block text-sm">
                    {statusResult.regNo || statusResult.registerNumber}
                  </span>
                </div>

                {/* Department */}
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
                    Department
                  </span>
                  <span className="font-bold text-[#1A3C34] block truncate">
                    {statusResult.department || statusResult.branch}
                  </span>
                </div>

                {/* Section */}
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
                    Section
                  </span>
                  <span className="font-bold text-[#1A3C34] block">
                    Section {statusResult.section || 'A'}
                  </span>
                </div>

                {/* Academic Year */}
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
                    Academic Year
                  </span>
                  <span className="font-bold text-[#1A3C34] block">
                    {statusResult.year || statusResult.academicYear || '1st Year'}
                  </span>
                </div>

                {/* Residency Status */}
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
                    Residency
                  </span>
                  <span className="font-bold text-[#1A3C34] block">
                    {statusResult.residency || statusResult.residencyStatus || 'Day Scholar'}
                  </span>
                </div>

                {/* Transaction ID & Venue */}
                <div className="col-span-2 sm:col-span-3 border-t border-[#CCE3DE] pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
                      UPI Reference / Transaction ID
                    </span>
                    <span className="font-mono font-bold text-[#1A3C34] block">
                      {statusResult.transactionId || statusResult.txnId || 'Not submitted yet'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
                      Venue
                    </span>
                    <span className="font-bold text-[#1A3C34] block">
                      Admin Block Seminar Hall • KLU Campus
                    </span>
                  </div>
                </div>
              </div>

              {/* Entrance QR Token & ID Card CTA for Verified Attendees */}
              {isVerified && (
                <div className="p-5 rounded-xl bg-[#DCFCE7]/40 border border-[#15803D] flex flex-col sm:flex-row items-center gap-5">
                  {passportQrUrl && (
                    <div className="p-2.5 rounded-xl bg-white border border-[#15803D]/30 shadow-xs shrink-0">
                      <img
                        src={passportQrUrl}
                        alt="Delegate Verification QR"
                        className="w-32 h-32 object-contain rounded-lg"
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold uppercase">
                      <Sparkles className="w-3 h-3 text-[#15803D]" />
                      <span>Entry Verification Active</span>
                    </div>
                    <h3 className="text-base font-bold text-[#1A3C34]">
                      Official Entrance Token Ready
                    </h3>
                    <p className="text-xs text-[#3D6153]">
                      Scan this digital passport at the entrance gates to receive your delegate credential and welcome kit.
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleOpenPass}
                        className="px-5 py-2.5 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#84CC16]" />
                        <span>View &amp; Download ID Card</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Uploaded Screenshot Proof Preview for Pending Audits */}
              {isPending && statusResult.paymentScreenshot?.url && (
                <div className="p-4 rounded-xl bg-[#F8FAF9] border border-[#DCE8E2] flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <FileImage className="w-5 h-5 text-[#15803D] shrink-0" />
                    <div>
                      <span className="font-bold text-[#1A3C34] block">
                        Payment Screenshot Received
                      </span>
                      <span className="text-[11px] text-[#6B9080]">
                        Screenshot stored securely • Verification in progress
                      </span>
                    </div>
                  </div>
                  <a
                    href={statusResult.paymentScreenshot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#CCE3DE] text-[#1A3C34] text-xs font-semibold hover:bg-[#CCE3DE] transition-all"
                  >
                    <span>View Image</span>
                    <ExternalLink className="w-3 h-3 text-[#6B9080]" />
                  </a>
                </div>
              )}
            </div>

            {/* ======================================================================
                3. OFFICIAL WHATSAPP GROUP CARDS
                ====================================================================== */}
            <div className="p-5 sm:p-6 rounded-xl bg-[#F8FAF9] border border-[#DCE8E2] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold uppercase">
                    <span>Official Community Links</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-[#1A3C34]">
                    AgriVerse 2026 Participant WhatsApp Community
                  </h4>
                  <p className="text-xs text-[#3D6153]">
                    Join the verified participant group for live keynote notifications, workshop schedules, and delegate networking.
                  </p>
                </div>

                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <span>Join WhatsApp Community</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Pay Now Option for Unpaid Registrations */}
            {isUnpaid && (
              <div className="p-5 rounded-xl bg-[#FEF3C7]/40 border border-[#D97706] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#1A3C34]">
                    Complete Your ₹350 Fee Payment
                  </h4>
                  <p className="text-xs text-[#3D6153]">
                    Your slot is currently held. Transfer ₹350 via UPI to complete registration.
                  </p>
                </div>
                <Link
                  to={`/team-payment?regId=${encodeURIComponent(statusResult.registrationId || statusResult.regNo)}`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shrink-0"
                >
                  <span>Pay Now (₹350)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        )}


      </div>
    </div>
  );
}
