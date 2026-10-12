import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, AlertCircle, RefreshCw, Lock, Sparkles,
  CheckCircle2, XCircle, CreditCard, QrCode, Upload, ExternalLink, Download,
  Copy, Check, FileImage, Smartphone, ShieldCheck, Search, Edit3
} from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import failoverApi from '../api/failoverClient.js';
import { useApp } from '../context/AppContext.jsx';

const DRAFT_KEY = 'agrigen_solo_registration_draft_v4';

/**
 * Client-Side Image Compression Helper
 * Efficiently resizes and compresses user-uploaded payment screenshots (up to 10MB)
 * down to crisp, web-optimized JPEG format for fast uploads.
 */
async function compressImageFile(file, maxDimension = 1600, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) return file;
  if (file.size <= 500 * 1024) return file; // Already small enough

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { stats, setIssuedIdCard, fetchStats, whatsappLink, qrAccounts, qrImages } = useApp();

  // Detect if this page was reached via browser reload/refresh
  // In React Router, in-app navigation generates a unique key (location.key !== 'default').
  // A browser reload or initial load always starts with location.key === 'default'.
  const isReloaded = (() => {
    if (location.key !== 'default') {
      return false;
    }

    try {
      const wasReloadedByFlag = sessionStorage.getItem('agri_reg_was_reloaded') === 'true';
      let wasReloadedByPerf = false;
      const navEntries = typeof window !== 'undefined' && window.performance?.getEntriesByType?.('navigation');
      if (navEntries && navEntries.length > 0) {
        wasReloadedByPerf = navEntries[0].type === 'reload';
      } else if (typeof window !== 'undefined' && window.performance?.navigation?.type === 1) {
        wasReloadedByPerf = true;
      }

      if (wasReloadedByFlag || wasReloadedByPerf) {
        sessionStorage.removeItem('agri_reg_was_reloaded');
        sessionStorage.removeItem('agri_pending_registration');
        localStorage.removeItem(DRAFT_KEY);
        return true;
      }
    } catch (_) {}
    return false;
  })();

  // Track page reload/refresh only while RegisterPage is mounted
  useEffect(() => {
    if (isReloaded) return;

    const markReload = () => {
      try {
        sessionStorage.setItem('agri_reg_was_reloaded', 'true');
      } catch (_) {}
    };

    window.addEventListener('beforeunload', markReload);
    window.addEventListener('pagehide', markReload);

    return () => {
      window.removeEventListener('beforeunload', markReload);
      window.removeEventListener('pagehide', markReload);
    };
  }, [isReloaded]);

  // Step 1 = Form, Step 2 = Payment Screen
  const [step, setStep] = useState(1);

  // Form State
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.department === 'Computer Science and Engineering (CSE)') {
          parsed.department = '';
        }
        return parsed;
      }
    } catch {}
    return {
      fullName: '',
      registerNumber: '',
      academicEmail: '',
      phone: '',
      department: '',
      section: 'A',
      academicYear: '1st Year',
      gender: 'Male',
      residencyStatus: 'Day Scholar'
    };
  });

  // Real-time Credential Availability Badges (Debounced)
  const [availability, setAvailability] = useState({
    registerNumber: { checked: false, available: null, message: '', loading: false },
    academicEmail: { checked: false, available: null, message: '', loading: false },
    phone: { checked: false, available: null, message: '', loading: false }
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [capacityFullModal, setCapacityFullModal] = useState({ show: false, message: '' });

  // Registration Gate State (Checked on mount)
  const [eventGate, setEventGate] = useState({
    isOpen: true,
    isFull: false,
    checked: false,
    message: ''
  });

  useEffect(() => {
    let isMounted = true;
    const verifyGate = async () => {
      try {
        const res = await failoverApi.get('v1/event/status');
        const data = res.data;
        if (isMounted && data) {
          const open = data.isOpen !== false && data.isSystemOpen !== false;
          setEventGate({
            isOpen: open,
            isFull: Boolean(data.isFull),
            checked: true,
            message: data.message || (open ? '' : 'Registrations are closed.')
          });
        }
      } catch (err) {
        if (isMounted) {
          setEventGate((prev) => ({ ...prev, checked: true }));
        }
      }
    };
    verifyGate();
    return () => {
      isMounted = false;
    };
  }, []);

  // Registered Profile after Step 1
  const [registeredProfile, setRegisteredProfile] = useState(null);

  // Step 2 Payment Screen State
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
        console.warn('Payment methods fetch error:', err.message);
      }
    };
    fetchMethods();
    return () => { isMounted = false; };
  }, []);

  // Generate dynamic QR images for active methods
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
    if (paymentMethods.length > 0) {
      genQrs();
    }
    return () => { isMounted = false; };
  }, [paymentMethods]);

  // Restore pending registration session if user returns to Step 2 (not on reload)
  useEffect(() => {
    if (isReloaded) return;
    try {
      const pending = sessionStorage.getItem('agri_pending_registration');
      if (pending) {
        const parsed = JSON.parse(pending);
        if (parsed && (parsed.registrationId || parsed.regNo)) {
          setRegisteredProfile(parsed);
          setStep(2);
        }
      }
    } catch {}
  }, [isReloaded]);

  // Draft Autosave effect to localStorage
  useEffect(() => {
    if (isReloaded) return;
    if (step === 1) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      } catch {}
    }
  }, [formData, step, isReloaded]);

  // Debounced API Credential Verification
  const debounceTimers = useRef({});

  const checkCredential = useCallback((field, value) => {
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }

    if (!value || value.trim().length < 3) {
      setAvailability((prev) => ({
        ...prev,
        [field]: { checked: false, available: null, message: '', loading: false }
      }));
      return;
    }

    // If editing and value matches current registered profile's own credentials, show available
    if (registeredProfile) {
      const ownRegNo = (registeredProfile.regNo || registeredProfile.registrationId || '').toUpperCase();
      const ownEmail = (registeredProfile.email || registeredProfile.academicEmail || '').toLowerCase();
      const ownPhone = (registeredProfile.phone || '').replace(/\D/g, '');
      const cleanVal = field === 'phone' ? value.replace(/\D/g, '') : value.trim().toUpperCase();

      if (
        (field === 'registerNumber' && cleanVal === ownRegNo) ||
        (field === 'academicEmail' && value.trim().toLowerCase() === ownEmail) ||
        (field === 'phone' && cleanVal === ownPhone)
      ) {
        setAvailability((prev) => ({
          ...prev,
          [field]: { checked: true, available: true, message: 'Current Profile ✓', loading: false }
        }));
        return;
      }
    }

    setAvailability((prev) => ({
      ...prev,
      [field]: { ...prev[field], loading: true }
    }));

    debounceTimers.current[field] = setTimeout(async () => {
      try {
        const payload = {};
        if (field === 'registerNumber') payload.registerNumber = value.trim().toUpperCase();
        if (field === 'academicEmail') payload.academicEmail = value.trim().toLowerCase();
        if (field === 'phone') payload.phone = value.replace(/\D/g, '');

        const res = await failoverApi.post('v1/registrations/check', payload);
        const data = res.data;

        if (data?.success) {
          const fieldResult = data[field];
          setAvailability((prev) => ({
            ...prev,
            [field]: {
              checked: true,
              available: fieldResult?.available ?? true,
              message: fieldResult?.message || (fieldResult?.available ? 'Available ✓' : 'Already Registered ✕'),
              loading: false
            }
          }));
        }
      } catch (err) {
        setAvailability((prev) => ({
          ...prev,
          [field]: { checked: false, available: null, message: '', loading: false }
        }));
      }
    }, 350);
  }, []);

  // Field change handlers
  const handleRegNoChange = (val) => {
    const cleaned = val.replace(/\s+/g, '').toUpperCase();
    const autoEmail = cleaned ? `${cleaned.toLowerCase()}@klu.ac.in` : formData.academicEmail;

    setFormData((prev) => ({
      ...prev,
      registerNumber: cleaned,
      academicEmail: prev.academicEmail && !prev.academicEmail.includes('@klu.ac.in') ? prev.academicEmail : autoEmail
    }));
    setSubmitError('');

    checkCredential('registerNumber', cleaned);
    if (autoEmail && autoEmail.length >= 5) {
      checkCredential('academicEmail', autoEmail);
    }
  };

  const handleEmailChange = (val) => {
    const cleaned = val.trim().toLowerCase();
    setFormData((prev) => ({ ...prev, academicEmail: cleaned }));
    setSubmitError('');
    checkCredential('academicEmail', cleaned);
  };

  const handlePhoneChange = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digits }));
    setSubmitError('');
    if (digits.length === 10) {
      checkCredential('phone', digits);
    } else {
      setAvailability((prev) => ({
        ...prev,
        phone: { checked: false, available: null, message: '', loading: false }
      }));
    }
  };

  // Step 1: Submit Form & Atomic Slot Claim
  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const cleanName = formData.fullName.trim();
    const cleanRegNo = formData.registerNumber.trim().toUpperCase();
    const cleanEmail = formData.academicEmail.trim().toLowerCase();
    const cleanPhone = formData.phone.replace(/\D/g, '');

    // Validation checks
    if (!cleanName || cleanName.length < 2) {
      setSubmitError('Please enter your full name (minimum 2 characters).');
      return;
    }
    if (!cleanRegNo || cleanRegNo.length < 3) {
      setSubmitError('Please enter a valid Register / Roll Number.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setSubmitError('Please enter a valid academic email address.');
      return;
    }
    if (!cleanPhone || cleanPhone.length !== 10) {
      setSubmitError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const isOwnRegNo = registeredProfile && (registeredProfile.regNo || registeredProfile.registrationId || '').toUpperCase() === cleanRegNo;
    const isOwnEmail = registeredProfile && (registeredProfile.email || registeredProfile.academicEmail || '').toLowerCase() === cleanEmail;
    const isOwnPhone = registeredProfile && (registeredProfile.phone || '').replace(/\D/g, '') === cleanPhone;

    if (availability.registerNumber.available === false && !isOwnRegNo) {
      setSubmitError(`Register Number (${cleanRegNo}) is already registered.`);
      return;
    }
    if (availability.academicEmail.available === false && !isOwnEmail) {
      setSubmitError(`Academic Email (${cleanEmail}) is already registered.`);
      return;
    }
    if (availability.phone.available === false && !isOwnPhone) {
      setSubmitError(`Mobile number (${cleanPhone}) is already registered.`);
      return;
    }

    setSubmitting(true);

    try {
      const res = await failoverApi.post('v1/registrations/register', {
        fullName: cleanName,
        registerNumber: cleanRegNo,
        academicEmail: cleanEmail,
        phone: cleanPhone,
        department: formData.department,
        section: formData.section,
        academicYear: formData.academicYear,
        gender: formData.gender,
        residencyStatus: formData.residencyStatus
      });

      const data = res.data;

      if (data?.success && data?.registration) {
        // Clear draft from localStorage
        localStorage.removeItem(DRAFT_KEY);

        const savedReg = {
          ...data.registration,
          id: data.registration.id || `AGRI-2026-${cleanRegNo.slice(-4)}`,
          name: cleanName,
          regNo: cleanRegNo,
          email: cleanEmail,
          phone: cleanPhone,
          branch: formData.department,
          department: formData.department,
          section: formData.section,
          year: formData.academicYear,
          academicYear: formData.academicYear,
          residency: formData.residencyStatus,
          residencyStatus: formData.residencyStatus,
          paymentStatus: 'UNPAID',
          verificationStatus: 'PENDING',
          registrationId: cleanRegNo
        };

        setRegisteredProfile(savedReg);
        setIssuedIdCard(savedReg);
        fetchStats();

        // Immediate transition into Step 2 (Payment Screen) without reloading!
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSubmitError(data?.error || 'Registration failed.');
      }
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || err.message;
      const code = err.response?.data?.code;

      if (code === 'REGISTRATIONS_CLOSED' || (errorMsg && errorMsg.toLowerCase().includes('closed'))) {
        setEventGate({
          isOpen: false,
          isFull: false,
          checked: true,
          message: errorMsg || 'Registrations are currently closed by the administrator.'
        });
        setSubmitError(errorMsg || 'Registrations are currently closed by the administrator.');
      } else if (code === 'CAPACITY_FULL') {
        // Seat limit reached simultaneously by another participant
        setCapacityFullModal({
          show: true,
          message: errorMsg || 'The event seat limit was reached. Capacity is full.'
        });
      } else if (status === 409) {
        if (registeredProfile && (isOwnRegNo || isOwnEmail || isOwnPhone)) {
          // This registration is already reserved by this student.
          // Apply edited details to the profile and proceed seamlessly to payment.
          const updatedReg = {
            ...registeredProfile,
            fullName: cleanName,
            name: cleanName,
            regNo: cleanRegNo,
            registerNumber: cleanRegNo,
            registrationId: cleanRegNo,
            email: cleanEmail,
            phone: cleanPhone,
            department: formData.department,
            branch: formData.department,
            section: formData.section,
            year: formData.academicYear,
            academicYear: formData.academicYear,
            gender: formData.gender,
            residency: formData.residencyStatus,
            residencyStatus: formData.residencyStatus,
            paymentStatus: registeredProfile.paymentStatus || 'UNPAID'
          };
          setRegisteredProfile(updatedReg);
          sessionStorage.setItem('agri_pending_registration', JSON.stringify(updatedReg));
          setStep(2);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        setSubmitError(errorMsg || 'A registration with these credentials already exists.');
      } else {
        setSubmitError(errorMsg || 'Network error occurred while reserving your seat. Please retry.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Handle Screenshot Selection with Instant Preview & Compression
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

    // Client-side image compression
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

  const copyUpiId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2200);
  };

  // Step 2: Complete Payment Submission
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

    const targetRegId = registeredProfile?.registrationId || registeredProfile?.registerNumber || registeredProfile?.regNo || registeredProfile?.id;
    if (!targetRegId) {
      setPaymentError('Registration profile not found. Please re-enter your registration details.');
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
      fd.append('idProof', proofFile); // Alias for fallback

      if (registeredProfile?.fullName || registeredProfile?.name) {
        fd.append('fullName', registeredProfile.fullName || registeredProfile.name);
      }
      if (registeredProfile?.department || registeredProfile?.branch) {
        fd.append('department', registeredProfile.department || registeredProfile.branch);
      }
      if (registeredProfile?.section) fd.append('section', registeredProfile.section);
      if (registeredProfile?.academicYear || registeredProfile?.year) {
        fd.append('academicYear', registeredProfile.academicYear || registeredProfile.year);
      }
      if (registeredProfile?.gender) fd.append('gender', registeredProfile.gender);
      if (registeredProfile?.residencyStatus || registeredProfile?.residency) {
        fd.append('residencyStatus', registeredProfile.residencyStatus || registeredProfile.residency);
      }

      const res = await failoverApi.post('v1/registrations/payment', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        // Clear drafts from storage
        sessionStorage.removeItem('agri_pending_registration');
        localStorage.removeItem(DRAFT_KEY);

        const updated = res.data.registration || {
          ...registeredProfile,
          paymentStatus: 'PAID',
          transactionId: cleanTxnId
        };
        setIssuedIdCard(updated);
        fetchStats();

        // Redirect directly to Success Page as specified in Workflow B
        const destinationId = res.data.registrationId || targetRegId;
        navigate(`/success/${encodeURIComponent(destinationId)}`);
      } else {
        setPaymentError(res.data?.error || 'Payment proof verification failed.');
      }
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || err.message || 'Payment upload failed';
      if (status === 409) {
        setPaymentError(`UPI Reference ID (${cleanTxnId}) has already been submitted by another attendee. Please check your transaction receipt.`);
      } else {
        setPaymentError(errorMsg);
      }
    } finally {
      setPaymentSubmitting(false);
    }
  };

  if (isReloaded) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between mb-6">
        {step === 2 ? (
          <button
            type="button"
            onClick={() => {
              setStep(1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#CCE3DE] text-[#1A3C34] text-xs font-bold transition-all border border-[#CCE3DE] shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Edit Details</span>
          </button>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#CCE3DE] text-[#1A3C34] text-xs font-semibold transition-all border border-[#CCE3DE] shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Course Overview</span>
          </Link>
        )}

        {/* Workflow Step Tracker */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#CCE3DE] text-xs font-semibold text-[#1A3C34]">
          <button
            type="button"
            onClick={() => {
              if (step === 2) {
                setStep(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              step === 1
                ? 'bg-[#1A3C34] text-white shadow-xs cursor-default'
                : 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#bbf7d0] cursor-pointer'
            }`}
          >
            {step === 2 && <Edit3 className="w-3 h-3 text-[#15803D]" />}
            <span>Step 1: Profile {step === 2 ? '(Edit)' : ''}</span>
          </button>
          <span className="text-[#A4C3B2]">➔</span>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              step === 2
                ? 'bg-[#1A3C34] text-white shadow-xs'
                : 'bg-[#EAF4F4] text-[#6B9080]'
            }`}
          >
            Step 2: Payment
          </span>
        </div>
      </div>

      {/* ======================================================================
          STEP 1: STUDENT REGISTRATION FORM
          ====================================================================== */}
      {step === 1 && (
        <div className="relative bg-white p-6 sm:p-10 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Corner Leaves SVGs */}
          <svg
            className="absolute -top-4 -right-4 w-32 h-32 sm:w-44 sm:h-44 text-[#1A3C34] pointer-events-none select-none z-0 opacity-80"
            viewBox="0 0 160 160"
            fill="currentColor"
          >
            <path d="M160 0 C120 20, 90 60, 75 110 C80 75, 70 40, 45 15 C65 45, 80 85, 85 120 C60 85, 35 65, 10 55 C45 80, 70 110, 80 135 C50 120, 25 115, 0 120 C45 135, 75 145, 95 150 C100 120, 115 70, 140 30 C120 60, 105 100, 102 140 C125 115, 145 75, 160 40 C135 75, 115 115, 110 150 C135 135, 150 110, 160 80 Z" />
          </svg>

          <svg
            className="absolute -bottom-6 -left-6 w-28 h-28 sm:w-36 sm:h-36 text-[#1A3C34] pointer-events-none select-none z-0 opacity-80"
            viewBox="0 0 140 140"
            fill="currentColor"
          >
            <path d="M0 140 C20 110, 50 85, 90 75 C60 70, 30 60, 15 35 C40 60, 70 75, 100 80 C70 55, 50 30, 40 5 C65 35, 90 60, 110 75 C95 45, 90 20, 95 0 C110 40, 120 70, 125 90 C140 95, 145 100, 140 105 C120 100, 105 110, 90 135 C100 110, 105 95, 100 85 C80 105, 55 125, 30 140 Z" />
          </svg>

          {/* Document Header */}
          <div className="relative z-10 mb-6 sm:mb-8">
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-3xl sm:text-5xl font-black font-serif text-[#1A3C34] tracking-wider uppercase">
                {eventGate.checked && !eventGate.isOpen ? 'REGISTRATIONS' : 'REGISTRATION FORM'}
              </h1>
              <div className="flex flex-col gap-1.5 w-16 sm:w-24 pt-1">
                <div className="h-0.5 bg-[#1A3C34] rounded-full" />
                <div className="h-0.5 bg-[#1A3C34] rounded-full" />
                <div className="h-0.5 bg-[#1A3C34] rounded-full" />
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-xs sm:text-sm font-bold text-[#1A3C34] uppercase tracking-wider">
                AgriVerse: UE Course • 31st October &amp; 1st November 2026
              </p>
              <p className="text-xs font-semibold text-[#3D6153]">
                Theme: Modern Agriculture: Sustainable Practices, Innovations &amp; Future Farming
              </p>
              <p className="text-[11px] font-medium text-[#6B9080]">
                Venue: Admin Block Seminar Hall • ₹350 per participant (Individual) • Autosaved to Draft
              </p>
            </div>

            {/* Editing Mode Banner */}
            {registeredProfile && (
              <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-white border border-[#2D6A4F]/30 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#1A3C34] block">
                      Editing Registration Details ({registeredProfile.registrationId || registeredProfile.regNo})
                    </span>
                    <span className="text-[11px] text-[#6B9080]">
                      Update any details below and click proceed to update your reserved slot.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <span>Return to Payment (Step 2)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Conditional Gate: If Registrations are Closed by Administrator */}
          {eventGate.checked && !eventGate.isOpen ? (
            <div className="relative z-10 bg-white p-8 sm:p-10 rounded-xl border border-gray-200 shadow-sm text-center max-w-2xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FEE2E2] border border-[#FCA5A5] text-[#DC2626] text-xs font-black uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" />
                <span>REGISTRATIONS CLOSED</span>
              </div>

              <div className="w-16 h-16 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] flex items-center justify-center text-[#DC2626] mx-auto">
                <Lock className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black text-[#1A3C34] tracking-tight">
                  Registrations are Closed
                </h2>
                <p className="text-sm font-medium text-[#3D6153] leading-relaxed max-w-lg mx-auto">
                  {eventGate.message || 'Registrations are currently closed by the administrator. New participant applications are not being accepted at this time.'}
                </p>
              </div>

              {/* Helpful notice for existing registrants */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A3C34]">
                  <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
                  <span>Already Registered? Check Your Status</span>
                </div>
                <p className="text-xs text-[#6B9080] leading-relaxed">
                  If you have already submitted your details or opted to pay later, your reservation is secure! You can track your status, upload payment proof, or view your ID card anytime.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  to="/status"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#15803D] hover:bg-[#1E5D39] text-white text-xs font-black uppercase tracking-wider transition-all shadow-md hover:shadow-lg"
                >
                  <Search className="w-4 h-4" />
                  <span>Check Registration Status</span>
                </Link>

                <Link
                  to="/"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-white border border-[#CCE3DE] hover:bg-[#EAF4F4] text-[#1A3C34] text-xs font-bold transition-all shadow-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Home Overview</span>
                </Link>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await failoverApi.get('v1/event/status');
                      const data = res.data;
                      const open = data && data.isOpen !== false && data.isSystemOpen !== false;
                      setEventGate({
                        isOpen: open,
                        isFull: Boolean(data?.isFull),
                        checked: true,
                        message: data?.message || (open ? '' : 'Registrations are closed.')
                      });
                    } catch {}
                  }}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6B9080] hover:text-[#1A3C34] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh status to check if opened</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {submitError && (
                <div className="relative z-10 mb-6 p-4 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-[#DC2626]" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Form Card */}
              <form onSubmit={handleSubmitProfile} className="relative z-10 space-y-6">
            <div className="p-5 sm:p-8 rounded-xl bg-slate-50/80 border border-gray-200 shadow-sm space-y-6">
              <div className="space-y-4 text-xs sm:text-sm">
                {/* 1. Full Name */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between shrink-0">
                    <span>Full Name</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      required
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#A4C3B2]/50 focus:border-[#1A3C34] text-[#1A3C34] text-xs sm:text-sm outline-none transition-all placeholder:text-[#6B9080]/60 shadow-sm"
                    />
                  </div>
                </div>

                {/* 2. Register / Roll Number (Auto-uppercased with Real-Time Badge) */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between sm:pt-2.5">
                    <span>Register / Roll No</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex-1 space-y-1">
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. 2300030001"
                        value={formData.registerNumber}
                        onChange={(e) => handleRegNoChange(e.target.value)}
                        className={`w-full px-3.5 py-2.5 pr-32 rounded-xl bg-white border ${
                          availability.registerNumber.available === false
                            ? 'border-[#DC2626] ring-1 ring-[#DC2626]'
                            : availability.registerNumber.available === true
                            ? 'border-[#15803D]'
                            : 'border-[#A4C3B2]/50'
                        } text-[#1A3C34] font-mono text-xs sm:text-sm outline-none transition-all shadow-sm`}
                      />

                      {/* Real-time Badge */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-bold pointer-events-none select-none">
                        {availability.registerNumber.loading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#6B9080]" />
                        ) : availability.registerNumber.available === true ? (
                          <span className="text-[#15803D] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Available ✓</span>
                          </span>
                        ) : availability.registerNumber.available === false ? (
                          <span className="text-[#DC2626] inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Already Registered ✕</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Academic Email Address (Valid email format with Real-Time Badge) */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between sm:pt-2.5">
                    <span>Academic Email</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex-1 space-y-1">
                    <div className="relative">
                      <input
                        type="email"
                        required
                        placeholder="e.g. 2300030001@klu.ac.in"
                        value={formData.academicEmail}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className={`w-full px-3.5 py-2.5 pr-32 rounded-xl bg-white border ${
                          availability.academicEmail.available === false
                            ? 'border-[#DC2626] ring-1 ring-[#DC2626]'
                            : availability.academicEmail.available === true
                            ? 'border-[#15803D]'
                            : 'border-[#A4C3B2]/50'
                        } text-[#1A3C34] font-mono text-xs sm:text-sm outline-none transition-all shadow-sm`}
                      />

                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-bold pointer-events-none select-none">
                        {availability.academicEmail.loading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#6B9080]" />
                        ) : availability.academicEmail.available === true ? (
                          <span className="text-[#15803D] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Available ✓</span>
                          </span>
                        ) : availability.academicEmail.available === false ? (
                          <span className="text-[#DC2626] inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Already Registered ✕</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Phone Number (10-Digit Format with Real-Time Badge) */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between sm:pt-2.5">
                    <span>Phone Number</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex-1 space-y-1">
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="Enter 10-digit mobile number"
                        value={formData.phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className={`w-full px-3.5 py-2.5 pr-32 rounded-xl bg-white border ${
                          availability.phone.available === false
                            ? 'border-[#DC2626] ring-1 ring-[#DC2626]'
                            : availability.phone.available === true
                            ? 'border-[#15803D]'
                            : 'border-[#A4C3B2]/50'
                        } text-[#1A3C34] font-mono text-xs sm:text-sm outline-none transition-all shadow-sm`}
                      />

                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-bold pointer-events-none select-none">
                        {availability.phone.loading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#6B9080]" />
                        ) : availability.phone.available === true ? (
                          <span className="text-[#15803D] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Available ✓</span>
                          </span>
                        ) : availability.phone.available === false ? (
                          <span className="text-[#DC2626] inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Already Registered ✕</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Department */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between shrink-0">
                    <span>Department</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      required
                      placeholder="Enter your department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#A4C3B2]/50 focus:border-[#1A3C34] text-[#1A3C34] text-xs sm:text-sm outline-none shadow-sm"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* 6. Section */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between shrink-0">
                    <span>Section</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      required
                      placeholder="e.g. A, B, C or 01"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                      className="w-full sm:w-48 px-3.5 py-2.5 rounded-xl bg-white border border-[#A4C3B2]/50 focus:border-[#1A3C34] text-[#1A3C34] text-xs sm:text-sm font-bold uppercase tracking-wider outline-none shadow-sm"
                    />
                  </div>
                </div>

                {/* 7. Academic Year */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between shrink-0">
                    <span>Academic Year</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex-1 min-w-0">
                    <select
                      value={formData.academicYear}
                      onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                      className="w-full sm:max-w-xs px-3.5 py-2.5 rounded-xl bg-white border border-[#A4C3B2]/50 focus:border-[#1A3C34] text-[#1A3C34] text-xs sm:text-sm outline-none cursor-pointer shadow-sm"
                    >
                      <option>1st Year</option>
                      <option>2nd Year</option>
                      <option>3rd Year</option>
                      <option>4th Year</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                {/* 8. Gender */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between shrink-0">
                    <span>Gender</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex items-center gap-4">
                    {['Male', 'Female', 'Other'].map((g) => (
                      <label
                        key={g}
                        onClick={() => setFormData({ ...formData, gender: g })}
                        className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-medium text-[#1A3C34]"
                      >
                        <input
                          type="radio"
                          name="gender"
                          checked={formData.gender === g}
                          onChange={() => setFormData({ ...formData, gender: g })}
                          className="w-4 h-4 text-[#1A3C34] accent-[#1A3C34] cursor-pointer"
                        />
                        <span>{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 9. Residency Status */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                  <label className="w-36 font-semibold text-[#1A3C34] flex items-center justify-between shrink-0">
                    <span>Residency Status</span>
                    <span className="hidden sm:inline">:</span>
                  </label>
                  <div className="flex items-center gap-4">
                    {['Day Scholar', 'Hosteller'].map((res) => (
                      <label
                        key={res}
                        onClick={() => setFormData({ ...formData, residencyStatus: res })}
                        className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-medium text-[#1A3C34]"
                      >
                        <input
                          type="radio"
                          name="residencyStatus"
                          checked={formData.residencyStatus === res}
                          onChange={() => setFormData({ ...formData, residencyStatus: res })}
                          className="w-4 h-4 text-[#1A3C34] accent-[#1A3C34] cursor-pointer"
                        />
                        <span>{res}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-lg bg-[#0D2818] hover:bg-[#153E27] text-white font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{registeredProfile ? 'Updating Profile & Slot...' : 'Claiming Slot & Saving Profile...'}</span>
                </>
              ) : (
                <>
                  <span>{registeredProfile ? 'Update Details & Proceed to Payment (₹350)' : 'Save Profile & Proceed to Payment (₹350)'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-[11px] text-[#6B9080] font-mono px-1">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Autosaved draft: agrigen_solo_registration_draft_v4</span>
              </span>
              <span>Atomic slot claim protected</span>
            </div>
          </form>
            </>
          )}
        </div>
      )}

      {/* ======================================================================
          STEP 2: PAYMENT SCREEN (Seamless inline transition without reloading)
          ====================================================================== */}
      {step === 2 && registeredProfile && (
        <div className="bg-white p-6 sm:p-10 rounded-xl border border-gray-200 shadow-sm space-y-6 animate-in fade-in">
          {/* Header */}
          <div className="border-b border-gray-200 pb-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#DCFCE7] text-[#15803D] text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Step 2 of 2: Complete ₹350 Fee Payment</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#EAF4F4] hover:bg-[#CCE3DE] text-[#1A3C34] text-xs font-bold transition-all border border-[#CCE3DE] shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>Edit Profile Details</span>
              </button>
            </div>
            <h2 className="text-2xl font-black text-[#1A3C34]">
              Slot Reserved for {registeredProfile.fullName || registeredProfile.name}
            </h2>
            <p className="text-xs sm:text-sm text-[#3D6153]">
              Your student profile has been registered with registration ID <strong className="font-mono text-[#1A3C34]">{registeredProfile.registrationId}</strong>. Complete the payment below to finalize verification.
            </p>
          </div>

          {/* Reserved Profile Summary Pill with Edit Option */}
          <div className="p-4 sm:p-5 rounded-lg bg-slate-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between border-b border-[#CCE3DE]/60 pb-2.5">
              <span className="text-[11px] font-bold text-[#1A3C34] uppercase tracking-wider flex items-center gap-1.5">
                <span>Attendee Information</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white hover:bg-[#CCE3DE] text-[#1A3C34] text-xs font-bold border border-[#CCE3DE] transition-all cursor-pointer shadow-xs"
              >
                <Edit3 className="w-3 h-3 text-[#2D6A4F]" />
                <span>Edit Details</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Registration ID</span>
                <span className="font-mono font-bold text-[#1A3C34]">{registeredProfile.registrationId}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Department</span>
                <span className="font-bold text-[#1A3C34] truncate block">{registeredProfile.department || registeredProfile.branch}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Fee Amount</span>
                <span className="font-bold text-[#15803D]">₹350.00</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Payment Status</span>
                <span className="font-bold text-[#D97706]">{registeredProfile.paymentStatus || 'UNPAID'}</span>
              </div>
            </div>
          </div>

          {/* Step 2 Form */}
          <form onSubmit={handleCompletePayment} className="space-y-6">
            {paymentError && (
              <div className="p-4 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
                <span className="font-medium leading-relaxed">{paymentError}</span>
              </div>
            )}

            {/* 1. UPI QR Code Display Grid (Shows ALL Active QR Codes from Admin Panel) */}
            <div className="p-5 sm:p-7 rounded-xl bg-[#F4F9F6] border border-[#DCE8E2] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CCE3DE]/70 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1A3C34] uppercase tracking-wider flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#15803D]" />
                    <span>Official UPI Payment QR Codes</span>
                  </h3>
                  <p className="text-[11px] text-[#6B9080]">
                    Select any active account below, scan via your UPI app (GPay / PhonePe / Paytm), and pay exact registration fee.
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
                    qrImages[method.id] ||
                    methodQrImages['qr1'] ||
                    qrImages['qr1'];

                  return (
                    <div
                      key={method.id || idx}
                      className="bg-white p-5 sm:p-6 rounded-xl border border-[#DCE8E2] hover:border-[#15803D] transition-all shadow-xs flex flex-col items-center justify-between text-center relative group"
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
                      <div className="p-3.5 rounded-xl bg-white border border-[#DCE8E2] shadow-xs mb-3 flex items-center justify-center">
                        {qrImageSrc ? (
                          <img
                            src={qrImageSrc}
                            alt={method.title || `Payment QR ${idx + 1}`}
                            className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                          />
                        ) : (
                          <div className="w-48 h-48 sm:w-56 sm:h-56 bg-[#F4F9F6] rounded-lg flex flex-col items-center justify-center gap-2">
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

            {/* 2. Proof Collection: UPI Reference ID & Payment Screenshot */}
            <div className="p-5 sm:p-7 rounded-xl bg-[#F8FAF9] border border-[#DCE8E2] space-y-5">
              <h3 className="text-sm font-bold text-[#1A3C34] uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                <span>Proof Collection &amp; Verification</span>
              </h3>

              {/* UPI Reference ID / Transaction ID */}
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
                  className="w-full px-4 py-3 rounded-lg bg-white border border-[#DCE8E2] text-xs sm:text-sm font-mono font-semibold text-[#1A3C34] outline-none focus:border-[#1A3C34] focus:ring-1 focus:ring-[#1A3C34] shadow-xs"
                />
                <p className="text-[11px] text-[#3D6153]">
                  Enter the exact 12-digit UPI reference ID or alphanumeric transaction number from your payment receipt.
                </p>
              </div>

              {/* Payment Screenshot with Instant Preview & Change Image Button */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1A3C34]">
                  Payment Screenshot Receipt <span className="text-[#DC2626]">*</span>
                </label>

                {/* Hidden Native File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleProofChange}
                  className="hidden"
                />

                {filePreview ? (
                  /* Client-Side Image Preview Card with Change Image Button */
                  <div className="p-4 rounded-xl bg-white border border-[#15803D] shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="relative group shrink-0">
                        <img
                          src={filePreview}
                          alt="Uploaded payment screenshot preview"
                          className="w-28 h-28 sm:w-32 sm:h-32 object-contain rounded-xl border border-[#CCE3DE] bg-[#F4F9F6] p-1 shadow-xs"
                        />
                      </div>
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
                          Text and UTR timestamp are sharp and ready for organizer verification.
                        </p>
                      </div>

                      {/* Action Buttons: Change Image & Remove */}
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
                  /* Clean File Drop/Selector Area */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 sm:p-8 rounded-xl bg-white border-2 border-dashed border-[#DCE8E2] hover:border-[#1A3C34] transition-all cursor-pointer text-center space-y-2 group shadow-xs"
                  >
                    <div className="w-12 h-12 mx-auto rounded-full bg-[#EAF4F4] group-hover:bg-[#DCE8E2] text-[#1A3C34] flex items-center justify-center transition-all">
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
                    <span className="inline-block px-3 py-1 rounded-full bg-[#F4F9F6] text-[#3D6153] text-[10px] font-semibold border border-[#DCE8E2]">
                      Instant client-side preview &amp; compression
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Official WhatsApp Community Option */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#F8FAF9] border border-[#DCE8E2] space-y-2.5">
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
                  <span>Yes, I joined the community</span>
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
            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={paymentSubmitting}
                className="w-full py-3.5 rounded-lg bg-[#0D2818] hover:bg-[#153E27] text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {paymentSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying Proof &amp; Uploading to Cloud CDN...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Payment Proof &amp; Complete Registration</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono px-1">
                <span>Unique UTR verification enforced</span>
                <span>Direct redirect to /success/:registrationId</span>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* CAPACITY FULL / 403 FORBIDDEN MODAL */}
      {capacityFullModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white p-7 sm:p-8 rounded-xl max-w-md w-full border border-gray-200 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-[#1A3C34]">
              Capacity Limit Reached
            </h3>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              {capacityFullModal.message}
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/"
                className="w-full py-2.5 rounded-lg bg-[#0D2818] text-white font-bold text-xs hover:bg-[#153E27] text-center"
              >
                Back to Home
              </Link>
              <button
                type="button"
                onClick={() => setCapacityFullModal({ show: false, message: '' })}
                className="w-full py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold text-xs hover:bg-gray-200 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
