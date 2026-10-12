import React from 'react';
import { Sprout } from 'lucide-react';
import { AgrigenLogo } from './AgrigenIcons.jsx';

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-[#06120E] text-white border-t border-[#193B2F] py-5 px-4 sm:px-8 mt-16 text-xs select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
        {/* Left: Brand Logo & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-black border border-white/20 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
            <AgrigenLogo className="w-full h-full object-cover" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm tracking-wide text-white">
              AGRI<span className="text-[#22C55E]">VERSE</span> 2026
            </span>
            <span className="text-[#27784A]">•</span>
            <span className="text-[#689E88] text-xs font-medium">
              Agri-Genomics &amp; Innovation
            </span>
          </div>
        </div>

        {/* Center: Organizing Contacts (Web Lead & Secretary) */}
        <div className="flex items-center gap-5 sm:gap-8 font-mono text-[11px] text-[#CCE3DE]">
          {/* Jayanth */}
          <div className="text-left space-y-0.5">
            <div className="flex items-center gap-1 font-sans">
              <span className="font-bold text-white text-xs">Jayanth</span>
              <span className="text-[#22C55E] text-[10px] font-extrabold uppercase">(WEB LEAD)</span>
            </div>
            <a
              href="tel:8869965959"
              className="text-[#98BBAE] hover:text-white transition-colors tracking-wider block font-sans text-xs"
            >
              8869965959
            </a>
          </div>

          {/* Divider */}
          <div className="h-7 w-[1px] bg-[#27784A]" />

          {/* Abhiram */}
          <div className="text-left space-y-0.5">
            <div className="flex items-center gap-1 font-sans">
              <span className="font-bold text-white text-xs">ABHIRAM</span>
              <span className="text-[#22C55E] text-[10px] font-extrabold uppercase">(SECRETARY)</span>
            </div>
            <a
              href="tel:9398779899"
              className="text-[#98BBAE] hover:text-white transition-colors tracking-wider block font-sans text-xs"
            >
              9398779899
            </a>
          </div>
        </div>

        {/* Right: Copyright & Leaf Action Button */}
        <div className="flex items-center gap-4">
          <p className="text-[11px] text-[#689E88] text-center md:text-right">
            © 2026 AGRIVERSE Organizing Committee. All rights reserved.
          </p>

          <button
            type="button"
            onClick={scrollToTop}
            title="Return to Top"
            className="w-8 h-8 rounded-full border border-[#22C55E] bg-[#0A1F17] hover:bg-[#22C55E] text-[#22C55E] hover:text-[#06120E] flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 cursor-pointer hover:scale-105"
          >
            <Sprout className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </footer>
  );
}
