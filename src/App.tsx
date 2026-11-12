import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { applyThemeVariables } from './lib/theme.ts';
import { getApiUrl, safeParseResponse, fetchPublicSettings } from './lib/api.ts';
import { updateSeoMetadata, PAGE_SEO_REGISTRY } from './utils/seo.ts';

// Code-split heavy dashboards to keep initial mobile bundle ultra-light and blazing fast (<1.2s)
const UserDashboard = lazy(() =>
  import('./components/UserDashboard.tsx').then((m) => ({ default: m.UserDashboard }))
);
const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard.tsx').then((m) => ({ default: m.AdminDashboard }))
);

const ADMIN_EMAILS = ['aviral2340b@gmail.com', 'rujdr368@gmail.com'];

function isSuperAdminUser(u: any, fallbackAdminEmail = 'aviral2340b@gmail.com'): boolean {
  if (!u) return false;
  const norm = (u.email || '').toLowerCase().trim();
  return (
    norm === fallbackAdminEmail ||
    ADMIN_EMAILS.some(em => norm === em || norm.includes(em.split('@')[0])) ||
    u.role === 'admin'
  );
}

function executeScripts(parent: HTMLElement) {
  const scripts = Array.from(parent.getElementsByTagName('script'));
  scripts.forEach((oldScript) => {
    try {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    } catch (e) {
      console.warn('Custom script injection warning:', e);
    }
  });
}

