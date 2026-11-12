import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  Wallet,
  Clock,
  XCircle,
  Zap,
  Smartphone,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Info,
  Lock,
  ChevronDown
} from 'lucide-react';

interface AddFundsSectionProps {
  token: string;
  user: any;
  publicSettings: any;
  onRefreshProfile: () => void;
  isDarkMode: boolean;
  currency: string;
  formatAmount: (val: number) => string;
}

export const AddFundsSection: React.FC<AddFundsSectionProps> = ({
  token,
  user,
  publicSettings,
  onRefreshProfile,
  isDarkMode,
  formatAmount,
}) => {
  // Method selection: 'bharatpe' (default) or 'phonepe'
  const [selectedMethod, setSelectedMethod] = useState<'phonepe' | 'bharatpe'>('bharatpe');
  
  // Amount state (empty or min 10)
  const [amount, setAmount] = useState<string>('100');
  const [utr, setUtr] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [payments, setPayments] = useState<any[]>([]);
  const [copiedText, setCopiedText] = useState<string>('');
  const [viewAdminQr, setViewAdminQr] = useState<boolean>(false);

  const minDepositRequired = parseFloat(publicSettings?.minDeposit) || 10;

  // PhonePe Merchant Details from Backend / Admin Settings
  const phonepeMerchantName = publicSettings?.phonepeMerchantName || 'TrustySMM PhonePe';
  const phonepeVpa = publicSettings?.phonepeVpa || '8795005604@ybl';
  const phonepeQrUrl = publicSettings?.phonepeQrUrl || '';
  const phonepeInstructions = publicSettings?.phonepeInstructions || 'Enter ₹10 or more to generate dynamic PhonePe QR. Scan and submit 12-digit UTR below.';
  const phonepeStatus = publicSettings?.phonepeStatus !== 'disabled';

  // BharatPe Merchant Details from Backend / Admin Settings
  const bharatpeMerchantName = publicSettings?.bharatpeMerchantName || publicSettings?.allUpiMerchantName || 'TrustySMM';
  const bharatpeVpa = publicSettings?.bharatpeVpa || publicSettings?.allUpiVpa || 'BHARATPE2H0D0Q1Y4T29351@unitype';
  const bharatpeQrUrl = publicSettings?.bharatpeQrUrl || publicSettings?.allUpiQrUrl || '';

  // Fetch payments ledger for this user
  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/user/payments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [token]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const parsedAmount = parseFloat(amount);
  const isAmountValid = !isNaN(parsedAmount) && parsedAmount >= minDepositRequired;

  // Active VPA and Merchant based on selected method
  const activeVpa = selectedMethod === 'phonepe' ? phonepeVpa : bharatpeVpa;
  const activeMerchantName = selectedMethod === 'phonepe' ? phonepeMerchantName : bharatpeMerchantName;
  const activeAdminQr = selectedMethod === 'phonepe' ? phonepeQrUrl : bharatpeQrUrl;

  // Dynamic UPI Payload based on entered amount
  const dynamicUpiPayload = isAmountValid
    ? `upi://pay?pa=${encodeURIComponent(activeVpa)}&pn=${encodeURIComponent(activeMerchantName)}&am=${parsedAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`TrustySMM-Deposit-${user?.id || 'User'}`)}`
    : `upi://pay?pa=${encodeURIComponent(activeVpa)}&pn=${encodeURIComponent(activeMerchantName)}&cu=INR&tn=${encodeURIComponent(`TrustySMM-Deposit-${user?.id || 'User'}`)}`;

  // QR Code URL: Generated dynamically via QR Server API for exact amount
  const dynamicQrImageUrl = isAmountValid
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(dynamicUpiPayload)}`
    : '';

  // Display QR URL: Use admin custom upload if user toggled or if available and dynamic not requested
  const displayQrImageUrl = viewAdminQr && activeAdminQr
    ? activeAdminQr
    : (dynamicQrImageUrl || activeAdminQr);

  // Submit 12-digit UTR for Instant Verification & Wallet Credit
  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isAmountValid) {
      setErrorMsg('Please enter a valid deposit amount (minimum ₹10).');
      return;
    }

    const cleanUtr = utr.trim().replace(/\D/g, '');
    if (cleanUtr.length !== 12) {
      setErrorMsg('Invalid UTR format. Bank Reference Number (UTR) must be exactly 12 digits from your PhonePe/UPI payment receipt.');
      return;
    }

    // Anti-fake checks
    const isRepeated = /^(\d)\1{11}$/.test(cleanUtr);
    const isSequential = '01234567890123456789'.includes(cleanUtr) || '98765432109876543210'.includes(cleanUtr);
    if (isRepeated || isSequential) {
      setErrorMsg('Fake or dummy UTR detected. Please enter your genuine 12-digit UPI bank reference number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/user/deposit/submit-utr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          utr: cleanUtr,
          amount: parsedAmount,
          paymentMethod: selectedMethod === 'phonepe' ? 'PhonePe QR' : 'BharatPe UPI QR',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Payment could not be verified. Please check your 12-digit UTR and try again.');
      } else {
        const addedAmount = data.amount ? `₹${data.amount}` : `₹${parsedAmount}`;
        setSuccessMsg(data.message || `✓ Payment Verified! ${addedAmount} added to your wallet balance.`);
        setErrorMsg('');
        setUtr('');
        onRefreshProfile();
        fetchPayments();
      }
    } catch (err) {
      setErrorMsg('Network error while verifying UTR. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickAmounts = [10, 50, 100, 250, 500, 1000, 2000];

  return (
    <div className="w-full max-w-5xl mx-auto pb-12 space-y-6 sm:space-y-8 min-w-0 animate-in fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-purple-600/25 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'} tracking-tight`}>
                Add Funds
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-black uppercase tracking-wider">
                Instant UPI
              </span>
            </div>
            <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>
              Generate dynamic PhonePe QR code (Min ₹10) & verify instantly with 12-digit UTR
            </p>
          </div>
        </div>

        {/* Current Balance Card */}
        <div className={`px-4 py-2.5 rounded-2xl border flex items-center space-x-3 ${
          isDarkMode ? 'bg-[#15181E] border-[#272B33]' : 'bg-white border-gray-200'
        } shadow-xs`}>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Your Balance:</span>
          <span className="font-mono font-black text-emerald-400 text-lg">
            {formatAmount(user?.balance || 0)}
          </span>
        </div>
      </div>

      {/* Payment Method Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {/* PhonePe QR Tab */}
        <button
          type="button"
          onClick={() => {
            setSelectedMethod('phonepe');
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
            selectedMethod === 'phonepe'
              ? 'bg-gradient-to-r from-purple-950/40 to-indigo-950/30 border-purple-500 ring-2 ring-purple-500/30 shadow-lg shadow-purple-600/15'
              : isDarkMode
              ? 'bg-[#15181E] border-[#272B33] hover:border-gray-700'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedMethod === 'phonepe'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                : 'bg-purple-500/10 text-purple-400'
            }`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {publicSettings?.phonepeTitle || 'PhonePe QR'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase">
                  Fast
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Dynamic QR for ₹10+ · Instant automated 12-digit UTR credit
              </p>
            </div>
          </div>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            selectedMethod === 'phonepe' ? 'border-purple-500 bg-purple-500' : 'border-gray-500'
          }`}>
            {selectedMethod === 'phonepe' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
        </button>

        {/* BharatPe / All UPI Tab */}
        <button
          type="button"
          onClick={() => {
            setSelectedMethod('bharatpe');
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
            selectedMethod === 'bharatpe'
              ? 'bg-gradient-to-r from-teal-950/40 to-emerald-950/30 border-teal-500 ring-2 ring-teal-500/30 shadow-lg shadow-teal-600/15'
              : isDarkMode
              ? 'bg-[#15181E] border-[#272B33] hover:border-gray-700'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedMethod === 'bharatpe'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/40'
                : 'bg-teal-500/10 text-teal-400'
            }`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  BharatPe Gateway
                </span>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[9px] font-black uppercase">
                  All UPI
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Scan with GPay, Paytm, BHIM, Cred or any bank app
              </p>
            </div>
          </div>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            selectedMethod === 'bharatpe' ? 'border-teal-500 bg-teal-500' : 'border-gray-500'
          }`}>
            {selectedMethod === 'bharatpe' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
        </button>
      </div>

      {/* Main Payment Section: Step 1 Amount -> Dynamic QR Generated -> Step 2 UTR Beneath QR */}
      <div className="space-y-6">

        {/* STEP 1: Enter Deposit Amount (Minimum ₹10) */}
        <div className={`${isDarkMode ? 'bg-[#15181E] border-[#272B33]' : 'bg-white border-gray-200'} rounded-3xl p-5 sm:p-7 border shadow-xs space-y-4`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${
                selectedMethod === 'phonepe' ? 'bg-purple-600' : 'bg-teal-600'
              }`}>
                1
              </span>
              <h2 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Enter Deposit Amount
              </h2>
            </div>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              Minimum ₹10
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-6 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-black text-gray-400 text-xl pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                min="10"
                step="any"
                required
                placeholder="Enter ₹10 or more"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full pl-10 pr-4 py-4 rounded-2xl font-mono font-black text-2xl focus:outline-none transition-all box-border ${
                  isDarkMode
                    ? 'bg-[#191C22] border border-[#272B33] text-white placeholder-gray-600'
                    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
                } ${
                  selectedMethod === 'phonepe' ? 'focus:border-purple-500' : 'focus:border-teal-500'
                }`}
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="md:col-span-6 flex flex-wrap gap-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q.toString())}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                    amount === q.toString()
                      ? selectedMethod === 'phonepe'
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                        : 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                      : isDarkMode
                      ? 'bg-[#191C22] border border-[#272B33] text-gray-300 hover:border-gray-600'
                      : 'bg-gray-100 border border-gray-200 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  ₹{q}
                </button>
              ))}
            </div>
          </div>

          {/* Validation Notice */}
          {!isAmountValid && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center space-x-2 animate-in fade-in">
              <Info className="w-4 h-4 shrink-0" />
              <span>Please enter an amount of <strong>₹10 or more</strong> to generate your dynamic payment QR code.</span>
            </div>
          )}
        </div>

        {/* STEP 2: GENERATED QR CODE & UTR VERIFICATION UNDERNEATH */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Dynamic QR Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className={`${isDarkMode ? 'bg-[#15181E] border-[#272B33]' : 'bg-white border-gray-200'} rounded-3xl p-6 border shadow-xs space-y-4`}>
              
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${
                  selectedMethod === 'phonepe'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                }`}>
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{selectedMethod === 'phonepe' ? 'PhonePe Dynamic QR' : 'BharatPe QR'}</span>
                </span>
                
                {isAmountValid && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>QR Generated</span>
                  </span>
                )}
              </div>

              {/* QR Display Area */}
              <div className="flex flex-col items-center justify-center pt-2">
                {isAmountValid ? (
                  <div className="space-y-3 w-full flex flex-col items-center">
                    <div className={`p-4 rounded-3xl bg-white shadow-2xl border-2 shrink-0 ${
                      selectedMethod === 'phonepe' ? 'border-purple-500/40' : 'border-teal-500/40'
                    }`}>
                      <img
                        src={displayQrImageUrl}
                        alt="Dynamic UPI QR Code"
                        className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Exact Amount Tag */}
                    <div className="text-center w-full">
                      <span className={`text-xs font-mono font-black px-4 py-1.5 rounded-xl text-white shadow-md inline-block max-w-full truncate ${
                        selectedMethod === 'phonepe'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                          : 'bg-gradient-to-r from-teal-600 to-emerald-600'
                      }`}>
                        Pay Exact ₹{parsedAmount.toFixed(2)} via {selectedMethod === 'phonepe' ? 'PhonePe' : 'UPI'}
                      </span>
                    </div>

                    {/* Option to toggle admin's uploaded PhonePe QR if available */}
                    {activeAdminQr && (
                      <button
                        type="button"
                        onClick={() => setViewAdminQr(!viewAdminQr)}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold underline cursor-pointer transition-colors pt-1"
                      >
                        {viewAdminQr ? 'Switch to Auto Amount QR' : 'View Admin Uploaded PhonePe QR Image'}
                      </button>
                    )}
                  </div>
                ) : (
                  /* Placeholder when amount < 10 */
                  <div className="w-full py-12 px-4 rounded-3xl border-2 border-dashed border-gray-700/50 flex flex-col items-center justify-center text-center space-y-3">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                      isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Lock className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        QR Code Locked
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-[220px]">
                        Enter <strong>₹10 or more</strong> in Step 1 above to generate your PhonePe payment QR.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Merchant Details Box */}
              <div className={`p-4 rounded-2xl border space-y-2 text-xs ${
                isDarkMode ? 'bg-[#191C22] border-[#272B33]' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-semibold">Merchant:</span>
                  <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>
                    {activeMerchantName}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-gray-400 font-semibold shrink-0">UPI ID / VPA:</span>
                  <div className="flex items-center space-x-1.5 min-w-0 max-w-full">
                    <span className="font-mono text-purple-400 font-bold truncate max-w-[170px] sm:max-w-none text-[11px]">
                      {activeVpa}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeVpa, 'vpa')}
                      className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-[10px] cursor-pointer shrink-0 transition-colors"
                      title="Copy UPI VPA"
                    >
                      {copiedText === 'vpa' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Direct App Deep Link */}
              {isAmountValid && (
                <a
                  href={dynamicUpiPayload}
                  className={`w-full py-3 px-4 rounded-2xl text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg transition-all text-center cursor-pointer ${
                    selectedMethod === 'phonepe'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/25'
                      : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-teal-600/25'
                  }`}
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>
                    Pay ₹{parsedAmount.toFixed(2)} on {selectedMethod === 'phonepe' ? 'PhonePe App' : 'UPI App'}
                  </span>
                </a>
              )}

            </div>
          </div>

          {/* Right: STEP 2 - SUBMIT 12-DIGIT UTR UNDER THE QR ("qr ke niche utr daal ke verify kreh") */}
          <div className="lg:col-span-7 space-y-4">
            <div className={`${isDarkMode ? 'bg-[#15181E] border-[#272B33]' : 'bg-white border-gray-200'} rounded-3xl p-6 sm:p-7 border shadow-xs space-y-5`}>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${
                    selectedMethod === 'phonepe' ? 'bg-purple-600' : 'bg-teal-600'
                  }`}>
                    2
                  </span>
                  <h2 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Enter 12-Digit UTR to Verify
                  </h2>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  Instant Wallet Credit
                </span>
              </div>

              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Payment complete hone ke baad PhonePe / UPI receipt me se <strong>12-digit UTR (UPI Ref No.)</strong> yahan enter karein aur verify button dabayein.
              </p>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start space-x-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="min-w-0 flex-1 font-semibold leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {/* Success Message */}
              {successMsg && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start space-x-2.5 animate-in fade-in">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-bold min-w-0 flex-1 leading-relaxed">{successMsg}</span>
                </div>
              )}

              {/* UTR Form */}
              <form onSubmit={handleVerifyPayment} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className={`block text-[11px] font-black uppercase tracking-wider ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      12-Digit UPI Reference Number (UTR)
                    </label>
                    <span className={`text-[10px] font-mono font-bold ${
                      utr.length === 12 ? 'text-emerald-400' : 'text-gray-500'
                    }`}>
                      {utr.length}/12 Digits
                    </span>
                  </div>

                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="e.g. 528491038291"
                    value={utr}
                    onChange={(e) => setUtr(e.target.value.replace(/\D/g, ''))}
                    className={`w-full px-4 py-4 rounded-2xl font-mono font-black text-xl tracking-widest focus:outline-none transition-all box-border ${
                      isDarkMode
                        ? 'bg-[#191C22] border border-[#272B33] text-white placeholder-gray-600'
                        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
                    } ${
                      selectedMethod === 'phonepe' ? 'focus:border-purple-500' : 'focus:border-teal-500'
                    }`}
                  />
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Find this on your payment receipt labeled as <strong>"UPI Ref No."</strong>, <strong>"UTR"</strong>, or <strong>"Transaction ID"</strong>.
                  </p>
                </div>

                {/* Receipt Helper Visual Box */}
                <div className={`p-4 rounded-2xl border space-y-2 text-xs leading-relaxed ${
                  isDarkMode ? 'bg-[#191C22] border-[#272B33] text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}>
                  <div className="flex items-center space-x-2 font-bold text-purple-400 text-xs">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>How to verify your PhonePe payment:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-400">
                    <li>Scan the <strong>PhonePe QR code</strong> on the left using your PhonePe app.</li>
                    <li>Pay the exact amount: <strong>₹{isAmountValid ? parsedAmount.toFixed(2) : '10.00'}</strong>.</li>
                    <li>Copy the <strong>12-digit UTR / UPI Ref ID</strong> from the successful payment screen.</li>
                    <li>Paste the 12 digits above and click <strong>"Verify UTR & Add Funds"</strong>.</li>
                  </ol>
                </div>

                {/* Submit Verification Button */}
                <button
                  type="submit"
                  disabled={submitting || utr.length !== 12 || !isAmountValid}
                  className={`w-full py-4 px-4 rounded-2xl font-black text-sm text-white shadow-xl disabled:opacity-50 transition-all flex items-center justify-center space-x-2 cursor-pointer hover:scale-[1.01] active:scale-98 ${
                    selectedMethod === 'phonepe'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
                      : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-teal-600/30'
                  }`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>Verifying 12-Digit UTR...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Verify UTR & Add ₹{isAmountValid ? parsedAmount.toFixed(2) : '0'} to Wallet</span>
                    </>
                  )}
                </button>
              </form>

            </div>
          </div>

        </div>

      </div>

      {/* Deposit History & Status Ledger */}
      <div className={`${isDarkMode ? 'bg-[#15181E] border-[#272B33]' : 'bg-white border-gray-200'} rounded-3xl p-5 sm:p-7 border shadow-xs space-y-4 w-full min-w-0`}>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>
              Your Deposit History
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>
              Verified records of your PhonePe & UPI deposits and wallet credits
            </p>
          </div>
          <button
            onClick={fetchPayments}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
              isDarkMode ? 'bg-[#191C22] border-[#272B33] text-gray-300 hover:bg-[#272B33]' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
            }`}
            title="Refresh History"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto w-full max-w-full touch-scroll-x rounded-xl">
          <table className="w-full min-w-[520px] text-left border-collapse">
            <thead>
              <tr className={`border-b text-[11px] font-black uppercase tracking-wider ${
                isDarkMode ? 'border-[#272B33] text-gray-400 bg-[#191C22]' : 'border-gray-200 text-gray-600 bg-gray-50'
              }`}>
                <th className="px-4 py-3 rounded-l-xl">ID</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">12-Digit UTR</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right rounded-r-xl">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs font-semibold">
              {payments.length > 0 ? (
                payments.map((p) => (
                  <tr key={p.id} className={isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3.5 font-mono text-gray-500">#{p.id}</td>
                    <td className={`px-4 py-3.5 font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {p.paymentMethod || p.method || 'PhonePe QR'}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-purple-400">
                      {p.transactionId || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-400">
                      +{formatAmount(p.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center space-x-1 ${
                          p.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : p.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {p.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                        {p.status === 'pending' && <Clock className="w-3 h-3" />}
                        {p.status === 'failed' && <XCircle className="w-3 h-3" />}
                        <span>{p.status === 'completed' ? 'Verified' : p.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-gray-500">
                      {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500 text-xs">
                    No deposit transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
