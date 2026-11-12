import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    question: 'How fast are orders delivered?',
    answer:
      'Order delivery begins automatically within minutes for most services once payment is confirmed. Depending on network volume and the requested quantity, completion times can range from a few minutes to several hours for natural, gradual pacing. Exact estimated start times and speeds are listed in each individual service description in our catalog.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We support a wide variety of instant, secure payment gateways including UPI (Google Pay, PhonePe, Paytm, BHIM), instant QR scanning, Binance Pay (USDT/crypto), TRC20 USDT, and direct cryptocurrency deposits. All transactions are securely processed via automated server-side verification.',
  },
  {
    question: 'Do you offer an API and child panels?',
    answer:
      'Yes! We provide a high-performance RESTful API for developers and resellers with instant order placement, status checks, and balance inquiries. We also offer fully hosted, turnkey Child Panels that connect directly to TrustySMM, enabling you to run your own branded SMM business with custom pricing.',
  },
  {
    question: 'Are the services safe for my accounts?',
    answer:
      'Our platform utilizes high-retention profiles, gradual delivery algorithms, and standard platform compliance practices designed to minimize risk. We never ask for your account passwords. Because third-party social media algorithms update regularly, we advise pacing large orders and selecting services with refill guarantees.',
  },
  {
    question: 'How does the affiliate program work?',
    answer:
      'Our affiliate program lets you earn generous lifetime commissions on every deposit made by users who sign up through your referral link. Tracking is automatic, and earnings are credited directly to your account balance for ordering services or requesting payouts once minimum withdrawal thresholds are met.',
  },
];

export const LoginFaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq-section"
      className="w-full py-16 sm:py-20 px-4 sm:px-6 border-t border-[#2A2A2A] relative z-10 box-border bg-[#101010]"
    >
      <div className="w-full max-w-3xl mx-auto relative z-10 box-border">
        {/* Section Heading */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white font-display">
            Questions, answered
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2.5 max-w-md mx-auto leading-relaxed">
            Everything you need to know about our services, delivery times, and reseller platform.
          </p>
        </div>

        {/* Accordion List with subtle dark divider lines */}
        <div className="divide-y divide-[#2A2A2A] border-y border-[#2A2A2A]">
          {FAQ_DATA.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="py-4 sm:py-5 transition-colors">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between text-left group cursor-pointer py-1"
                  aria-expanded={isOpen}
                >
                  <span
                    className={`text-sm sm:text-base font-bold text-gray-200 transition-colors group-hover:text-[#FF3030] pr-4 ${
                      isOpen ? 'text-[#FF3030]' : ''
                    }`}
                  >
                    {faq.question}
                  </span>
                  <div
                    className={`p-1.5 rounded-xl transition-all flex-shrink-0 ${
                      isOpen
                        ? 'bg-[#FF3030]/20 text-[#FF3030]'
                        : 'bg-[#1C1C1C] border border-[#2A2A2A] group-hover:border-[#FF3030]/40 text-gray-400 group-hover:text-[#FF3030]'
                    }`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-[#FF3030]' : ''
                      }`}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs sm:text-sm text-gray-400 font-normal leading-relaxed pt-3 pb-1">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
