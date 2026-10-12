import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, ExternalLink, Download, ArrowRight,
  ShieldCheck, Sparkles, Copy, Check, QrCode
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { AgrigenLogo } from '../components/AgrigenIcons.jsx';
import failoverApi from '../api/failoverClient.js';
import { useApp } from '../context/AppContext.jsx';

export default function SuccessPage() {
  const { registrationId } = useParams();
  const { whatsappLink, setIssuedIdCard } = useApp();

  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    // Launch celebratory confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2D6A4F', '#52B788', '#84CC16', '#CCE3DE']
    });

    const fetchRegistration = async () => {
      try {
        const res = await failoverApi.get(`v1/registrations/${encodeURIComponent(registrationId)}`);
        if (res.data?.success && res.data?.registration) {
          const reg = res.data.registration;
          setRegistration(reg);
          setIssuedIdCard(reg);

          // Generate verification QR code
          try {
            const qr = await QRCode.toDataURL(
              `AGRIVERSE|${reg.id || reg.registrationId}|${reg.regNo}|${reg.name}|${reg.txnId || reg.transactionId}`,
              { width: 260, margin: 1 }
            );
            setQrCodeUrl(qr);
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Registration fetch note:', err.message);
      } finally {
        setLoading(false);
      }
    };

    if (registrationId) {
      fetchRegistration();
    }
  }, [registrationId]);

  const copyRegId = () => {
    if (registrationId) {
      navigator.clipboard.writeText(registrationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto min-h-[calc(100vh-160px)]">
      <div className="bg-white p-6 sm:p-10 rounded-xl border border-[#DCE8E2] shadow-sm space-y-6 text-center">
        {/* Celebration Header */}
        <div className="w-16 h-16 mx-auto rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shadow-xs">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#EDF5F1] border border-[#DCE8E2] text-[#15803D] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Registration &amp; Payment Submitted</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-fraunces font-bold text-[#1A3C34]">
            You're Confirmed for AgriVerse 2026!
          </h1>
          <p className="text-xs sm:text-sm text-[#3D6153] max-w-lg mx-auto">
            Your profile details and payment receipt have been recorded. Your slot is reserved and placed into the organizer audit queue.
          </p>
        </div>

        {/* Registration ID Badge */}
        <div className="p-4 rounded-lg bg-[#F8FAF9] border border-[#DCE8E2] max-w-md mx-auto flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold text-[#6B9080] block">
              Official Registration ID
            </span>
            <span className="text-base sm:text-lg font-mono font-black text-[#1A3C34]">
              {registrationId}
            </span>
          </div>
          <button
            type="button"
            onClick={copyRegId}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white hover:bg-[#EDF5F1] border border-[#DCE8E2] text-xs font-bold text-[#1A3C34] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#15803D]" />
                <span className="text-[#15803D]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy ID</span>
              </>
            )}
          </button>
        </div>

        {/* Registration Details Grid */}
        {registration && (
          <div className="p-5 rounded-lg bg-[#F8FAF9] border border-[#DCE8E2] text-left text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCE8E2] pb-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Student Name</span>
                <span className="font-bold text-sm text-[#1A3C34]">{registration.name || registration.fullName}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Audit Status</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E0F2FE] text-[#0284C7] inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>IN AUDIT QUEUE</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Department</span>
                <span className="font-semibold text-[#1A3C34] truncate block">{registration.department || registration.branch}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">UPI Reference (UTR)</span>
                <span className="font-mono font-bold text-[#1A3C34]">{registration.transactionId || registration.txnId}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B9080] block">Payment Status</span>
                <span className="font-bold text-[#15803D]">PAID (₹350.00)</span>
              </div>
            </div>

          </div>
        )}

        {/* WhatsApp Community Onboarding Banner */}
        <div className="p-5 rounded-xl bg-[#0D2818] border border-[#1E4D35] text-white flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#A3E635] tracking-wider block">
              Essential Next Step
            </span>
            <h3 className="font-bold text-sm sm:text-base">
              Join Official WhatsApp Community Group
            </h3>
            <p className="text-xs text-[#DCE8E2]">
              Receive event schedules, room allocation, workshop announcements, and keynote live updates.
            </p>
          </div>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-lg bg-[#27784A] hover:bg-[#1E5D39] text-white font-bold text-xs uppercase tracking-wider shrink-0 transition-all flex items-center gap-2 shadow-sm"
          >
            <span>Join WhatsApp Group</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/id-card"
            className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-[#1A3C34] hover:bg-[#132A24] text-white font-bold text-xs sm:text-sm tracking-wide transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Open &amp; Print ID Card</span>
          </Link>
          <Link
            to="/"
            className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-white hover:bg-[#EDF5F1] border border-[#DCE8E2] text-[#1A3C34] font-semibold text-xs sm:text-sm transition-all"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
