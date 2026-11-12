// Centralized SEO Metadata Engine for TrustySMM
// Ensures clean, duplicate-free, and high-impact SEO metadata for public and private routes.

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  noIndex?: boolean;
  ogType?: string;
  image?: string;
}

export const CANONICAL_SITE_URL = 'https://www.trustysmm.in';
export const DEFAULT_OG_IMAGE = 'https://www.trustysmm.in/favicon-512x512.png';
export const DEFAULT_KEYWORDS =
  'trustysmm, trusty smm, best smm panel, cheapest smm panel india, main smm provider, smm reseller panel, buy instagram followers cheap, youtube watch time panel, telegram members panel, facebook followers panel, instant smm panel, smm panel upi, bharatpe qr smm panel, fastest smm panel 2026, social media marketing panel';

export const PRIMARY_SEO: SeoConfig = {
  title: 'TrustySMM – #1 Best & Cheapest SMM Panel | Main SMM Provider',
  description:
    'TrustySMM is the #1 main SMM provider and cheapest reseller panel in India. Instant automated delivery for Instagram followers, YouTube watch time, Telegram members & Facebook with 24/7 UPI & QR payments.',
  keywords: DEFAULT_KEYWORDS,
  canonicalPath: '/',
  noIndex: false,
  ogType: 'website',
  image: DEFAULT_OG_IMAGE,
};

export const PAGE_SEO_REGISTRY: Record<string, SeoConfig> = {
  home: PRIMARY_SEO,
  services: {
    title: 'All SMM Services & Pricing – Instagram, Facebook & Telegram | TrustySMM',
    description:
      'Explore affordable social media marketing services with instant delivery. Buy real Instagram followers, Facebook likes, and Telegram members on TrustySMM.',
    keywords: 'smm services list, buy instagram followers cheap, youtube subscribers smm, telegram members buy, cheap smm services, trustysmm pricing, facebook likes smm',
    canonicalPath: '/services',
    noIndex: false,
  },
  blog: {
    title: 'Social Media Marketing Blog & Growth Guides | TrustySMM',
    description:
      'Read proven social media growth strategies, algorithm insights, and marketing tips for Instagram, YouTube, Telegram, and Facebook on TrustySMM.',
    keywords: 'smm growth guide, instagram algorithm tips 2026, youtube watch time tricks, telegram channel marketing, smm reseller tips, social media growth strategies',
    canonicalPath: '/blog',
    noIndex: false,
  },
  faq: {
    title: 'Frequently Asked Questions & Help Center | TrustySMM',
    description:
      'Find answers to common questions regarding orders, payments, automated delivery, refill policies, and child panels on TrustySMM.',
    keywords: 'trustysmm faq, smm panel payment help, upi payment smm, refund policy smm, refill smm panel',
    canonicalPath: '/faq',
    noIndex: false,
  },
  'api-docs': {
    title: 'SMM Reseller API Documentation & Integration | TrustySMM',
    description:
      'Connect your reseller website or panel to TrustySMM using our high-speed REST API. Automate order placement, refills, and balance checks.',
    keywords: 'smm api, smm reseller api, trustysmm api docs, automated smm orders api, v2 smm api, smm panel rest api',
    canonicalPath: '/api-docs',
    noIndex: false,
  },
  'child-panels': {
    title: 'Start Your Own SMM Reseller Business – Child Panels | TrustySMM',
    description:
      'Launch your fully branded social media marketing panel in minutes. Connect directly to TrustySMM with automatic service syncing and easy payment gateways.',
    keywords: 'smm child panel, start smm panel, smm reseller panel business, trustysmm child panel, white label smm panel',
    canonicalPath: '/child-panels',
    noIndex: false,
  },
  affiliates: {
    title: 'Affiliate Partner Program – Earn Lifetime Commission | TrustySMM',
    description:
      'Earn recurring lifetime commissions by inviting creators, agencies, and businesses to TrustySMM. Instant payouts and real-time affiliate tracking.',
    canonicalPath: '/affiliates',
    noIndex: false,
  },
  about: {
    title: 'About TrustySMM – Reliable Global Social Media Partner',
    description:
      'Learn about TrustySMM, our mission, 24/7 automated infrastructure, and why thousands of creators and agencies trust us for social media growth.',
    canonicalPath: '/about',
    noIndex: false,
  },
  contact: {
    title: 'Contact & 24/7 Customer Support | TrustySMM',
    description:
      'Get 24/7 assistance from the TrustySMM support team. Contact us via live chat, WhatsApp, Telegram, or ticket system for instant help.',
    canonicalPath: '/contact',
    noIndex: false,
  },
  terms: {
    title: 'Terms of Service – Usage Guidelines & Policies | TrustySMM',
    description:
      'Review the official terms of service, acceptable use guidelines, refund terms, and customer rights for using TrustySMM marketing solutions.',
    canonicalPath: '/terms',
    noIndex: false,
  },
  privacy: {
    title: 'Privacy Policy – Data Protection & Security | TrustySMM',
    description:
      'Read how TrustySMM securely manages, protects, and encrypts your private data. Transparent data safety standards and zero sharing with third parties.',
    canonicalPath: '/privacy',
    noIndex: false,
  },

  // Private states: strictly blocked from search engines
  dashboard: {
    title: 'Dashboard – My Account | TrustySMM',
    description: 'Manage your social media orders, account balance, and active tickets on TrustySMM.',
    canonicalPath: '/',
    noIndex: true,
  },
  admin: {
    title: 'Admin Panel – Management Workspace | TrustySMM',
    description: 'TrustySMM administrative dashboard and system management.',
    canonicalPath: '/',
    noIndex: true,
  },
  auth: {
    title: 'Sign In & Register | TrustySMM',
    description: 'Log in or create a new account on TrustySMM.',
    canonicalPath: '/',
    noIndex: true,
  },
};

