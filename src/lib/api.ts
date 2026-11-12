/**
 * Centralized API configuration & robust request helpers for TrustySMM.
 * Seamlessly supports both unified full-stack deployments (same-origin /api/...)
 * and separated frontend/backend deployments (via VITE_API_URL environment variable).
 */

const RAW_API_BASE = ((import.meta as any).env?.VITE_API_URL || '').trim();

// Strip trailing slashes and normalize API Base URL
export const API_BASE_URL = (() => {
  if (!RAW_API_BASE) return '';
  if (typeof window !== 'undefined') {
    try {
      const currentHost = window.location.hostname;
      const currentOrigin = window.location.origin;

      // 1. If running on Cloud Run, AI Studio preview, localhost, or same container, ALWAYS use local relative /api routes
      if (
        currentHost === 'localhost' ||
        currentHost === '127.0.0.1' ||
        currentHost.includes('.run.app') ||
        currentHost.includes('webcontainer') ||
        currentHost.includes('google')
      ) {
        return '';
      }

      // 2. If running on trustysmm.in, frontend and backend are unified on Vercel
      if (currentHost.includes('trustysmm.in')) {
        return '';
      }

      // 3. If RAW_API_BASE matches current origin, use relative paths
      if (RAW_API_BASE === currentOrigin) {
        return '';
      }
    } catch (_) {}
  }

  // 4. Normalize trustysmm.in to avoid 308 redirect dropping CORS headers
  let normalized = RAW_API_BASE.replace(/\/+$/, '');
  if (normalized === 'https://trustysmm.in' || normalized === 'http://trustysmm.in') {
    normalized = 'https://www.trustysmm.in';
  }

  return normalized;
})();

/**
 * Returns the fully-qualified API URL for any given path or endpoint.
 * @param path e.g. "/api/public-settings" or "api/auth/login" or "/public-settings"
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (API_BASE_URL) {
    // If path already starts with /api, append to base
    if (cleanPath.startsWith('/api/')) {
      return `${API_BASE_URL}${cleanPath}`;
    }
    // If path is e.g. "/public-settings", prefix with /api
    return `${API_BASE_URL}/api${cleanPath}`;
  }
  
  // Same-origin relative path
  if (cleanPath.startsWith('/api/')) {
    return cleanPath;
  }
  return `/api${cleanPath}`;
}

/**
 * Safe JSON parser helper that validates HTTP status and Content-Type header
 * before attempting to parse JSON. Prevents `Unexpected token '<'` / HTML parser crashes.
 */
export async function safeParseResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
      }
      return data as T;
    } catch (err: any) {
      if (!res.ok && err.message) {
        throw err;
      }
      throw new Error('Invalid JSON format received from server.');
    }
  }

  // Non-JSON response (e.g. HTML 404, plain text error)
  const rawText = await res.text();
  const previewText = rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 150);
  
  if (!res.ok) {
    throw new Error(previewText || `Server returned HTTP ${res.status} (${res.statusText})`);
  }
  
  throw new Error(`Expected JSON response but server returned ${contentType || 'text'}: ${previewText}`);
}

