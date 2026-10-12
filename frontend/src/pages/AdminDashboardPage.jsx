import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, GraduationCap, Clock, CheckCircle2, RefreshCw, Eye,
  Sparkles, TrendingUp, Activity, ExternalLink, ShieldAlert,
  AlertCircle, Lock, Unlock
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export default function AdminDashboardPage() {
  const {
    adminToken,
    adminDashboardStats,
    fetchAdminDashboardStats,
    handleToggleEventRegistration,
    setSelectedProofLightbox,
    registrationsList,
    loadAdminRegistrations
  } = useApp();

  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (adminToken) {
      fetchAdminDashboardStats();
      loadAdminRegistrations(adminToken);
    }
  }, [adminToken]);

  const stats = adminDashboardStats || {};
  const isOpen = stats.isOpen !== false;

  const onToggleSwitch = async () => {
    setToggling(true);
    await handleToggleEventRegistration(!isOpen);
    setToggling(false);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAdminDashboardStats(),
      adminToken ? loadAdminRegistrations(adminToken) : Promise.resolve()
    ]);
    setRefreshing(false);
  };

  // Capacity calculations
  const totalReg = stats.currentRegistrations || (registrationsList ? registrationsList.length : 0);
  const capacity = stats.capacityLimit || 250;
  const percentFilled = stats.percentFilled
    ? parseFloat(stats.percentFilled)
    : Math.round((totalReg / capacity) * 100);

  // Recent 5 registrations
  const recentList =
    stats.recentRegistrations && stats.recentRegistrations.length > 0
      ? stats.recentRegistrations.slice(0, 5)
      : (registrationsList || []).slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* ======================================================================
          1. HEADER & GLOBAL CONTROLS
          ====================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF4F4] border border-[#CCE3DE] text-[#15803D] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#84CC16]" />
            <span>Live Committee Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A3C34] tracking-tight">
            AgriVerse Live Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#3D6153] mt-0.5">
            Real-time registered participants, verification progress, and symposium capacity metrics.
          </p>
        </div>

        {/* Top Right Controls: Registration Toggle & Refresh */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-[#CCE3DE] shadow-xs">
            <span className="text-xs font-bold text-[#1A3C34]">Registrations:</span>
            <button
              type="button"
              onClick={onToggleSwitch}
              disabled={toggling}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                isOpen ? 'bg-[#15803D]' : 'bg-[#94A3B8]'
              } ${toggling ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isOpen ? 'Click to close registrations' : 'Click to open registrations'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                  isOpen ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-[11px] font-extrabold uppercase ${isOpen ? 'text-[#15803D]' : 'text-[#64748B]'}`}>
              {isOpen ? 'ON' : 'OFF'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-2xl bg-white border border-[#CCE3DE] text-[#1A3C34] hover:bg-[#F4F9F6] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#15803D]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ======================================================================
          2. FOUR CORE STATISTIC CARDS
          ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* CARD 1: TOTAL REGISTRATIONS */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#CCE3DE] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#6B9080]">
              TOTAL REGISTRATIONS
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EAF4F4] text-[#15803D] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-black text-[#1A3C34] tracking-tight">
              {totalReg}
            </div>
            <div className="text-xs font-semibold text-[#6B9080] mt-1">
              Capacity: <span className="text-[#1A3C34] font-bold">{totalReg}</span> / {capacity}
            </div>
          </div>
        </div>

        {/* CARD 2: TOTAL PARTICIPANTS */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#CCE3DE] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#6B9080]">
              TOTAL PARTICIPANTS
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EAF4F4] text-[#15803D] flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-black text-[#1A3C34] tracking-tight">
              {stats.totalParticipants || totalReg}
            </div>
            <div className="text-xs font-semibold text-[#6B9080] mt-1">
              (Solo individual participants)
            </div>
          </div>
        </div>

        {/* CARD 3: PENDING VERIFICATION */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#CCE3DE] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#D97706]">
              PENDING VERIFICATION
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-black text-[#D97706] tracking-tight">
              {stats.pendingVerification || 0}
            </div>
            <Link
              to="/master/registrations"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#D97706] hover:underline mt-1"
            >
              <span>View Pending</span>
              <span>↗</span>
            </Link>
          </div>
        </div>

        {/* CARD 4: VERIFIED REGISTRATIONS */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#CCE3DE] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#15803D]">
              VERIFIED REGISTRATIONS
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-black text-[#15803D] tracking-tight">
              {stats.verifiedCount || 0}
            </div>
            <Link
              to="/master/registrations"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#15803D] hover:underline mt-1"
            >
              <span>View Verified</span>
              <span>↗</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ======================================================================
          3. REGISTRATION CAPACITY & QUOTA PROGRESS CARD
          ====================================================================== */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#CCE3DE] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1A3C34]">
          <TrendingUp className="w-4 h-4 text-[#15803D]" />
          <span>AgriVerse Registration Capacity &amp; Quota</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#1A3C34]">
            <Activity className="w-3.5 h-3.5 text-[#15803D]" />
            <span>Registration Status</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              isOpen ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#DC2626]'
            }`}>
              {isOpen ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              <span>{isOpen ? 'Open' : 'Closed'}</span>
            </span>
            <span className="font-extrabold text-sm text-[#1A3C34]">
              {percentFilled}% Filled
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#EAF4F4] rounded-full h-3.5 p-0.5 border border-[#CCE3DE] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#15803D] via-[#84CC16] to-[#15803D] transition-all duration-700 shadow-xs"
            style={{ width: `${Math.min(100, Math.max(0, percentFilled))}%` }}
          />
        </div>

        {/* Progress Labels */}
        <div className="flex items-center justify-between text-[11px] font-bold text-[#6B9080]">
          <span>0%</span>
          <span className="text-[#15803D] font-extrabold">{percentFilled}% Capacity Filled</span>
          <span>100%</span>
        </div>
      </div>

      {/* ======================================================================
          4. RECENT REGISTRATIONS TABLE
          ====================================================================== */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#CCE3DE] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CCE3DE] pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1A3C34] tracking-tight">
              Recent Registrations
            </h2>
            <p className="text-xs text-[#6B9080]">
              Latest participant submissions requiring verification
            </p>
          </div>
          <Link
            to="/master/registrations"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#15803D] hover:underline self-start sm:self-auto"
          >
            <span>View All Registrations</span>
            <span>↗</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#CCE3DE] text-[10px] font-extrabold text-[#6B9080] uppercase tracking-wider">
                <th className="py-3 px-3">REG NO</th>
                <th className="py-3 px-3">PARTICIPANT NAME</th>
                <th className="py-3 px-3">PHONE NUMBER</th>
                <th className="py-3 px-3">DEPARTMENT</th>
                <th className="py-3 px-3">PAYMENT STATUS</th>
                <th className="py-3 px-3">VERIFICATION STATUS</th>
                <th className="py-3 px-3">TIME</th>
                <th className="py-3 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CCE3DE]/60 text-xs">
              {recentList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[#6B9080]">
                    No registrations found in current queue.
                  </td>
                </tr>
              ) : (
                recentList.map((item, idx) => {
                  const isPaid = (item.paymentStatus || '').toUpperCase() === 'PAID';
                  const isVerified = (item.verificationStatus || '').toUpperCase() === 'VERIFIED';
                  const isRejected = (item.verificationStatus || '').toUpperCase() === 'REJECTED';
                  const isPending = !isVerified && !isRejected;

                  const dateStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString()
                    : '10/8/2026';

                  return (
                    <tr
                      key={item.id || item._id || idx}
                      onClick={() => setSelectedProofLightbox(item)}
                      className="hover:bg-[#F4F9F6] transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-3 font-mono font-bold text-[#1A3C34]">
                        {item.regNo || item.registerNumber || '—'}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-bold text-[#15803D] group-hover:underline block">
                          {item.name || item.fullName || '—'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[#3D6153]">
                        {item.phone || '—'}
                      </td>

                      <td className="py-3.5 px-3 text-[#1A3C34] font-medium">
                        {item.department || item.branch || 'CSE'}
                      </td>

                      <td className="py-3.5 px-3">
                        {isPaid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] font-bold text-[10px]">
                            PAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-bold text-[10px]">
                            UNPAID
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        {isVerified && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] font-bold text-[10px]">
                            VERIFIED
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] font-bold text-[10px]">
                            REJECTED
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-bold text-[10px]">
                            PENDING
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[#6B9080] text-[11px]">
                        {dateStr}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProofLightbox(item);
                          }}
                          className="p-1.5 rounded-lg bg-[#EAF4F4] hover:bg-[#1A3C34] text-[#1A3C34] hover:text-white transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Audit participant submission & proof"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