/**
 * Updates DOM metadata cleanly, eliminating duplicates and enforcing SEO standards.
 */
export function updateSeoMetadata(config: Partial<SeoConfig> = {}): void {
  if (typeof document === 'undefined') return;

  const title = config.title || PRIMARY_SEO.title;
  const description = config.description || PRIMARY_SEO.description;
  const canonicalPath = config.canonicalPath !== undefined ? config.canonicalPath : PRIMARY_SEO.canonicalPath;
  const noIndex = Boolean(config.noIndex);
  const ogType = config.ogType || 'website';
  const image = config.image || DEFAULT_OG_IMAGE;

  const keywords = config.keywords || PRIMARY_SEO.keywords || DEFAULT_KEYWORDS;

  // 1. Title
  document.title = title;

  // 2. Meta Keywords
  let keywordsTag = document.querySelector("meta[name='keywords']") as HTMLMetaElement | null;
  if (!keywordsTag) {
    keywordsTag = document.createElement('meta');
    keywordsTag.name = 'keywords';
    document.head.appendChild(keywordsTag);
  }
  keywordsTag.content = keywords;

  // 3. Meta Description (single source of truth)
  let descMeta = document.querySelector("meta[name='description']") as HTMLMetaElement | null;
  if (!descMeta) {
    descMeta = document.createElement('meta');
    descMeta.name = 'description';
    document.head.appendChild(descMeta);
  }
  descMeta.content = description;

  // 4. Robots Tag (index, follow vs noindex, nofollow)
  let robotsMeta = document.querySelector("meta[name='robots']") as HTMLMetaElement | null;
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.content = noIndex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  // 5. Canonical Link
  const fullCanonicalUrl = canonicalPath
    ? `${CANONICAL_SITE_URL}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`
    : `${CANONICAL_SITE_URL}/`;

  let canonicalLink = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = fullCanonicalUrl;

  // 6. Open Graph Tags
  const setMetaProperty = (prop: string, val: string) => {
    let el = document.querySelector(`meta[property='${prop}']`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', prop);
      document.head.appendChild(el);
    }
    el.content = val;
  };

  setMetaProperty('og:site_name', 'TrustySMM');
  setMetaProperty('og:title', title);
  setMetaProperty('og:description', description);
  setMetaProperty('og:url', fullCanonicalUrl);
  setMetaProperty('og:type', ogType);
  setMetaProperty('og:image', image);
  setMetaProperty('og:locale', 'en_US');

  // 7. Twitter / X Card Tags
  const setMetaName = (name: string, val: string) => {
    let el = document.querySelector(`meta[name='${name}']`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.name = name;
      document.head.appendChild(el);
    }
    el.content = val;
  };

  setMetaName('twitter:card', 'summary_large_image');
  setMetaName('twitter:title', title);
  setMetaName('twitter:description', description);
  setMetaName('twitter:image', image);
}
