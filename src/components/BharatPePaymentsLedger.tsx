import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Trash2,
  Copy,
  Check,
  Zap,
  TrendingUp,
  ShieldCheck,
  Ban,
  ArrowDownRight,
  Filter,
  QrCode,
  Upload,
  Save,
  Settings,
  ChevronDown,
  ChevronUp,
  Smartphone,
  ExternalLink,
  Sparkles,
  Lock,
  Eye
} from 'lucide-react';

interface BharatPePaymentsLedgerProps {
  token: string;
  adminTheme: 'dark' | 'light' | 'espresso';
  formatCurrency: (val: number) => string;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  onRefreshStats?: () => void;
}

export const BharatPePaymentsLedger: React.FC<BharatPePaymentsLedgerProps> = ({
  token,
  adminTheme,
  formatCurrency,
  showSuccess,
  showError,
  onRefreshStats,
}) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed' | 'cancelled'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string>('');
  const [removingToday, setRemovingToday] = useState(false);

  // BharatPe QR & Gateway Configuration State
  const [showQrConfig, setShowQrConfig] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testAmount, setTestAmount] = useState('100');
  const [qrSettings, setQrSettings] = useState({
    bharatpeVpa: 'BHARATPE2H0D0Q1Y4T29351@unitype',
    bharatpeMerchantName: 'TrustySMM',
    bharatpeQrUrl: '',
    bharatpeMerchantId: '64225077',
    bharatpeToken: '',
    bharatpeStatus: 'enabled',
    minDeposit: '10',
    bharatpeInstructions: 'Enter amount (min ₹10) to generate dynamic BharatPe QR. Scan with any UPI app and enter 12-digit UTR below.'
  });

  // Fetch admin settings to populate BharatPe QR fields
  const fetchSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQrSettings(prev => ({
          ...prev,
          bharatpeVpa: data.bharatpeVpa || data.allUpiVpa || prev.bharatpeVpa,
          bharatpeMerchantName: data.bharatpeMerchantName || data.allUpiMerchantName || prev.bharatpeMerchantName,
          bharatpeQrUrl: data.bharatpeQrUrl || data.allUpiQrUrl || '',
          bharatpeMerchantId: data.bharatpeMerchantId || prev.bharatpeMerchantId,
          bharatpeToken: data.bharatpeToken || '',
          bharatpeStatus: data.bharatpeStatus || 'enabled',
          minDeposit: data.minDeposit || prev.minDeposit,
          bharatpeInstructions: data.bharatpeInstructions || prev.bharatpeInstructions
        }));
      }
    } catch (err) {
      console.error('Error fetching BharatPe settings:', err);
    }
  };

  const handleSaveQrSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bharatpeVpa: qrSettings.bharatpeVpa,
          bharatpeMerchantName: qrSettings.bharatpeMerchantName,
          bharatpeQrUrl: qrSettings.bharatpeQrUrl,
          bharatpeMerchantId: qrSettings.bharatpeMerchantId,
          bharatpeToken: qrSettings.bharatpeToken,
          bharatpeStatus: qrSettings.bharatpeStatus,
          minDeposit: qrSettings.minDeposit,
          bharatpeInstructions: qrSettings.bharatpeInstructions,
          allUpiVpa: qrSettings.bharatpeVpa,
          allUpiMerchantName: qrSettings.bharatpeMerchantName,
          allUpiQrUrl: qrSettings.bharatpeQrUrl,
          allUpiStatus: qrSettings.bharatpeStatus,
        }),
      });
      if (res.ok) {
        showSuccess('✓ BharatPe QR & Gateway settings saved successfully!');
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to save BharatPe settings.');
      }
    } catch (err) {
      showError('Network error while saving settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showError('QR Code image must be less than 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setQrSettings(prev => ({ ...prev, bharatpeQrUrl: reader.result as string }));
        showSuccess('QR image loaded! Click "Save BharatPe Settings" to persist.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Dynamic preview payload
  const previewAmount = parseFloat(testAmount) || 100;
  const previewUpiPayload = `upi://pay?pa=${encodeURIComponent(qrSettings.bharatpeVpa)}&pn=${encodeURIComponent(qrSettings.bharatpeMerchantName)}&am=${previewAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('TrustySMM-Deposit-Test')}`;
  const dynamicPreviewQr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(previewUpiPayload)}`;
  const displayPreviewQr = qrSettings.bharatpeQrUrl || dynamicPreviewQr;

  const fetchPayments = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(Array.isArray(data) ? data : []);
      } else {
        showError('Failed to load BharatPe payment records.');
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      showError('Network error while retrieving payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchSettings();
  }, [token]);

  const handleCopyUtr = (utr: string) => {
    if (!utr) return;
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(''), 2000);
  };

  const handleUpdateStatus = async (paymentId: number, targetStatus: string) => {
    setUpdatingId(paymentId);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(data.message || `Payment #${paymentId} updated to ${targetStatus}`);
        setPayments(prev =>
          prev.map(p => (p.id === paymentId ? { ...p, status: data.status || targetStatus } : p))
        );
        if (onRefreshStats) onRefreshStats();
      } else {
        showError(data.error || 'Failed to update payment status');
      }
    } catch (err) {
      showError('Network error updating payment status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm(`Are you sure you want to delete BharatPe payment record #${paymentId}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(data.message || `Payment #${paymentId} removed`);
        setPayments(prev => prev.filter(p => p.id !== paymentId));
        if (onRefreshStats) onRefreshStats();
      } else {
        showError(data.error || 'Failed to delete payment record');
      }
    } catch (err) {
      showError('Network error deleting payment');
    }
  };

  const handleRemoveTodayPayments = async () => {
    const confirmation = window.prompt(
      'Type "REMOVE TODAY" to confirm deleting all payments added today and deducting their funds from user wallets:'
    );
    if (confirmation !== 'REMOVE TODAY') {
      if (confirmation !== null) showError('Action cancelled: Confirmation text did not match.');
      return;
    }

    setRemovingToday(true);
    try {
      const res = await fetch('/api/admin/payments/remove-today-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(data.message || "Successfully removed today's payments and deducted wallet funds.");
        fetchPayments();
        if (onRefreshStats) onRefreshStats();
      } else {
        showError(data.error || "Failed to remove today's payments.");
      }
    } catch (err) {
      showError('Network error while removing payments.');
    } finally {
      setRemovingToday(false);
    }
  };

  // Filter & Search Logic
  const filteredPayments = payments.filter(p => {
    const status = (p.status || 'pending').toLowerCase();
    const matchesFilter =
      statusFilter === 'all'
        ? true
        : statusFilter === 'completed'
        ? status === 'completed' || status === 'success'
        : status === statusFilter;

    if (!matchesFilter) return false;

    if (!search.trim()) return true;
    const query = search.toLowerCase();
    const utr = String(p.transactionId || '').toLowerCase();
    const userEmail = String(p.userEmail || '').toLowerCase();
    const userName = String(p.userName || '').toLowerCase();
    const id = String(p.id || '');
    const amountStr = String(p.amount || '');

    return utr.includes(query) || userEmail.includes(query) || userName.includes(query) || id.includes(query) || amountStr.includes(query);
  });

  // Analytics Metrics
  const totalVolume = payments
    .filter(p => p.status === 'completed' || p.status === 'success')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const successCount = payments.filter(p => p.status === 'completed' || p.status === 'success').length;
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const failedCount = payments.filter(p => p.status === 'failed').length;
  const cancelledCount = payments.filter(p => p.status === 'cancelled').length;

  const cardBg =
    adminTheme === 'espresso'
      ? 'bg-[#1e1915] border-[#382d25]'
      : adminTheme === 'light'
      ? 'bg-white border-gray-200'
      : 'bg-[#15181E] border-[#272B33]';

  const subCardBg =
    adminTheme === 'espresso'
      ? 'bg-[#181411] border-[#382d25]'
      : adminTheme === 'light'
      ? 'bg-gray-50 border-gray-200'
      : 'bg-[#0f1216] border-[#272B33]';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className={`${cardBg} p-5 sm:p-6 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/30 shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-1">
              <h2 className={`text-lg sm:text-xl font-black ${adminTheme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tight`}>
                BharatPe Payments Ledger
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Exclusive Gateway
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                MID: 64225077
              </span>
            </div>
            <p className={`text-xs ${adminTheme === 'light' ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>
              Real-time audit log of all BharatPe UPI transactions, UTR numbers, and wallet reconciliations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowQrConfig(!showQrConfig)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-teal-600/20 active:scale-95"
            title="Configure BharatPe QR Code & Merchant details"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{showQrConfig ? 'Hide QR Settings' : 'Configure BharatPe QR'}</span>
            {showQrConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleRemoveTodayPayments}
            disabled={removingToday}
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Deducts funds added today from user wallets and deletes today's records"
          >
            {removingToday ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Remove Today's Payments</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchPayments();
              fetchSettings();
            }}
            disabled={loading}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              adminTheme === 'light'
                ? 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200'
            }`}
            title="Refresh Ledger & Settings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* BHARATPE QR CONFIGURATION & LIVE SIMULATOR (DEDICATED PANEL)   */}
      {/* ============================================================== */}
      {showQrConfig && (
        <div className={`${cardBg} p-5 sm:p-7 rounded-2xl border-2 border-teal-500/30 shadow-xl space-y-6 animate-in fade-in duration-200`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-tr from-teal-600 to-emerald-600 text-white rounded-xl shadow-lg shadow-teal-600/30">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className={`text-base font-black ${adminTheme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    BharatPe QR & UPI Gateway Configuration
                  </h3>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    qrSettings.bharatpeStatus === 'enabled'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {qrSettings.bharatpeStatus === 'enabled' ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className={`text-xs ${adminTheme === 'light' ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>
                  Manage BharatPe QR image, UPI VPA ID, Merchant name, and instant dynamic QR generation
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => setQrSettings(prev => ({
                  ...prev,
                  bharatpeStatus: prev.bharatpeStatus === 'enabled' ? 'disabled' : 'enabled'
                }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  qrSettings.bharatpeStatus === 'enabled'
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                {qrSettings.bharatpeStatus === 'enabled' ? '✓ Gateway Active' : 'Gateway Disabled (Click to Enable)'}
              </button>

              <button
                type="button"
                onClick={handleSaveQrSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-teal-600/30 disabled:opacity-50"
              >
                {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savingSettings ? 'Saving...' : 'Save BharatPe Settings'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Controls */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BharatPe UPI ID (VPA) */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    BharatPe UPI ID / VPA <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BHARATPE2H0D0Q1Y4T29351@unitype or bharatpe.98xxxxxx@fbpe"
                    value={qrSettings.bharatpeVpa}
                    onChange={e => setQrSettings({ ...qrSettings, bharatpeVpa: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-semibold focus:outline-none focus:border-teal-500 transition-colors ${
                      adminTheme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-[#0f1216] border-white/10 text-white'
                    }`}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Users will send payments to this UPI address</p>
                </div>

                {/* BharatPe Merchant Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Merchant / Business Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TrustySMM"
                    value={qrSettings.bharatpeMerchantName}
                    onChange={e => setQrSettings({ ...qrSettings, bharatpeMerchantName: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:border-teal-500 transition-colors ${
                      adminTheme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-[#0f1216] border-white/10 text-white'
                    }`}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Displayed in user's UPI app (GPay/PhonePe/Paytm)</p>
                </div>

                {/* Minimum Deposit */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Minimum Deposit Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="10"
                    value={qrSettings.minDeposit}
                    onChange={e => setQrSettings({ ...qrSettings, minDeposit: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-semibold focus:outline-none focus:border-teal-500 transition-colors ${
                      adminTheme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-[#0f1216] border-white/10 text-white'
                    }`}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Minimum amount required to generate dynamic QR (Default: ₹10)</p>
                </div>

                {/* BharatPe Merchant ID */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    BharatPe Merchant ID (MID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 64225077"
                    value={qrSettings.bharatpeMerchantId}
                    onChange={e => setQrSettings({ ...qrSettings, bharatpeMerchantId: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-semibold focus:outline-none focus:border-teal-500 transition-colors ${
                      adminTheme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-[#0f1216] border-white/10 text-white'
                    }`}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Your registered BharatPe merchant account number</p>
                </div>
              </div>

              {/* Upload QR Image File or Enter URL */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide">
                  BharatPe QR Code Image (Upload File or Enter Image URL)
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    placeholder="https://example.com/bharatpe-qr.jpg or upload from device"
                    value={qrSettings.bharatpeQrUrl}
                    onChange={e => setQrSettings({ ...qrSettings, bharatpeQrUrl: e.target.value })}
                    className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:border-teal-500 transition-colors ${
                      adminTheme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-[#0f1216] border-white/10 text-white'
                    }`}
                  />
                  <label className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-teal-600/20 transition-all shrink-0">
                    <Upload className="w-4 h-4" />
                    <span>Upload QR Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleQrUpload}
                    />
                  </label>
                  {qrSettings.bharatpeQrUrl && (
                    <button
                      type="button"
                      onClick={() => setQrSettings({ ...qrSettings, bharatpeQrUrl: '' })}
                      className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
                      title="Clear custom QR and use dynamic generator"
                    >
                      Clear Image
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-teal-400/90 font-medium">
                  💡 Tip: If you leave the QR Image blank, the system automatically creates a clean, official dynamic QR code embedding the user's entered deposit amount!
                </p>
              </div>

              {/* User Instructions Text */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Deposit Instructions Displayed to Users
                </label>
                <input
                  type="text"
                  placeholder="Enter ₹10 or more to generate dynamic BharatPe QR. Scan and submit 12-digit UTR below."
                  value={qrSettings.bharatpeInstructions}
                  onChange={e => setQrSettings({ ...qrSettings, bharatpeInstructions: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:border-teal-500 transition-colors ${
                    adminTheme === 'light'
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-[#0f1216] border-white/10 text-white'
                  }`}
                />
              </div>
            </div>

            {/* Right Column: Live Dynamic QR Simulator & Preview */}
            <div className={`lg:col-span-5 p-5 rounded-2xl border ${subCardBg} flex flex-col items-center justify-center space-y-4 text-center`}>
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Live User View Simulator</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20">
                  {qrSettings.bharatpeQrUrl ? 'Static Upload' : 'Dynamic UPI QR'}
                </span>
              </div>

              {/* Interactive Test Amount Selector */}
              <div className="w-full space-y-1.5 text-left">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Test Deposit Amount:</span>
                <div className="flex items-center space-x-2">
                  {['10', '50', '100', '500'].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTestAmount(amt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        testAmount === amt
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* QR Image Display */}
              <div className="p-3.5 rounded-2xl bg-white shadow-2xl border-2 border-teal-500/30 shrink-0">
                <img
                  src={displayPreviewQr}
                  alt="BharatPe QR Preview"
                  className="w-44 h-44 object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Amount Tag */}
              <div className="w-full">
                <span className="text-xs font-mono font-black px-3 py-1 rounded-lg bg-teal-600/20 text-teal-300 border border-teal-500/30 inline-block">
                  Pay Exact ₹{previewAmount.toFixed(2)} to {qrSettings.bharatpeMerchantName}
                </span>
                <div className="mt-2 text-[10px] font-mono text-gray-500 truncate max-w-xs mx-auto">
                  {previewUpiPayload}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Verified Volume */}
        <div className={`${cardBg} p-4 rounded-2xl border shadow-xs flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Total Volume</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono font-black text-xl sm:text-2xl text-emerald-400">
            {formatCurrency(totalVolume)}
          </div>
          <span className="text-[10px] text-gray-500 mt-1 font-semibold">From successful deposits</span>
        </div>

        {/* Success */}
        <div className={`${cardBg} p-4 rounded-2xl border shadow-xs flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            <span>Success</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono font-black text-xl sm:text-2xl text-emerald-400">
            {successCount}
          </div>
          <span className="text-[10px] text-gray-500 mt-1 font-semibold">Credited to wallet</span>
        </div>

        {/* Pending */}
        <div className={`${cardBg} p-4 rounded-2xl border shadow-xs flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 uppercase tracking-wider">
            <span>Pending</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono font-black text-xl sm:text-2xl text-amber-400">
            {pendingCount}
          </div>
          <span className="text-[10px] text-gray-500 mt-1 font-semibold">Awaiting confirmation</span>
        </div>

        {/* Failed */}
        <div className={`${cardBg} p-4 rounded-2xl border shadow-xs flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-[11px] font-bold text-red-400 uppercase tracking-wider">
            <span>Failed</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-2 font-mono font-black text-xl sm:text-2xl text-red-400">
            {failedCount}
          </div>
          <span className="text-[10px] text-gray-500 mt-1 font-semibold">Verification failed</span>
        </div>

        {/* Cancelled */}
        <div className={`${cardBg} p-4 rounded-2xl border shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1`}>
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Cancelled</span>
            <Ban className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-2 font-mono font-black text-xl sm:text-2xl text-gray-400">
            {cancelledCount}
          </div>
          <span className="text-[10px] text-gray-500 mt-1 font-semibold">Voided or expired</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={`${cardBg} p-4 rounded-2xl border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3`}>
        {/* Status Pill Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 touch-scroll-x">
          {(
            [
              { id: 'all', label: 'All', count: payments.length },
              { id: 'completed', label: 'Success', count: successCount },
              { id: 'pending', label: 'Pending', count: pendingCount },
              { id: 'failed', label: 'Failed', count: failedCount },
              { id: 'cancelled', label: 'Cancelled', count: cancelledCount },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                statusFilter === tab.id
                  ? 'bg-teal-600 text-white shadow-md'
                  : adminTheme === 'light'
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by UTR, User, or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-semibold focus:outline-none transition-all ${
              adminTheme === 'light'
                ? 'bg-gray-50 border border-gray-200 focus:border-teal-600 text-gray-900'
                : 'bg-white/5 border border-white/10 focus:border-teal-500 text-white'
            }`}
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className={`${cardBg} rounded-2xl border shadow-xs overflow-hidden`}>
        <div className="overflow-x-auto w-full touch-scroll-x">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className={`border-b text-[11px] font-black uppercase tracking-wider ${
                adminTheme === 'light'
                  ? 'bg-gray-50 text-gray-600 border-gray-200'
                  : 'bg-white/[0.02] text-gray-400 border-white/5'
              }`}>
                <th className="py-3.5 px-4">Txn ID</th>
                <th className="py-3.5 px-4">User Details</th>
                <th className="py-3.5 px-4">12-Digit UTR / Ref</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-center">Current Status</th>
                <th className="py-3.5 px-4 text-right">Created At</th>
                <th className="py-3.5 px-4 text-center">Update Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium">
              {filteredPayments.length > 0 ? (
                filteredPayments.map(p => {
                  const normalizedStatus = (p.status || 'pending').toLowerCase();
                  const isCompleted = normalizedStatus === 'completed' || normalizedStatus === 'success';
                  const isPending = normalizedStatus === 'pending';
                  const isFailed = normalizedStatus === 'failed';
                  const isCancelled = normalizedStatus === 'cancelled';

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        adminTheme === 'light' ? 'hover:bg-gray-50/80' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Payment ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-400">
                        #{p.id}
                      </td>

                      {/* User Details */}
                      <td className="py-3.5 px-4">
                        <div className={`font-bold ${adminTheme === 'light' ? 'text-gray-900' : 'text-white'} truncate max-w-[180px]`}>
                          {p.userName || 'Customer'}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate max-w-[180px] font-mono">
                          {p.userEmail || `User #${p.userId}`}
                        </div>
                      </td>

                      {/* 12-Digit UTR with Copy */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-teal-400 select-all">
                            {p.transactionId || '-'}
                          </span>
                          {p.transactionId && (
                            <button
                              type="button"
                              onClick={() => handleCopyUtr(p.transactionId)}
                              className="p-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors cursor-pointer"
                              title="Copy UTR"
                            >
                              {copiedUtr === p.transactionId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">
                          {p.paymentMethod || 'BharatPe UPI'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-emerald-400">
                        +{formatCurrency(Number(p.amount) || 0)}
                      </td>

                      {/* Current Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isPending
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : isFailed
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}
                        >
                          {isCompleted && <CheckCircle className="w-3 h-3" />}
                          {isPending && <Clock className="w-3 h-3" />}
                          {isFailed && <XCircle className="w-3 h-3" />}
                          {isCancelled && <Ban className="w-3 h-3" />}
                          <span>{isCompleted ? 'Success' : normalizedStatus}</span>
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-right font-mono text-[11px] text-gray-400 whitespace-nowrap">
                        {p.createdAt
                          ? `${new Date(p.createdAt).toLocaleDateString()} ${new Date(p.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : '-'}
                      </td>

                      {/* Status Change Selector & 1-Click Fast Approval */}
                      <td className="py-3.5 px-4 text-center">
                        {isPending ? (
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              disabled={updatingId === p.id}
                              onClick={() => handleUpdateStatus(p.id, 'completed')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50 active:scale-95"
                              title="Approve deposit and credit user wallet"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === p.id}
                              onClick={() => handleUpdateStatus(p.id, 'failed')}
                              className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[11px] transition-all flex items-center space-x-0.5 cursor-pointer disabled:opacity-50"
                              title="Reject payment"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <select
                            disabled={updatingId === p.id}
                            value={isCompleted ? 'completed' : normalizedStatus}
                            onChange={e => handleUpdateStatus(p.id, e.target.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              isCompleted
                                ? 'bg-emerald-950/30 text-emerald-300 border-emerald-500/30'
                                : isPending
                                ? 'bg-amber-950/30 text-amber-300 border-amber-500/30'
                                : isFailed
                                ? 'bg-red-950/30 text-red-300 border-red-500/30'
                                : 'bg-gray-900 text-gray-300 border-white/10'
                            }`}
                          >
                            <option value="pending" className="bg-[#15181E] text-amber-400">
                              Pending
                            </option>
                            <option value="completed" className="bg-[#15181E] text-emerald-400">
                              Success (Credit)
                            </option>
                            <option value="failed" className="bg-[#15181E] text-red-400">
                              Failed
                            </option>
                            <option value="cancelled" className="bg-[#15181E] text-gray-400">
                              Cancelled
                            </option>
                          </select>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete payment record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 text-xs font-medium">
                    {loading ? 'Fetching BharatPe payment records...' : 'No BharatPe payments match the selected criteria.'}
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
