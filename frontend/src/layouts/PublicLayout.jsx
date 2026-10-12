import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import LightboxModal from '../components/LightboxModal.jsx';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#EAF4F4] text-[#1A3C34] selection:bg-[#CCE3DE] selection:text-[#1A3C34] flex flex-col justify-between">
      <Navbar />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
      <LightboxModal />
    </div>
  );
}
