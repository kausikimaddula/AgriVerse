import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Sparkles, Sprout, CheckCircle,
  Download, QrCode, Upload, ExternalLink, X, Info
} from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import failoverApi from '../api/failoverClient.js';
import { AgrigenLogo } from '../components/AgrigenIcons.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function IdCardPage() {
  const navigate = useNavigate();
  const {
    issuedIdCard,
    setIssuedIdCard,
    whatsappLink,
    qrAccounts,
    qrImages,
    generateQrs,
    fetchStats
  } = useApp();

  const [dropAnimKey, setDropAnimKey] = useState(0);
  const [activeQrIndex, setActiveQrIndex] = useState(0);
  const [enlargeQr, setEnlargeQr] = useState(false);

  // Payment Verification State
  const [txnId, setTxnId] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [joinedWhatsapp, setJoinedWhatsapp] = useState('');
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [finalSuccessPass, setFinalSuccessPass] = useState(null);

  useEffect(() => {
    if (issuedIdCard?.status === 'VERIFIED') {
      setFinalSuccessPass(issuedIdCard);
    }
  }, [issuedIdCard]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Selected file exceeds the 10MB limit.');
      return;
    }
    setProofFile(file);
    setSubmitError('');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleCompleteRegistration = async (e) => {
    if (e) e.preventDefault();
    setSubmitError('');

    if (!txnId.trim()) {
      setSubmitError('Please enter your 12-digit Transaction ID / UTR reference number.');
      return;
    }

    if (!proofFile) {
      setSubmitError('Please upload your payment screenshot.');
      return;
    }

    if (!joinedWhatsapp) {
      setSubmitError('Please indicate whether you joined the WhatsApp group (Yes or No).');
      return;
    }

    const candidateName = (issuedIdCard?.name || '').trim();
    const candidateRegNo = (issuedIdCard?.regNo || '').trim().toUpperCase();
    const candidatePhone = (issuedIdCard?.phone || '').replace(/\D/g, '');
    const candidateBranch = (issuedIdCard?.branch || 'Agricultural Tech').trim();
    const candidateSection = (issuedIdCard?.section || 'A').trim();
    const candidateResidency = issuedIdCard?.residency || 'Day Scholar';
    const candidateYear = issuedIdCard?.year || '1st Year';
    const candidateGender = issuedIdCard?.gender || 'Male';
    const candidateEmail = (issuedIdCard?.email || `${candidateRegNo.toLowerCase()}@klu.ac.in`).trim().toLowerCase();

    setFinalSubmitting(true);

    try {
      const body = new FormData();
      body.append('name', candidateName);
      body.append('fullName', candidateName);
      body.append('regNo', candidateRegNo);
      body.append('phone', candidatePhone);
      body.append('mobileNumber', candidatePhone);
      body.append('email', candidateEmail);
      body.append('branch', candidateBranch);
      body.append('department', candidateBranch);
      body.append('section', candidateSection);
      body.append('residency', candidateResidency);
      body.append('year', candidateYear);
      body.append('gender', candidateGender);
      body.append('college', 'KLU / AgriGen Campus');
      body.append('txnId', txnId.trim().toUpperCase());
      body.append('joinedWhatsapp', joinedWhatsapp);
      body.append('paymentMode', 'PAY_NOW');
      if (proofFile) {
        body.append('idProof', proofFile);
      }

      const res = await failoverApi.post('register', body, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const pass = res.data.registration || {
          id: issuedIdCard?.id || `AGRI-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          ...issuedIdCard,
          txnId: txnId.trim()
        };

        try {
          const qrCodeUrl = await QRCode.toDataURL(
            `AGRIVERSE|${pass.id}|${pass.regNo}|${pass.name}|${pass.txnId}`,
            { width: 300, margin: 1 }
          );
          pass.qrCode = qrCodeUrl;
        } catch (e) {}

        setFinalSuccessPass(pass);
        setIssuedIdCard(pass);
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
        fetchStats();
      } else {
        setSubmitError(res.data?.error || 'Registration verification could not be completed.');
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Connection error. Please try again.';
      setSubmitError(message);
    } finally {
      setFinalSubmitting(false);
    }
  };

  const currentPass = finalSuccessPass || issuedIdCard || {
    id: 'AGRI-2026-6855',
    name: 'Student Delegate',
    regNo: '2300030001',
    phone: '9876543210',
    branch: 'Agricultural Tech',
    section: 'A',
    residency: 'Day Scholar',
    year: '1st Year',
    gender: 'Male',
    email: '2300030001@klu.ac.in'
  };

  return (
    <div className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto min-h-[calc(100vh-160px)] flex flex-col items-center">
      {/* Top Controls Bar */}
      <div className="w-full max-w-xl flex items-center justify-between gap-3 mb-6">
        <Link
          to="/register"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#CCE3DE] text-[#1A3C34] text-xs font-semibold transition-all border border-[#CCE3DE] shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Edit Details</span>
        </Link>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#CCE3DE] text-[11px] font-bold text-[#1A3C34]">
          <Sparkles className="w-3.5 h-3.5 text-[#84CC16]" />
          <span>STUDENT ID CARD • VERIFICATION</span>
        </div>

        <button
          onClick={() => setDropAnimKey((prev) => prev + 1)}
          title="Replay lanyard drop animation"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#CCE3DE] text-[#1A3C34] text-xs font-semibold transition-all border border-[#CCE3DE] shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#1A3C34]" />
          <span className="hidden sm:inline">Replay Drop</span>
        </button>
      </div>

      {!issuedIdCard && (
        <div className="w-full max-w-xl mb-4 p-3 rounded-xl bg-[#CCE3DE]/60 border border-[#A4C3B2] text-[#1A3C34] text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0 text-[#1A3C34]" />
            <span>Showing reference preview. Complete the registration form to personalize!</span>
          </div>
          <Link to="/register" className="font-bold underline text-xs flex-shrink-0">
            Go to Form
          </Link>
        </div>
      )}

      {/* TOP SUSPENSION LINE / CEILING MOUNT */}
      <div className="w-full max-w-md relative flex flex-col items-center z-20">
        <div className="w-full h-1.5 bg-[#1A3C34] rounded-full shadow-sm relative overflow-hidden">
          <div className="absolute inset-y-0 left-1/4 right-1/4 bg-[#84CC16]/60 rounded-full" />
        </div>
        <div className="w-16 h-3 bg-slate-500 shadow-md border-t border-slate-700 -mt-0.5 flex items-center justify-center">
          <div className="w-10 h-1 bg-slate-400" />
        </div>
      </div>

      {/* ANIMATED LANYARD & ID CARD ASSEMBLY */}
      <div
        key={dropAnimKey}
        className="w-full max-w-xl mx-auto flex flex-col items-center relative z-10 animate-lanyard-drop"
      >
        {/* 1. Lanyard Braided Green Ribbon */}
        <div className="w-12 h-20 sm:h-24 shadow-md relative overflow-hidden bg-[#27784A]">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-black/25" />
        </div>

        {/* 2. Silver Metal Crimp Ring */}
        <div className="w-8 h-3.5 bg-slate-300 shadow-md border-t border-b border-slate-500 relative z-20 -mt-0.5 flex items-center justify-center">
          <div className="w-6 h-1 bg-slate-400" />
        </div>

        {/* 3. Silver Metal Swivel Clip */}
        <div className="relative z-20 flex flex-col items-center -mt-0.5">
          <div className="w-3.5 h-2.5 bg-slate-400 shadow-inner" />
          <div className="w-5 h-5 border-2 border-slate-400 bg-slate-300 shadow-sm flex items-center justify-center -mt-0.5">
            <div className="w-1.5 h-2.5 bg-slate-700/60" />
          </div>
        </div>

        {/* 4. Acrylic Sleeve Top Slot */}
        <div className="w-full flex justify-center -mb-2.5 relative z-10">
          <div className="w-24 h-5 bg-white border-2 border-slate-300 rounded-t-xl flex items-center justify-center shadow-sm">
            <div className="w-10 h-1.5 bg-slate-800/80 rounded-full shadow-inner" />
          </div>
        </div>

        {/* 5. PHYSICAL ID CARD BADGE CASING */}
        <div className="w-full bg-white p-2 sm:p-3 rounded-3xl shadow-2xl border-4 border-slate-200/90 relative">
          <div className="w-full bg-[#F4F9F6] p-5 sm:p-7 rounded-2xl border border-[#CCE3DE] overflow-hidden relative text-[#1A3C34]">
            {/* Corner Leaves */}
            <svg
              className="absolute -top-3 -right-3 w-24 h-24 text-[#1A3C34] pointer-events-none select-none opacity-80 z-0"
              viewBox="0 0 160 160"
              fill="currentColor"
            >
              <path d="M160 0 C120 20, 90 60, 75 110 C80 75, 70 40, 45 15 C65 45, 80 85, 85 120 C60 85, 35 65, 10 55 C45 80, 70 110, 80 135 C50 120, 25 115, 0 120 C45 135, 75 145, 95 150 C100 120, 115 70, 140 30 C120 60, 105 100, 102 140 C125 115, 145 75, 160 40 C135 75, 115 115, 110 150 C135 135, 150 110, 160 80 Z" />
            </svg>

            {/* ID Card Header */}
            <div className="relative z-10 text-center mb-5">
              <div className="w-12 h-12 mx-auto rounded-full bg-black text-white flex items-center justify-center shadow-md border-2 border-[#CCE3DE] mb-2 overflow-hidden">
                <AgrigenLogo className="w-full h-full object-cover" />
              </div>
              <div className="text-xs text-[#1A3C34] font-bold mt-2">
                {currentPass.name}{' '}
                <span className="text-[#6B9080] font-normal">•</span> Reg:{' '}
                {currentPass.regNo}
              </div>
              <div className="text-[11px] text-[#15803D] font-extrabold mt-0.5">
                Fee: ₹350 • Admin Block Seminar Hall
              </div>
            </div>

            {/* ID Card Body */}
            <div className="relative z-10 space-y-4">
              {finalSuccessPass ? (
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-[#15803D] text-center space-y-3 shadow-sm">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shadow-sm">
                    <CheckCircle className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#15803D] bg-[#DCFCE7] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      ✓ PAYMENT &amp; REGISTRATION VERIFIED
                    </span>
                    <div className="text-base font-mono font-bold text-[#1A3C34] mt-1.5">
                      PASS #{finalSuccessPass.id}
                    </div>
                    <div className="text-xs text-[#3D6153] font-mono mt-0.5">
                      UTR: {finalSuccessPass.txnId || txnId}
                    </div>
                  </div>
                  {finalSuccessPass.qrCode && (
                    <div className="p-2 bg-[#F4F9F6] rounded-xl inline-block border border-[#CCE3DE] shadow-sm">
                      <img src={finalSuccessPass.qrCode} alt="Pass QR" className="w-28 h-28 object-contain" />
                    </div>
                  )}
                  <p className="text-xs text-[#15803D] font-bold">
                    Seat confirmed for {finalSuccessPass.name}. Present this pass at venue entrance on 31st Oct &amp; 1st Nov 2026!
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white font-bold text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Save / Print ID Card</span>
                    </button>
                    <Link
                      to="/"
                      className="py-3 px-4 rounded-xl bg-white hover:bg-[#CCE3DE] border border-[#CCE3DE] text-[#1A3C34] text-xs font-bold transition-all shadow-sm text-center"
                    >
                      Back to Home
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCompleteRegistration} className="space-y-4">
                  {/* TWO QR CODES */}
                  <div className="p-4 rounded-2xl bg-white border border-[#CCE3DE] shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1A3C34] uppercase tracking-wide flex items-center gap-1.5">
                        <span>1. Scan &amp; Pay (₹350)</span>
                      </span>
                      <button
                        type="button"
                        onClick={generateQrs}
                        className="text-[10px] font-bold text-[#1A3C34] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Refresh QR</span>
                      </button>
                    </div>

                    <div className="flex justify-center">
                      <div
                        onClick={() => { setActiveQrIndex(0); setEnlargeQr(true); }}
                        className="p-4 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] hover:border-[#1A3C34] flex flex-col items-center text-center cursor-pointer transition-all hover:scale-[1.02] max-w-xs w-full"
                        title="Tap to enlarge"
                      >
                        <div className="w-36 h-36 bg-white p-2 rounded-lg border border-[#CCE3DE] flex items-center justify-center">
                          {qrImages.qr1 ? (
                            <img src={qrImages.qr1} alt="UPI QR" className="w-full h-full object-contain" />
                          ) : (
                            <QrCode className="w-16 h-16 text-[#6B9080]" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[#3D6153] mt-2 truncate max-w-full font-bold">
                          sundarrajan.it@okaxis
                        </span>
                        <span className="text-sm font-extrabold text-[#15803D] mt-0.5">₹350</span>
                      </div>
                    </div>
                  </div>

                  {/* UTR NUMBER */}
                  <div className="p-4 rounded-2xl bg-white border border-[#CCE3DE] shadow-sm space-y-1.5">
                    <label className="block text-xs font-bold text-[#1A3C34] tracking-wide">
                      2. Transaction ID / UTR Number <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ENTER 12-DIGIT UTR / REFERENCE NUMBER"
                      value={txnId}
                      onChange={(e) => setTxnId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] focus:border-[#1A3C34] focus:ring-1 focus:ring-[#1A3C34] text-[#1A3C34] text-xs font-mono outline-none uppercase placeholder:text-[#6B9080]/60 shadow-sm"
                    />
                  </div>

                  {/* UPLOAD PAYMENT SCREENSHOT */}
                  <div className="p-4 rounded-2xl bg-white border border-[#CCE3DE] shadow-sm space-y-1.5">
                    <label className="block text-xs font-bold text-[#1A3C34] tracking-wide">
                      3. Upload Payment Screenshot <span className="text-[#DC2626]">*</span>
                    </label>
                    <label className="w-full py-3 px-3 rounded-xl bg-[#F4F9F6] hover:bg-[#EAF4F4] border-2 border-[#CCE3DE] border-dashed text-center flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm">
                      <Upload className="w-4 h-4 text-[#1A3C34]" />
                      <span className="text-xs text-[#3D6153] truncate font-medium">
                        {proofFile ? proofFile.name : 'Upload Screenshot (JPG, PNG)'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    {filePreview && (
                      <div className="mt-2 flex items-center gap-2.5 text-xs text-[#15803D] bg-[#DCFCE7] p-2 rounded-xl border border-[#A4C3B2]">
                        <span>✓ Screenshot attached:</span>
                        <img src={filePreview} alt="Receipt preview" className="w-8 h-8 object-cover rounded border border-[#CCE3DE]" />
                      </div>
                    )}
                  </div>

                  {/* JOIN WHATSAPP GROUP */}
                  <div className="p-3.5 rounded-2xl bg-white border border-[#CCE3DE] shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-[#1A3C34] tracking-wide">
                        4. Join WhatsApp Group <span className="text-[#DC2626] font-bold text-sm leading-none">*</span>
                      </label>
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15803D] hover:underline"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="text-[11px] text-[#3D6153] bg-[#F4F9F6] px-2.5 py-1.5 rounded-lg border border-[#CCE3DE] flex items-center justify-between gap-2">
                      <span className="truncate">Join: <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="font-mono text-[#075E54] underline font-semibold">{whatsappLink.replace(/^https?:\/\//, '')}</a></span>
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                      <label
                        onClick={() => setJoinedWhatsapp('Yes')}
                        className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#1A3C34]"
                      >
                        <input
                          type="radio"
                          name="joinedWhatsapp"
                          value="Yes"
                          checked={joinedWhatsapp === 'Yes'}
                          onChange={() => setJoinedWhatsapp('Yes')}
                          className="w-3.5 h-3.5 accent-[#1A3C34] cursor-pointer"
                          required
                        />
                        <span>Yes</span>
                      </label>

                      <label
                        onClick={() => setJoinedWhatsapp('No')}
                        className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#1A3C34]"
                      >
                        <input
                          type="radio"
                          name="joinedWhatsapp"
                          value="No"
                          checked={joinedWhatsapp === 'No'}
                          onChange={() => setJoinedWhatsapp('No')}
                          className="w-3.5 h-3.5 accent-[#1A3C34] cursor-pointer"
                          required
                        />
                        <span>No</span>
                      </label>
                    </div>
                  </div>

                  {submitError && (
                    <div className="p-2.5 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs">
                      {submitError}
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="submit"
                      disabled={finalSubmitting}
                      className="flex-1 py-3.5 px-4 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white font-bold text-xs sm:text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {finalSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>Verifying Payment...</span>
                        </>
                      ) : (
                        <span>Submit Payment &amp; Verify Registration</span>
                      )}
                    </button>
                    <Link
                      to="/register"
                      className="py-3.5 px-4 rounded-xl bg-white hover:bg-[#CCE3DE] border border-[#CCE3DE] text-[#1A3C34] text-xs font-bold transition-all shadow-sm text-center"
                    >
                      Back to Form
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enlarged QR Modal */}
      {enlargeQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl max-w-xs w-full text-center space-y-4 border border-[#CCE3DE] shadow-2xl">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-[#1A3C34]">Official UPI QR</h4>
              <button onClick={() => setEnlargeQr(false)} className="text-[#6B9080] hover:text-[#1A3C34] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-white border border-[#CCE3DE] rounded-xl flex justify-center">
              <img
                src={qrImages.qr1}
                alt="UPI QR Enlarge"
                className="w-56 h-56 object-contain"
              />
            </div>
            <p className="text-xs font-mono text-[#3D6153] break-all">sundarrajan.it@okaxis</p>
            <button
              type="button"
              onClick={() => setEnlargeQr(false)}
              className="w-full py-2.5 bg-[#1A3C34] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
