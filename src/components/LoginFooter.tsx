import React from 'react';
import { Send, Shield, Sparkles } from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo.tsx';

interface LoginFooterProps {
  websiteName?: string;
  websiteLogo?: string;
  onOpenCategory: (category: string) => void;
  onOpenAboutUs?: () => void;
  onOpenBlog: () => void;
  onOpenApi: () => void;
  onOpenChildPanels: () => void;
  onOpenAffiliates: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenSupport: () => void;
  onOpenContact: () => void;
  onScrollToFaq: () => void;
}

export const LoginFooter: React.FC<LoginFooterProps> = ({
  websiteName = 'TrustySMM',
  websiteLogo,
  onOpenCategory,
  onOpenAboutUs,
  onOpenBlog,
  onOpenApi,
  onOpenChildPanels,
  onOpenAffiliates,
  onOpenTerms,
  onOpenPrivacy,
  onOpenSupport,
  onOpenContact,
  onScrollToFaq,
}) => {
  return (
    <footer className="w-full bg-[#0D0D0D] text-gray-400 py-12 sm:py-16 px-4 sm:px-6 md:px-8 border-t border-[#2A2A2A] relative z-10 box-border">
      <div className="w-full max-w-6xl mx-auto box-border">
        {/* Main 4-Column Grid on Desktop, stacked on Mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-8 sm:gap-10 pb-12 border-b border-[#2A2A2A]">
          
          {/* ========================================================================= */}
          {/* LEFT SECTION: Brand Logo & Description */}
          {/* ========================================================================= */}
          <div className="sm:col-span-2 md:col-span-4 space-y-4">
            <div className="flex items-center space-x-2.5">
              {websiteLogo ? (
                <img
                  src={websiteLogo}
                  alt={websiteName || 'TrustySMM'}
                  className="h-8 max-w-[150px] object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <AnimatedLogo size="md" showText={true} />
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-sm">
              TrustySMM is India's leading automated SMM platform, providing wholesale growth solutions for Instagram, YouTube, Telegram & Facebook with 24/7 instant delivery.
            </p>

            <div className="pt-1 flex items-center space-x-3">
              <a
                href="https://t.me/securesmmtursted"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3.5 rounded-xl bg-[#1C1C1C] hover:bg-[#252525] hover:text-sky-400 border border-[#2A2A2A] hover:border-sky-500/40 shadow-xs flex items-center space-x-1.5 text-gray-200 transition-all text-xs font-semibold"
                title="Telegram Support"
              >
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>Telegram</span>
              </a>

              <button
                type="button"
                onClick={onOpenContact}
                className="h-8 px-3.5 rounded-xl bg-[#1C1C1C] hover:bg-[#FF3030] hover:text-white border border-[#2A2A2A] hover:border-[#FF3030] shadow-xs flex items-center text-gray-200 transition-all text-xs font-semibold cursor-pointer"
              >
                24/7 Support
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SERVICES COLUMN */}
          {/* ========================================================================= */}
          <div className="sm:col-span-1 md:col-span-3 space-y-3.5">
            <h4 className="text-xs font-bold text-[#FF3030] uppercase tracking-wider font-mono">
              Services
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenCategory('Instagram')}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Instagram
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenCategory('YouTube')}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  YouTube
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenCategory('Facebook')}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Facebook
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenCategory('Telegram')}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Telegram
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenCategory('All')}
                  className="text-[#FF3030] hover:text-[#FF5050] font-bold transition-colors cursor-pointer text-left py-0.5 inline-flex items-center space-x-1"
                >
                  <span>All Services</span>
                  <span>&rarr;</span>
                </button>
              </li>
            </ul>
          </div>

          {/* ========================================================================= */}
          {/* COMPANY COLUMN */}
          {/* ========================================================================= */}
          <div className="sm:col-span-1 md:col-span-2 space-y-3.5">
            <h4 className="text-xs font-bold text-[#FF3030] uppercase tracking-wider font-mono">
              Company
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <button
                  type="button"
                  onClick={onOpenAboutUs}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5 font-bold flex items-center space-x-1"
                >
                  <span>About Us</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#FF3030]/20 text-[#FF3030] font-semibold">Info</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenBlog}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Blog
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenApi}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  API
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenChildPanels}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Child Panels
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenAffiliates}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Affiliates
                </button>
              </li>
            </ul>
          </div>

          {/* ========================================================================= */}
          {/* SUPPORT COLUMN */}
          {/* ========================================================================= */}
          <div className="sm:col-span-2 md:col-span-3 space-y-3.5">
            <h4 className="text-xs font-bold text-[#FF3030] uppercase tracking-wider font-mono">
              Support
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <button
                  type="button"
                  onClick={onScrollToFaq}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  FAQ
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenSupport}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Tickets
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenTerms}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Terms
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenContact}
                  className="text-gray-400 hover:text-[#FF3030] transition-colors cursor-pointer text-left py-0.5"
                >
                  Contact Us
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* BOTTOM COPYRIGHT BAR */}
        {/* ========================================================================= */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <p>© 2026 TrustySMM. All rights reserved.</p>
          <div className="flex items-center space-x-4 flex-wrap justify-center gap-y-2">
            <button
              type="button"
              onClick={onOpenAboutUs}
              className="hover:text-[#FF3030] transition-colors cursor-pointer font-medium"
            >
              About Us
            </button>
            <span>&middot;</span>
            <button
              type="button"
              onClick={onOpenTerms}
              className="hover:text-[#FF3030] transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <span>&middot;</span>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="hover:text-[#FF3030] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>&middot;</span>
            <button
              type="button"
              onClick={onOpenApi}
              className="hover:text-[#FF3030] transition-colors cursor-pointer"
            >
              API Docs
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
