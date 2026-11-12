import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  PlusCircle,
  List,
  Package,
  RotateCcw,
  Wallet,
  Ticket,
  Users,
  FileCode,
  Globe,
  HelpCircle,
  Phone,
  BookOpen,
  Info,
  LogOut,
  Bell,
  Search,
  Check,
  Copy,
  ChevronDown,
  User as UserIcon,
  FileText,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Gift,
  Award,
  Sparkles,
  Zap,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Music,
  Send,
  Smartphone,
  CreditCard,
  QrCode,
  Menu,
  Star,
  Settings,
  MessageSquare,
  Shield,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Plus,
  Headphones,
  DollarSign,
  Bot,
  Calendar,
  Database,
  Clock,
  Layers,
  Key,
} from 'lucide-react';
import { User, Category, Service, Order, Ticket as TicketType, Payment, Announcement } from '../types.ts';
import { AnimatedLogo } from './AnimatedLogo.tsx';
import { getCategoryIcon } from '../lib/icons.tsx';
import { ServiceCategoryIcon } from './ServiceCategoryIcon.tsx';
import {
  TikTokColorIcon,
  TikTokIcon,
  SpotifyIcon,
  TwitterXIcon,
  InstagramIcon,
  YouTubeIcon,
  TelegramIcon,
  FacebookIcon,
  WhatsAppIcon,
} from './BrandIcons.tsx';
import { AiChatBot } from './AiChatBot.tsx';
import { WhatsAppSupportButton } from './WhatsAppSupportButton.tsx';
import { AddFundsSection } from './AddFundsSection.tsx';
import { fetchPublicSettings, getApiUrl } from '../lib/api.ts';

