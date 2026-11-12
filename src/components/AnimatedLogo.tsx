import React from 'react';
import { motion } from 'motion/react';
import { Zap } from 'lucide-react';
import { fetchPublicSettings } from '../lib/api.ts';

interface AnimatedLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  theme?: 'dark' | 'light' | 'auto';
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  theme = 'auto',
}) => {
  const [logoImg, setLogoImg] = React.useState<string>('');
  const [siteName, setSiteName] = React.useState<string>('trustysmm');

  React.useEffect(() => {
    const cachedLogo = localStorage.getItem('websiteLogo');
    const cachedName = localStorage.getItem('websiteName');
    if (cachedLogo) setLogoImg(cachedLogo);
    if (cachedName && cachedName.toLowerCase() !== 'ethicalsmm') {
      setSiteName(cachedName);
    } else {
      setSiteName('trustysmm');
    }

    fetchPublicSettings().then((data) => {
      if (data) {
        if (data.websiteLogo !== undefined) {
          setLogoImg(data.websiteLogo);
        }
        if (data.websiteName && data.websiteName.toLowerCase() !== 'ethicalsmm') {
          setSiteName(data.websiteName);
        } else {
          setSiteName('trustysmm');
        }
      }
    });
  }, []);

  const iconSizes = {
    xs: 'w-7 h-7',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-13 h-13',
    xl: 'w-16 h-16',
  };

  const textSizes = {
    xs: 'text-sm sm:text-base',
    sm: 'text-base sm:text-lg',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl',
  };

  const name = (siteName || 'trustysmm').toLowerCase() === 'ethicalsmm' ? 'trustysmm' : (siteName || 'trustysmm');
  const mid = name.toLowerCase().includes('trusty') ? 6 : Math.ceil(name.length / 2);
  const prefix = name.slice(0, mid);
  const suffix = name.slice(mid);

  const isSuffixLight = theme === 'dark';

  return (
    <div className={`inline-flex items-center space-x-2.5 select-none ${className}`}>
      {/* Dynamic Kinetic Emblem Container */}
      <motion.div
        className="relative flex items-center justify-center cursor-pointer group flex-shrink-0"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
      >
        {/* Glow Background Pulse */}
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-red-600 via-orange-500 to-rose-500 opacity-60 blur-md"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.45, 0.8, 0.45],
            rotate: [0, 4, 0, -4, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Foreground Emblem Box */}
        <div
          className={`${iconSizes[size]} relative rounded-2xl bg-gradient-to-br from-red-600 via-red-500 to-rose-600 border border-white/30 flex items-center justify-center overflow-hidden z-10 shadow-lg text-white shadow-red-500/20`}
        >
          {logoImg ? (
            <img src={logoImg} alt={siteName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-1">
              {/* Shimmer sweep animation */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -skew-x-20"
                animate={{
                  x: ['-140%', '140%'],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  repeatDelay: 1.2,
                  ease: 'easeInOut',
                }}
              />

              {/* Animated TrustySMM "T" Emblem */}
              <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-md" fill="none">
                {/* Horizontal Top Bar of "T" with athletic terminals */}
                <motion.path
                  d="M6 13.5 L6 10 L30 10 L30 13.5"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  animate={{
                    strokeWidth: [4, 4.4, 4],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Vertical Central Stem of "T" */}
                <motion.path
                  d="M18 10 L18 29"
                  stroke="#ffffff"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  animate={{
                    strokeWidth: [4.2, 4.6, 4.2],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
                />

                {/* Golden Energy Core within Stem */}
                <motion.path
                  d="M18 14 L18 28"
                  stroke="#fef08a"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  animate={{
                    stroke: ['#fef08a', '#ffffff', '#fef08a'],
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />

                {/* Central pulsating star/nucleus at T-junction */}
                <motion.circle
                  cx="18"
                  cy="10"
                  r="3.2"
                  fill="#facc15"
                  animate={{
                    r: [2.8, 4.2, 2.8],
                    opacity: [0.85, 1, 0.85],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Left Terminal Energy Node */}
                <motion.circle
                  cx="6"
                  cy="10"
                  r="2.2"
                  fill="#ffffff"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />

                {/* Right Terminal Energy Node */}
                <motion.circle
                  cx="30"
                  cy="10"
                  r="2.2"
                  fill="#ffffff"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
                />

                {/* Bottom Stem Energy Node */}
                <motion.circle
                  cx="18"
                  cy="29"
                  r="2.4"
                  fill="#fef08a"
                  animate={{ scale: [1, 1.35, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
                />
              </svg>

              {/* Dynamic Lightning Accent */}
              <motion.div
                className="absolute -top-0.5 -right-0.5"
                animate={{
                  rotate: [-8, 12, -8],
                  scale: [0.95, 1.15, 0.95],
                }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                <Zap className="w-2.5 h-2.5 text-yellow-300 fill-yellow-300 drop-shadow" />
              </motion.div>
            </div>
          )}
        </div>

        {/* Orbiting particle ring */}
        <motion.div
          animate={{
            scale: [0.7, 1.3, 0.7],
            opacity: [0.3, 0.9, 0.3],
          }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full blur-[0.5px] z-20"
        />
      </motion.div>

      {/* Brand Typography with dynamic animated accents */}
      {showText && (
        <div className="flex flex-col items-start leading-none">
          <div className="flex items-center">
            {/* "trusty" Prefix in fiery vibrant gradient */}
            <span className={`${textSizes[size]} font-black tracking-tight bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 bg-clip-text text-transparent group-hover:brightness-110 transition-all font-display`}>
              {prefix}
            </span>

            {/* "smm" Suffix in bold high contrast with animated live pulse dot */}
            <span className={`${textSizes[size]} font-black tracking-tight ${isSuffixLight ? 'text-white' : 'text-gray-900'} ml-0.5 flex items-center font-display`}>
              {suffix}
              <motion.span
                className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 ml-1 shadow-xs shadow-red-500/50"
                animate={{
                  scale: [1, 1.7, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </span>
          </div>

          <div className="flex items-center space-x-1 mt-0.5">
            <span className="text-[8px] font-black uppercase tracking-wider text-red-600 bg-red-500/10 border border-red-500/20 px-1.5 py-0.2 rounded font-mono">
              SMM PANEL
            </span>
          </div>
        </div>
      )}
    </div>
  );
};


