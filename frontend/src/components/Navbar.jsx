import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AgrigenLogo } from './AgrigenIcons.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Navbar() {
  const { issuedIdCard, stats, nodeState } = useApp();

  return (
    <header className="fixed top-3 sm:top-5 left-0 right-0 z-50 px-3 sm:px-6 max-w-6xl mx-auto pointer-events-none">
      <div className="w-full bg-[#1A3C34] text-white border border-[#3D6153]/80 rounded-xl shadow-lg px-4 sm:px-8 py-3.5 flex items-center justify-between pointer-events-auto backdrop-blur-md">
        {/* Brand Name on the Left Side Corner */}
        <Link
          to="/"
          className="text-base sm:text-xl font-bold tracking-tight text-white flex items-center gap-2.5 font-display hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
            <AgrigenLogo className="w-full h-full object-cover" />
          </div>
          <span className="font-extrabold tracking-wide">AgriVerse</span>
        </Link>

        {/* Clean Floating Navigation Links */}
        <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium">
          <NavLink
            to="/agrigenevent/registerationforstudent"
            className={({ isActive }) =>
              `transition-colors py-1 ${
                isActive || window.location.pathname === '/register'
                  ? 'text-white font-bold border-b-2 border-[#CCE3DE]'
                  : 'text-[#CCE3DE] hover:text-white'
              }`
            }
          >
            Register (₹350)
          </NavLink>

          <NavLink
            to="/status"
            className={({ isActive }) =>
              `transition-colors py-1 ${
                isActive
                  ? 'text-white font-bold border-b-2 border-[#CCE3DE]'
                  : 'text-[#CCE3DE] hover:text-white'
              }`
            }
          >
            Check Status
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
