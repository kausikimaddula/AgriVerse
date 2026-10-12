import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Users, Settings, ArrowLeft, LogOut,
  Download, LayoutDashboard, Menu, X, UserCheck
} from 'lucide-react';
import { AgrigenLogo } from '../components/AgrigenIcons.jsx';
import LightboxModal from '../components/LightboxModal.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function AdminLayout() {
  const {
    adminUser,
    adminLogout,
    handleExportExcel,
    exportingExcel,
    selectedProofLightbox,
    setSelectedProofLightbox,
    handleVerifyPayment,
    handleRejectPayment,
    adminActionLoading
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = () => {
    adminLogout();
    navigate('/master/login');
  };

  const navItems = [
    { to: '/master/dashboard', label: 'Live Dashboard', icon: LayoutDashboard },
    { to: '/master/students', label: 'Students', icon: UserCheck },
    { to: '/master/registrations', label: 'Registrations', icon: Users },
    { to: '/master/settings', label: 'AgriVerse Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-[#EAF4F4] text-[#1A3C34] flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden sticky top-0 z-40 bg-[#1A3C34] text-white px-4 py-3 flex items-center justify-between border-b border-[#27784A] shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
            <AgrigenLogo className="w-full h-full object-cover" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-white">AgriVerse Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-[#132A24] text-[#CCE3DE] hover:text-white border border-[#27784A] cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for Mobile Sidebar */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 bottom-0 z-50 w-64 xl:w-72 bg-[#1A3C34] text-white flex flex-col justify-between border-r border-[#27784A]/60 shadow-xl transition-transform duration-300 ease-in-out md:translate-x-0 h-screen ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Section */}
        <div className="p-5 border-b border-[#27784A]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-sm border border-white/10 shrink-0 overflow-hidden">
              <AgrigenLogo className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight truncate">AgriVerse Admin</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#132A24] text-[#84CC16] border border-[#27784A]">
                  {adminUser?.role || 'SUPER_ADMIN'}
                </span>
                <span className="text-[10px] text-[#CCE3DE] truncate">v2.4 Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#CCE3DE]/70">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-white text-[#1A3C34] shadow-md font-extrabold translate-x-1'
                      : 'text-[#CCE3DE] hover:bg-[#132A24] hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Actions Section */}
        <div className="p-4 border-t border-[#27784A]/60 space-y-3 bg-[#16332C]">
          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#27784A] hover:bg-[#1E5D39] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Download formatted .xlsx report via ExcelJS stream"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          {/* Secondary Actions Row */}
          <div className="flex items-center gap-2 pt-1">
            <Link
              to="/"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#132A24] text-[#CCE3DE] hover:text-white hover:bg-[#1A3C34] text-xs font-semibold transition-colors border border-[#27784A]"
              title="Return to Public Site"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Site</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#132A24] hover:bg-[#DC2626] text-white text-xs font-semibold transition-colors border border-[#27784A] cursor-pointer"
              title="Sign out of admin session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin Content View */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Audit Lightbox Modal */}
      {selectedProofLightbox && (
        <LightboxModal
          registration={selectedProofLightbox}
          onClose={() => setSelectedProofLightbox(null)}
          onVerify={(id) => handleVerifyPayment(id)}
          onReject={(id) => handleRejectPayment(id)}
          loading={adminActionLoading}
        />
      )}
    </div>
  );
}
