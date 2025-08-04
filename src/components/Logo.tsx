import React from 'react';

interface LogoProps {
  className?: string;
  showTagline?: boolean;
}

export default function Logo({ className = "", showTagline = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Multi-generational family hub icon */}
      <svg
        width="60"
        height="60"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Central hub/home circle */}
        <circle
          cx="50"
          cy="50"
          r="18"
          fill="#C5DAD1"
          stroke="#444B59"
          strokeWidth="2.5"
        />
        
        {/* Connected family circles representing different generations */}
        {/* Child (top-left) */}
        <circle
          cx="30"
          cy="25"
          r="10"
          fill="#9B98B0"
          stroke="#444B59"
          strokeWidth="2"
        />
        
        {/* Parent (top-right) */}
        <circle
          cx="70"
          cy="25"
          r="12"
          fill="#87A89A"
          stroke="#444B59"
          strokeWidth="2"
        />
        
        {/* Elder (bottom-left) */}
        <circle
          cx="25"
          cy="75"
          r="11"
          fill="#9B98B0"
          stroke="#444B59"
          strokeWidth="2"
        />
        
        {/* Another family member (bottom-right) */}
        <circle
          cx="75"
          cy="75"
          r="10"
          fill="#87A89A"
          stroke="#444B59"
          strokeWidth="2"
        />
        
        {/* Connection lines showing family relationships */}
        <g stroke="#87A89A" strokeWidth="2" strokeLinecap="round">
          {/* Hub to each family member */}
          <path d="M38 35 L42 42" opacity="0.7" />
          <path d="M62 35 L58 42" opacity="0.7" />
          <path d="M32 65 L42 58" opacity="0.7" />
          <path d="M68 65 L58 58" opacity="0.7" />
        </g>
        
        {/* Heart symbol in center of hub */}
        <path
          d="M47 47 Q47 44 50 44 Q53 44 53 47 Q53 49 50 52 Q47 49 47 47"
          fill="#444B59"
        />
      </svg>
      
      {/* Text */}
      <div className="flex flex-col">
        <div className="text-3xl md:text-4xl font-bold text-[#9B98B0]">
          FamilyHub.care
        </div>
        {showTagline && (
          <p className="text-sm md:text-base text-neutral-600 mt-1">
            Organize. Communicate. Support.
          </p>
        )}
      </div>
    </div>
  );
}