import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { AgrigenLogo } from '../components/AgrigenIcons.jsx';

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-xl bg-black text-white flex items-center justify-center shadow-sm overflow-hidden border border-black/10">
        <AgrigenLogo className="w-full h-full object-cover" />
      </div>
      <h1 className="text-4xl font-fraunces font-bold text-[#1A3C34]">404</h1>
      <h2 className="text-lg font-bold text-[#2D6A4F]">Page Not Found</h2>
      <p className="text-xs text-[#3D6153] max-w-sm">
        The requested page does not exist or has been moved within the AgriVerse 2026 portal.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1A3C34] hover:bg-[#132A24] text-white text-xs font-bold transition-all shadow-sm"
      >
        <Home className="w-4 h-4" />
        <span>Return to Homepage</span>
      </Link>
    </div>
  );
}
