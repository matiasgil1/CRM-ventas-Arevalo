import React, { useState } from 'react';

interface ArevaloLogoProps {
  className?: string;
  variant?: 'full' | 'icon-only' | 'white';
  size?: 'sm' | 'md' | 'lg';
}

export const ArevaloLogo: React.FC<ArevaloLogoProps> = ({ 
  className = '', 
  variant = 'full',
  size = 'md' 
}) => {
  const [imgError, setImgError] = useState(false);

  const imgHeight = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16'
  }[size];

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14'
  }[size];

  const titleSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl'
  }[size];

  const subSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]'
  }[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {!imgError ? (
        <img 
          src="/logo.png" 
          alt="Arevalo Servicios Sociales" 
          className={`object-contain ${imgHeight} max-w-full`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <>
          <div className={`relative shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#40C4C0] to-[#2B9A97] shadow-xs p-1.5 ${iconSizes}`}>
            <svg 
              viewBox="0 0 36 36" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg" 
              className="w-full h-full text-white"
            >
              <path 
                d="M18 3L6 8V16C6 23.5 11.1 30.4 18 33C24.9 30.4 30 23.5 30 16V8L18 3Z" 
                fill="white" 
                fillOpacity="0.2"
              />
              <path 
                d="M18 10C15.2 10 13 12.2 13 15C13 19 18 24 18 24C18 24 23 19 23 15C23 12.2 20.8 10 18 10Z" 
                fill="white"
              />
              <path 
                d="M16.5 13.5H19.5V16.5H16.5V13.5Z" 
                fill="#2B9A97"
              />
            </svg>
          </div>

          {variant !== 'icon-only' && (
            <div className="flex flex-col leading-none">
              <span className={`font-extrabold tracking-tight font-sans lowercase ${titleSizes} ${
                variant === 'white' ? 'text-white' : 'text-[#2D3748]'
              }`}>
                arevalo
              </span>
              <span className={`font-bold tracking-widest uppercase mt-0.5 ${subSizes} ${
                variant === 'white' ? 'text-teal-200' : 'text-[#40C4C0]'
              }`}>
                servicios sociales
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
