import React from 'react';

/**
 * AgrigenIcons - High-precision custom SVG vector icons for AgriVerse
 * Crafted to pair seamlessly with Lucide icons with matching viewBox, strokeWidth, and styling props.
 */

export const AgrigenLeafLogo = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Central Leaf Vein and Digital Circuit Nodes */}
    <path d="M12 22V10" />
    <path d="M12 10C8 6 6 2 12 2C18 2 16 6 12 10Z" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 14C8.5 13 4 15 3 19C7 19.5 10 18 12 14Z" />
    <path d="M12 12C15.5 11 20 13 21 17C17 17.5 14 16 12 12Z" />
    <circle cx="12" cy="2" r="1" fill="currentColor" />
    <circle cx="3" cy="19" r="1" fill="currentColor" />
    <circle cx="21" cy="17" r="1" fill="currentColor" />
  </svg>
);

export const AgrigenLogo = ({ className = "w-6 h-6", alt = "AgriVerse Logo", strokeWidth, ...props }) => (
  <img
    src="/logo.png"
    alt={alt}
    className={`object-contain inline-block ${className}`}
    {...props}
  />
);

export const AgrigenDrone = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Central Drone Body */}
    <rect x="9" y="9" width="6" height="6" rx="2" />
    {/* Arms */}
    <line x1="9" y1="9" x2="4" y2="4" />
    <line x1="15" y1="9" x2="20" y2="4" />
    <line x1="9" y1="15" x2="4" y2="20" />
    <line x1="15" y1="15" x2="20" y2="20" />
    {/* Rotors / Propellers */}
    <ellipse cx="4" cy="4" rx="3" ry="1.2" transform="rotate(-30 4 4)" />
    <ellipse cx="20" cy="4" rx="3" ry="1.2" transform="rotate(30 20 4)" />
    <ellipse cx="4" cy="20" rx="3" ry="1.2" transform="rotate(30 4 20)" />
    <ellipse cx="20" cy="20" rx="3" ry="1.2" transform="rotate(-30 20 20)" />
    {/* Camera Sensor / Spray Nozzle */}
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <path d="M11 15v2a1 1 0 0 0 2 0v-2" />
  </svg>
);

export const AgrigenIoTSoilSensor = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Head unit / telemetry transmitter */}
    <rect x="7" y="2" width="10" height="7" rx="1.5" />
    <line x1="10" y1="4" x2="14" y2="4" />
    <circle cx="12" cy="6.5" r="1" fill="currentColor" />
    {/* Antenna Waves */}
    <path d="M19 3a4 4 0 0 1 0 5" />
    <path d="M5 3a4 4 0 0 0 0 5" />
    {/* Sensor Probes / Ground Stake */}
    <line x1="9" y1="9" x2="9" y2="21" />
    <line x1="12" y1="9" x2="12" y2="22" />
    <line x1="15" y1="9" x2="15" y2="21" />
    {/* Soil level line & strata dashes */}
    <path d="M3 13h4" strokeDasharray="1.5 1.5" />
    <path d="M17 13h4" strokeDasharray="1.5 1.5" />
    <path d="M4 17h3" strokeDasharray="1.5 1.5" />
    <path d="M17 17h3" strokeDasharray="1.5 1.5" />
  </svg>
);

export const AgrigenGreenhouse = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Greenhouse Roof Pitch */}
    <path d="M3 11L12 3L21 11" />
    {/* Walls and Foundation */}
    <path d="M4 11V21H20V11" />
    {/* Glass Pane Grid */}
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="4" y1="11" x2="20" y2="11" />
    <line x1="4" y1="16" x2="20" y2="16" />
    {/* Little seedling inside */}
    <path d="M12 18c-1-1-2-1.5-2-3c1 0 2 1 2 3z" fill="currentColor" fillOpacity="0.25" />
    <path d="M12 18c1-1 2-1.5 2-3c-1 0-2 1-2 3z" fill="currentColor" fillOpacity="0.25" />
  </svg>
);

