import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Clock,
  ExternalLink, Copy, Check, QrCode, Upload, RefreshCw, Smartphone,
  ShieldCheck, Sparkles, FileImage, CreditCard
} from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import failoverApi from '../api/failoverClient.js';
import { useApp } from '../context/AppContext.jsx';

/**
 * Client-Side Image Compression Helper
 */
async function compressImageFile(file, maxDimension = 1600, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) return file;
  if (file.size <= 500 * 1024) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, '.jpg'),
                { type: 'image/jpeg', lastModified: Date.now() }
              );
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function TeamPaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { whatsappLink, setIssuedIdCard, fetchStats } = useApp();

  // Search input state
  const [query, setQuery] = useState(searchParams.get('regId') || searchParams.get('query') || '');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Loaded registration record
  const [registration, setRegistration] = useState(null);

  // Active Payment Methods state for Scenario 3
  const [paymentMethods, setPaymentMethods] = useState([
    {
      id: 'qr1',
      title: 'UPI QR Code',
      name: 'AgriVerse UE',
      upiId: 'sundarrajan.it@okaxis',
      holder: 'sundarrajan.it',
      amount: 350,
      currency: 'INR',
      upiString: 'upi://pay?pa=sundarrajan.it@okaxis&pn=sundarrajan.it&am=350&cu=INR&tn=AgriVerse_UE_Course'
    }
  ]);
  const [methodQrImages, setMethodQrImages] = useState({});
  const [activeQrIndex, setActiveQrIndex] = useState(0);
  const [copiedUpi, setCopiedUpi] = useState('');
  const handleCopyUpi = (upiId, id) => {
    if (!upiId) return;
    try {
      navigator.clipboard?.writeText(upiId);
      setCopiedUpi(id);
      setTimeout(() => setCopiedUpi(''), 2000);
    } catch {}
  };

  // Unpaid Payment Form State
  const [txnId, setTxnId] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [joinedWhatsapp, setJoinedWhatsapp] = useState('Yes');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const fileInputRef = useRef(null);

  // Fetch active UPI QR codes from the server
  useEffect(() => {
    let isMounted = true;
    const fetchMethods = async () => {
      try {
        const res = await failoverApi.get('v1/event/payment-methods');
        if (isMounted && res.data?.success && Array.isArray(res.data.paymentMethods) && res.data.paymentMethods.length > 0) {
          setPaymentMethods(res.data.paymentMethods);
        }
      } catch (err) {
        console.warn('Payment methods endpoint fetch note:', err.message);
      }
    };
    fetchMethods();
    return () => { isMounted = false; };
  }, []);

  // Generate dynamic QR images
  useEffect(() => {
    let isMounted = true;
    const genQrs = async () => {
      const generated = {};
      for (const m of paymentMethods) {
        try {
          if (m.url || m.imageUrl) {
            generated[m.id] = m.url || m.imageUrl;
          } else if (m.upiString) {
            const qrData = await QRCode.toDataURL(m.upiString, {
              width: 340,
              margin: 1,
              color: { dark: '#1A3C34', light: '#FFFFFF' }
            });
            generated[m.id] = qrData;
          }
        } catch (_) {}
      }
      if (isMounted) {
        setMethodQrImages(generated);
      }
    };
    if (paymentMethods.length > 0) genQrs();
    return () => { isMounted = false; };
  }, [paymentMethods]);

  // Execute lookup
  const handleLookup = async (lookupValue) => {
    const val = (lookupValue || query).trim();
    if (!val || val.length < 2) {
      setSearchError('Please enter your Register / Roll Number or Registration ID.');
      return;
    }

    setSearching(true);
    setSearchError('');
    setRegistration(null);
    setPaymentError('');
    setProofFile(null);
    setFilePreview(null);
    setTxnId('');

    try {
      const res = await failoverApi.post('v1/registrations/lookup-team', { query: val });
      if (res.data?.success && res.data?.registration) {
        const rec = res.data.registration;
        setRegistration(rec);
        if (rec.paymentStatus === 'PAID') {
          setIssuedIdCard(rec);
        }
      } else {
        setSearchError(res.data?.error || 'Registration record not found.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Lookup failed. Please verify your credentials.';
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  };

  // Auto-run lookup if URL contains parameter
  useEffect(() => {
    const initial = searchParams.get('regId') || searchParams.get('query');
    if (initial) {
      handleLookup(initial);
    }
  }, [searchParams]);

  const copyUpiId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2200);
  };

  // Proof screenshot change handler
  const handleProofChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = /\.(jpg|jpeg|png|webp)$/i;
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase()) && !validExtensions.test(file.name)) {
      setPaymentError('Invalid file format. Only .jpg, .png, .jpeg, or .webp images up to 10MB are permitted.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPaymentError('Selected file exceeds the 10MB limit. Please choose a smaller image.');
      return;
    }

    setPaymentError('');

    // Instant local preview
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(reader.result);
    };
    reader.readAsDataURL(file);

    setFileDetails({
      name: file.name,
      originalSize: (file.size / 1024).toFixed(1) + ' KB',
      type: file.type || 'image/jpeg'
    });

    try {
      const compressed = await compressImageFile(file);
      setProofFile(compressed);
      setFileDetails((prev) => ({
        ...prev,
        compressedSize: (compressed.size / 1024).toFixed(1) + ' KB'
      }));
    } catch {
      setProofFile(file);
    }
  };

  const handleChangeImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleRemoveImage = () => {
    setProofFile(null);
    setFilePreview(null);
    setFileDetails(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle Scenario 3 Payment Proof submission
  const handleCompletePayment = async (e) => {
    e.preventDefault();
    setPaymentError('');

    const cleanTxnId = txnId.trim().toUpperCase();
    if (!cleanTxnId || cleanTxnId.length < 4) {
      setPaymentError('Please enter a valid UPI Reference ID / Transaction ID (minimum 4 characters).');
      return;
    }
    if (!proofFile) {
      setPaymentError('Please attach your payment screenshot receipt (.jpg, .png, .jpeg, .webp up to 10MB).');
      return;
    }

    const targetRegId = registration?.registrationId || registration?.registerNumber || registration?.regNo || registration?.id;
    if (!targetRegId) {
      setPaymentError('Registration profile not found. Please refresh and retry.');
      return;
    }

    setPaymentSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('registrationId', targetRegId);
      fd.append('registerNumber', targetRegId);
      fd.append('regNo', targetRegId);
      fd.append('id', targetRegId);
      fd.append('transactionId', cleanTxnId);
      fd.append('txnId', cleanTxnId);
      fd.append('joinedWhatsapp', joinedWhatsapp);
      fd.append('paymentScreenshot', proofFile);
      fd.append('idProof', proofFile);

      const res = await failoverApi.post('v1/registrations/payment', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const updated = res.data.registration || {
          ...registration,
          paymentStatus: 'PAID',
          transactionId: cleanTxnId
        };
        setIssuedIdCard(updated);
        fetchStats();

        // Redirect to success page
        const destinationId = res.data.registrationId || targetRegId;
        navigate(`/success/${encodeURIComponent(destinationId)}`);
      } else {
        setPaymentError(res.data?.error || 'Payment proof verification failed.');
      }
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || err.message || 'Payment upload failed.';
      if (status === 409) {
        setPaymentError(`UPI Reference ID (${cleanTxnId}) has already been submitted by another attendee. Please check your transaction receipt.`);
      } else {
        setPaymentError(errorMsg);
      }
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Determine which scenario applies
  const isPaid = registration?.paymentStatus === 'PAID';
  const isVerified =
    isPaid &&
    (registration?.verificationStatus === 'VERIFIED' ||
      registration?.status === 'CONFIRMED' ||
      registration?.status === 'VERIFIED');
  const isPendingReview = isPaid && !isVerified;
  const isUnpaid = registration && !isPaid;

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
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#CCE3DE] text-xs font-semibold text-[#1A3C34]">
          <CreditCard className="w-4 h-4 text-[#15803D]" />
          <span>Workflow C: Pay Later Portal</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="space-y-6">
        {/* Header & Lookup Card */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#CCE3DE] shadow-xl space-y-6">
          <div className="text-center sm:text-left space-y-2 border-b border-[#CCE3DE] pb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF4F4] text-[#15803D] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Deferred Payment Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1A3C34]">
              Participant Payment &amp; Proof Submission
            </h1>
            <p className="text-xs sm:text-sm text-[#3D6153]">
              Registered earlier or on another device? Lookup your reserved profile by Register / Roll Number to submit your UPI payment proof or check review status.
            </p>
          </div>

          {/* Lookup Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup();
            }}
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-[#6B9080] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Register / Roll Number (e.g. 2200030243 or AGRI-2026-XXXX)"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchError('');
                  }}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs sm:text-sm font-mono font-bold text-[#1A3C34] outline-none focus:border-[#1A3C34] focus:ring-1 focus:ring-[#1A3C34] shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {searching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <span>Lookup Profile</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>

            {searchError && (
              <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
                  <span>{searchError}</span>
                </div>
                <Link
                  to="/agrigenevent/registerationforstudent"
                  className="underline font-bold shrink-0 hover:text-[#7F1D1D]"
                >
                  New Registration?
                </Link>
              </div>
            )}
          </form>
        </div>

        {/* ======================================================================
            CONTEXTUAL STATUS HANDLING (3 SCENARIOS)
            ====================================================================== */}

        {/* SCENARIO 1: ALREADY PAID & VERIFIED */}
        {registration && isVerified && (
          <div className="bg-white p-6 sm:p-10 rounded-3xl border-2 border-[#15803D] shadow-xl space-y-6 animate-in fade-in text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Scenario 1: Verified &amp; Confirmed Attendee</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1A3C34]">
                Payment Verified for {registration.name || registration.fullName}!
              </h2>
              <p className="text-xs sm:text-sm text-[#3D6153] max-w-lg mx-auto">
                Your payment of ₹350 has been audited and approved by the AgriVerse committee. Your official registration is confirmed.
              </p>
            </div>

            {/* Profile Data Card */}
            <div className="p-5 rounded-2xl bg-[#F4F9F6] border border-[#CCE3DE] max-w-lg mx-auto grid grid-cols-2 sm:grid-cols-3 gap-4 text-left text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Registration ID</span>
                <span className="font-mono font-bold text-[#1A3C34]">{registration.registrationId || registration.regNo}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Branch &amp; Section</span>
                <span className="font-bold text-[#1A3C34] truncate block">{registration.department || registration.branch} ({registration.section || 'A'})</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Status</span>
                <span className="font-bold text-[#15803D]">CONFIRMED ✓</span>
              </div>
              <div className="col-span-2 sm:col-span-3 border-t border-[#CCE3DE] pt-2">
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Verified Transaction ID</span>
                <span className="font-mono font-bold text-[#1A3C34]">{registration.transactionId || registration.txnId || 'N/A'}</span>
              </div>
            </div>

            {/* Action Buttons & Community Links */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/id-card"
                className="px-6 py-3 rounded-xl bg-[#1A3C34] text-white font-bold text-xs sm:text-sm hover:bg-[#132A24] transition-all shadow-md flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#84CC16]" />
                <span>View ID Card</span>
              </Link>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2"
              >
                <span>Join Official WhatsApp Group</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* SCENARIO 2: ALREADY PAID & PENDING ADMIN AUDIT */}
        {registration && isPendingReview && (
          <div className="bg-white p-6 sm:p-10 rounded-3xl border-2 border-[#D97706] shadow-xl space-y-6 animate-in fade-in text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shadow-xs">
              <Clock className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs font-bold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>Payment Proof Under Review</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1A3C34]">
                Proof Submitted &amp; Under Verification
              </h2>
              <p className="text-xs sm:text-sm text-[#3D6153] max-w-lg mx-auto">
                Thank you, <strong>{registration.name || registration.fullName}</strong>. Your payment proof and UTR reference ID have been received and are currently undergoing payment verification.
              </p>
            </div>

            {/* Submission Detail Card */}
            <div className="p-5 rounded-2xl bg-[#F4F9F6] border border-[#CCE3DE] max-w-lg mx-auto grid grid-cols-2 gap-4 text-left text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Registration ID</span>
                <span className="font-mono font-bold text-[#1A3C34]">{registration.registrationId || registration.regNo}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Verification Status</span>
                <span className="font-bold text-[#D97706] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                  <span>PENDING VERIFICATION</span>
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Submitted UTR Reference ID</span>
                <span className="font-mono font-bold text-[#1A3C34]">{registration.transactionId || registration.txnId}</span>
              </div>
              {registration.paymentScreenshot?.url && (
                <div className="col-span-2 border-t border-[#CCE3DE] pt-3">
                  <span className="text-[10px] uppercase font-bold text-[#6B9080] block mb-2">
                    Submitted Screenshot Receipt
                  </span>
                  <a
                    href={registration.paymentScreenshot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#1A3C34] hover:underline bg-white p-2 rounded-xl border border-[#CCE3DE]"
                  >
                    <FileImage className="w-4 h-4 text-[#15803D]" />
                    <span>View Uploaded Proof Image</span>
                    <ExternalLink className="w-3 h-3 text-[#6B9080]" />
                  </a>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/status"
                className="px-5 py-3 rounded-xl bg-[#1A3C34] text-white font-bold text-xs sm:text-sm hover:bg-[#132A24] transition-all shadow-md"
              >
                Track Audit Queue Status
              </Link>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-xl bg-white border border-[#CCE3DE] text-[#1A3C34] font-bold text-xs sm:text-sm hover:bg-[#EAF4F4] transition-all flex items-center gap-2"
              >
                <span>Join Official WhatsApp Group</span>
                <ExternalLink className="w-4 h-4 text-[#15803D]" />
              </a>
            </div>
          </div>
        )}

        {/* SCENARIO 3: UNPAID (DEFERRED / PAY LATER) */}
        {registration && isUnpaid && (
          <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#CCE3DE] shadow-xl space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="border-b border-[#CCE3DE] pb-5 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs font-bold uppercase tracking-wider">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Scenario 3: Slot Reserved • Awaiting Payment (₹350)</span>
              </div>
              <h2 className="text-2xl font-black text-[#1A3C34]">
                Complete Payment for {registration.name || registration.fullName}
              </h2>
              <p className="text-xs sm:text-sm text-[#3D6153]">
                Your seat is currently reserved under registration ID <strong className="font-mono text-[#1A3C34]">{registration.registrationId || registration.regNo}</strong>. Complete the ₹350 fee transfer below to secure verification.
              </p>
            </div>

            {/* Reserved Profile Summary Pill */}
            <div className="p-4 rounded-2xl bg-[#F4F9F6] border border-[#CCE3DE] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Registration ID</span>
                <span className="font-mono font-bold text-[#1A3C34]">{registration.registrationId || registration.regNo}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Department</span>
                <span className="font-bold text-[#1A3C34] truncate block">{registration.department || registration.branch}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Fee Amount</span>
                <span className="font-bold text-[#15803D]">₹350.00</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Payment Status</span>
                <span className="font-bold text-[#DC2626]">UNPAID (Pending)</span>
              </div>
            </div>

            {/* Complete Payment Submission Form */}
            <form onSubmit={handleCompletePayment} className="space-y-6">
              {paymentError && (
                <div className="p-4 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
                  <span className="font-medium leading-relaxed">{paymentError}</span>
                </div>
              )}

              {/* 1. UPI QR Code Display Grid (Shows ALL Active QR Codes from Admin Panel) */}
              <div className="p-5 sm:p-7 rounded-2xl bg-[#F4F9F6] border border-[#CCE3DE] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CCE3DE]/70 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1A3C34] uppercase tracking-wider flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#15803D]" />
                      <span>Official UPI Payment QR Codes</span>
                    </h3>
                    <p className="text-[11px] text-[#6B9080]">
                      Scan via any UPI mobile application and transfer exact registration fee.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF4F4] border border-[#CCE3DE] text-[#1A3C34] text-xs font-bold shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                      <span>{paymentMethods.length} Active {paymentMethods.length === 1 ? 'QR' : 'QRs'}</span>
                    </span>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs font-black shadow-xs">
                      <span>Exact Fee: ₹350.00</span>
                    </div>
                  </div>
                </div>

                {/* Grid displaying all active QR codes simultaneously */}
                <div
                  className={`grid gap-5 ${
                    paymentMethods.length === 1
                      ? 'grid-cols-1 max-w-md mx-auto'
                      : paymentMethods.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {paymentMethods.map((method, idx) => {
                    const qrImageSrc =
                      method.url ||
                      method.imageUrl ||
                      methodQrImages[method.id] ||
                      methodQrImages['qr1'];

                    return (
                      <div
                        key={method.id || idx}
                        className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-[#CCE3DE] hover:border-[#15803D] transition-all shadow-sm flex flex-col items-center justify-between text-center relative group"
                      >
                        {/* Top Header Pill with Title & Account Counter */}
                        <div className="w-full flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#CCE3DE]/60">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-black uppercase tracking-wider">
                            <QrCode className="w-3 h-3" />
                            <span>QR {idx + 1}</span>
                          </span>
                          <span
                            className="text-xs font-bold text-[#1A3C34] truncate max-w-[150px]"
                            title={method.title || `Payment QR #${idx + 1}`}
                          >
                            {method.title || `Payment QR #${idx + 1}`}
                          </span>
                        </div>

                        {/* QR Image Box */}
                        <div className="p-3.5 rounded-2xl bg-white border-2 border-[#CCE3DE] shadow-inner mb-3 flex items-center justify-center">
                          {qrImageSrc ? (
                            <img
                              src={qrImageSrc}
                              alt={method.title || `Payment QR ${idx + 1}`}
                              className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
                            />
                          ) : (
                            <div className="w-48 h-48 sm:w-56 sm:h-56 bg-[#F4F9F6] rounded-xl flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-7 h-7 animate-spin text-[#6B9080]" />
                              <span className="text-xs text-[#6B9080] font-medium">Generating QR...</span>
                            </div>
                          )}
                        </div>

                        {/* Caption */}
                        <p className="text-xs font-bold text-[#1A3C34] mb-2">
                          Scan QR Code using any UPI App to pay ₹{method.amount || 350}
                        </p>

                        {/* UPI ID with Click-to-Copy */}
                        {method.upiId && (
                          <div className="w-full pt-1">
                            <button
                              type="button"
                              onClick={() => handleCopyUpi(method.upiId, method.id)}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#F4F9F6] hover:bg-[#EAF4F4] border border-[#CCE3DE] text-[11px] font-mono text-[#1A3C34] transition-colors cursor-pointer"
                              title="Click to copy UPI ID"
                            >
                              <span className="truncate">{method.upiId}</span>
                              <span className="shrink-0 flex items-center gap-1 text-[10px] font-sans font-bold text-[#15803D]">
                                {copiedUpi === method.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#15803D]" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </span>
                            </button>
                          </div>
                        )}

                        {/* Direct UPI Mobile Intent Link */}
                        {method.upiString && (
                          <div className="w-full pt-2 block sm:hidden">
                            <a
                              href={method.upiString}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#15803D] text-white text-xs font-bold shadow-xs hover:bg-[#166534] transition-all"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Pay ₹{method.amount || 350} in UPI App</span>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Proof Collection Fields */}
              <div className="p-5 sm:p-7 rounded-2xl bg-[#CCE3DE]/40 border border-[#A4C3B2] space-y-5">
                <h3 className="text-sm font-bold text-[#1A3C34] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                  <span>Proof Collection &amp; UTR Reference</span>
                </h3>

                {/* UTR Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1A3C34]">
                      UPI Reference ID / Transaction ID (UTR) <span className="text-[#DC2626]">*</span>
                    </label>
                    <span className="text-[11px] font-mono">
                      {txnId.trim().length < 4 ? (
                        <span className="text-amber-700 font-medium">Min 4 chars required ({txnId.trim().length}/4)</span>
                      ) : (
                        <span className="text-[#15803D] font-bold">✓ Valid ID format ({txnId.trim().length} chars)</span>
                      )}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 439281902812 or UPI Ref UTR number"
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#A4C3B2] text-xs sm:text-sm font-mono font-semibold text-[#1A3C34] outline-none focus:border-[#1A3C34] focus:ring-1 focus:ring-[#1A3C34] shadow-xs"
                  />
                  <p className="text-[11px] text-[#3D6153]">
                    Enter the exact UPI transaction reference number displayed on your banking receipt.
                  </p>
                </div>

                {/* Screenshot Upload with Instant Preview & Change Image Button */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1A3C34]">
                    Payment Screenshot Receipt <span className="text-[#DC2626]">*</span>
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleProofChange}
                    className="hidden"
                  />

                  {filePreview ? (
                    <div className="p-4 rounded-2xl bg-white border-2 border-[#15803D] shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <img
                          src={filePreview}
                          alt="Uploaded payment screenshot preview"
                          className="w-28 h-28 sm:w-32 sm:h-32 object-contain rounded-xl border border-[#CCE3DE] bg-[#F4F9F6] p-1 shadow-xs shrink-0"
                        />
                        <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold uppercase">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Image Loaded &amp; Optimized</span>
                          </div>
                          <p className="text-xs font-bold text-[#1A3C34] truncate">
                            {fileDetails?.name || proofFile?.name || 'receipt_screenshot.png'}
                          </p>
                          <p className="text-[11px] text-[#6B9080]">
                            Size: <span className="font-semibold text-[#1A3C34]">{fileDetails?.compressedSize || fileDetails?.originalSize || 'Ready'}</span> • Format: {fileDetails?.type || 'Image'}
                          </p>
                          <p className="text-[11px] text-[#3D6153]">
                            Ready for immediate verification audit.
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleChangeImage}
                            className="px-3.5 py-2 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Change Image</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-3 py-2 rounded-xl bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] text-xs font-semibold transition-all cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-dashed border-[#A4C3B2] hover:border-[#1A3C34] transition-all cursor-pointer text-center space-y-2 group shadow-xs"
                    >
                      <div className="w-12 h-12 mx-auto rounded-full bg-[#EAF4F4] group-hover:bg-[#CCE3DE] text-[#1A3C34] flex items-center justify-center transition-all">
                        <Upload className="w-6 h-6 stroke-[2]" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs sm:text-sm font-bold text-[#1A3C34]">
                          Click to upload payment screenshot
                        </p>
                        <p className="text-[11px] text-[#6B9080]">
                          Supports .jpg, .png, .jpeg, .webp (up to 10MB)
                        </p>
                      </div>
                      <span className="inline-block px-3 py-1 rounded-full bg-[#F4F9F6] text-[#3D6153] text-[10px] font-semibold border border-[#CCE3DE]">
                        Instant preview &amp; compression
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. WhatsApp Community */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#EAF4F4] border border-[#CCE3DE] space-y-2.5">
                <div>
                  <span className="text-xs font-bold text-[#1A3C34] block mb-1">
                    Official WhatsApp Community
                  </span>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#15803D] hover:underline"
                  >
                    <span>Open WhatsApp Group</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-5 pt-1 text-xs font-medium text-[#1A3C34]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="joinedWhatsapp"
                      value="Yes"
                      checked={joinedWhatsapp === 'Yes'}
                      onChange={() => setJoinedWhatsapp('Yes')}
                      className="accent-[#1A3C34]"
                    />
                    <span>Yes, I joined the group</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="joinedWhatsapp"
                      value="No"
                      checked={joinedWhatsapp === 'No'}
                      onChange={() => setJoinedWhatsapp('No')}
                      className="accent-[#1A3C34]"
                    />
                    <span>I will join later</span>
                  </label>
                </div>
              </div>

              {/* 4. Submission Button */}
              <button
                type="submit"
                disabled={paymentSubmitting}
                className="w-full py-4 rounded-[15px] bg-[#1A3C34] hover:bg-[#132A24] text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {paymentSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying Proof &amp; Uploading to Cloud CDN...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Payment Proof (₹350)</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
