import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, RefreshCw, Download, Eye, CheckCircle2, Clock,
  XCircle, ChevronDown, Sparkles, AlertCircle, Check, X
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export default function AdminRegistrationsPage() {
  const {
    adminToken,
    registrationsList,
    loadAdminRegistrations,
    handleExportExcel,
    exportingExcel,
    setSelectedProofLightbox,
    handleVerifyRegistration,
    handleRejectRegistration,
    adminActionLoading
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openActionDropdown, setOpenActionDropdown] = useState(null);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const dropdownRef = useRef(null);

  useEffect(() => {
    if (adminToken) {
      loadAdminRegistrations(adminToken);
    }
  }, [adminToken]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenActionDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setSearchTerm(searchInput);
  };

  // Status Filter options
  const statusOptions = ['ALL', 'UNPAID', 'PAID', 'PENDING', 'VERIFIED', 'REJECTED'];

  // Filtered registrations
  const filteredList = useMemo(() => {
    return (registrationsList || []).filter((r) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matches =
          (r.name || r.fullName || '').toLowerCase().includes(q) ||
          (r.regNo || r.registerNumber || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q) ||
          (r.phone || '').toLowerCase().includes(q) ||
          (r.department || r.branch || '').toLowerCase().includes(q) ||
          (r.transactionId || r.txnId || '').toLowerCase().includes(q) ||
          (r.id || r.registrationId || '').toLowerCase().includes(q);

        if (!matches) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        const s = statusFilter.toUpperCase();
        if (s === 'PAID') {
          if ((r.paymentStatus || '').toUpperCase() !== 'PAID') return false;
        } else if (s === 'UNPAID') {
          if ((r.paymentStatus || '').toUpperCase() === 'PAID') return false;
        } else if (s === 'PENDING') {
          const v = (r.verificationStatus || '').toUpperCase();
          if (v === 'VERIFIED' || v === 'REJECTED') return false;
        } else if (s === 'VERIFIED') {
          const v = (r.verificationStatus || '').toUpperCase();
          if (v !== 'VERIFIED') return false;
        } else if (s === 'REJECTED') {
          const v = (r.verificationStatus || '').toUpperCase();
          if (v !== 'REJECTED') return false;
        }
      }

      return true;
    });
  }, [registrationsList, searchTerm, statusFilter]);

  const handleActionVerify = async (itemId) => {
    setOpenActionDropdown(null);
    await handleVerifyRegistration(itemId);
  };

  const handleOpenRejectModal = (item) => {
    setOpenActionDropdown(null);
    setRejectingItem(item);
    setRejectReason('Payment receipt unreadable or transaction reference mismatch.');
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectingItem) return;
    const itemId = rejectingItem.id || rejectingItem._id || rejectingItem.regNo;
    await handleRejectRegistration(itemId, rejectReason);
    setRejectingItem(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto" ref={dropdownRef}>
      {/* ======================================================================
          1. HEADER ROW: BADGE, TITLE, EXPORT & REFRESH
          ====================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF4F4] border border-[#CCE3DE] text-[#15803D] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#84CC16]" />
            <span>Agri-Genomics Verification Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A3C34] tracking-tight">
            Participant Registrations
          </h1>
          <p className="text-xs sm:text-sm text-[#3D6153] mt-0.5">
            Validate payment records and verify participant registrations, then export official spreadsheets.
          </p>
        </div>

        {/* Right Tools: Export to Excel & Refresh */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleExportExcel(statusFilter)}
            disabled={exportingExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#15803D] hover:bg-[#1E5D39] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Export matching records to styled .xlsx"
          >
            <Download className="w-4 h-4 text-[#84CC16]" />
            <span>{exportingExcel ? 'Exporting...' : 'Export to Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={() => loadAdminRegistrations(adminToken)}
            className="p-2.5 rounded-lg bg-white border border-[#DCE8E2] text-[#1A3C34] hover:bg-[#F4F9F6] transition-colors shadow-xs cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ======================================================================
          2. FILTERS & SEARCH ROW
          ====================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Horizontal Status Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {statusOptions.map((st) => {
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'bg-white text-[#3D6153] hover:bg-[#EAF4F4] border border-[#CCE3DE]'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>

        {/* Search Bar with Search Button */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-96">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6B9080] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search participant, reg no..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#CCE3DE] text-xs font-medium text-[#1A3C34] outline-none focus:border-[#15803D] shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#1E5D39] text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* ======================================================================
          3. REGISTRATIONS TABLE
          ====================================================================== */}
      <div className="bg-white rounded-xl border border-[#DCE8E2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[820px]">
            <thead>
              <tr className="border-b border-[#CCE3DE] text-[10px] font-extrabold text-[#6B9080] uppercase tracking-wider">
                <th className="py-2.5 px-2 whitespace-nowrap">REG NO</th>
                <th className="py-2.5 px-2 leading-tight">
                  <div>PARTICIPANT</div>
                  <div>NAME</div>
                </th>
                <th className="py-2.5 px-2 whitespace-nowrap">PHONE NUMBER</th>
                <th className="py-2.5 px-2">DEPARTMENT &amp; YEAR</th>
                <th className="py-2.5 px-2 whitespace-nowrap">UTR / PROOF</th>
                <th className="py-2.5 px-2 leading-tight whitespace-nowrap">
                  <div>PAYMENT</div>
                  <div>STATUS</div>
                </th>
                <th className="py-2.5 px-2 leading-tight whitespace-nowrap">
                  <div>VERIFICATION</div>
                  <div>STATUS</div>
                </th>
                <th className="py-2.5 px-2 whitespace-nowrap">DATE</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CCE3DE]/60">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-xs text-[#6B9080]">
                    No registrations found matching the specified query or filters.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const itemId = item.id || item._id || item.regNo;
                  const isPaid = (item.paymentStatus || '').toUpperCase() === 'PAID';
                  const vStatus = (item.verificationStatus || '').toUpperCase();
                  const isVerified = vStatus === 'VERIFIED';
                  const isRejected = vStatus === 'REJECTED';
                  const isPending = !isVerified && !isRejected;

                  const utr = item.transactionId || item.txnId || '-';
                  const hasProof = Boolean(item.proofUrl || item.paymentScreenshot?.url);
                  const dateStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString()
                    : '10/8/2026';

                  const isDropdownOpen = openActionDropdown === itemId;

                  return (
                    <tr
                      key={itemId || idx}
                      className="hover:bg-[#F4F9F6] transition-colors"
                    >
                      {/* 1. REG NO */}
                      <td className="py-2.5 px-2 font-mono font-bold text-[#1A3C34] whitespace-nowrap">
                        {item.regNo || item.registerNumber || '—'}
                      </td>

                      {/* 2. PARTICIPANT NAME (1st row: 1st name, 2nd row: 2nd name) */}
                      <td className="py-2.5 px-2">
                        <div
                          onClick={() => setSelectedProofLightbox(item)}
                          className="font-bold text-[#15803D] hover:underline cursor-pointer leading-tight text-xs"
                          title={item.email}
                        >
                          {(() => {
                            const raw = (item.name || item.fullName || '—').trim();
                            const parts = raw.split(/\s+/);
                            if (parts.length <= 1) {
                              return <span className="block break-words">{raw}</span>;
                            }
                            const firstName = parts[0];
                            const secondName = parts.slice(1).join(' ');
                            return (
                              <>
                                <span className="block">{firstName}</span>
                                <span className="block">{secondName}</span>
                              </>
                            );
                          })()}
                        </div>
                      </td>

                      {/* 3. PHONE NUMBER */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#EAF4F4] text-[#1A3C34] font-mono text-[11px] font-medium">
                          {item.phone || '—'}
                        </span>
                      </td>

                      {/* 4. DEPARTMENT & YEAR */}
                      <td className="py-2.5 px-2 text-[#1A3C34]">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-semibold text-xs leading-tight">
                            {item.department || item.branch || 'CSE'}
                          </span>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-[#F4F9F6] border border-[#CCE3DE] text-[#6B9080] whitespace-nowrap">
                            {item.residency || item.residencyStatus || 'Day Scholar'}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#6B9080] mt-0.5 leading-tight">
                          {item.year || item.academicYear || '1st Year'} • Sec {item.section || 'A'}
                        </div>
                      </td>

                      {/* 5. UTR / PROOF */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span className="font-mono text-xs text-[#1A3C34] block">
                          {utr}
                        </span>
                        {hasProof ? (
                          <button
                            type="button"
                            onClick={() => setSelectedProofLightbox(item)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-[#15803D] hover:underline cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Receipt</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#6B9080] italic">No proof</span>
                        )}
                      </td>

                      {/* 6. PAYMENT STATUS */}
                      <td className="py-2.5 px-2 font-bold text-[11px] whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                            <Check className="w-3 h-3" />
                            <span>PAID</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]">
                            <span>UNPAID</span>
                          </span>
                        )}
                      </td>

                      {/* 7. VERIFICATION STATUS */}
                      <td className="py-2.5 px-2 font-bold text-[11px] whitespace-nowrap">
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>VERIFIED</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626]">
                            <XCircle className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]">
                            <Clock className="w-3 h-3" />
                            <span>PENDING</span>
                          </span>
                        )}
                      </td>

                      {/* 8. DATE */}
                      <td className="py-2.5 px-2 font-mono text-[#6B9080] text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* 9. ACTIONS */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end relative">
                          {/* Audit Eye Icon */}
                          <button
                            type="button"
                            onClick={() => setSelectedProofLightbox(item)}
                            className="p-1.5 rounded-xl text-[#6B9080] hover:text-[#1A3C34] hover:bg-[#EAF4F4] transition-colors cursor-pointer"
                            title="Audit participant submission & proof"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Action Pill with Dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionDropdown(isDropdownOpen ? null : itemId);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                isVerified
                                  ? 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0]'
                                  : isRejected
                                  ? 'bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA]'
                                  : 'bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A]'
                              }`}
                            >
                              {isVerified && <Check className="w-3 h-3" />}
                              {isRejected && <X className="w-3 h-3" />}
                              {isPending && <Clock className="w-3 h-3" />}
                              <span>{isVerified ? 'VERIFIED' : isRejected ? 'REJECTED' : 'PENDING'}</span>
                              <ChevronDown className="w-3 h-3 ml-0.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1.5 w-48 rounded-lg bg-white border border-[#DCE8E2] shadow-xl z-50 p-1.5 space-y-1 text-left animate-in fade-in zoom-in-95"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleActionVerify(itemId)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#15803D] hover:bg-[#DCFCE7] transition-colors cursor-pointer text-left"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Verify Payment</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenRejectModal(item)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#DC2626] hover:bg-[#FEE2E2] transition-colors cursor-pointer text-left"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject Payment</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSelectedProofLightbox(item)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#1A3C34] hover:bg-[#F4F9F6] transition-colors cursor-pointer text-left border-t border-[#CCE3DE] mt-1 pt-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Audit Proof Modal</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          REJECT PAYMENT MODAL
          ====================================================================== */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl border border-[#DCE8E2] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#CCE3DE] pb-3">
              <h3 className="font-bold text-base text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>Reject Registration</span>
              </h3>
              <button
                onClick={() => setRejectingItem(null)}
                className="text-[#6B9080] hover:text-[#1A3C34] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#3D6153]">
              Provide a reason for rejecting the payment for{' '}
              <strong className="text-[#1A3C34]">{rejectingItem.name || rejectingItem.fullName}</strong> ({rejectingItem.regNo}).
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A3C34] mb-1">
                  Rejection Reason
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-medium text-[#1A3C34] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#CCE3DE]">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="px-4 py-2 rounded-xl bg-[#EAF4F4] text-xs font-bold text-[#1A3C34] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminActionLoading}
                  className="px-5 py-2 rounded-xl bg-[#DC2626] text-xs font-bold text-white uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
                >
                  {adminActionLoading ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