export const DEFAULT_PUBLIC_SETTINGS: Record<string, string> = {
  websiteLogo: '',
  favicon: '',
  websiteName: 'TrustySMM',
  defaultLanguage: 'en',
  homepageYoutubeId: '',
  addFundPageContent: '<div class="space-y-4"><p class="text-gray-300">You can add funds via All UPI, PhonePe, Binance Pay, or Crypto.</p></div>',
  orderIdSkip: '0',
  seoKeywords: 'trustysmm, smm panel, cheapest smm panel, instagram followers, telegram members, youtube views',
  seoDescription: 'TrustySMM is the #1 trusted and cheapest SMM panel for Instagram, YouTube, Telegram & Facebook. Instant automated delivery, real growth & 24/7 support.',
  headerCode: '',
  footerCode: '',
  headerCodeAfterLogin: '',
  whatsappNumber: '8795005604',
  telegramUsername: '@securesmmtursted',
  telegramChannel: 'https://t.me/securesmmtursted',
  activeTheme: 'candid',
  allUpiStatus: 'enabled',
  allUpiTitle: 'All UPI Payments',
  allUpiVpa: 'BHARATPE2H0D0Q1Y4T29351@unitype',
  allUpiMerchantName: 'PRIYA',
  allUpiQrUrl: 'https://cdn.phototourl.com/free/2026-08-19-fb27bf3a-b964-4e34-8c41-baf3080dd047.jpg',
  allUpiInstructions: 'Scan with PhonePe, Google Pay, Paytm, BharatPe, or any UPI app to complete payment.',
  bharatpePhone: '8795005604',
  bharatpeMerchantName: 'trustysmm',
  bharatpeVpa: 'BHARATPE2H0D0Q1Y4T29351@unitype',
  bharatpeStatus: 'linked',
  bharatpeQrUrl: 'https://cdn.phototourl.com/free/2026-08-18-f25c7129-6d72-4b7a-9d01-b64aafa3d060.jpg',
  phonepeStatus: 'disabled',
  phonepeTitle: 'PhonePe Only',
  phonepeVpa: '8795005604@ybl',
  phonepeMerchantName: 'TrustySMM PhonePe',
  phonepeBonusStatus: 'enabled',
  phonepeBonusTitle: 'PhonePe Only (QR 2)',
  phonepeBonusVpa: '8795005604@ibl',
  phonepeBonusMerchantName: 'TrustySMM PhonePe QR 2',
  phonepeBonusPercent: '2',
  phonepeBonusMinAmount: '1000',
  binanceStatus: 'enabled',
  binanceTitle: 'Binance Pay',
  binancePayId: '912837465',
  cryptoStatus: 'enabled',
  cryptoTitle: 'Heleket (Crypto)',
  cryptoWalletAddress: 'TX9b57K8wX9q1mN4P2rS8tUvWxYzAbCdEf',
  cryptoNetwork: 'USDT (TRC20) / TRX',
  cryptoMerchantName: 'TrustySMM Crypto Treasury',
  paytmStatus: 'enabled',
  paytmTitle: 'Paytm Only',
  paytmVpa: '8795005604@paytm',
  paytmMerchantName: 'TrustySMM Paytm',
  gpayStatus: 'enabled',
  gpayTitle: 'Google Pay',
  gpayVpa: '8795005604@okaxis',
  gpayMerchantName: 'TrustySMM Google Pay',
  stripeStatus: 'disabled',
  paypalStatus: 'disabled',
  usdManualStatus: 'disabled',
  razorpayStatus: 'disabled',
  upiStatus: 'enabled',
  inrStripeStatus: 'disabled',
  inrManualStatus: 'disabled',
  upiDirectVpa: '8795005604',
  upiDirectMerchantName: 'Mukul bhatt',
  upiDirectQrUrl: 'upi://pay?pa=BHARATPE2H0D0Q1Y4T29351@unitype&pn=Priya&cu=INR&tn=Pay%20To%20Priya',
  googleLoginStatus: 'enabled',
  googleClientId: (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '',
  adminEmail: 'aviral2340b@gmail.com, rujdr368@gmail.com',
  inrToUsdRate: '0.012',
  inrToEurRate: '0.011',
  inrToPkrRate: '3.32',
  bannerStatus: 'enabled',
  bannerBadge: 'FREE WALLET CREDIT',
  bannerTitle: 'Earn up to ₹ 200 in free credit',
  bannerSubtitle: 'Leave a review for ₹ 25 · make a promo video for ₹ 200',
  bannerBtnText: 'Earn now →',
  bannerBtnLink: 'affiliate',
  greetingNotice: 'Place a new order in a few taps — orders delivered on TrustySMM | Main SMM Provider.',
  childPanelPrice: '₹ 1,500 / month',
  childPanelTitle: 'Rent a Child Panel',
  childPanelDescription: 'Start your own automated SMM panel website connected to our provider API',
  statsOrdersDelivered: '25,000',
  statsRegisteredUsers: '10,000',
  statsActiveServices: '2,487',
  statsOrdersToday: '1,188'
};

/**
 * Resilient fetcher for public settings with caching, fallback, and retry logic.
 */
export async function fetchPublicSettings(): Promise<Record<string, string>> {
  let cached: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('trustysmm_public_settings');
      if (stored) {
        cached = JSON.parse(stored);
      }
    } catch (_) {}
  }

  const endpointsToTry: string[] = ['/api/public-settings'];
  const primaryUrl = getApiUrl('/api/public-settings');
  if (primaryUrl !== '/api/public-settings' && !endpointsToTry.includes(primaryUrl)) {
    endpointsToTry.push(primaryUrl);
  }

  for (const url of endpointsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data && typeof data === 'object') {
              const merged = { ...DEFAULT_PUBLIC_SETTINGS, ...cached, ...data };
              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('trustysmm_public_settings', JSON.stringify(merged));
                  if (merged.websiteLogo) localStorage.setItem('websiteLogo', merged.websiteLogo);
                  if (merged.websiteName) localStorage.setItem('websiteName', merged.websiteName);
                } catch (_) {}
              }
              return merged;
            }
          }
        }
      } catch (err) {
        // Retry delay if first attempt fails
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
  }

  // Fallback to cache or defaults
  return { ...DEFAULT_PUBLIC_SETTINGS, ...cached };
}

/**
 * Robust fetch wrapper with automatic URL resolution, JSON headers, and safe parsing.
 */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = getApiUrl(endpoint);
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    return safeParseResponse<T>(response);
  } catch (err: any) {
    // If external absolute URL failed, retry with local relative URL
    if (url.startsWith('http') && typeof window !== 'undefined') {
      const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const relativeUrl = cleanPath.startsWith('/api/') ? cleanPath : `/api${cleanPath}`;
      try {
        const fallbackRes = await fetch(relativeUrl, {
          ...options,
          headers,
        });
        return safeParseResponse<T>(fallbackRes);
      } catch (_) {}
    }
    throw err;
  }
}