export const AgrigenHydroponics = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Vertical tower columns */}
    <rect x="7" y="3" width="10" height="18" rx="2" />
    <line x1="7" y1="8" x2="17" y2="8" />
    <line x1="7" y1="13" x2="17" y2="13" />
    <line x1="7" y1="18" x2="17" y2="18" />
    {/* Emergent Hydroponic Shoots */}
    <path d="M7 6C5 5 4 6 3 7C4 8 6 7 7 6" />
    <path d="M17 6C19 5 20 6 21 7C20 8 18 7 17 6" />
    <path d="M7 11C5 10 4 11 3 12C4 13 6 12 7 11" />
    <path d="M17 11C19 10 20 11 21 12C20 13 18 12 17 11" />
    <path d="M7 16C5 15 4 16 3 17C4 18 6 17 7 16" />
    <path d="M17 16C19 15 20 16 21 17C20 18 18 17 17 16" />
    {/* Nutrient Flow Drops */}
    <circle cx="12" cy="10.5" r="0.75" fill="currentColor" />
    <circle cx="12" cy="15.5" r="0.75" fill="currentColor" />
  </svg>
);

export const AgrigenWheatGrain = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 22V2" />
    {/* Left Grains */}
    <path d="M12 5C10 3 7 4 7 7C10 7 11 6 12 5Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 9C9 7 6 8 6 11C9 11 11 10 12 9Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 13C9 11 6 12 6 15C9 15 11 14 12 13Z" fill="currentColor" fillOpacity="0.2" />
    {/* Right Grains */}
    <path d="M12 5C14 3 17 4 17 7C14 7 13 6 12 5Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 9C15 7 18 8 18 11C15 11 13 10 12 9Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 13C15 11 18 12 18 15C15 15 13 14 12 13Z" fill="currentColor" fillOpacity="0.2" />
    {/* Beard / Awns */}
    <path d="M7 4L5 2" />
    <path d="M17 4L19 2" />
  </svg>
);

export const AgrigenBioDNA = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M4 3C8 7 16 7 20 3" />
    <path d="M4 21C8 17 16 17 20 21" />
    <path d="M4 12C8 8 16 16 20 12" />
    <line x1="8" y1="5.5" x2="8" y2="9.5" />
    <line x1="16" y1="5.5" x2="16" y2="9.5" />
    <line x1="8" y1="14.5" x2="8" y2="18.5" />
    <line x1="16" y1="14.5" x2="16" y2="18.5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

export const AgrigenSolarIrrigation = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Solar PV Panel */}
    <path d="M3 11L6 4H18L21 11H3Z" />
    <line x1="9.5" y1="4" x2="8" y2="11" />
    <line x1="14.5" y1="4" x2="16" y2="11" />
    <line x1="4.5" y1="7.5" x2="19.5" y2="7.5" />
    {/* Pump Post */}
    <line x1="12" y1="11" x2="12" y2="16" />
    {/* Water Flow / Pipe Outlets */}
    <path d="M6 19C6 17.5 8 16 12 16C16 16 18 17.5 18 19" />
    <path d="M4 21C4 20 6 19 12 19C18 19 20 20 20 21" strokeDasharray="2 2" />
  </svg>
);

export const AgrigenSatellite = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Satellite core body */}
    <rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)" />
    {/* Solar Arrays Left and Right */}
    <path d="M4 4L8 8" />
    <rect x="2" y="2" width="5" height="4" transform="rotate(-45 4.5 4)" />
    <path d="M16 16L20 20" />
    <rect x="17" y="17" width="5" height="4" transform="rotate(-45 19.5 19)" />
    {/* Downward sensor beam (Earth imaging) */}
    <path d="M12 16L6 22" strokeDasharray="1.5 1.5" />
    <path d="M14 14L20 20" strokeDasharray="1.5 1.5" />
    <circle cx="6" cy="22" r="1" fill="currentColor" />
  </svg>
);

export const AgrigenEcoShield = ({ className = "w-6 h-6", strokeWidth = 1.75, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2L4 5V11C4 16.5 7.5 21 12 22C16.5 21 20 16.5 20 11V5L12 2Z" />
    {/* Inner Leaf */}
    <path d="M12 7C9.5 7 8 9 9 12C9.5 13.5 11 15 12 17C13 15 14.5 13.5 15 12C16 9 14.5 7 12 7Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 17V10" />
  </svg>
);

export default {
  AgrigenLogo,
  AgrigenDrone,
  AgrigenIoTSoilSensor,
  AgrigenGreenhouse,
  AgrigenHydroponics,
  AgrigenWheatGrain,
  AgrigenBioDNA,
  AgrigenSolarIrrigation,
  AgrigenSatellite,
  AgrigenEcoShield
};
