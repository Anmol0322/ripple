import React from "react";

interface RippleLogoProps {
  className?: string;
  size?: number; // Size in pixels
  showBackground?: boolean;
}

export const RippleLogo: React.FC<RippleLogoProps> = ({
  className = "",
  size = 40,
  showBackground = true,
}) => {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-lg"
      >
        <defs>
          {/* Glowing Gradient */}
          <linearGradient id="wavelet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" /> {/* Glowing Cyan */}
            <stop offset="50%" stopColor="#06B6D4" /> {/* Teal */}
            <stop offset="100%" stopColor="#3B82F6" /> {/* Electric Blue */}
          </linearGradient>
          
          {/* Background Gradient */}
          <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#080E26" />
            <stop offset="100%" stopColor="#0B1538" />
          </linearGradient>

          {/* Glow filter for authentic glowing effect */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Squircle / Rounded Background matching the design mockup */}
        {showBackground && (
          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            rx="24"
            fill="url(#bg-grad)"
            stroke="#1E293B"
            strokeWidth="1.5"
          />
        )}

        {/* Abstract Wavelet R Curves */}
        <g stroke="url(#wavelet-grad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)">
          {/* Top Wavelet (Outer Boundary of R) */}
          <path d="M 26,26 L 68,26 C 78,26 84,34 84,44 C 84,54 76,60 66,60 L 46,60 L 72,82" />
          
          {/* Middle Wavelet (Nested Inner R Boundary) */}
          <path d="M 26,38 L 62,38 C 70,38 74,43 74,49 C 74,55 68,59 60,59 L 46,59 M 46,68 L 64,82" />
          
          {/* Inner / Bottom Accent Wavelet */}
          <path d="M 26,50 L 54,50 C 60,50 63,53 63,57 C 63,61 58,63 53,63 L 46,63 M 26,62 C 32,68 38,74 46,82" />
        </g>
      </svg>
    </div>
  );
};