interface UserDashboardProps {
  user: User;
  token: string;
  onLogout: () => void;
  onRefreshProfile: () => void;
  isAdmin: boolean;
  onToggleAdminView: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  user,
  token,
  onLogout,
  onRefreshProfile,
  isAdmin,
  onToggleAdminView,
}) => {
  const [activeTab, setActiveTab] = useState('new-order');
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);

  // Blogs & news
  const [blogs, setBlogs] = useState<any[]>([]);
  const [fetchingBlogs, setFetchingBlogs] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState<any | null>(null);

  // Public Settings from Admin
  const [publicSettings, setPublicSettings] = useState<any>({});

  // Theme State: Bold Red Dark Theme (Locked to TrustySMM branding matching Login Page)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  useEffect(() => {
    localStorage.setItem('user_theme_mode', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(true);
    localStorage.setItem('user_theme_mode', 'dark');
  };

  // Currency State (Supports INR, USD, EUR, PKR)
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR' | 'PKR'>(() => {
    const saved = localStorage.getItem('smm_currency');
    return (saved as 'INR' | 'USD' | 'EUR' | 'PKR') || 'INR';
  });

  const currencySymbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    PKR: '₨',
  };

  const currencyRates: Record<string, number> = {
    INR: 1.0,   // Base is INR (1.0)
    USD: Number(publicSettings.inrToUsdRate) || 0.012, // 1 INR ~ 0.012 USD
    EUR: Number(publicSettings.inrToEurRate) || 0.011, // 1 INR ~ 0.011 EUR
    PKR: Number(publicSettings.inrToPkrRate) || 3.32,  // 1 INR ~ 3.32 PKR
  };

  const changeCurrency = (curr: 'INR' | 'USD' | 'EUR' | 'PKR') => {
    setCurrency(curr);
    localStorage.setItem('smm_currency', curr);
    setCurrencyDropdownOpen(false);
  };

  const formatAmount = (val: number | string | undefined) => {
    const num = Number(val) || 0;
    const rate = currencyRates[currency] || 1.0;
    const converted = num * rate;
    const locale = currency === 'PKR' ? 'en-PK' : currency === 'INR' ? 'en-IN' : 'en-US';
    return `${currencySymbols[currency]} ${converted.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatAmountFourDecimals = (val: number | string | undefined) => {
    const num = Number(val) || 0;
    const rate = currencyRates[currency] || 1.0;
    const converted = num * rate;
    const locale = currency === 'PKR' ? 'en-PK' : currency === 'INR' ? 'en-IN' : 'en-US';
    return `${currencySymbols[currency]} ${converted.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  // Header Dropdowns & Modals
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPromoBanner, setShowPromoBanner] = useState(true);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTrackerModal, setShowTrackerModal] = useState(false);

  // Child Panels and Refill History
  const [childPanelsList, setChildPanelsList] = useState<any[]>([]);
  const [childPanelForm, setChildPanelForm] = useState({ domain: '', currency: 'INR', adminUsername: '', adminPassword: '' });
  const [orderingChildPanel, setOrderingChildPanel] = useState(false);
  const [refillRequestsList, setRefillRequestsList] = useState<any[]>([]);

  // Order History Filter & Search states
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [copiedOrderId, setCopiedOrderId] = useState<number | null>(null);
  const [copiedDetailsId, setCopiedDetailsId] = useState<number | null>(null);
  const [requestingRefill, setRequestingRefill] = useState<number | null>(null);

  // Order & UI Form States
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [newOrder, setNewOrder] = useState({ categoryId: '', serviceId: '', link: '', quantity: '', coupon: '' });
  const [orderServiceSearch, setOrderServiceSearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const categoryDropdownRef = React.useRef<HTMLDivElement>(null);
  const serviceDropdownRef = React.useRef<HTMLDivElement>(null);
  const quickSearchRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
        setIsServiceDropdownOpen(false);
      }
      if (quickSearchRef.current && !quickSearchRef.current.contains(event.target as Node)) {
        setIsQuickSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [massInput, setMassInput] = useState('');
  const [depositCurrency, setDepositCurrency] = useState<'INR' | 'USD'>('INR');
  const [addFunds, setAddFunds] = useState({ amount: '', method: 'UPI' });
  const [bharatpeUtr, setBharatpeUtr] = useState('');
  const [bharatpeAmount, setBharatpeAmount] = useState('');
  const [bharatpeActiveQr, setBharatpeActiveQr] = useState(false);
  const [bpDepositLoading, setBpDepositLoading] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Tickets
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [replyMessage, setReplyMessage] = useState('');

  // API Key & Custom Provider
  const [customProviderUrl, setCustomProviderUrl] = useState(user.customProviderUrl || '');
  const [customProviderKey, setCustomProviderKey] = useState(user.customProviderKey || '');
  const [updatingProvider, setUpdatingProvider] = useState(false);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedApiUrl, setCopiedApiUrl] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Search & Filter for Services Tab
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('All');

  // UI Feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState({ referralCode: '', earnings: 0, visits: 0 });

  // Public Settings Fetch
  useEffect(() => {
    fetchPublicSettings().then((data) => {
      if (data) setPublicSettings(data);
    });
  }, []);

  // Sync custom provider inputs
  useEffect(() => {
    setCustomProviderUrl(user.customProviderUrl || '');
    setCustomProviderKey(user.customProviderKey || '');
  }, [user]);

  // Initial Data Fetch
  useEffect(() => {
    fetchDashboardData();
  }, [token, activeTab]);

  const safeJson = async (res: Response) => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  };

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      if (activeTab === 'new-order' || activeTab === 'mass-order') {
        const [catRes, srvRes, annRes, favRes, ordRes] = await Promise.all([
          fetch('/api/user/categories', { headers }),
          fetch('/api/user/services', { headers }),
          fetch('/api/user/announcements', { headers }),
          fetch('/api/user/favorites', { headers }),
          fetch('/api/user/orders', { headers }),
        ]);

        if (catRes.ok) setCategories(await safeJson(catRes));
        if (srvRes.ok) setServices(await safeJson(srvRes));
        if (annRes.ok) setAnnouncements(await safeJson(annRes));
        if (favRes.ok) setFavorites(await safeJson(favRes));
        if (ordRes.ok) setOrders(await safeJson(ordRes));
      } else if (activeTab === 'orders') {
        const res = await fetch('/api/user/orders', { headers });
        if (res.ok) setOrders(await safeJson(res));
      } else if (activeTab === 'add-funds') {
        const res = await fetch('/api/user/payments', { headers });
        if (res.ok) setPayments(await safeJson(res));
      } else if (activeTab === 'tickets') {
        const res = await fetch('/api/user/tickets', { headers });
        if (res.ok) setTickets(await safeJson(res));
      } else if (activeTab === 'services') {
        const [catRes, srvRes, favRes] = await Promise.all([
          fetch('/api/user/categories', { headers }),
          fetch('/api/user/services', { headers }),
          fetch('/api/user/favorites', { headers }),
        ]);
        if (catRes.ok) setCategories(await safeJson(catRes));
        if (srvRes.ok) setServices(await safeJson(srvRes));
        if (favRes.ok) setFavorites(await safeJson(favRes));
      } else if (activeTab === 'affiliate') {
        const res = await fetch('/api/user/affiliate', { headers });
        if (res.ok) setAffiliateCode(await safeJson(res));
      } else if (activeTab === 'child-panels') {
        const res = await fetch('/api/user/child-panels', { headers });
        if (res.ok) setChildPanelsList(await safeJson(res));
      } else if (activeTab === 'refill-history') {
        const res = await fetch('/api/user/refill-requests', { headers });
        if (res.ok) setRefillRequestsList(await safeJson(res));
      } else if (activeTab === 'blogs') {
        fetchUserBlogs();
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  const fetchUserBlogs = async () => {
    setFetchingBlogs(true);
    try {
      const res = await fetch('/api/blogs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBlogs(await safeJson(res));
    } catch (err) {
      console.error('Failed to fetch blogs:', err);
    } finally {
      setFetchingBlogs(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  // Helper to calculate order metrics: percentage, speed, and counters
  const getOrderMetrics = (ord: Order) => {
    const quantity = Number(ord.quantity) || 1;
    const start = Number(ord.startCount) || 0;
    const remains = ord.remains !== undefined && ord.remains !== null ? Number(ord.remains) : 0;
    
    let percentage = 0;
    const normStatus = (ord.status || 'pending').toLowerCase();
    
    if (normStatus === 'completed') {
      percentage = 100;
    } else if (normStatus === 'cancelled' || normStatus === 'refunded') {
      percentage = 0;
    } else if (normStatus === 'pending') {
      percentage = 8;
    } else if (normStatus === 'processing' || normStatus === 'inprogress' || normStatus === 'in_progress') {
      if (remains > 0 && remains < quantity) {
        percentage = Math.min(99, Math.max(15, Math.round(((quantity - remains) / quantity) * 100)));
      } else {
        percentage = 65; // Active delivery speed
      }
    } else if (normStatus === 'partial') {
      percentage = Math.min(99, Math.max(0, Math.round(((quantity - remains) / quantity) * 100)));
    }

    // End count calculation
    let end = start;
    if (normStatus === 'completed') {
      end = start + quantity;
    } else if (remains < quantity) {
      end = start + (quantity - remains);
    } else {
      end = start;
    }

    // Speed extraction
    let speedText = 'Instant Speed (10k-50k/Day)';
    const serviceLower = (ord.serviceName || '').toLowerCase();
    const speedMatch = ord.serviceName?.match(/\(([^)]*(?:day|hour|hr|instant|speed|k\/d|k\/day)[^)]*)\)/i);
    if (speedMatch && speedMatch[1]) {
      speedText = speedMatch[1];
    } else if (serviceLower.includes('instant')) {
      speedText = '⚡ Instant Turbo (0-15 Min)';
    } else if (serviceLower.includes('100k')) {
      speedText = '⚡ 100k/Day Ultra Fast';
    } else if (serviceLower.includes('50k')) {
      speedText = '⚡ 50k/Day High Speed';
    } else if (serviceLower.includes('20k') || serviceLower.includes('10k')) {
      speedText = '⚡ 10k-20k/Day Fast';
    } else if (serviceLower.includes('drip') || serviceLower.includes('gradual')) {
      speedText = '💧 Drip-Feed Gradual';
    } else if (normStatus === 'completed') {
      speedText = '⚡ Instant High Speed';
    }

    return {
      percentage,
      start,
      end,
      remains,
      speedText,
      normStatus
    };
  };

  const copyOrderId = (id: number) => {
    navigator.clipboard.writeText(String(id));
    setCopiedOrderId(id);
    showSuccess(`Order ID #${id} copied!`);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const copyOrderDetails = (ord: Order) => {
    const text = `Order ID: #${ord.id}\nService: ${ord.serviceName || 'SMM Service'}\nLink: ${ord.link}\nQuantity: ${ord.quantity}\nCharge: ${formatAmount(ord.charge)}\nStatus: ${ord.status}\nDate: ${ord.createdAt}`;
    navigator.clipboard.writeText(text);
    setCopiedDetailsId(ord.id);
    showSuccess(`Order #${ord.id} details copied to clipboard!`);
    setTimeout(() => setCopiedDetailsId(null), 2000);
  };

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllOrders = (filtered: Order[]) => {
    if (selectedOrderIds.length === filtered.length && filtered.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filtered.map(o => o.id));
    }
  };

  const handleRequestRefill = async (orderId: number) => {
    try {
      setRequestingRefill(orderId);
      const res = await fetch(`/api/orders/${orderId}/refill`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('trustysmm_token') || localStorage.getItem('trustysmm_token') || ''}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || `Refill requested for Order #${orderId}`);
        fetchDashboardData();
      } else {
        showError(data.error || 'Failed to request refill.');
      }
    } catch (err: any) {
      showError(err.message || 'Error requesting refill');
    } finally {
      setRequestingRefill(null);
    }
  };

  // Greeting helper based on exact local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return { text: 'Good morning', emoji: '🌅' };
    if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '☀️' };
    if (hour >= 17 && hour < 22) return { text: 'Good evening', emoji: '🌆' };
    return { text: 'Good night', emoji: '🌙' };
  };

  // Place Order Handler
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.serviceId || !newOrder.link || !newOrder.quantity) {
      showError('Please select a service and provide a valid target link & quantity.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/orders/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceId: parseInt(newOrder.serviceId),
          link: newOrder.link,
          quantity: parseInt(newOrder.quantity),
          couponCode: newOrder.coupon,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || 'Order placed successfully!');
        setNewOrder({ categoryId: '', serviceId: '', link: '', quantity: '', coupon: '' });
        onRefreshProfile();
        fetchDashboardData();
      } else {
        showError(data.error || 'Failed to place order.');
      }
    } catch (err) {
      showError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Mass Order Handler
  const handleMassOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!massInput.trim()) {
      showError('Input cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/orders/mass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ massInput }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('Mass orders processed successfully!');
        setMassInput('');
        onRefreshProfile();
        fetchDashboardData();
      } else {
        showError(data.error || 'Failed to process mass orders.');
      }
    } catch (err) {
      showError('Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // Add Funds Handler
  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(addFunds.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showError('Please enter a valid deposit amount.');
      return;
    }
    const finalAmountDb = depositCurrency === 'INR' ? amountVal : (amountVal * 83.0);
    const finalMethodLabel = `${addFunds.method} (${depositCurrency})`;

    setLoading(true);
    try {
      const res = await fetch('/api/user/add-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: finalAmountDb,
          method: finalMethodLabel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || 'Deposit completed!');
        setAddFunds({ amount: '', method: 'UPI' });
        onRefreshProfile();
        fetchDashboardData();
      } else {
        showError(data.error || 'Payment transaction failed.');
      }
    } catch (err) {
      showError('Deposit failed.');
    } finally {
      setLoading(false);
    }
  };

  // BharatPe UPI QR Deposit
  const handleBharatpeDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(bharatpeAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showError('Please enter a valid deposit amount.');
      return;
    }
    const finalAmountDb = depositCurrency === 'INR' ? amountVal : (amountVal * 83.0);

    if (!bharatpeUtr || !/^\d{12}$/.test(bharatpeUtr)) {
      showError('Please enter a valid 12-digit UPI Transaction Ref (UTR).');
      return;
    }
    setBpDepositLoading(true);
    try {
      const res = await fetch('/api/user/add-funds-bharatpe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: finalAmountDb,
          utr: bharatpeUtr,
          paymentMethod: 'BharatPe UPI QR'
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || 'Deposit successful!');
        setBharatpeUtr('');
        setBharatpeAmount('');
        setBharatpeActiveQr(false);
        onRefreshProfile();
        fetchDashboardData();
      } else {
        showError(data.error || 'Failed to verify transaction.');
      }
    } catch (err) {
      showError('Failed to verify payment.');
    } finally {
      setBpDepositLoading(false);
    }
  };

  // Create Ticket Handler
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject || !ticketForm.message) {
      showError('Subject and Message are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tickets/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(ticketForm),
      });
      if (res.ok) {
        showSuccess('Support ticket created successfully!');
        setTicketForm({ subject: '', message: '' });
        fetchDashboardData();
      } else {
        showError('Failed to create ticket.');
      }
    } catch (err) {
      showError('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  // Generate API Key Handler
  const handleGenerateApiKey = async () => {
    setGeneratingApiKey(true);
    try {
      const res = await fetch('/api/user/generate-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('New API Key generated successfully!');
        onRefreshProfile();
      } else {
        showError(data.error || 'Failed to generate API Key.');
      }
    } catch (err) {
      showError('Error generating API Key.');
    } finally {
      setGeneratingApiKey(false);
    }
  };

  // Selected Category & Service calculation
  const selectedCategory = categories.find(c => String(c.id) === String(newOrder.categoryId));
  const selectedService = services.find(s => s.id === Number(newOrder.serviceId));
  const estimatedPrice = selectedService
    ? ((Number(newOrder.quantity) || 0) / 1000) * selectedService.pricePerThousand
    : 0;

  // Filtered categories by platform
  const filteredCategories = categories.filter(c => {
    if (selectedPlatform === 'All') return true;
    const catNameLower = c.name.toLowerCase();
    const platLower = selectedPlatform.toLowerCase();
    return catNameLower.includes(platLower);
  });

  const displayedCategories = filteredCategories.filter(c =>
    c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  // Filtered services for new order
  const availableServices = services.filter(s => {
    if (newOrder.categoryId) {
      return s.categoryId === Number(newOrder.categoryId);
    }
    if (selectedPlatform !== 'All') {
      const parentCat = categories.find(c => c.id === s.categoryId);
      return parentCat?.name.toLowerCase().includes(selectedPlatform.toLowerCase()) ||
             s.name.toLowerCase().includes(selectedPlatform.toLowerCase());
    }
    return true;
  });

  const displayedServices = availableServices.filter(s =>
    s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
    String(s.id).includes(serviceSearchQuery)
  );

  // Quick search matching services & categories above Category step
  const matchingQuickServices = quickSearchQuery.trim()
    ? services.filter(s => {
        const q = quickSearchQuery.toLowerCase();
        const cat = categories.find(c => c.id === s.categoryId);
        return (
          s.name.toLowerCase().includes(q) ||
          String(s.id).includes(q) ||
          (cat && cat.name.toLowerCase().includes(q))
        );
      })
    : [];

  // Calculate user total orders & total spent
  const totalOrdersCount = orders.length;
  const calculatedTotalSpent = orders.reduce((acc, o) => acc + (Number(o.charge) || 0), 0);
  const totalSpentFormatted = formatAmount(calculatedTotalSpent);

  // Platform quick tabs with animated logo configurations
  const platforms = [
    { id: 'All', label: 'All Platforms', icon: Sparkles, color: 'from-amber-500 to-red-500', activeBg: 'bg-gradient-to-r from-red-600 to-rose-600', iconColor: 'text-amber-500 dark:text-amber-400' },
    { id: 'TikTok', label: 'TikTok', icon: TikTokColorIcon, color: 'from-black via-zinc-900 to-black', activeBg: 'bg-gradient-to-r from-black via-zinc-900 to-black', iconColor: 'text-[#FE2C55]' },
    { id: 'Instagram', label: 'Instagram', icon: InstagramIcon, color: 'from-[#f09433] via-[#dc2743] to-[#bc1888]', activeBg: 'bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888]', iconColor: 'text-[#E1306C]' },
    { id: 'YouTube', label: 'YouTube', icon: YouTubeIcon, color: 'from-red-600 to-red-700', activeBg: 'bg-gradient-to-r from-red-600 to-red-700', iconColor: 'text-[#FF0000]' },
    { id: 'Telegram', label: 'Telegram', icon: TelegramIcon, color: 'from-sky-400 to-blue-500', activeBg: 'bg-gradient-to-r from-sky-500 to-blue-600', iconColor: 'text-[#229ED9]' },
    { id: 'Facebook', label: 'Facebook', icon: FacebookIcon, color: 'from-blue-600 to-blue-700', activeBg: 'bg-gradient-to-r from-blue-600 to-blue-800', iconColor: 'text-[#1877F2]' },
    { id: 'Spotify', label: 'Spotify', icon: SpotifyIcon, color: 'from-emerald-500 to-green-600', activeBg: 'bg-gradient-to-r from-emerald-600 to-green-700', iconColor: 'text-[#1DB954]' },
    { id: 'Twitter', label: 'Twitter / 𝕏', icon: TwitterXIcon, color: 'from-gray-700 to-gray-900', activeBg: 'bg-gradient-to-r from-gray-900 to-black', iconColor: 'text-gray-900 dark:text-white' },
  ];

  // Navigation Items
  const navItems = [
    { id: 'new-order', label: 'New Order', icon: Zap, iconBg: 'bg-red-500 text-white' },
    { id: 'orders', label: 'Orders', icon: Package, iconBg: 'bg-indigo-600 text-white' },
    { id: 'services', label: 'Services', icon: List, iconBg: 'bg-sky-500 text-white' },
    { id: 'add-funds', label: 'Add Funds', icon: Wallet, iconBg: 'bg-emerald-500 text-white' },
    { id: 'ai-chat', label: 'AI Chat Support', icon: Bot, iconBg: 'bg-gradient-to-r from-red-600 to-rose-600 text-white' },
    { id: 'tickets', label: 'Tickets', icon: Ticket, iconBg: 'bg-rose-400 text-white' },
    { id: 'api-docs', label: 'Api', icon: FileCode, iconBg: 'bg-red-600 text-white' },
    { id: 'refill-history', label: 'Refill History', icon: RotateCcw, iconBg: 'bg-amber-500 text-white' },
    { id: 'child-panels', label: 'Child Panels', icon: Globe, iconBg: 'bg-teal-500 text-white' },
    { id: 'affiliate', label: 'Affiliates', icon: Users, iconBg: 'bg-purple-500 text-white' },
    { id: 'blogs', label: 'Blogs & News', icon: BookOpen, iconBg: 'bg-pink-500 text-white' },
    { id: 'faq', label: 'FAQ', icon: HelpCircle, iconBg: 'bg-blue-500 text-white' },
    { id: 'contact-us', label: 'Support Channels', icon: Phone, iconBg: 'bg-emerald-600 text-white' },
  ];

  const currentTabObj = navItems.find(n => n.id === activeTab) || navItems[0];

  return (
    <div className="min-h-screen bg-[#101010] text-[#F5F5F5] flex flex-col font-sans selection:bg-[#FF3030] selection:text-white transition-colors duration-200 relative overflow-x-hidden">
      {/* Ambient glowing radial effects matching Login Page */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(255,48,48,0.07)_0%,transparent_70%)] blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(255,48,48,0.05)_0%,transparent_70%)] blur-3xl pointer-events-none" />
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR */}
      {/* ========================================================================= */}
      <header className="w-full bg-[#1C1C1C]/90 backdrop-blur-md border-b border-[#2A2A2A] text-white px-3 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-40 select-none shadow-xl">
        {/* Left Side: Brand Logo & Current Breadcrumb */}
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 sm:p-2 rounded-xl border border-[#2A2A2A] bg-[#141414] text-gray-200 hover:border-[#FF3030]/40 hover:text-white transition-all shadow-xs shrink-0"
            aria-label="Toggle Menu"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Desktop Logo & Branding (Shown on sm/md and above) */}
          <div 
            onClick={() => setActiveTab('new-order')}
            className="hidden sm:flex items-center space-x-2.5 cursor-pointer group shrink-0"
          >
            {publicSettings.websiteLogo ? (
              <img 
                src={publicSettings.websiteLogo} 
                alt={publicSettings.websiteName || 'TrustySMM'} 
                className="h-8 max-w-[140px] object-contain" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <AnimatedLogo size="sm" showText={true} theme={isDarkMode ? 'dark' : 'light'} />
            )}
          </div>

          {/* Desktop Divider & Active Tab Title (Exactly like Screenshot) */}
          <div className={`hidden sm:flex items-center space-x-2 pl-4 border-l ${isDarkMode ? 'border-[#272B33]' : 'border-gray-300'} min-w-0`}>
            <span className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {currentTabObj.label}
            </span>
          </div>

          {/* Mobile Only: Active Tab Title right next to menu button */}
          <div className="sm:hidden flex items-center min-w-0 pl-1">
            <span className={`text-sm font-bold tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {currentTabObj.label}
            </span>
          </div>
        </div>

        {/* Right Side: Quick Action Icons & Currency Button */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          {/* Notification Bell */}
          <button
            onClick={() => setActiveTab('new-order')}
            title="Announcements & Notifications"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shadow-xs transition-all hover:scale-105 cursor-pointer relative bg-[#141414] border border-[#2A2A2A] text-gray-200 hover:border-[#FF3030]/50 hover:text-white"
          >
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {announcements.length > 0 && (
              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 rounded-full bg-[#FF3030] animate-ping" />
            )}
          </button>

          {/* Currency Pill Switcher (INR / USD / EUR) */}
          <div className="relative">
            <button
              onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-[#FF3030] hover:bg-[#E02424] text-white font-bold text-[11px] sm:text-xs flex items-center space-x-1 sm:space-x-1.5 shadow-[0_2px_10px_rgba(255,48,48,0.3)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>{currency}</span>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-90" />
            </button>

            {currencyDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setCurrencyDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-36 rounded-xl border border-[#2A2A2A] bg-[#1C1C1C] divide-y divide-[#2A2A2A] shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  {(['INR', 'USD', 'EUR', 'PKR'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => changeCurrency(c)}
                      className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center justify-between transition-colors ${
                        currency === c
                          ? 'bg-[#FF3030]/20 text-[#FF3030]'
                          : 'text-gray-200 hover:bg-[#252525]'
                      }`}
                    >
                      <span>{c} ({currencySymbols[c]})</span>
                      {currency === c && <Check className="w-3.5 h-3.5 text-[#FF3030]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* TrustySMM Red Brand Active Indicator */}
          <div
            title="TrustySMM Red Branding Active"
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#141414] border border-[#2A2A2A] text-[11px] font-bold text-[#FF3030]"
          >
            <span className="w-2 h-2 rounded-full bg-[#FF3030] animate-pulse" />
            <span className="tracking-wider">RED PRO</span>
          </div>

          {/* User Profile Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-xs transition-all hover:scale-105 cursor-pointer bg-[#141414] border border-[#2A2A2A] text-gray-200 hover:border-[#FF3030]/50 hover:text-white"
            >
              <UserIcon className="w-4 h-4" />
            </button>

            {profileDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setProfileDropdownOpen(false)} 
                />
                <div className={`absolute right-0 mt-2.5 w-64 rounded-2xl border shadow-2xl z-50 overflow-hidden py-2 divide-y animate-in fade-in slide-in-from-top-2 duration-150 text-left ${
                  isDarkMode 
                    ? 'bg-[#15181E] border-[#272B33] divide-[#272B33] text-gray-200' 
                    : 'bg-white border-gray-200 divide-gray-100 text-gray-800'
                }`}>
                  <div className={`px-4 py-3 ${isDarkMode ? 'bg-[#191C22]' : 'bg-gray-50/70'}`}>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Signed In As</div>
                    <div className={`text-sm font-extrabold truncate mt-0.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user.email}</div>
                    <div className="flex items-center space-x-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-red-600/20 text-red-500 font-extrabold text-[10px] uppercase">
                        {user.role === 'admin' ? 'Administrator' : 'Bronze Level 3'}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        {formatAmount(user.balance)}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setShowAccountModal(true);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center space-x-3 ${isDarkMode ? 'text-gray-300 hover:bg-[#191C22] hover:text-white' : 'text-gray-700 hover:bg-red-50 hover:text-red-600'}`}
                    >
                      <UserIcon className="w-4 h-4 text-sky-400" />
                      <span>Account Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('add-funds');
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center space-x-3 ${isDarkMode ? 'text-gray-300 hover:bg-[#191C22] hover:text-white' : 'text-gray-700 hover:bg-red-50 hover:text-red-600'}`}
                    >
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span>Add Funds History</span>
                    </button>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setShowRewardsModal(true);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center space-x-3 ${isDarkMode ? 'text-gray-300 hover:bg-[#191C22] hover:text-white' : 'text-gray-700 hover:bg-red-50 hover:text-red-600'}`}
                    >
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Rewards & Level Tier</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onToggleAdminView();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-purple-400 hover:bg-purple-950/40 transition-colors flex items-center space-x-3"
                      >
                        <LayoutDashboard className="w-4 h-4 text-purple-400" />
                        <span>👑 Open Admin Panel</span>
                      </button>
                    )}
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setShowAboutModal(true);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center space-x-3 ${isDarkMode ? 'text-gray-400 hover:bg-[#191C22]' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Info className="w-4 h-4 text-red-500" />
                      <span>About Us & Platform</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setShowTermsModal(true);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center space-x-3 ${isDarkMode ? 'text-gray-400 hover:bg-[#191C22]' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span>Terms & Conditions</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setShowPrivacyModal(true);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center space-x-3 ${isDarkMode ? 'text-gray-400 hover:bg-[#191C22]' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <ShieldCheck className="w-4 h-4 text-gray-400" />
                      <span>Privacy Policy</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-950/30 transition-colors flex items-center space-x-3"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT WITH SIDEBAR */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative max-w-[1550px] w-full mx-auto px-2 sm:px-4 md:px-6 py-4 md:py-6 pb-28 sm:pb-32 md:pb-6 gap-6">
        {/* Mobile menu backdrop */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* ========================================================================= */}
        {/* 2A. LEFT SIDEBAR (CSS Selector 2) */}
        {/* ========================================================================= */}
        <aside className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-10 w-72 md:w-64 bg-[#101010] md:bg-transparent text-gray-200 flex flex-col space-y-4 flex-shrink-0 transition-transform duration-300 md:transform-none p-4 md:p-0 border-r border-[#2A2A2A] md:border-none
          ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}>
          {/* Top Red Balance & Level Card (TrustySMM Bold Red) */}
          <div className="bg-gradient-to-br from-[#FF3030] to-[#C91A1A] text-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(255,48,48,0.3)] border border-[#FF3030]/30 text-left relative overflow-hidden">
            {/* Subtle light bubble in background */}
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 filter blur-lg pointer-events-none" />

            <div className="text-[11px] font-extrabold uppercase tracking-wider text-red-100">
              BALANCE
            </div>

            <div className="text-3xl font-black font-sans tracking-tight mt-1">
              {formatAmount(user.balance)}
            </div>

            <button
              onClick={() => {
                setActiveTab('add-funds');
                setMobileMenuOpen(false);
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all inline-flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-xs"
            >
              <span>{publicSettings.sidebarAddFundsBtnText || '+ Add funds'}</span>
            </button>

            {/* Level Tier Status & Progress */}
            <div className="mt-4 pt-3 border-t border-white/20 text-xs">
              <div className="flex items-center justify-between text-white font-bold text-[11px]">
                <span className="flex items-center space-x-1">
                  <span>🏅 {publicSettings.sidebarLevelNum || 'Level 3'}</span>
                </span>
                <span className="uppercase tracking-wider text-[10px] bg-white/20 px-2 py-0.5 rounded-md">
                  {publicSettings.sidebarLevelName || (user.level === 1 ? 'GOLD' : user.level === 2 ? 'SILVER' : 'BRONZE')}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden mt-2">
                <div className="bg-white h-full rounded-full w-[55%]" />
              </div>

              <div className="flex justify-between items-center text-[10px] text-red-100 font-semibold mt-1.5">
                <span>{publicSettings.sidebarXpText || '66 / 120 XP'}</span>
                <span>{publicSettings.sidebarNextXp || 'Next: 54 XP'}</span>
              </div>

              <button
                onClick={() => setShowRewardsModal(true)}
                className="w-full text-center text-[10px] font-black uppercase tracking-wider text-white/95 hover:underline mt-2.5 block cursor-pointer"
              >
                {publicSettings.sidebarRewardsLinkText || '🏆 VIEW REWARDS & LEVELS'}
              </button>
            </div>
          </div>

          {/* Navigation Menu List (TrustySMM Dark Red Style) */}
          <nav className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-360px)] pr-1 scrollbar-none">
            {/* Admin Panel Quick Switcher in Sidebar */}
            {(isAdmin || user.role === 'admin' || user.email?.toLowerCase().includes('aviral2340b') || user.email?.toLowerCase().includes('rujdr368')) && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onToggleAdminView();
                }}
                className="w-full mb-2 flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold bg-[#1C1C1C] border border-[#2A2A2A] text-white hover:border-[#FF3030]/60 transition-all cursor-pointer shadow-md"
              >
                <div className="w-7 h-7 rounded-xl bg-[#FF3030] flex items-center justify-center text-white">
                  <LayoutDashboard className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-extrabold flex-1 text-left">👑 Switch to Admin Panel</span>
              </button>
            )}

            {navItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#FF3030] text-white shadow-[0_4px_16px_rgba(255,48,48,0.35)] font-extrabold'
                      : 'text-gray-300 hover:bg-[#1C1C1C] hover:text-white border border-transparent hover:border-[#2A2A2A]'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/20 text-white' : tab.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* WhatsApp Direct Support Button in Left Sidebar */}
          <a
            href={`https://wa.me/91${(publicSettings.whatsappNumber || '8795005604').replace(/[^0-9]/g, '') || '8795005604'}?text=${encodeURIComponent(`Hello ${publicSettings.websiteName || 'TrustySMM'} Support, I need help with my account.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer group shadow-xs"
            title="Chat on WhatsApp"
          >
            <div className="w-7 h-7 rounded-xl bg-[#25D366] text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-xs">
              <WhatsAppIcon className="w-4 h-4 fill-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 leading-tight">
                <span>WhatsApp Support</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                Online 24/7 Support
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 flex-shrink-0" />
          </a>

          {/* Sidebar Footer Copyright */}
          <div className={`pt-2 text-[11px] font-semibold pl-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {publicSettings.footerCopyright || `© ${publicSettings.websiteName || 'TrustySMM'} | Main SMM Provider`}
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* 2B. MAIN CONTENT AREA */}
        {/* ========================================================================= */}
        <main className="flex-1 min-w-0 flex flex-col space-y-6">
          {/* Notification / Error / Success Alerts */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between text-xs font-bold shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700">✕</button>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-between text-xs font-bold shadow-xs">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">✕</button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOP PROMOTIONAL BANNER: FREE WALLET CREDIT (Exact match to screenshot) */}
          {/* ========================================================================= */}
          {showPromoBanner && publicSettings.bannerStatus !== 'disabled' && (
            <div className="bg-gradient-to-r from-purple-800 via-indigo-700 to-purple-700 text-white rounded-3xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Carousel Left Navigation button */}
              <button 
                className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 items-center justify-center text-white text-xs cursor-pointer"
                onClick={() => showSuccess('Checking promotional offers...')}
              >
                ‹
              </button>

              <div className="flex items-center space-x-4 pl-0 lg:pl-6">
                {/* Yellow Gift Box Icon */}
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 flex-shrink-0 shadow-inner">
                  <Gift className="w-7 h-7" />
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-purple-200">
                    {publicSettings.bannerBadge || 'FREE WALLET CREDIT'}
                  </div>
                  <div className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                    {publicSettings.bannerTitle || `Earn up to ${formatAmount(200)} in free credit`}
                  </div>
                  <div className="text-xs text-purple-100 font-medium mt-0.5">
                    {publicSettings.bannerSubtitle || `Leave a review for ${formatAmount(25)} · make a promo video for ${formatAmount(200)}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 self-end sm:self-center pr-0 lg:pr-6">
                <button
                  onClick={() => {
                    if (publicSettings.bannerBtnLink && publicSettings.bannerBtnLink.startsWith('http')) {
                      window.open(publicSettings.bannerBtnLink, '_blank');
                    } else if (publicSettings.bannerBtnLink === 'affiliate') {
                      setActiveTab('affiliate');
                    } else {
                      setShowRewardsModal(true);
                    }
                  }}
                  className="px-5 py-2 rounded-full bg-white hover:bg-gray-100 text-gray-900 font-extrabold text-xs shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  {publicSettings.bannerBtnText || 'Earn now →'}
                </button>

                <button
                  onClick={() => setShowPromoBanner(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-purple-200 hover:text-white transition-colors cursor-pointer"
                  title="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Carousel Right Navigation button */}
              <button 
                className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 items-center justify-center text-white text-xs cursor-pointer"
                onClick={() => showSuccess('Checking promotional offers...')}
              >
                ›
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* GREETING HEADER */}
          {/* ========================================================================= */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center flex-wrap gap-2">
              <span className="text-2xl sm:text-3xl">{getGreeting().emoji}</span>
              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{getGreeting().text},</span>
              <span className="text-red-500">{user.name || user.email}</span>
            </h1>
            <p className={`text-xs sm:text-sm font-medium mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {publicSettings.greetingNotice || `Place a new order in a few taps — orders delivered on ${publicSettings.websiteName || 'TrustySMM'} | Main SMM Provider.`}
            </p>
          </div>

          {/* ========================================================================= */}
          {/* 4 STAT METRIC CARDS (Exact match to screenshot) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. BALANCE */}
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] hover:border-[#FF3030]/50 text-white rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all">
              <div className="w-10 h-10 rounded-2xl bg-[#FF3030] text-white flex items-center justify-center shadow-md">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  BALANCE
                </div>
                <div className="text-xl sm:text-2xl font-black mt-0.5 text-white font-sans">
                  {formatAmount(user.balance)}
                </div>
              </div>
            </div>

            {/* 2. TOTAL ORDERS */}
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] hover:border-[#FF3030]/50 text-white rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <List className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  TOTAL ORDERS
                </div>
                <div className="text-xl sm:text-2xl font-black mt-0.5 text-white font-sans">
                  {totalOrdersCount}
                </div>
              </div>
            </div>

            {/* 3. TOTAL SPENT */}
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] hover:border-[#FF3030]/50 text-white rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  TOTAL SPENT
                </div>
                <div className="text-xl sm:text-2xl font-black mt-0.5 text-white font-sans">
                  {totalSpentFormatted}
                </div>
              </div>
            </div>

            {/* 4. LEVEL */}
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] hover:border-[#FF3030]/50 text-white rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                <Award className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  LEVEL
                </div>
                <div className="text-xl sm:text-2xl font-black mt-0.5 text-white font-sans">
                  Bronze
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: NEW ORDER / DASHBOARD (TrustySMM Dark Red Style) */}
          {/* ========================================================================= */}
          {activeTab === 'new-order' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Place New Order Form */}
              <div className="lg:col-span-2 bg-[#1C1C1C] border border-[#2A2A2A] text-white rounded-3xl p-6 sm:p-8 shadow-2xl">
                {/* Header with red circle lightning */}
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-9 h-9 rounded-full bg-[#FF3030] text-white flex items-center justify-center shadow-[0_2px_12px_rgba(255,48,48,0.4)]">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-white">
                    Place a new order
                  </h2>
                </div>

                {/* Sub Switcher: New Order vs Mass Order */}
                <div className="flex items-center space-x-2 bg-[#141414] border border-[#2A2A2A] p-1.5 rounded-2xl w-fit mb-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab('new-order')}
                    className="px-4 py-2 rounded-xl bg-[#FF3030] text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-[0_2px_10px_rgba(255,48,48,0.35)] cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>New order</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('mass-order')}
                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Mass Order</span>
                  </button>
                </div>

                {/* 4 Steps Indicator Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 text-xs font-bold">
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-xl border bg-[#141414] border-[#2A2A2A] text-gray-200">
                    <span className="w-5 h-5 rounded-full bg-[#FF3030] text-white text-[10px] font-black flex items-center justify-center">1</span>
                    <span>Platform</span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-xl border bg-[#141414] border-[#2A2A2A] text-gray-200">
                    <span className="w-5 h-5 rounded-full bg-[#FF3030] text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <span>Category</span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-xl border bg-[#141414] border-[#2A2A2A] text-gray-200">
                    <span className="w-5 h-5 rounded-full bg-[#FF3030] text-white text-[10px] font-black flex items-center justify-center">3</span>
                    <span>Service</span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-xl border bg-[#141414] border-[#2A2A2A] text-gray-200">
                    <span className="w-5 h-5 rounded-full bg-[#FF3030] text-white text-[10px] font-black flex items-center justify-center">4</span>
                    <span>Details</span>
                  </div>
                </div>

                {/* Step 1: Platforms Quick Selection Pills */}
                <div className="mb-6">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider mb-2.5 text-gray-400">
                    Step 1: Choose Platform
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {platforms.map((p) => {
                      const PIcon = p.icon;
                      const isSel = selectedPlatform === p.id;
                      return (
                        <motion.button
                          key={p.id}
                          type="button"
                          whileHover={{ scale: 1.06, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setSelectedPlatform(p.id);
                            setNewOrder(prev => ({ ...prev, categoryId: '', serviceId: '' }));
                          }}
                          className={`relative px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer border overflow-hidden group select-none ${
                            isSel
                              ? 'bg-[#FF3030] border-[#FF3030] text-white shadow-[0_4px_16px_rgba(255,48,48,0.35)]'
                              : 'bg-[#141414] border-[#2A2A2A] text-gray-300 hover:border-[#FF3030]/50 hover:text-white'
                          }`}
                        >
                          {/* Animated background shimmer on hover */}
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -skew-x-12 pointer-events-none"
                            initial={{ x: '-100%' }}
                            whileHover={{ x: '100%' }}
                            transition={{ duration: 0.6 }}
                          />

                          {/* Animated Icon with subtle floating/pulse motion */}
                          <motion.div
                            animate={isSel ? { scale: [1, 1.25, 1], rotate: [0, -6, 6, 0] } : {}}
                            transition={{ duration: 1.8, repeat: isSel ? Infinity : 0, repeatDelay: 2 }}
                            className={`flex items-center justify-center ${isSel ? 'text-white' : p.iconColor}`}
                          >
                            <PIcon className="w-3.5 h-3.5 transition-transform group-hover:scale-115 group-hover:rotate-3" />
                          </motion.div>
                          <span className="relative z-10">{p.label}</span>

                          {/* Active glowing indicator spark */}
                          {isSel && (
                            <motion.span
                              className="w-1.5 h-1.5 rounded-full bg-white ml-0.5 shadow-xs"
                              animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                              transition={{ duration: 1.2, repeat: Infinity }}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handlePlaceOrder} className="space-y-5">
                  {/* Search Bar Above Category */}
                  <div ref={quickSearchRef} className="relative">
                    <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Search Category / Service
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search any service or category by name, keyword, or ID..."
                        value={quickSearchQuery}
                        onFocus={() => {
                          if (quickSearchQuery.trim()) setIsQuickSearchOpen(true);
                          setIsCategoryDropdownOpen(false);
                          setIsServiceDropdownOpen(false);
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuickSearchQuery(val);
                          setIsQuickSearchOpen(val.trim().length > 0);
                        }}
                        className={`w-full pl-10 pr-10 py-3 rounded-2xl border text-xs font-semibold focus:outline-none transition-all shadow-xs ${
                          isDarkMode
                            ? 'bg-[#191C22] border-[#272B33] text-white placeholder-gray-500 focus:border-red-500/70 focus:ring-1 focus:ring-red-500/40'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-red-600 focus:ring-1 focus:ring-red-600/30'
                        }`}
                      />
                      {quickSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickSearchQuery('');
                            setIsQuickSearchOpen(false);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-200 text-xs transition-colors cursor-pointer"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Quick Search Dropdown Results Popover */}
                    <AnimatePresence>
                      {isQuickSearchOpen && quickSearchQuery.trim().length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className={`absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-md max-h-72 overflow-y-auto p-1.5 space-y-1 ${
                            isDarkMode
                              ? 'bg-[#15181E]/95 border-[#272B33] text-white'
                              : 'bg-white/95 border-gray-200 text-gray-900'
                          }`}
                        >
                          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center justify-between border-b border-gray-200/50 dark:border-white/5 mb-1">
                            <span>Matching Results ({matchingQuickServices.length})</span>
                            <span className="text-[9px] text-teal-400 font-bold">Click to Select</span>
                          </div>

                          {matchingQuickServices.length === 0 ? (
                            <div className="py-6 text-center text-xs text-gray-400">
                              No service or category found matching "{quickSearchQuery}"
                            </div>
                          ) : (
                            matchingQuickServices.slice(0, 15).map((srv) => {
                              const parentCat = categories.find(c => c.id === srv.categoryId);
                              return (
                                <button
                                  key={srv.id}
                                  type="button"
                                  onClick={() => {
                                    setNewOrder({
                                      ...newOrder,
                                      categoryId: String(srv.categoryId),
                                      serviceId: String(srv.id),
                                    });
                                    setQuickSearchQuery('');
                                    setIsQuickSearchOpen(false);
                                  }}
                                  className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                    isDarkMode
                                      ? 'hover:bg-[#191C22] text-gray-200'
                                      : 'hover:bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  <div className="truncate mr-3">
                                    <div className="font-bold truncate flex items-center space-x-1.5">
                                      <span className="text-red-500 font-mono text-[11px]">#{srv.id}</span>
                                      <span className="truncate">{srv.name}</span>
                                    </div>
                                    {parentCat && (
                                      <div className="text-[10px] text-gray-400 truncate mt-0.5 flex items-center space-x-1">
                                        <span>Category:</span>
                                        <span className="text-teal-400 font-medium">{parentCat.name}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0 font-mono font-black">
                                    <span className="text-emerald-500 font-bold">{formatAmount(srv.pricePerThousand)}</span>
                                    <span className="block text-[9px] text-gray-400">/ 1K</span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Step 2: Category Dropdown with Animated Platform/Category Logo */}
                  <div ref={categoryDropdownRef} className="relative">
                    <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Step 2: Category
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                        setIsServiceDropdownOpen(false);
                        setIsQuickSearchOpen(false);
                      }}
                      className="w-full px-4 py-3.5 rounded-2xl border text-sm font-semibold flex items-center justify-between transition-all cursor-pointer shadow-xs bg-[#141414] border-[#2A2A2A] text-white hover:border-[#FF3030]/60"
                    >
                      <div className="flex items-center space-x-3.5 truncate">
                        {(selectedCategory || selectedPlatform !== 'All') && (
                          <ServiceCategoryIcon
                            name={selectedCategory ? selectedCategory.name : selectedPlatform}
                            icon={selectedCategory?.icon}
                            size="md"
                          />
                        )}
                        <span className="font-bold truncate text-sm text-white">
                          {selectedCategory ? selectedCategory.name : (selectedPlatform !== 'All' ? `${selectedPlatform} Services` : `Select a Category (${filteredCategories.length} available)`)}
                        </span>
                      </div>

                      {/* Dropdown Indicator */}
                      <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                        <div className="w-5 h-5 rounded bg-[#FF3030] text-white flex items-center justify-center font-black text-[9px] shadow-xs">
                          {isCategoryDropdownOpen ? '▲' : '▼'}
                        </div>
                      </div>
                    </button>

                    {/* Animated Category Popover List */}
                    <AnimatePresence>
                      {isCategoryDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-[#2A2A2A] bg-[#1C1C1C] text-white shadow-2xl overflow-hidden backdrop-blur-md"
                        >
                          {/* Categories List */}
                          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                            {displayedCategories.length === 0 ? (
                              <div className="py-6 text-center text-xs text-gray-400">
                                No matching categories found
                              </div>
                            ) : (
                              displayedCategories.map((cat) => {
                                const isCatSelected = String(cat.id) === String(newOrder.categoryId);
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                      setNewOrder({ ...newOrder, categoryId: String(cat.id), serviceId: '' });
                                      setIsCategoryDropdownOpen(false);
                                      setCategorySearchQuery('');
                                    }}
                                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                      isCatSelected
                                        ? 'bg-[#FF3030] text-white shadow-xs'
                                        : 'hover:bg-[#252525] text-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-3 truncate">
                                      <ServiceCategoryIcon name={cat.name} icon={cat.icon} size="sm" />
                                      <span className="truncate">{cat.name}</span>
                                    </div>
                                    {isCatSelected && <Check className="w-4 h-4 text-white shrink-0 ml-2" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Step 3: Service Dropdown */}
                  <div ref={serviceDropdownRef} className="relative">
                    <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Step 3: Service
                    </label>
                    <button
                      type="button"
                      disabled={!newOrder.categoryId && availableServices.length === 0}
                      onClick={() => {
                        setIsServiceDropdownOpen(!isServiceDropdownOpen);
                        setIsCategoryDropdownOpen(false);
                        setIsQuickSearchOpen(false);
                      }}
                      className="w-full px-4 py-3.5 rounded-2xl border text-sm font-semibold flex items-center justify-between transition-all cursor-pointer shadow-xs disabled:opacity-60 bg-[#141414] border-[#2A2A2A] text-white hover:border-[#FF3030]/60"
                    >
                      <div className="text-left truncate">
                        <span className="font-bold truncate block text-sm text-white">
                          {selectedService ? `#${selectedService.id} - ${selectedService.name}` : `Select a Service (${availableServices.length} available)`}
                        </span>
                        {selectedService && (
                          <span className="text-[11px] font-mono text-[#FF3030] font-bold block">
                            {formatAmount(selectedService.pricePerThousand)} / 1,000
                          </span>
                        )}
                      </div>

                      {/* Dropdown Indicator */}
                      <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                        <div className="w-5 h-5 rounded bg-[#FF3030] text-white flex items-center justify-center font-black text-[9px] shadow-xs">
                          {isServiceDropdownOpen ? '▲' : '▼'}
                        </div>
                      </div>
                    </button>

                    {/* Animated Service Popover List */}
                    <AnimatePresence>
                      {isServiceDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-[#2A2A2A] bg-[#1C1C1C] text-white shadow-2xl overflow-hidden backdrop-blur-md"
                        >
                          {/* Services List */}
                          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                            {displayedServices.length === 0 ? (
                              <div className="py-6 text-center text-xs text-gray-400">
                                No matching services found
                              </div>
                            ) : (
                              displayedServices.map((s) => {
                                const isSrvSelected = String(s.id) === String(newOrder.serviceId);
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setNewOrder({ ...newOrder, serviceId: String(s.id) });
                                      setIsServiceDropdownOpen(false);
                                      setServiceSearchQuery('');
                                    }}
                                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                      isSrvSelected
                                        ? 'bg-[#FF3030] text-white shadow-xs'
                                        : 'hover:bg-[#252525] text-gray-200'
                                    }`}
                                  >
                                    <div className="truncate">
                                      <span className="font-bold block truncate">
                                        #{s.id} - {s.name}
                                      </span>
                                      <span className={`text-[10px] font-mono ${isSrvSelected ? 'text-white/90' : 'text-gray-400'}`}>
                                        Min: {s.minAmount} &middot; Max: {s.maxAmount}
                                      </span>
                                    </div>
                                    <div className="text-right shrink-0 ml-3 font-mono font-black">
                                      <span className={isSrvSelected ? 'text-white' : 'text-emerald-500'}>
                                        {formatAmount(s.pricePerThousand)}
                                      </span>
                                      <span className={`block text-[9px] ${isSrvSelected ? 'text-white/80' : 'text-gray-400'}`}>/ 1K</span>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Service Description Box */}
                  {selectedService && (
                    <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${
                      isDarkMode 
                        ? 'bg-[#15181E] border-[#272B33] text-gray-300' 
                        : 'bg-red-50/50 border-red-100 text-gray-700'
                    }`}>
                      <div className="font-extrabold text-red-500 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Service Description</span>
                      </div>
                      <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                        {selectedService.description || 'Fast and guaranteed delivery with instant activation.'}
                      </p>
                      <div className="flex gap-4 pt-1 font-mono font-bold text-red-500 text-[11px]">
                        <span>Min: {selectedService.minAmount}</span>
                        <span>Max: {selectedService.maxAmount}</span>
                        <span>Speed: Instant</span>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Link URL */}
                  <div>
                    <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Step 4: Target Link / Profile / Post URL
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://instagram.com/p/..."
                      value={newOrder.link}
                      onChange={(e) => setNewOrder({ ...newOrder, link: e.target.value })}
                      className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold shadow-xs focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 ${
                        isDarkMode
                          ? 'bg-[#191C22] border-[#272B33] text-white placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className={`text-[11px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Quantity
                      </label>
                      {selectedService && (
                        <span className={`text-[11px] font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Min: {selectedService.minAmount.toLocaleString()} &middot; Max: {selectedService.maxAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 1000"
                      value={newOrder.quantity}
                      onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })}
                      className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold shadow-xs focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 ${
                        isDarkMode
                          ? 'bg-[#191C22] border-[#272B33] text-white placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />

                    {/* Quick Quantity Preset Chips */}
                    {selectedService && (
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        {[
                          { label: `Min (${selectedService.minAmount})`, val: selectedService.minAmount },
                          { label: '500', val: 500 },
                          { label: '1,000', val: 1000 },
                          { label: '5,000', val: 5000 },
                          { label: `Max (${selectedService.maxAmount})`, val: selectedService.maxAmount },
                        ]
                          .filter(
                            (chip, idx, self) =>
                              chip.val >= selectedService.minAmount &&
                              chip.val <= selectedService.maxAmount &&
                              self.findIndex((c) => c.val === chip.val) === idx
                          )
                          .map((chip) => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => setNewOrder({ ...newOrder, quantity: String(chip.val) })}
                              className={`text-[10px] px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                                newOrder.quantity === String(chip.val)
                                  ? 'bg-red-600 text-white shadow-xs'
                                  : isDarkMode
                                  ? 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                              }`}
                            >
                              {chip.label}
                            </button>
                          ))}
                      </div>
                    )}

                    {/* Live Amount Show Box Right Below Quantity */}
                    {selectedService && (
                      <div
                        className={`mt-3 p-3.5 rounded-2xl border transition-all ${
                          Number(newOrder.quantity) > 0
                            ? isDarkMode
                              ? 'bg-emerald-950/25 border-emerald-500/30'
                              : 'bg-emerald-50/90 border-emerald-200 shadow-xs'
                            : isDarkMode
                            ? 'bg-white/5 border-white/5'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <DollarSign
                              className={`w-4 h-4 ${
                                Number(newOrder.quantity) > 0 ? 'text-emerald-500' : 'text-gray-400'
                              }`}
                            />
                            <span
                              className={`text-xs font-extrabold uppercase tracking-wider ${
                                isDarkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}
                            >
                              Total Amount:
                            </span>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-base sm:text-lg font-black font-mono ${
                                Number(newOrder.quantity) > 0
                                  ? 'text-emerald-500'
                                  : isDarkMode
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              }`}
                            >
                              {formatAmountFourDecimals(estimatedPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Breakdown & Wallet check */}
                        {Number(newOrder.quantity) > 0 && (
                          <div
                            className={`mt-2 pt-2 border-t text-[11px] flex flex-col sm:flex-row justify-between sm:items-center gap-1 ${
                              isDarkMode
                                ? 'border-white/10 text-gray-400'
                                : 'border-emerald-200 text-gray-600'
                            }`}
                          >
                            <span>
                              Rate: <strong className={isDarkMode ? 'text-gray-200 font-mono' : 'text-gray-800 font-mono'}>{formatAmount(selectedService.pricePerThousand)}</strong> per 1K
                            </span>
                            {user.balance < estimatedPrice ? (
                              <span className="text-red-500 font-bold">
                                ⚠️ Low Balance: {formatAmount(user.balance)}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">
                                ✓ Balance: {formatAmount(user.balance)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Coupon Code (Optional) */}
                  <div>
                    <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Coupon Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DISCO10"
                      value={newOrder.coupon}
                      onChange={(e) => setNewOrder({ ...newOrder, coupon: e.target.value })}
                      className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold shadow-xs focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 ${
                        isDarkMode
                          ? 'bg-[#191C22] border-[#272B33] text-white placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-[#FF3030] hover:bg-[#E02424] text-white font-extrabold text-sm shadow-[0_4px_25px_rgba(255,48,48,0.35)] transition-all hover:scale-[1.01] active:scale-98 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" />
                        <span>Place Order</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right Column: Order Summary Card (TrustySMM Dark Red Style) */}
              <div className="space-y-6">
                <div className="bg-[#1C1C1C] border border-[#2A2A2A] text-white rounded-3xl shadow-2xl overflow-hidden">
                  {/* Top Red Header Bar */}
                  <div className="bg-[#FF3030] text-white p-4 font-bold text-xs flex items-center justify-between shadow-md">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span className="font-extrabold uppercase tracking-wider">Order summary</span>
                    </div>
                    <button 
                      onClick={() => setActiveTab('orders')}
                      className="text-red-100 hover:text-white flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Order status?</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Summary Details */}
                  <div className="p-6 space-y-4 text-xs font-bold divide-y divide-[#2A2A2A] text-gray-300">
                    <div className="flex justify-between items-start pt-1">
                      <span className="text-gray-400 font-medium">Service</span>
                      <span className="text-right font-extrabold max-w-[180px] line-clamp-2 text-white">
                        {selectedService ? selectedService.name : 'No service selected'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-3">
                      <span className="text-gray-400 font-medium">Quantity</span>
                      <span className="font-mono font-extrabold text-white">
                        {newOrder.quantity ? Number(newOrder.quantity).toLocaleString() : '0'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-3">
                      <span className="text-gray-400 font-medium">Rate / 1000</span>
                      <span className="font-mono font-extrabold text-white">
                        {selectedService ? formatAmount(selectedService.pricePerThousand) : formatAmount(0)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t-2 border-[#2A2A2A]">
                      <span className="text-sm font-extrabold text-white">Total Price</span>
                      <span className="text-xl font-black font-mono text-[#FF3030]">
                        {formatAmountFourDecimals(estimatedPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Announcements Ticker / Card */}
                <div className="bg-[#1C1C1C] border border-[#2A2A2A] text-white rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-black text-sm text-white">
                      <Bell className="w-4 h-4 text-[#FF3030]" />
                      <span>Live Updates</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#FF3030]/20 text-[#FF3030] text-[10px] font-extrabold">
                      Active
                    </span>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {announcements.length > 0 ? (
                      announcements.map((ann) => (
                        <div key={ann.id} className="p-3.5 rounded-2xl border border-[#2A2A2A] bg-[#141414] text-xs">
                          <div className="font-extrabold text-white">{ann.title}</div>
                          <div className="text-[11px] mt-1 leading-relaxed text-gray-400">{ann.content}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3.5 rounded-2xl border border-[#2A2A2A] bg-[#141414] text-xs leading-relaxed text-gray-400">
                        ⚡ Instagram & YouTube services updated with ultra-fast speed. 100% stable refill guarantees active!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MASS ORDER */}
          {/* ========================================================================= */}
          {activeTab === 'mass-order' && (
            <div className="bg-[#1C1C1C] rounded-3xl p-6 sm:p-8 border border-[#2A2A2A] shadow-2xl max-w-4xl text-white">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-[#FF3030] text-white flex items-center justify-center shadow-md">
                  <List className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-white">Mass Order Placement</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Place multiple orders simultaneously. Use the format: <strong className="text-white font-mono">service_id | quantity | link_url</strong> (one per line).
              </p>

              <form onSubmit={handleMassOrder} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">
                    Bulk Orders Input
                  </label>
                  <textarea
                    rows={8}
                    required
                    placeholder="101|1000|https://instagram.com/p/123&#10;102|5000|https://tiktok.com/@user/456"
                    value={massInput}
                    onChange={(e) => setMassInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 font-mono text-xs focus:outline-none focus:border-[#FF3030] focus:ring-1 focus:ring-[#FF3030] shadow-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3.5 rounded-2xl bg-[#FF3030] hover:bg-[#E02424] text-white font-extrabold text-xs shadow-[0_4px_20px_rgba(255,48,48,0.35)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Submit Mass Orders'}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ORDERS HISTORY */}
          {/* ========================================================================= */}
          {activeTab === 'orders' && (() => {
            const normOrders = orders.map(ord => ({
              ...ord,
              ...getOrderMetrics(ord)
            }));

            const filteredOrders = normOrders.filter(ord => {
              const matchesSearch = 
                String(ord.id).includes(orderSearchQuery.trim()) ||
                (ord.serviceName || '').toLowerCase().includes(orderSearchQuery.toLowerCase().trim()) ||
                (ord.link || '').toLowerCase().includes(orderSearchQuery.toLowerCase().trim());
              
              if (!matchesSearch) return false;

              if (orderStatusFilter === 'all') return true;
              if (orderStatusFilter === 'completed') return ord.normStatus === 'completed';
              if (orderStatusFilter === 'processing') return ['processing', 'inprogress', 'in_progress'].includes(ord.normStatus);
              if (orderStatusFilter === 'pending') return ord.normStatus === 'pending';
              if (orderStatusFilter === 'partial') return ord.normStatus === 'partial';
              if (orderStatusFilter === 'cancelled') return ['cancelled', 'refunded'].includes(ord.normStatus);
              return true;
            });

            const orderCounts = {
              all: orders.length,
              completed: orders.filter(o => (o.status || '').toLowerCase() === 'completed').length,
              processing: orders.filter(o => ['processing', 'inprogress', 'in_progress'].includes((o.status || '').toLowerCase())).length,
              pending: orders.filter(o => (o.status || '').toLowerCase() === 'pending').length,
              partial: orders.filter(o => (o.status || '').toLowerCase() === 'partial').length,
              cancelled: orders.filter(o => ['cancelled', 'refunded'].includes((o.status || '').toLowerCase())).length,
            };

            return (
              <div className="space-y-4">
                {/* Header & Filter Controls */}
                <div className="p-4 sm:p-6 rounded-3xl border border-[#2A2A2A] bg-[#1C1C1C] text-white shadow-xl transition-all">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#FF3030]/20 text-[#FF3030] flex items-center justify-center font-bold">
                          <Package className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">Order History & Live Delivery Tracker</h2>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Track live completion speed, delivery progress percentage, start count & remaining quantity
                      </p>
                    </div>

                    {/* Actions: Refresh & Batch Copy */}
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedOrderIds.length > 0 && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedOrderIds.join(', '));
                            showSuccess(`Copied ${selectedOrderIds.length} Order IDs!`);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#FF3030] hover:bg-[#E02424] text-white font-mono text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Selected ({selectedOrderIds.length})</span>
                        </button>
                      )}

                      <button 
                        onClick={fetchDashboardData}
                        className="p-2.5 rounded-xl border border-[#2A2A2A] bg-[#141414] text-gray-200 hover:border-[#FF3030]/50 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5 text-xs font-bold"
                        title="Refresh Orders"
                      >
                        <RefreshCw className="w-4 h-4 text-emerald-400" />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Search and Status Pills */}
                  <div className="mt-5 pt-4 border-t border-[#2A2A2A] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {[
                        { id: 'all', label: 'All', count: orderCounts.all },
                        { id: 'completed', label: 'Completed', count: orderCounts.completed, color: 'text-emerald-400' },
                        { id: 'processing', label: 'In Progress', count: orderCounts.processing, color: 'text-blue-400' },
                        { id: 'pending', label: 'Pending', count: orderCounts.pending, color: 'text-amber-400' },
                        { id: 'partial', label: 'Partial', count: orderCounts.partial, color: 'text-purple-400' },
                        { id: 'cancelled', label: 'Cancelled', count: orderCounts.cancelled, color: 'text-rose-400' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setOrderStatusFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                            orderStatusFilter === tab.id
                              ? 'bg-[#FF3030] text-white shadow-[0_2px_10px_rgba(255,48,48,0.35)]'
                              : 'bg-[#141414] border border-[#2A2A2A] text-gray-400 hover:text-white hover:border-[#FF3030]/40'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-black ${
                            orderStatusFilter === tab.id
                              ? 'bg-white/20 text-white'
                              : isDarkMode
                              ? 'bg-[#222836] text-gray-300'
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-64 shrink-0">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search ID, Service, Link..."
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#FF3030] focus:border-[#FF3030] border bg-[#141414] border-[#2A2A2A] text-white placeholder-gray-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Orders List / Cards matching the user's screenshot */}
                {filteredOrders.length > 0 ? (
                  <div className="space-y-3">
                    {/* Select all bar if multiple orders exist */}
                    <div className="flex items-center justify-between px-2 text-xs font-medium text-gray-400">
                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                          onChange={() => toggleSelectAllOrders(filteredOrders)}
                          className="w-4 h-4 rounded border-[#2A2A2A] bg-[#141414] text-[#FF3030] focus:ring-[#FF3030] cursor-pointer"
                        />
                        <span>Select All ({filteredOrders.length} orders)</span>
                      </label>
                      <span>Showing {filteredOrders.length} of {orders.length} total orders</span>
                    </div>

                    {filteredOrders.map((ord) => (
                      <motion.div
                        key={ord.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border p-4 sm:p-5 transition-all duration-200 relative overflow-hidden bg-[#1C1C1C] border-[#2A2A2A] text-white hover:border-[#FF3030]/40 shadow-xl"
                      >
                        {/* TOP ROW: Checkbox + ID + Service + Link + Date on Left | Status + Price + Qty + Counts on Right */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3">
                          
                          {/* Left Group: Checkbox + Order Info */}
                          <div className="flex items-start space-x-3 min-w-0">
                            {/* Selection Checkbox */}
                            <input 
                              type="checkbox"
                              checked={selectedOrderIds.includes(ord.id)}
                              onChange={() => toggleSelectOrder(ord.id)}
                              className={`mt-1 w-4 h-4 rounded ${
                                isDarkMode ? 'border-gray-600 bg-gray-900' : 'border-gray-300 bg-white'
                              } text-red-600 focus:ring-red-500 cursor-pointer shrink-0`}
                            />

                            {/* ID + Title + Link + Date */}
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`font-mono font-black text-sm sm:text-base tracking-wide ${
                                  isDarkMode ? 'text-white' : 'text-gray-900'
                                }`}>
                                  #{ord.id}
                                </span>
                                <h3 className={`font-extrabold text-xs sm:text-sm line-clamp-1 ${
                                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                                }`}>
                                  {ord.serviceName || 'Social Media Growth Service'}
                                </h3>
                              </div>

                              {/* Target Link in Red / Coral Accent */}
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <a 
                                  href={ord.link.startsWith('http') ? ord.link : `https://${ord.link}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className={`font-mono text-xs truncate max-w-[280px] sm:max-w-md md:max-w-lg block hover:underline transition-colors font-semibold ${
                                    isDarkMode ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-700'
                                  }`}
                                >
                                  {ord.link}
                                </a>
                                <a
                                  href={ord.link.startsWith('http') ? ord.link : `https://${ord.link}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`${isDarkMode ? 'text-gray-400 hover:text-rose-400' : 'text-gray-400 hover:text-rose-600'} transition-colors shrink-0`}
                                  title="Open Target Link"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>

                              {/* Timestamp with Clock Icon + Speed Indicator */}
                              <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium pt-0.5 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span className="font-mono">{ord.createdAt || '2026-08-29 19:18:25'}</span>
                                </div>
                                <span className={isDarkMode ? 'text-gray-600 hidden sm:inline' : 'text-gray-300 hidden sm:inline'}>•</span>
                                <div className={`flex items-center space-x-1 font-bold shrink-0 ${
                                  isDarkMode ? 'text-emerald-400/90' : 'text-emerald-600'
                                }`}>
                                  <Zap className="w-3 h-3" />
                                  <span>{ord.speedText}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Group: Status Badge + Price + Qty + Start/End/Rem Counters */}
                          <div className="flex flex-col items-start lg:items-end space-y-1.5 shrink-0 pl-7 lg:pl-0">
                            <div className="flex items-center space-x-3">
                              {/* Status Pill Badge: ● Completed */}
                              <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center space-x-1.5 border shadow-xs ${
                                ord.normStatus === 'completed'
                                  ? isDarkMode 
                                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : ord.normStatus === 'pending'
                                  ? isDarkMode
                                    ? 'bg-amber-950/80 border-amber-500/40 text-amber-400'
                                    : 'bg-amber-50 border-amber-200 text-amber-700'
                                  : ord.normStatus === 'processing' || ord.normStatus === 'inprogress' || ord.normStatus === 'in_progress'
                                  ? isDarkMode
                                    ? 'bg-blue-950/80 border-blue-500/40 text-blue-400'
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                  : ord.normStatus === 'partial'
                                  ? isDarkMode
                                    ? 'bg-purple-950/80 border-purple-500/40 text-purple-400'
                                    : 'bg-purple-50 border-purple-200 text-purple-700'
                                  : isDarkMode
                                    ? 'bg-red-950/80 border-red-500/40 text-red-400'
                                    : 'bg-red-50 border-red-200 text-red-700'
                              }`}>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  ord.normStatus === 'completed' ? (isDarkMode ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-emerald-500') :
                                  ord.normStatus === 'pending' ? 'bg-amber-500' :
                                  ord.normStatus === 'processing' || ord.normStatus === 'inprogress' ? 'bg-blue-500 animate-pulse' :
                                  'bg-red-500'
                                }`} />
                                <span className="capitalize">{ord.normStatus === 'inprogress' ? 'In Progress' : ord.normStatus}</span>
                              </span>

                              {/* Price on top right: ₹ 24.90 */}
                              <div className={`font-mono font-black text-base sm:text-lg ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                {formatAmount(ord.charge)}
                              </div>
                            </div>

                            {/* Quantity & Start · End · Rem Counters */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono">
                              <span className={`font-extrabold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                {ord.quantity.toLocaleString()} qty
                              </span>
                              <span className={isDarkMode ? 'text-gray-600' : 'text-gray-300'}>·</span>
                              <div className={`text-[11px] flex items-center space-x-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                <span>Start <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>{ord.start}</strong></span>
                                <span className={isDarkMode ? 'text-gray-600' : 'text-gray-300'}>·</span>
                                <span>End <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>{ord.end}</strong></span>
                                <span className={isDarkMode ? 'text-gray-600' : 'text-gray-300'}>·</span>
                                <span>Rem <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>{ord.remains}</strong></span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* FULL WIDTH BRIGHT PROGRESS BAR WITH PERCENTAGE ON RIGHT */}
                        <div className="my-3 flex items-center space-x-3">
                          <div className={`relative w-full h-2.5 rounded-full overflow-hidden border shadow-inner ${
                            isDarkMode 
                              ? 'bg-zinc-800/90 border-zinc-700/60' 
                              : 'bg-gray-100 border-gray-200/90'
                          }`}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${ord.percentage}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-full ${
                                ord.normStatus === 'completed'
                                  ? 'bg-[#00e599] shadow-[0_0_12px_rgba(0,229,153,0.85)]'
                                  : ord.normStatus === 'pending'
                                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                                  : ord.normStatus === 'partial'
                                  ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.7)]'
                                  : ord.normStatus === 'cancelled' || ord.normStatus === 'refunded'
                                  ? 'bg-rose-500'
                                  : 'bg-gradient-to-r from-cyan-400 via-emerald-400 to-[#00e599] shadow-[0_0_12px_rgba(0,229,153,0.7)]'
                              }`}
                            />
                          </div>
                          <span className={`font-mono font-black text-xs sm:text-sm shrink-0 min-w-[44px] text-right ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {ord.percentage}%
                          </span>
                        </div>

                        {/* BOTTOM ACTION BUTTONS: [# Copy ID] [⎘ Copy details] [🔄 Refill] [🎧 Report] */}
                        <div className={`pt-2.5 flex flex-wrap items-center justify-between gap-2 border-t ${
                          isDarkMode ? 'border-gray-800/80' : 'border-gray-100'
                        }`}>
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Copy ID Button */}
                            <button
                              onClick={() => copyOrderId(ord.id)}
                              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center space-x-1.5 transition-all border cursor-pointer shadow-xs active:scale-95 ${
                                isDarkMode
                                  ? 'bg-[#1b202a] hover:bg-[#252c3b] text-gray-200 hover:text-white border-gray-700/60'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-200/90'
                              }`}
                            >
                              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>#</span>
                              <span>{copiedOrderId === ord.id ? 'Copied!' : 'Copy ID'}</span>
                            </button>

                            {/* Copy Details Button */}
                            <button
                              onClick={() => copyOrderDetails(ord)}
                              className={`px-3 py-1.5 rounded-lg font-sans text-xs font-bold flex items-center space-x-1.5 transition-all border cursor-pointer shadow-xs active:scale-95 ${
                                isDarkMode
                                  ? 'bg-[#1b202a] hover:bg-[#252c3b] text-gray-200 hover:text-white border-gray-700/60'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-200/90'
                              }`}
                            >
                              <Copy className={`w-3.5 h-3.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                              <span>{copiedDetailsId === ord.id ? 'Details Copied!' : 'Copy details'}</span>
                            </button>

                            {/* Refill Button (if eligible) */}
                            {(ord.refillStatus === 'none' || !ord.refillStatus) && ord.normStatus === 'completed' && (
                              <button
                                onClick={() => handleRequestRefill(ord.id)}
                                disabled={requestingRefill === ord.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                                  isDarkMode
                                    ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/50 text-emerald-400'
                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                }`}
                              >
                                <RotateCcw className={`w-3.5 h-3.5 ${requestingRefill === ord.id ? 'animate-spin' : ''}`} />
                                <span>{requestingRefill === ord.id ? 'Requesting...' : 'Request Refill'}</span>
                              </button>
                            )}

                            {ord.refillStatus === 'requested' && (
                              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 border ${
                                isDarkMode
                                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}>
                                <Clock className="w-3.5 h-3.5" />
                                <span>Refill In Progress</span>
                              </span>
                            )}
                          </div>

                          {/* Quick Support Ticket Button */}
                          <button
                            onClick={() => {
                              setTicketForm({
                                subject: `Inquiry for Order #${ord.id}`,
                                message: `Hello, I need help with my Order #${ord.id} (${ord.serviceName || ''}) on link: ${ord.link}`
                              });
                              setActiveTab('tickets');
                            }}
                            className={`px-2.5 py-1 text-xs flex items-center space-x-1 transition-colors cursor-pointer ${
                              isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'
                            }`}
                          >
                            <Headphones className="w-3.5 h-3.5 text-red-500" />
                            <span>Report Issue</span>
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className={`p-12 text-center rounded-3xl border ${
                    isDarkMode ? 'bg-[#10131a] border-[#222834] text-gray-400' : 'bg-white border-gray-200 text-gray-500'
                  }`}>
                    <Package className="w-12 h-12 mx-auto text-gray-400/60 mb-3" />
                    <h3 className={`text-base font-extrabold mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>No Orders Found</h3>
                    <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {orderSearchQuery ? 'No orders match your search query.' : 'You haven’t placed any orders yet.'}
                    </p>
                    <button
                      onClick={() => setActiveTab('new-order')}
                      className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer inline-flex items-center space-x-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Place New Order</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* TAB 4: SERVICES CATALOG */}
          {/* ========================================================================= */}
          {activeTab === 'services' && (
            <div className="bg-[#1C1C1C] rounded-3xl border border-[#2A2A2A] shadow-2xl p-6 space-y-6 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-white">Services Catalog</h2>
                  <p className="text-xs text-gray-400">Search over 2,780+ active reseller services</p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-bold focus:outline-none focus:border-[#FF3030]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#141414] border-b border-[#2A2A2A] text-gray-400 text-[11px] font-extrabold uppercase tracking-wider">
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Service Name</th>
                      <th className="px-4 py-3 text-right">Rate / 1K</th>
                      <th className="px-4 py-3 text-center">Min / Max</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A2A] text-xs font-semibold">
                    {services
                      .filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                      .map((s) => (
                        <tr key={s.id} className="hover:bg-[#252525] transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-gray-400">#{s.id}</td>
                          <td className="px-4 py-3 font-bold text-white">
                            <span>{s.name}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-[#FF3030]">{formatAmount(s.pricePerThousand)}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{s.minAmount} / {s.maxAmount}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setNewOrder({ categoryId: String(s.categoryId), serviceId: String(s.id), link: '', quantity: '', coupon: '' });
                                setActiveTab('new-order');
                              }}
                              className="px-3 py-1 rounded-xl bg-[#FF3030] hover:bg-[#E02424] text-white font-bold text-[10px] cursor-pointer shadow-sm"
                            >
                              Order
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: ADD FUNDS */}
          {/* ========================================================================= */}
          {activeTab === 'add-funds' && (
            <AddFundsSection
              token={token}
              user={user}
              publicSettings={publicSettings}
              onRefreshProfile={onRefreshProfile}
              isDarkMode={isDarkMode}
              currency={currency}
              formatAmount={formatAmount}
            />
          )}

          {/* ========================================================================= */}
          {/* TAB 6: TICKETS */}
          {/* ========================================================================= */}
          {activeTab === 'tickets' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#1C1C1C] rounded-3xl p-6 sm:p-8 border border-[#2A2A2A] shadow-2xl text-white">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-9 h-9 rounded-full bg-[#FF3030] text-white flex items-center justify-center shadow-md">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Support Tickets</h2>
                    <p className="text-xs text-gray-400">24/7 dedicated customer assistance</p>
                  </div>
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-4 mb-8">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase text-gray-400 mb-1.5">Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Order #1234 Refill Request"
                      value={ticketForm.subject}
                      onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 text-xs font-semibold focus:outline-none focus:border-[#FF3030] shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase text-gray-400 mb-1.5">Message</label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Describe your issue or order details..."
                      value={ticketForm.message}
                      onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 text-xs font-semibold focus:outline-none focus:border-[#FF3030] shadow-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 rounded-2xl bg-[#FF3030] hover:bg-[#E02424] text-white font-extrabold text-xs shadow-[0_4px_20px_rgba(255,48,48,0.35)] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Open New Ticket'}
                  </button>
                </form>

                <div className="border-t border-[#2A2A2A] pt-6">
                  <div className="font-black text-white text-sm mb-4">Your Past Tickets</div>
                  <div className="space-y-3">
                    {tickets.length > 0 ? (
                      tickets.map((t) => (
                        <div key={t.id} className="p-4 rounded-2xl bg-[#141414] border border-[#2A2A2A] text-xs flex justify-between items-center">
                          <div>
                            <div className="font-extrabold text-white">#{t.id} - {t.subject}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{t.message}</div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            t.status === 'closed' ? 'bg-[#2A2A2A] text-gray-400' : 'bg-[#FF3030]/20 text-[#FF3030]'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-xs py-4">No support tickets opened yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: API DOCUMENTATION & KEY */}
          {/* ========================================================================= */}
          {activeTab === 'api-docs' && (
            <div className={`${isDarkMode ? 'bg-[#15181E] border-[#272B33]' : 'bg-white border-gray-200/90'} rounded-3xl p-6 sm:p-8 border shadow-xs space-y-6 max-w-4xl`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Reseller API Credentials & Docs</h2>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Connect your website or panel to TrustySMM seamlessly using standard SMM API v2</p>
                </div>
              </div>

              {/* 1. API URL Box (Placed on TOP of API Key) */}
              <div className={`p-5 rounded-3xl ${isDarkMode ? 'bg-[#191C22] border-[#272B33]' : 'bg-gray-50 border-gray-200'} border space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-red-500" />
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      API URL (Endpoint)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    HTTP POST
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v2`}
                    className={`flex-1 px-4 py-2.5 rounded-2xl ${
                      isDarkMode ? 'bg-[#15181E] border-[#272B33] text-emerald-400' : 'bg-white border-gray-300 text-emerald-700'
                    } border font-mono text-xs font-bold select-all`}
                  />
                  <button
                    onClick={() => {
                      const apiUrl = `${window.location.origin}/api/v2`;
                      navigator.clipboard.writeText(apiUrl);
                      setCopiedApiUrl(true);
                      showSuccess('API URL copied to clipboard!');
                      setTimeout(() => setCopiedApiUrl(false), 2000);
                    }}
                    className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs cursor-pointer flex items-center space-x-1.5 transition-all ${
                      copiedApiUrl
                        ? 'bg-emerald-600 text-white'
                        : isDarkMode
                        ? 'bg-[#222730] hover:bg-[#2c3340] text-gray-200 border border-[#272B33]'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedApiUrl ? 'Copied!' : 'Copy URL'}</span>
                  </button>
                </div>
              </div>

              {/* 2. API Key Box (Placed under API URL) */}
              <div className={`p-5 rounded-3xl ${isDarkMode ? 'bg-[#191C22] border-[#272B33]' : 'bg-gray-50 border-gray-200'} border space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Key className="w-4 h-4 text-amber-500" />
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Your API Secret Key
                    </span>
                  </div>
                  {user.apiKey && (
                    <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                      Keep Secret
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    readOnly
                    value={user.apiKey || 'No API key generated yet. Click Generate below.'}
                    className={`flex-1 px-4 py-2.5 rounded-2xl ${
                      isDarkMode ? 'bg-[#15181E] border-[#272B33] text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                    } border font-mono text-xs font-bold select-all`}
                  />
                  <button
                    onClick={() => {
                      if (user.apiKey) {
                        navigator.clipboard.writeText(user.apiKey);
                        setCopiedApiKey(true);
                        showSuccess('API Key copied to clipboard!');
                        setTimeout(() => setCopiedApiKey(false), 2000);
                      }
                    }}
                    disabled={!user.apiKey}
                    className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs cursor-pointer flex items-center space-x-1.5 transition-all ${
                      copiedApiKey
                        ? 'bg-emerald-600 text-white'
                        : isDarkMode
                        ? 'bg-[#222730] hover:bg-[#2c3340] text-gray-200 border border-[#272B33]'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedApiKey ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleGenerateApiKey}
                    disabled={generatingApiKey}
                    className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs cursor-pointer shadow-md flex items-center space-x-1.5 transition-all shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generatingApiKey ? 'animate-spin' : ''}`} />
                    <span>{generatingApiKey ? 'Generating...' : user.apiKey ? 'Regenerate' : 'Generate Key'}</span>
                  </button>
                </div>
              </div>

              {/* 3. API Endpoint Documentation */}
              <div className="space-y-4 pt-2">
                <div className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>HTTP API Endpoints & Request Examples</div>
                <div className="p-5 rounded-2xl bg-[#0D0F12] border border-[#272B33] text-gray-100 font-mono text-xs space-y-3 overflow-x-auto shadow-inner">
                  <div className="text-emerald-400 font-bold flex items-center gap-2">
                    <span># API Endpoint URL</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 text-emerald-300 font-semibold border border-white/5">
                    POST {window.location.origin}/api/v2
                  </div>

                  <div className="text-emerald-400 font-bold pt-2"># Request Parameters (Add Order)</div>
                  <div className="text-gray-300 bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                    <div><span className="text-purple-400 font-bold">key</span> = {user.apiKey ? user.apiKey.slice(0, 10) + '...' : 'YOUR_API_KEY'}</div>
                    <div><span className="text-purple-400 font-bold">action</span> = add</div>
                    <div><span className="text-purple-400 font-bold">service</span> = 101</div>
                    <div><span className="text-purple-400 font-bold">link</span> = https://instagram.com/p/123</div>
                    <div><span className="text-purple-400 font-bold">quantity</span> = 1000</div>
                  </div>

                  <div className="text-emerald-400 font-bold pt-2"># Request Parameters (Order Status)</div>
                  <div className="text-gray-300 bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                    <div><span className="text-purple-400 font-bold">key</span> = {user.apiKey ? user.apiKey.slice(0, 10) + '...' : 'YOUR_API_KEY'}</div>
                    <div><span className="text-purple-400 font-bold">action</span> = status</div>
                    <div><span className="text-purple-400 font-bold">order</span> = 10542</div>
                  </div>

                  <div className="text-emerald-400 font-bold pt-2"># Request Parameters (User Balance)</div>
                  <div className="text-gray-300 bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                    <div><span className="text-purple-400 font-bold">key</span> = {user.apiKey ? user.apiKey.slice(0, 10) + '...' : 'YOUR_API_KEY'}</div>
                    <div><span className="text-purple-400 font-bold">action</span> = balance</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: AFFILIATE / REFER & EARN */}
          {/* ========================================================================= */}
          {activeTab === 'affiliate' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs max-w-3xl space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">{publicSettings.affiliateTitle || 'Affiliate Referral Program'}</h2>
                  <p className="text-xs text-gray-500">{publicSettings.affiliateSubtitle || 'Earn 5% lifetime commission on every deposit by referred users'}</p>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-purple-50 border border-purple-200 space-y-3">
                <div className="text-xs font-extrabold text-purple-900 uppercase tracking-wider">Your Referral Link</div>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?ref=${user.id || 15}`}
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-white border border-purple-300 font-mono text-xs text-gray-900 font-bold"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?ref=${user.id || 15}`);
                      showSuccess('Referral link copied!');
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs cursor-pointer"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 9: REFILL HISTORY */}
          {/* ========================================================================= */}
          {activeTab === 'refill-history' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Refill Requests History</h2>
                  <p className="text-xs text-gray-500">Track and monitor your automatic refill warranty tasks</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] font-black uppercase text-gray-400">
                      <th className="pb-3">Refill ID</th>
                      <th className="pb-3">Order ID</th>
                      <th className="pb-3">Service</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {refillRequestsList.length > 0 ? (
                      refillRequestsList.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-3 font-mono font-bold text-gray-900">#{r.id || idx + 101}</td>
                          <td className="py-3 font-mono text-gray-600">#{r.orderId}</td>
                          <td className="py-3 font-bold text-gray-900">{r.serviceName || 'Refill Task'}</td>
                          <td className="py-3">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                              {r.status || 'Processing'}
                            </span>
                          </td>
                          <td className="py-3 text-gray-500 font-mono text-[11px]">
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Just now'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">
                          No refill requests found. Click Refill button on any eligible completed order.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 10: CHILD PANELS */}
          {/* ========================================================================= */}
          {activeTab === 'child-panels' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">{publicSettings.childPanelTitle || 'Rent a Child Panel'}</h2>
                    <p className="text-xs text-gray-500">{publicSettings.childPanelDescription || 'Start your own automated SMM panel website connected to our provider API'}</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs">
                  <span className="font-extrabold">Price: </span>
                  <span className="font-black text-sm">{publicSettings.childPanelPrice || '₹ 1,500 / month'}</span>
                  <p className="text-[11px] text-teal-700 mt-1">Set your nameservers to: <span className="font-mono font-bold">{publicSettings.childPanelNameservers || 'ns1.trustysmm.in & ns2.trustysmm.in'}</span></p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setOrderingChildPanel(true);
                    setTimeout(() => {
                      setOrderingChildPanel(false);
                      setChildPanelsList([
                        ...childPanelsList,
                        { id: Date.now(), domain: childPanelForm.domain, currency: childPanelForm.currency, status: 'Active', createdAt: new Date().toISOString() }
                      ]);
                      setChildPanelForm({ domain: '', currency: 'INR', adminUsername: '', adminPassword: '' });
                      showSuccess('Child panel order placed successfully! DNS propagation takes 1-2 hours.');
                    }, 1000);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase text-gray-600 mb-1.5">Domain Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. my-smm-store.com"
                      value={childPanelForm.domain}
                      onChange={(e) => setChildPanelForm({ ...childPanelForm, domain: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-gray-300 text-gray-900 text-xs font-semibold focus:outline-none focus:border-teal-600 shadow-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase text-gray-600 mb-1.5">Admin Username</label>
                      <input
                        type="text"
                        required
                        placeholder="admin"
                        value={childPanelForm.adminUsername}
                        onChange={(e) => setChildPanelForm({ ...childPanelForm, adminUsername: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-2xl bg-white border border-gray-300 text-gray-900 text-xs font-semibold focus:outline-none focus:border-teal-600 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase text-gray-600 mb-1.5">Admin Password</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={childPanelForm.adminPassword}
                        onChange={(e) => setChildPanelForm({ ...childPanelForm, adminPassword: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-2xl bg-white border border-gray-300 text-gray-900 text-xs font-semibold focus:outline-none focus:border-teal-600 shadow-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={orderingChildPanel}
                    className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
                  >
                    {orderingChildPanel ? 'Ordering...' : 'Order Child Panel'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs space-y-4">
                <div className="font-black text-gray-900 text-sm">Your Child Panels</div>
                <div className="space-y-3">
                  {childPanelsList.length > 0 ? (
                    childPanelsList.map((cp) => (
                      <div key={cp.id} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-extrabold text-gray-900">{cp.domain}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{cp.currency} Panel</div>
                        </div>
                        <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Active</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-xs py-8 text-center">No active child panels yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 11: BLOGS & NEWS */}
          {/* ========================================================================= */}
          {activeTab === 'blogs' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs space-y-6 max-w-4xl">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Latest Blogs & Industry News</h2>
                  <p className="text-xs text-gray-500">Tips, tutorials, and organic social media growth strategies</p>
                </div>
              </div>

              {selectedBlog ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedBlog(null)}
                    className="text-xs font-bold text-red-600 hover:underline flex items-center space-x-1"
                  >
                    <span>← Back to all posts</span>
                  </button>
                  <h3 className="text-2xl font-black text-gray-900">{selectedBlog.title}</h3>
                  <div className="text-xs text-gray-400 font-mono">
                    Published on {new Date(selectedBlog.createdAt).toLocaleDateString()}
                  </div>
                  <div className="prose prose-sm text-gray-700 leading-relaxed max-w-none pt-4 border-t border-gray-200">
                    {selectedBlog.content}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {blogs.length > 0 ? (
                    blogs.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBlog(b)}
                        className="p-5 rounded-3xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200 transition-all cursor-pointer space-y-2 group"
                      >
                        <h4 className="font-extrabold text-gray-900 group-hover:text-red-600 transition-colors text-sm line-clamp-2">
                          {b.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-3">
                          {b.content}
                        </p>
                        <div className="text-[10px] text-gray-400 font-mono pt-2 flex items-center justify-between">
                          <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                          <span className="text-red-600 font-bold">Read more →</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-12 text-gray-400 text-xs">
                      No blog posts published yet. Stay tuned for updates!
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 12: FAQ */}
          {/* ========================================================================= */}
          {activeTab === 'faq' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs space-y-6 max-w-3xl">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Frequently Asked Questions</h2>
                  <p className="text-xs text-gray-500">Quick answers to common questions about orders, payments & refill</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {publicSettings.faqContent ? (
                  <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {publicSettings.faqContent}
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                      <div className="font-extrabold text-gray-900 text-sm">How fast do orders start?</div>
                      <p className="text-gray-600 leading-relaxed">Most automated orders start within 0-15 minutes after placing. Speed depends on the specific service guarantee stated in the description.</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                      <div className="font-extrabold text-gray-900 text-sm">What is Refill Warranty?</div>
                      <p className="text-gray-600 leading-relaxed">If you experience natural social media drops within the guarantee duration (e.g. 30 Days Refill), simply open Refill History or submit a ticket and our system will restore the count for free.</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                      <div className="font-extrabold text-gray-900 text-sm">How do I add funds via UPI or Cards?</div>
                      <p className="text-gray-600 leading-relaxed">Navigate to Add Funds tab, enter your desired amount, scan the QR or select your preferred gateway, and enter the transaction reference ID for automatic balance crediting.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: AI CHAT SUPPORT */}
          {/* ========================================================================= */}
          {activeTab === 'ai-chat' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                    <span className="text-red-500">🤖</span> {publicSettings.websiteName || 'TrustySMM'} AI Assistant
                  </h2>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Ask anything about orders, services, payments, UTR verification, refill warranty, or connect with Telegram
                  </p>
                </div>
              </div>

              <AiChatBot
                isEmbedded={true}
                userId={user.id}
                userName={user.username || user.name || 'User'}
                isDarkMode={isDarkMode}
                latestOrderId={orders && orders.length > 0 ? orders[0].id : undefined}
                onNavigateTab={(tab) => setActiveTab(tab)}
                whatsappNumber={publicSettings.whatsappNumber || '8795005604'}
                telegramUsername={publicSettings.telegramUsername || '@securesmmtursted'}
                telegramChannel={publicSettings.telegramChannel || 'https://t.me/securesmmtursted'}
                websiteName={publicSettings.websiteName || 'TrustySMM'}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 13: CONTACT / SUPPORT */}
          {/* ========================================================================= */}
          {activeTab === 'contact-us' && (
            <div className={`${isDarkMode ? 'bg-[#15181E] border-[#272B33]' : 'bg-white border-gray-200/90'} rounded-3xl p-6 sm:p-8 border shadow-xs space-y-6 max-w-3xl`}>
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Direct Support Channels</h2>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Reach our 24/7 AI smart assistant or human customer support specialists</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* WhatsApp Support Direct Channel */}
                <a
                  href={`https://wa.me/91${(publicSettings.whatsappNumber || '8795005604').replace(/[^0-9]/g, '') || '8795005604'}?text=${encodeURIComponent(`Hello ${publicSettings.websiteName || 'TrustySMM'} Support, I need help with my account.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`p-5 rounded-3xl ${isDarkMode ? 'bg-[#191C22] border-emerald-500/30 hover:bg-[#272B33]' : 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200'} border transition-all flex items-center space-x-4 cursor-pointer group`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform shadow-sm">
                    <WhatsAppIcon className="w-6 h-6 fill-white" />
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-emerald-500 flex items-center space-x-1">
                      <span>WhatsApp Support</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className={`font-mono font-black ${isDarkMode ? 'text-white' : 'text-gray-900'} text-sm`}>
                      +91 {publicSettings.whatsappNumber || '8795005604'}
                    </div>
                    <div className="text-[10px] text-emerald-500 font-semibold">24x7 Live Direct Chat & Orders Help</div>
                  </div>
                </a>

                {/* TrustySMM AI Assistant */}
                <div
                  onClick={() => setActiveTab('ai-chat')}
                  className={`p-5 rounded-3xl ${isDarkMode ? 'bg-[#191C22] border-red-500/30 hover:bg-[#272B33]' : 'bg-red-50 hover:bg-red-100/80 border-red-200'} border transition-all flex items-center space-x-4 cursor-pointer group`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform shadow-sm">
                    🤖
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-red-500 flex items-center space-x-1">
                      <span>TrustySMM AI Assistant</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className={`font-mono font-black ${isDarkMode ? 'text-white' : 'text-gray-900'} text-sm`}>24x7 Instant AI Bot</div>
                    <div className="text-[10px] text-red-400 font-semibold">Live Order Status & Guidance</div>
                  </div>
                </div>

                {/* Telegram */}
                <a
                  href={publicSettings.telegramUsername ? (publicSettings.telegramUsername.startsWith('http') ? publicSettings.telegramUsername : `https://t.me/${publicSettings.telegramUsername.replace('@', '')}`) : 'https://t.me/securesmmtursted'}
                  target="_blank"
                  rel="noreferrer"
                  className={`p-5 rounded-3xl ${isDarkMode ? 'bg-[#191C22] border-sky-500/30 hover:bg-[#272B33]' : 'bg-sky-50 hover:bg-sky-100/80 border-sky-200'} border transition-all flex items-center space-x-4 cursor-pointer group`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform shadow-sm">
                    ✈️
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-sky-400">Telegram Channel</div>
                    <div className={`font-mono font-black ${isDarkMode ? 'text-white' : 'text-gray-900'} text-sm`}>{publicSettings.telegramUsername || '@securesmmtursted'}</div>
                    <div className="text-[10px] text-sky-400 font-semibold">Official Updates & Support</div>
                  </div>
                </a>

                {/* Email Support */}
                <div className={`p-5 rounded-3xl ${isDarkMode ? 'bg-[#191C22] border-purple-500/30' : 'bg-purple-50 border-purple-200'} border flex items-center space-x-4`}>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                    ✉️
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-purple-400">Email Helpdesk</div>
                    <div className={`font-mono font-black ${isDarkMode ? 'text-white' : 'text-gray-900'} text-xs truncate max-w-[180px]`}>
                      {publicSettings.supportEmail || 'support@trustysmm.in'}
                    </div>
                    <div className="text-[10px] text-purple-400 font-semibold">{publicSettings.supportWorkingHours || '24x7 Customer Helpdesk'}</div>
                  </div>
                </div>

                {/* Open Ticket Button */}
                <button
                  onClick={() => setActiveTab('tickets')}
                  className={`p-5 rounded-3xl ${isDarkMode ? 'bg-[#191C22] border-rose-500/30 hover:bg-[#272B33]' : 'bg-rose-50 hover:bg-rose-100/80 border-rose-200'} border transition-all flex items-center space-x-4 text-left cursor-pointer group`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform shadow-sm">
                    🎫
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-rose-400">Support Ticket</div>
                    <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} text-sm`}>Open High Priority Ticket</div>
                    <div className="text-[10px] text-rose-400 font-semibold">Guaranteed Human Reply</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 3. REWARDS & LEVELS MODAL */}
      {/* ========================================================================= */}
      {showRewardsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`${isDarkMode ? 'bg-[#15181E] border border-[#272B33] text-white' : 'bg-white border border-gray-200 text-gray-900'} rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative`}>
            <button
              onClick={() => setShowRewardsModal(false)}
              className={`absolute right-5 top-5 w-8 h-8 rounded-full ${isDarkMode ? 'bg-[#191C22] hover:bg-[#191C22] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'} flex items-center justify-center font-bold`}
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Rewards & Level Tier</h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Spend more to unlock instant VIP discounts & free wallet credits</p>
              </div>
            </div>

            <div className="space-y-3 my-6 text-xs font-semibold">
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-[#191C22] border-[#272B33]' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                <div>
                  <div className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>🥉 {publicSettings.sidebarLevelName || 'Bronze Level 3'} (Current)</div>
                  <div className={`text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{publicSettings.sidebarXpText || '66/120 XP'} &middot; {publicSettings.level1Perk || 'Standard Rates'}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-600/20 text-emerald-400 font-bold text-[10px]">Active</span>
              </div>

              <div className={`p-4 rounded-2xl border flex items-center justify-between opacity-80 ${isDarkMode ? 'bg-[#191C22] border-[#272B33]' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                <div>
                  <div className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>🥈 Silver Reseller</div>
                  <div className={`text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{publicSettings.level2Perk || '300 XP · 2% Lifetime Discount'}</div>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">Locked</span>
              </div>

              <div className={`p-4 rounded-2xl border flex items-center justify-between opacity-80 ${isDarkMode ? 'bg-[#191C22] border-[#272B33]' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                <div>
                  <div className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>🥇 Gold VIP</div>
                  <div className={`text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{publicSettings.level3Perk || '1000 XP · 5% Lifetime Discount'}</div>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">Locked</span>
              </div>
            </div>

            <button
              onClick={() => setShowRewardsModal(false)}
              className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TERMS & CONDITIONS MODAL */}
      {/* ========================================================================= */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-gray-200 shadow-2xl relative text-left max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowTermsModal(false)}
              className="absolute right-5 top-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Terms of Service</h3>
                <p className="text-xs text-gray-500">{publicSettings.websiteName || 'TrustySMM'} User Agreement & Policies</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 text-xs text-gray-700 space-y-4 leading-relaxed font-normal">
              {publicSettings.termsOfService ? (
                <div className="whitespace-pre-wrap">{publicSettings.termsOfService}</div>
              ) : (
                <>
                  <p>1. By placing an order with {publicSettings.websiteName || 'TrustySMM'}, you automatically accept all the below listed terms of services whether you read them or not.</p>
                  <p>2. We reserve the right to change these terms of service without notice. You are expected to read all terms before placing every order to ensure you are up to date with any changes.</p>
                  <p>3. {publicSettings.websiteName || 'TrustySMM'} rates are subject to change at any time without notice. The payment/refund policy stays in effect in the case of rate changes.</p>
                  <p>4. Disclaimer: {publicSettings.websiteName || 'TrustySMM'} will not be responsible for any damages you or your business may suffer.</p>
                </>
              )}
            </div>

            <button
              onClick={() => setShowTermsModal(false)}
              className="w-full mt-6 py-3 rounded-2xl bg-gray-900 hover:bg-black text-white font-extrabold text-xs shadow-md cursor-pointer"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PRIVACY POLICY MODAL */}
      {/* ========================================================================= */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-gray-200 shadow-2xl relative text-left max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="absolute right-5 top-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Privacy Policy</h3>
                <p className="text-xs text-gray-500">How we protect your confidential account information</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 text-xs text-gray-700 space-y-4 leading-relaxed font-normal">
              {publicSettings.privacyPolicy ? (
                <div className="whitespace-pre-wrap">{publicSettings.privacyPolicy}</div>
              ) : (
                <>
                  <p>1. We strictly protect and value your privacy. All your personal data is handled securely and will never be shared with or sold to third parties.</p>
                  <p>2. We only use your information (such as email and order links) to process your orders, deliver customer support, and communicate essential panel updates.</p>
                  <p>3. All payment transaction data is encrypted and processed through certified PCI-DSS compliant payment gateways.</p>
                </>
              )}
            </div>

            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full mt-6 py-3 rounded-2xl bg-gray-900 hover:bg-black text-white font-extrabold text-xs shadow-md cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABOUT US MODAL */}
      {/* ========================================================================= */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-gray-200 shadow-2xl relative text-left max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowAboutModal(false)}
              className="absolute right-5 top-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">About {publicSettings.websiteName || 'TrustySMM'}</h3>
                <p className="text-xs text-gray-500">Automated Social Media Growth & SMM Reseller Platform</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 text-xs text-gray-700 space-y-4 leading-relaxed font-normal">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
                <h4 className="font-bold text-gray-900 text-xs">What is {publicSettings.websiteName || 'TrustySMM'}?</h4>
                <p>
                  <strong>{publicSettings.websiteName || 'TrustySMM'}</strong> is a high-speed, automated Social Media Marketing (SMM) reseller panel. We provide high-retention promotion packages for Instagram, YouTube, Facebook, Telegram, TikTok, and Twitter/X with instant execution.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 text-xs mb-2">Key Features & Services:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="font-bold text-red-600">⚡ Automated 24/7 Delivery:</span> High-speed API execution with real-time order tracking.
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="font-bold text-emerald-600">💰 Wholesale Rates:</span> Starting from just ₹1 per 1,000 interactions with zero hidden fees.
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="font-bold text-blue-600">🔒 100% Safe:</span> No account password needed. Only public post or profile link required.
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="font-bold text-purple-600">🔌 Reseller API:</span> Seamless REST API integration for automated resellers and child panels.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-900 text-[11px]">
                <strong>24/7 Support:</strong> Need assistance with an order? Open a support ticket or join our Telegram channel at <strong>@securesmmtursted</strong>.
              </div>
            </div>

            <button
              onClick={() => setShowAboutModal(false)}
              className="w-full mt-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ACCOUNT SETTINGS MODAL */}
      {/* ========================================================================= */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 border border-gray-200 shadow-2xl relative text-left">
            <button
              onClick={() => setShowAccountModal(false)}
              className="absolute right-5 top-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Account Profile</h3>
                <p className="text-xs text-gray-500">Manage your credentials and information</p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-gray-500 font-bold uppercase text-[10px]">Email Address</label>
                <input
                  type="text"
                  readOnly
                  value={user.email}
                  className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-100 border border-gray-200 text-gray-700 font-bold"
                />
              </div>

              <div>
                <label className="text-gray-500 font-bold uppercase text-[10px]">Account Role</label>
                <input
                  type="text"
                  readOnly
                  value={user.role === 'admin' ? 'Administrator' : 'Standard User'}
                  className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-100 border border-gray-200 text-gray-700 font-bold uppercase"
                />
              </div>

              <div>
                <label className="text-gray-500 font-bold uppercase text-[10px]">Wallet Balance</label>
                <div className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-black text-sm">
                  {formatAmount(user.balance)}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAccountModal(false)}
              className="w-full mt-6 py-3 rounded-2xl bg-gray-900 hover:bg-black text-white font-extrabold text-xs shadow-md cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Quick Bar (5-Item Layout with Raised Center Floating Funds Button) */}
      <nav
        aria-label="Mobile Navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 px-2 sm:px-4 pt-2 border-t transition-colors duration-200 ${
          isDarkMode
            ? 'bg-[#0D0F12]/95 border-white/10 text-gray-400 shadow-[0_-4px_25px_rgba(0,0,0,0.4)] backdrop-blur-md'
            : 'bg-white/95 border-gray-200/90 text-gray-500 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] backdrop-blur-md'
        }`}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-5 items-end justify-items-center w-full max-w-md mx-auto">
          {/* 1. New Order */}
          <button
            type="button"
            onClick={() => setActiveTab('new-order')}
            className={`w-full flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-90 cursor-pointer ${
              activeTab === 'new-order'
                ? 'text-red-600 dark:text-red-500 font-bold'
                : isDarkMode
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Zap className={`w-5 h-5 transition-transform ${activeTab === 'new-order' ? 'scale-110 fill-red-600/20' : ''}`} />
            <span className="text-[11px] mt-1 font-semibold tracking-tight truncate">New</span>
          </button>

          {/* 2. Orders */}
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`w-full flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-90 cursor-pointer ${
              activeTab === 'orders'
                ? 'text-red-600 dark:text-red-500 font-bold'
                : isDarkMode
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Package className={`w-5 h-5 transition-transform ${activeTab === 'orders' ? 'scale-110' : ''}`} />
            <span className="text-[11px] mt-1 font-semibold tracking-tight truncate">Orders</span>
          </button>

          {/* 3. Center Floating Funds Button */}
          <button
            type="button"
            onClick={() => setActiveTab('add-funds')}
            className="w-full flex flex-col items-center justify-center -mt-6 cursor-pointer group focus:outline-none"
          >
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-all duration-200 active:scale-90 group-hover:scale-105 ring-4 ${
                isDarkMode ? 'ring-[#0D0F12]' : 'ring-white'
              } ${activeTab === 'add-funds' ? 'ring-red-500/30' : ''}`}
            >
              <Plus className="w-7 h-7 stroke-[2.75] text-white" />
            </div>
            <span
              className={`text-[11px] mt-1 font-bold tracking-tight truncate transition-colors ${
                activeTab === 'add-funds'
                  ? 'text-red-600 dark:text-red-500'
                  : isDarkMode
                  ? 'text-gray-400'
                  : 'text-gray-500'
              }`}
            >
              Funds
            </span>
          </button>

          {/* 4. Services */}
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`w-full flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-90 cursor-pointer ${
              activeTab === 'services'
                ? 'text-red-600 dark:text-red-500 font-bold'
                : isDarkMode
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className={`w-5 h-5 transition-transform ${activeTab === 'services' ? 'scale-110' : ''}`} />
            <span className="text-[11px] mt-1 font-semibold tracking-tight truncate">Services</span>
          </button>

          {/* 5. More */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`w-full flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-90 cursor-pointer ${
              mobileMenuOpen || ['tickets', 'ai-chat', 'refill-history', 'child-panels', 'affiliate', 'blogs', 'faq', 'contact-us', 'api-docs'].includes(activeTab)
                ? 'text-red-600 dark:text-red-500 font-bold'
                : isDarkMode
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Menu className="w-5 h-5 transition-transform" />
            <span className="text-[11px] mt-1 font-semibold tracking-tight truncate">More</span>
          </button>
        </div>
      </nav>

      {/* Floating Left Side WhatsApp Support Button */}
      <WhatsAppSupportButton
        phoneNumber={publicSettings.whatsappNumber || '8795005604'}
        isDarkMode={isDarkMode}
        websiteName={publicSettings.websiteName || 'TrustySMM'}
        userName={user.username || user.name || 'User'}
      />

      {/* Floating TrustySMM AI Chat Assistant */}
      <AiChatBot
        isEmbedded={false}
        userId={user.id}
        userName={user.username || user.name || 'User'}
        isDarkMode={isDarkMode}
        latestOrderId={orders && orders.length > 0 ? orders[0].id : undefined}
        onNavigateTab={(tab) => setActiveTab(tab)}
        whatsappNumber={publicSettings.whatsappNumber || '8795005604'}
        telegramUsername={publicSettings.telegramUsername || '@securesmmtursted'}
        telegramChannel={publicSettings.telegramChannel || 'https://t.me/securesmmtursted'}
        websiteName={publicSettings.websiteName || 'TrustySMM'}
      />
    </div>
  );
};

export default UserDashboard;
