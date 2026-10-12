import React, { useState, useEffect } from 'react';
import {
  UserPlus, Edit3, Search, RefreshCw, CheckCircle2, AlertCircle,
  X, Save, User, Building, Phone, Mail, CreditCard, ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export default function AdminStudentsPage() {
  const {
    adminToken,
    registrationsList,
    loadAdminRegistrations,
    handleManualRegisterStudent,
    handleEditStudent,
    adminActionLoading
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Form states for manual walk-in student
  const [addForm, setAddForm] = useState({
    name: '',
    regNo: '',
    email: '',
    phone: '',
    department: 'CSE',
    section: 'A',
    year: '1st Year',
    gender: 'Male',
    residency: 'Day Scholar',
    paymentStatus: 'PAID',
    amountPaid: 350,
    transactionId: '',
    adminNotes: 'Offline walk-in student manually registered by admin.'
  });

  // Form states for editing student details
  const [editForm, setEditForm] = useState({
    name: '',
    regNo: '',
    email: '',
    phone: '',
    department: '',
    section: '',
    year: '',
    residency: '',
    paymentStatus: '',
    transactionId: ''
  });

  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (adminToken) {
      loadAdminRegistrations(adminToken);
    }
  }, [adminToken]);

  const handleOpenEdit = (student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name || student.fullName || '',
      regNo: student.regNo || student.registerNumber || '',
      email: student.email || '',
      phone: student.phone || '',
      department: student.department || student.branch || 'CSE',
      section: student.section || 'A',
      year: student.year || student.academicYear || '1st Year',
      residency: student.residency || student.residencyStatus || 'Day Scholar',
      paymentStatus: student.paymentStatus || 'PAID',
      transactionId: student.transactionId || student.txnId || ''
    });
    setFeedbackMsg({ type: '', text: '' });
  };

  const handleCreateWalkin = async (e) => {
    e.preventDefault();
    setFeedbackMsg({ type: '', text: '' });

    if (!addForm.name.trim() || !addForm.regNo.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Name and Register Number are required.' });
      return;
    }

    const res = await handleManualRegisterStudent({
      ...addForm,
      regNo: addForm.regNo.trim().toUpperCase(),
      email: addForm.email.trim() || `${addForm.regNo.trim().toLowerCase()}@offline.agriverse.org`,
      phone: addForm.phone.trim() || '9876543210',
      transactionId: addForm.transactionId.trim() || `OFFLINE-${Date.now()}`
    });

    if (res?.success) {
      setFeedbackMsg({ type: 'success', text: 'Offline walk-in registration created successfully!' });
      setShowAddModal(false);
      setAddForm({
        name: '',
        regNo: '',
        email: '',
        phone: '',
        department: 'CSE',
        section: 'A',
        year: '1st Year',
        gender: 'Male',
        residency: 'Day Scholar',
        paymentStatus: 'PAID',
        amountPaid: 350,
        transactionId: '',
        adminNotes: 'Offline walk-in student manually registered by admin.'
      });
      loadAdminRegistrations(adminToken);
    } else {
      setFeedbackMsg({ type: 'error', text: res?.error || 'Failed to create student registration.' });
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setFeedbackMsg({ type: '', text: '' });

    const studentId = editingStudent.id || editingStudent._id || editingStudent.regNo;
    const res = await handleEditStudent(studentId, editForm);

    if (res?.success) {
      setFeedbackMsg({ type: 'success', text: `Details updated for ${editForm.name}!` });
      setEditingStudent(null);
      loadAdminRegistrations(adminToken);
    } else {
      setFeedbackMsg({ type: 'error', text: res?.error || 'Failed to update student details.' });
    }
  };

  const filteredStudents = (registrationsList || []).filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      (s.name || s.fullName || '').toLowerCase().includes(q) ||
      (s.regNo || s.registerNumber || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.department || s.branch || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#15803D]">
            STUDENT RECORDS
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A3C34] tracking-tight">
            Students
          </h1>
          <p className="text-xs sm:text-sm text-[#3D6153]">
            Add new students or update any participant record.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setFeedbackMsg({ type: '', text: '' });
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#15803D] hover:bg-[#1E5D39] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Student</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Alert */}
      {feedbackMsg.text && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between border ${
            feedbackMsg.type === 'error'
              ? 'bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B]'
              : 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#15803D]" />
            )}
            <span className="font-bold">{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg({ type: '', text: '' })}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar - Preserved exactly as requested */}
      <div className="bg-white p-5 rounded-3xl border border-[#CCE3DE] shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B9080] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, register number, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs sm:text-sm font-medium text-[#1A3C34] outline-none focus:border-[#1A3C34]"
          />
        </div>
        <button
          type="button"
          onClick={() => loadAdminRegistrations(adminToken)}
          className="p-3 rounded-xl bg-white hover:bg-[#CCE3DE] border border-[#CCE3DE] text-[#1A3C34] transition-all cursor-pointer shadow-xs"
          title="Refresh list"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Student List Table in Reference Format */}
      <div className="bg-white rounded-3xl border border-[#CCE3DE] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-[#CCE3DE] text-[10px] font-extrabold text-[#6B9080] uppercase tracking-wider">
                <th className="py-2.5 px-2">REGISTER NO</th>
                <th className="py-2.5 px-2">STUDENT</th>
                <th className="py-2.5 px-2">DEPARTMENT</th>
                <th className="py-2.5 px-2">RESIDENCY</th>
                <th className="py-2.5 px-2">PAYMENT</th>
                <th className="py-2.5 px-2">VERIFICATION</th>
                <th className="py-2.5 px-2 text-right">EDIT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CCE3DE]/60">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-xs text-[#6B9080]">
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const isPaid = (s.paymentStatus || '').toUpperCase() === 'PAID';
                  const vStatus = (s.verificationStatus || '').toUpperCase();
                  const isVerified = vStatus === 'VERIFIED';
                  const isRejected = vStatus === 'REJECTED';

                  return (
                    <tr key={s.id || s._id || idx} className="hover:bg-[#F4F9F6] transition-colors">
                      <td className="py-2.5 px-2 font-mono font-bold text-[#1A3C34] whitespace-nowrap">
                        {s.regNo || s.registerNumber || '—'}
                      </td>

                      <td className="py-2.5 px-2">
                        <div className="font-bold text-[#15803D] leading-tight text-xs" title={s.email}>
                          {(() => {
                            const raw = (s.name || s.fullName || '—').trim();
                            const parts = raw.split(/\s+/);
                            if (parts.length <= 1) {
                              return <span className="block break-words">{raw}</span>;
                            }
                            const firstName = parts[0];
                            const restName = parts.slice(1).join(' ');
                            return (
                              <>
                                <span className="block">{firstName}</span>
                                <span className="block">{restName}</span>
                              </>
                            );
                          })()}
                        </div>
                        {s.isOfflineWalkin && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#D97706] text-[9px] font-bold">
                            Offline Walk-in
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 text-[#1A3C34]">
                        <span className="font-medium text-xs leading-tight">
                          {s.department || s.branch || 'CSE'}
                        </span>
                        <span className="text-[10px] text-[#6B9080] block mt-0.5">
                          {s.year || s.academicYear || '1st Year'}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-[#1A3C34] font-medium whitespace-nowrap">
                        {s.residency || s.residencyStatus || 'Day Scholar'}
                      </td>

                      <td className="py-2.5 px-2 font-bold text-[11px] whitespace-nowrap">
                        {isPaid ? (
                          <span className="text-[#15803D]">PAID</span>
                        ) : (
                          <span className="text-[#B45309]">UNPAID</span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 font-bold text-[11px] whitespace-nowrap">
                        {isVerified && (
                          <span className="text-[#15803D]">VERIFIED</span>
                        )}
                        {isRejected && (
                          <span className="text-[#DC2626]">REJECTED</span>
                        )}
                        {!isVerified && !isRejected && (
                          <span className="text-[#D97706]">PENDING</span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-xl text-[#6B9080] hover:text-[#1A3C34] hover:bg-[#EAF4F4] transition-colors cursor-pointer"
                          title="Edit student details"
                        >
                          <Edit3 className="w-4 h-4" />
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

      {/* ======================================================================
          MODAL 1: ADD MANUAL OFFLINE WALK-IN (POST /api/v1/admin/students)
          ====================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#CCE3DE] shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-[#CCE3DE] pb-4">
              <div className="space-y-0.5">
                <h2 className="text-xl font-black text-[#1A3C34] flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#15803D]" />
                  <span>Insert Offline Walk-In Registration</span>
                </h2>
                <p className="text-xs text-[#3D6153]">
                  Submits to POST /api/v1/admin/students. Allocates immediate seat and verified pass.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl hover:bg-[#EAF4F4] text-[#1A3C34] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWalkin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-medium text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Register Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Register / Roll No *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2300030555"
                    value={addForm.regNo}
                    onChange={(e) => setAddForm({ ...addForm, regNo: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-mono font-bold text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. rahul.sharma@klu.ac.in"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-mono text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Department</label>
                  <select
                    value={addForm.department}
                    onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                  >
                    <option value="CSE">CSE (Computer Science)</option>
                    <option value="AI&DS">AI&amp;DS</option>
                    <option value="IT">IT (Information Technology)</option>
                    <option value="ECE">ECE (Electronics)</option>
                    <option value="EEE">EEE (Electrical)</option>
                    <option value="MECH">MECH (Mechanical)</option>
                    <option value="CIVIL">CIVIL</option>
                    <option value="BIO_TECH">Biotechnology</option>
                    <option value="AGRICULTURE">B.Sc Agriculture</option>
                  </select>
                </div>

                {/* Section */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Section</label>
                  <select
                    value={addForm.section}
                    onChange={(e) => setAddForm({ ...addForm, section: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>

                {/* Academic Year */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Academic Year</label>
                  <select
                    value={addForm.year}
                    onChange={(e) => setAddForm({ ...addForm, year: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                {/* Residency */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Residency Status</label>
                  <select
                    value={addForm.residency}
                    onChange={(e) => setAddForm({ ...addForm, residency: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                  >
                    <option value="Day Scholar">Day Scholar</option>
                    <option value="Hosteller">Hosteller</option>
                  </select>
                </div>

                {/* Payment Status */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Payment Status</label>
                  <select
                    value={addForm.paymentStatus}
                    onChange={(e) => setAddForm({ ...addForm, paymentStatus: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                  >
                    <option value="PAID">PAID (₹350 Cash / Desk UPI)</option>
                    <option value="UNPAID">UNPAID (Pending Pay Later)</option>
                  </select>
                </div>

                {/* Transaction / Receipt Note */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Cash Receipt / Desk UTR</label>
                  <input
                    type="text"
                    placeholder="e.g. CASH-DESK-01 or UPI UTR"
                    value={addForm.transactionId}
                    onChange={(e) => setAddForm({ ...addForm, transactionId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-mono text-[#1A3C34] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#CCE3DE]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#EAF4F4] text-[#1A3C34] text-xs font-bold hover:bg-[#CCE3DE] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminActionLoading}
                  className="px-6 py-2.5 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
                >
                  {adminActionLoading ? 'Saving...' : 'Confirm Walk-In Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL 2: EDIT MISSPELLED DETAILS (PATCH /api/v1/admin/students/:id)
          ====================================================================== */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#CCE3DE] shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-[#CCE3DE] pb-4">
              <div className="space-y-0.5">
                <h2 className="text-xl font-black text-[#1A3C34] flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[#15803D]" />
                  <span>Edit Student Record</span>
                </h2>
                <p className="text-xs text-[#3D6153]">
                  Correct misspelled register numbers, names, departments, sections, or phones. (PATCH /api/v1/admin/students/:id)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-2 rounded-xl hover:bg-[#EAF4F4] text-[#1A3C34] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-medium text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Register Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Register / Roll No</label>
                  <input
                    type="text"
                    required
                    value={editForm.regNo}
                    onChange={(e) => setEditForm({ ...editForm, regNo: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-mono font-bold text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Department</label>
                  <input
                    type="text"
                    required
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Section */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Section</label>
                  <input
                    type="text"
                    required
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-mono text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Academic Year */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Academic Year</label>
                  <input
                    type="text"
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs text-[#1A3C34] outline-none"
                  />
                </div>

                {/* Residency */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#1A3C34]">Residency</label>
                  <select
                    value={editForm.residency}
                    onChange={(e) => setEditForm({ ...editForm, residency: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F9F6] border border-[#CCE3DE] text-xs font-bold text-[#1A3C34] outline-none"
                  >
                    <option value="Day Scholar">Day Scholar</option>
                    <option value="Hosteller">Hosteller</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#CCE3DE]">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#EAF4F4] text-[#1A3C34] text-xs font-bold hover:bg-[#CCE3DE] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminActionLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A3C34] hover:bg-[#132A24] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-[#84CC16]" />
                  <span>{adminActionLoading ? 'Saving...' : 'Save Corrections (PATCH)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
