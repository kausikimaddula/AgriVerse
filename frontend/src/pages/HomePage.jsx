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
    currentRegistrations: 13,
    registrationLimit: 250,
    remainingSlots: 237,
    percentFilled: '5.2',
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
            isOpen: stats.seatsRemaining > 0,
            isFull: stats.seatsRemaining <= 0,
            currentRegistrations: stats.totalFilled || 372,
            registrationLimit: stats.maxSeats || 500,
            remainingSlots: stats.seatsRemaining || 128,
            percentFilled: stats.percentFilled || '74.4',
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
    <div className="pt-24 sm:pt-28 pb-16">
      {/* 1. HERO SECTION */}
      <section className="pt-6 sm:pt-10 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Main Headline */}
          <h1 className="font-fraktur text-4xl sm:text-6xl md:text-7xl font-bold tracking-wide text-[#1A3C34] leading-[1.2]">
            Modern Agriculture:<br />
            <span className="text-[#2D6A4F]">Sustainable Practices, Innovations &amp; Future Farming</span>
          </h1>

          {/* Natural Narrative Description */}
          <p className="font-sans text-base sm:text-lg text-[#3D6153] max-w-3xl mx-auto leading-relaxed font-normal">
            A 2-day intensive University Elective (UE) course focusing on modern &amp; sustainable agricultural practices, innovations, future farming, agribusiness, and emerging agricultural trends.
          </p>

          {/* Live Seat Capacity Meter (X / Y Slots Booked) */}
          <div className="max-w-xl mx-auto p-4 rounded-[18px] bg-white border border-[#CCE3DE] shadow-md space-y-2.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold text-[#1A3C34] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] animate-pulse" />
                <span>Live Seat Capacity Meter</span>
              </span>
              <span className="font-mono font-extrabold text-[#1A3C34] text-sm">
                {eventStatus.currentRegistrations} / {eventStatus.registrationLimit} Slots Booked
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#EAF4F4] h-3.5 rounded-full overflow-hidden border border-[#CCE3DE]">
              <div
                className="bg-gradient-to-r from-[#2D6A4F] to-[#52B788] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (eventStatus.currentRegistrations / eventStatus.registrationLimit) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#6B9080]">
              <span>{eventStatus.remainingSlots} seats remaining before capacity cutoff</span>
              <span className="font-bold text-[#15803D]">
                {eventStatus.isFull ? 'CAPACITY FULL' : 'REGISTRATIONS OPEN'}
              </span>
            </div>
          </div>

          {/* Course Logistics Bar */}
          <div className="p-6 rounded-[20px] bg-white border border-[#CCE3DE] shadow-md max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div className="border-r border-[#EAF4F4] sm:border-[#CCE3DE] pr-3">
              <span className="text-[11px] font-semibold text-[#6B9080] uppercase tracking-wider block">📅 DATE</span>
              <span className="text-sm font-bold text-[#1A3C34] mt-0.5 block">31st Oct &amp; 1st Nov 2026</span>
              <span className="text-[11px] text-[#6B9080]">⏳ Duration: 2 Days</span>
            </div>
            <div className="sm:border-r border-[#CCE3DE] pr-3">
              <span className="text-[11px] font-semibold text-[#6B9080] uppercase tracking-wider block">📍 VENUE</span>
              <span className="text-sm font-bold text-[#1A3C34] mt-0.5 block">Admin Block Seminar Hall</span>
              <span className="text-[11px] text-[#6B9080]">Campus Venue</span>
            </div>
            <div className="border-r border-[#EAF4F4] sm:border-[#CCE3DE] pr-3">
              <span className="text-[11px] font-semibold text-[#6B9080] uppercase tracking-wider block">💰 REGISTRATION FEE</span>
              <span className="text-sm font-bold text-[#1A3C34] mt-0.5 block">₹350 per participant</span>
              <span className="text-[11px] text-[#6B9080]">👤 Individual Participation</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#6B9080] uppercase tracking-wider block">📋 ASSESSMENT</span>
              <span className="text-sm font-bold text-[#1A3C34] mt-0.5 block">Daily Internal + Final External</span>
              <span className="text-[11px] text-[#6B9080]">🏆 Certificate Provided</span>
            </div>
          </div>

          {/* Hero Call to Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={handleRegisterClick}
              disabled={checkingPreflight}
              className="px-8 py-4 rounded-[15px] bg-[#1A3C34] hover:bg-[#132A24] text-white font-bold text-sm transition-all shadow-md flex items-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {checkingPreflight ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
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
              className="px-7 py-4 rounded-[15px] bg-white hover:bg-[#CCE3DE] text-[#1A3C34] font-semibold text-sm transition-all border border-[#A4C3B2] shadow-sm flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-[#3D6153]" />
              <span>Check Status</span>
            </Link>
          </div>
        </div>
      </section>

      {closedModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white p-7 sm:p-9 rounded-[24px] max-w-md w-full border border-[#CCE3DE] shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-[#1A3C34]">
              Registrations Closed
            </h3>

            <p className="text-xs sm:text-sm text-[#3D6153] leading-relaxed">
              {closedModal.message}
            </p>

            <div className="p-3.5 rounded-[15px] bg-[#F4F9F6] border border-[#CCE3DE] text-xs text-[#1A3C34] space-y-1">
              <div className="font-bold">Capacity Status:</div>
              <div>{eventStatus.currentRegistrations} of {eventStatus.registrationLimit} Slots Booked (100% Capacity)</div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/status"
                className="w-full py-3 rounded-[12px] bg-[#1A3C34] text-white font-bold text-xs hover:bg-[#132A24] transition-all text-center"
              >
                Check Existing Registration Status
              </Link>
              <button
                type="button"
                onClick={() => setClosedModal({ show: false, message: '' })}
                className="w-full py-2.5 rounded-[12px] bg-[#EAF4F4] text-[#1A3C34] font-semibold text-xs hover:bg-[#CCE3DE] transition-all cursor-pointer"
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
