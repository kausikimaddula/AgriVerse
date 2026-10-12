import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, Search, AlertCircle, RefreshCw
} from 'lucide-react';
import failoverApi from '../api/failoverClient.js';
import { useApp } from '../context/AppContext.jsx';

export default function HomePage() {
  const navigate = useNavigate();
  const { stats, fetchStats } = useApp();

  const [eventStatus, setEventStatus] = useState({
    isOpen: true,
    isFull: false,
    currentRegistrations: 0,
    registrationLimit: 250,
    remainingSlots: 250,
    percentFilled: '0.0',
    fee: 350
  });
  const [checkingPreflight, setCheckingPreflight] = useState(false);
  const [closedModal, setClosedModal] = useState({ show: false, message: '' });

  // Fetch pre-flight event status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await failoverApi.get('v1/event/status');
        if (res.data?.success) {
          setEventStatus(res.data);
        }
      } catch (err) {
        // Fallback to stats
        if (stats) {
          setEventStatus({
            isOpen: stats.seatsRemaining !== undefined ? stats.seatsRemaining > 0 : true,
            isFull: stats.seatsRemaining !== undefined ? stats.seatsRemaining <= 0 : false,
            currentRegistrations: stats.totalFilled || 0,
            registrationLimit: stats.maxSeats || 500,
            remainingSlots: stats.seatsRemaining !== undefined ? stats.seatsRemaining : 500,
            percentFilled: stats.percentFilled || '0.0',
            fee: 350
          });
        }
      }
    };
    checkStatus();
  }, [stats]);

  // Pre-flight check when user clicks "Register Now"
  const handleRegisterClick = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setCheckingPreflight(true);

    try {
      const res = await failoverApi.get('v1/event/status');
      const data = res.data;

      if (!data?.isOpen || data?.isFull || data?.remainingSlots <= 0) {
        setClosedModal({
          show: true,
          message: data?.message || 'Registrations are currently closed. All seats have been booked.'
        });
        setCheckingPreflight(false);
        return;
      }

      // Progression allowed: Navigate to Registration Page
      navigate('/agrigenevent/registerationforstudent');
    } catch (err) {
      // In case of network edge case, check local capacity
      if (eventStatus.isFull || eventStatus.remainingSlots <= 0) {
        setClosedModal({
          show: true,
          message: 'All available participant slots for AgriVerse 2026 have been booked.'
        });
      } else {
        navigate('/agrigenevent/registerationforstudent');
      }
    } finally {
      setCheckingPreflight(false);
    }
  };



  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-100px)]">
      {/* Background Image Layer Behind Text */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/hero-field-bg.jpg"
          alt="AgriVerse Agricultural Sunrise Field"
          className="w-full h-full object-cover object-center transform scale-105"
        />
        {/* Luminous, natural sunrise overlay: softens background while keeping the golden sun and lush green crops visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F2F8F5]/85 via-[#F5FAF7]/75 to-[#EAF4F4]/98 backdrop-blur-[1px]" />
        {/* Soft morning sun warmth glow in center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-200/25 via-emerald-100/15 to-transparent blur-3xl" />
      </div>

      {/* 1. HERO SECTION */}
      <section className="relative z-10 pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center space-y-7">
          {/* Handcrafted Botanical Eyebrow Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-[#2D6A4F]/20 shadow-[0_2px_12px_rgba(45,106,79,0.06)] text-[#1B4332]">
            <span className="w-2 h-2 rounded-full bg-[#2D6A4F] animate-pulse" />
            <span className="text-[11px] font-sans font-bold tracking-[0.22em] uppercase">
              University Elective (UE) • 2-Day Intensive Course
            </span>
          </div>

          {/* Editorial Display Headline (Fraunces + Cormorant Garamond pairing) */}
          <div className="space-y-3">
            <h1 className="font-fraunces text-4xl sm:text-6xl md:text-7xl lg:text-[5rem] font-bold tracking-tight text-[#0D2818] leading-[1.08]">
              Modern Agriculture
            </h1>
            <p className="font-cormorant italic font-medium text-2xl sm:text-4xl md:text-5xl text-[#20573E] tracking-normal leading-snug">
              Sustainable Practices, Innovations &amp; Future Farming
            </p>
          </div>

          {/* Refined Narrative Description */}
          <p className="font-sans text-base sm:text-lg text-[#254A3B] max-w-2xl mx-auto leading-relaxed font-normal">
            A two-day immersive academic summit exploring regenerative agro-tech, precision cropping systems, and sustainable agricultural economies.
          </p>

          {/* Live Seat Capacity Meter (X / Y Slots Booked) */}
          <div className="max-w-xl mx-auto p-4 sm:p-5 rounded-xl bg-white/95 border border-[#D5E2DC] shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold text-[#0D2818] flex items-center gap-2 font-sans">
                <span className="w-2 h-2 rounded-full bg-[#2D6A4F] animate-ping" />
                <span className="tracking-wide">Live Seat Capacity Meter</span>
              </span>
              <span className="font-mono font-extrabold text-[#0D2818] text-xs sm:text-sm bg-[#F4F8F6] px-2.5 py-1 rounded border border-[#D5E2DC]">
                {eventStatus.currentRegistrations} / {eventStatus.registrationLimit} Slots Booked
              </span>
            </div>

            {/* Progress Bar with crisp track */}
            <div className="w-full bg-[#E8F0EC] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#52B788] h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (eventStatus.currentRegistrations / eventStatus.registrationLimit) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium text-[#4D7765]">
              <span>{eventStatus.remainingSlots} seats remaining before capacity cutoff</span>
              <span className="font-bold text-[#1B4332] tracking-wider uppercase text-[10px] bg-[#F4F8F6] px-2 py-0.5 rounded border border-[#D5E2DC]">
                {eventStatus.isFull ? 'CAPACITY FULL' : 'REGISTRATIONS OPEN'}
              </span>
            </div>
          </div>

          {/* Course Logistics Card */}
          <div className="p-6 rounded-xl bg-white/95 border border-[#D5E2DC] shadow-sm max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div className="border-r border-[#EAF4F4] sm:border-[#D5E2DC] pr-3">
              <span className="text-[10px] font-bold text-[#5B8270] uppercase tracking-[0.16em] block">📅 DATE</span>
              <span className="font-fraunces text-base font-semibold text-[#0D2818] mt-1 block">31 Oct &amp; 1 Nov 2026</span>
              <span className="text-[11px] text-[#5B8270] font-sans">2-Day Intensive</span>
            </div>
            <div className="sm:border-r border-[#D5E2DC] pr-3">
              <span className="text-[10px] font-bold text-[#5B8270] uppercase tracking-[0.16em] block">📍 VENUE</span>
              <span className="font-fraunces text-base font-semibold text-[#0D2818] mt-1 block">Admin Block</span>
              <span className="text-[11px] text-[#5B8270] font-sans">Seminar Hall</span>
            </div>
            <div className="border-r border-[#EAF4F4] sm:border-[#D5E2DC] pr-3">
              <span className="text-[10px] font-bold text-[#5B8270] uppercase tracking-[0.16em] block">💰 REGISTRATION FEE</span>
              <span className="font-fraunces text-base font-semibold text-[#0D2818] mt-1 block">₹350 per student</span>
              <span className="text-[11px] text-[#5B8270] font-sans">Individual Entry</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#5B8270] uppercase tracking-[0.16em] block">🏆 ACCREDITATION</span>
              <span className="font-fraunces text-base font-semibold text-[#0D2818] mt-1 block">1-Credit UE Course</span>
              <span className="text-[11px] text-[#5B8270] font-sans">Certificate Included</span>
            </div>
          </div>

          {/* Hero Call to Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={handleRegisterClick}
              disabled={checkingPreflight}
              className="px-8 py-3.5 rounded-lg bg-[#0D2818] hover:bg-[#153E27] text-[#FAF7EE] font-sans font-semibold text-sm transition-all shadow-sm flex items-center gap-2.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 border border-[#2D6A4F]/40"
            >
              {checkingPreflight ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#A4C3B2]" />
                  <span>Checking Availability...</span>
                </>
              ) : (
                <>
                  <span>Register Now (₹350)</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>

            <Link
              to="/status"
              className="px-7 py-3.5 rounded-lg bg-white hover:bg-slate-50 text-[#0D2818] font-sans font-medium text-sm transition-all border border-[#D5E2DC] shadow-sm hover:border-[#1B4332]/40 flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-[#2D6A4F]" />
              <span>Check Status</span>
            </Link>
          </div>
        </div>
      </section>

      {closedModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white p-7 sm:p-8 rounded-xl max-w-md w-full border border-gray-200 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-[#1A3C34]">
              Registrations Closed
            </h3>

            <p className="text-xs sm:text-sm text-[#3D6153] leading-relaxed">
              {closedModal.message}
            </p>

            <div className="p-3.5 rounded-lg bg-[#F4F9F6] border border-gray-200 text-xs text-[#1A3C34] space-y-1">
              <div className="font-bold">Capacity Status:</div>
              <div>{eventStatus.currentRegistrations} of {eventStatus.registrationLimit} Slots Booked (100% Capacity)</div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/status"
                className="w-full py-2.5 rounded-lg bg-[#1A3C34] text-white font-bold text-xs hover:bg-[#132A24] transition-all text-center"
              >
                Check Existing Registration Status
              </Link>
              <button
                type="button"
                onClick={() => setClosedModal({ show: false, message: '' })}
                className="w-full py-2 rounded-lg bg-gray-100 text-[#1A3C34] font-semibold text-xs hover:bg-gray-200 transition-all cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