function AppContent() {
  const { firebaseUser, user, token, loading, login, logout, refreshProfile, loginAsUser } = useAuth();
  const [viewMode, setViewMode] = useState<'homepage' | 'dashboard'>('homepage');
  const adminEmail = 'aviral2340b@gmail.com';

  // Synchronously initialize adminActive from storage or cached user to prevent brief dashboard flashes
  const [adminActive, setAdminActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('trustysmm_admin_active') || localStorage.getItem('trustsysmm_admin_active');
      if (stored !== null) return stored === 'true';
      const cached = localStorage.getItem('user');
      if (cached) {
        return isSuperAdminUser(JSON.parse(cached), adminEmail);
      }
    } catch {
      return false;
    }
    return false;
  });

  const [publicSettings, setPublicSettings] = useState<any>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('trustysmm_public_settings') || localStorage.getItem('trustsysmm_public_settings');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const handleToggleAdmin = (active: boolean) => {
    setAdminActive(active);
    try {
      localStorage.setItem('trustysmm_admin_active', String(active));
    } catch {
      // ignore
    }
  };

  // Fetch and apply public settings
  useEffect(() => {
    fetchPublicSettings().then((data) => {
      if (data) {
        setPublicSettings(data);

        // Apply active theme
        if (data.activeTheme) {
          applyThemeVariables(data.activeTheme);
        } else {
          applyThemeVariables('default');
        }

        // 1. Favicon (Preserve custom favicon if provided)
        if (data.favicon) {
          let faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
          if (!faviconLink) {
            faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            document.head.appendChild(faviconLink);
          }
          faviconLink.href = data.favicon;
        }

        // 2. Remove obsolete or stuffed meta keywords tag completely
        const metaKeywords = document.querySelector("meta[name='keywords']");
        if (metaKeywords) {
          metaKeywords.remove();
        }

        // 5. Additional Header Code (General)
        if (data.additionalHeaderCode) {
          let container = document.getElementById('custom-header-code');
          if (!container) {
            container = document.createElement('div');
            container.id = 'custom-header-code';
            document.head.appendChild(container);
          }
          container.innerHTML = data.additionalHeaderCode;
          executeScripts(container);
        }

        // 6. Additional Footer Code (General)
        if (data.additionalFooterCode) {
          let container = document.getElementById('custom-footer-code');
          if (!container) {
            container = document.createElement('div');
            container.id = 'custom-footer-code';
            document.body.appendChild(container);
          }
          container.innerHTML = data.additionalFooterCode;
          executeScripts(container);
        }
      }
    });
  }, []);

  // Additional Header Code - After Login pages
  useEffect(() => {
    if (firebaseUser && publicSettings?.additionalHeaderCodeAfterLogin) {
      let container = document.getElementById('custom-header-after-login');
      if (!container) {
        container = document.createElement('div');
        container.id = 'custom-header-after-login';
        document.head.appendChild(container);
      }
      container.innerHTML = publicSettings.additionalHeaderCodeAfterLogin;
      executeScripts(container);
    } else {
      const el = document.getElementById('custom-header-after-login');
      if (el) el.remove();
    }
  }, [firebaseUser, publicSettings]);

  // Auto-redirect to dashboard when user logs in, and preserve admin panel state
  useEffect(() => {
    if (firebaseUser && user) {
      setViewMode('dashboard');
      if (isSuperAdminUser(user, adminEmail)) {
        const stored = localStorage.getItem('trustysmm_admin_active') ?? localStorage.getItem('trustsysmm_admin_active');
        if (stored === null) {
          setAdminActive(true);
        }
      }
    } else if (!firebaseUser && !loading) {
      setViewMode('homepage');
      setAdminActive(false);
    }
  }, [firebaseUser, user, adminEmail, loading]);

  // Private Dashboard SEO Protection (noindex, nofollow)
  useEffect(() => {
    if (viewMode === 'dashboard') {
      if (adminActive) {
        updateSeoMetadata(PAGE_SEO_REGISTRY.admin);
      } else {
        updateSeoMetadata(PAGE_SEO_REGISTRY.dashboard);
      }
    }
  }, [viewMode, adminActive]);

  const renderActiveView = () => {
    if (loading) {
      return (
        <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center text-gray-200 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
            <RefreshCw className="w-10 h-10 text-red-500 animate-spin" />
          </div>
          <div className="text-sm font-semibold tracking-wide text-gray-400 font-display">
            {publicSettings.websiteName || 'trustysmm'} &middot; Loading workspace...
          </div>
        </div>
      );
    }

    // Handle suspended status
    const isUserAdmin = isSuperAdminUser(user, adminEmail);
    if (user && user.status === 'suspended' && !isUserAdmin) {
      return (
        <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center text-gray-200 p-6 text-center space-y-6">
          <div className="p-4 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shadow-lg">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <div className="max-w-md space-y-2">
            <h1 className="text-2xl font-bold font-display text-white">Account Suspended</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your profile has been suspended for terms of service violations. Please contact the administrator or submit a manual request.
            </p>
          </div>
          <button
            onClick={logout}
            className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold font-mono text-gray-300 transition-all"
          >
            Sign Out Profile
          </button>
        </div>
      );
    }

    // View Routing
    if (viewMode === 'dashboard' && firebaseUser && user && token) {
      if (adminActive && isUserAdmin) {
        return (
          <Suspense
            fallback={
              <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center text-gray-200 space-y-4">
                <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
                <div className="text-xs font-mono text-gray-400">Loading Management Suite...</div>
              </div>
            }
          >
            <AdminDashboard
              token={token}
              onGoToUserView={() => handleToggleAdmin(false)}
              onRefreshProfile={refreshProfile}
              onLoginAsUser={(impersonatedToken, targetUser) => {
                loginAsUser(impersonatedToken, targetUser);
                handleToggleAdmin(false);
                setViewMode('dashboard');
              }}
            />
          </Suspense>
        );
      }

      return (
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center text-gray-200 space-y-4">
              <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
              <div className="text-xs font-mono text-gray-400">Loading Workspace...</div>
            </div>
          }
        >
          <UserDashboard
            user={user}
            token={token}
            onLogout={logout}
            onRefreshProfile={refreshProfile}
            isAdmin={isUserAdmin}
            onToggleAdminView={() => handleToggleAdmin(true)}
          />
        </Suspense>
      );
    }

    return <LoginPage onLogin={login} />;
  };

  return (
    <div className="relative min-h-screen">
      {renderActiveView()}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
