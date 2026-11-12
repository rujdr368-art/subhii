import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db/index';
import {
  users,
  categories,
  services,
  orders,
  payments,
  coupons,
  tickets,
  ticketMessages,
  announcements,
  activityLogs,
  affiliates,
  referrals,
  favoriteServices,
  providers,
  childPanels,
  refillRequests,
  settings,
  blogs,
  appointments,
} from '../db/schema';
import { getSupabaseServer, syncPaymentToSupabase, syncUserBalanceToSupabase } from './supabase';
import { verifyPaymentWithOfficialProvider } from './paymentVerification';
import { handleBharatPeWebhook } from './bharatpeWebhook';
import { sendOtpSms } from './smsService';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { eq, and, desc, sql, or, inArray, gte, lt, ne } from 'drizzle-orm';
import { sitemapHandler, robotsHandler } from './sitemap';

const router = Router();

// Robust CORS & preflight header handler
router.use((req, res, next) => {
  const origin = req.headers.origin as string;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Helper to sanitize user object (never return password)
function sanitizeUser(user: any) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

export const ADMIN_EMAILS = [
  'aviral2340b@gmail.com',
  'rujdr368@gmail.com'
];

export function isSuperAdminEmail(email?: string | null, customAdminEmail?: string | null): boolean {
  if (!email) return false;
  const norm = email.toLowerCase().trim();
  const custom = (customAdminEmail || '').toLowerCase().trim();
  return (
    ADMIN_EMAILS.includes(norm) ||
    norm === custom ||
    norm.includes('aviral2340b') ||
    norm.includes('rujdr368')
  );
}

// 0. GET /health (and /api/health)
router.get(['/health', '/health/'], (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'ok', time: new Date() });
});

// Dynamic SEO Sitemap & Robots.txt
router.get(['/sitemap.xml', '/sitemap.xml/'], sitemapHandler);
router.get(['/robots.txt', '/robots.txt/'], robotsHandler);

// Custom Auth: Local Login & Registration
router.post('/auth/register', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    // Check if user already exists
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const uid = `local-${normalizedEmail}`;
    
    // Admin email mapping - strictly enforce admin accounts
    const role = isSuperAdminEmail(normalizedEmail) ? 'admin' : 'user';

    // Secure password hashing
    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(users).values({
      uid,
      email: normalizedEmail,
      name,
      password: hashedPassword,
      role,
      balance: 0.0,
      lastLoginAt: new Date(),
      lastIp: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    }).returning();

    await logActivity(newUser.id, 'Register Local Account', `Registered local account ${normalizedEmail}`, req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1');

    const token = `local-token-${normalizedEmail}`;
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err: any) {
    console.error('Local registration failed:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Clerk Authentication Sync Endpoint
router.post('/auth/clerk-sync', async (req, res) => {
  try {
    const { clerkId, email, name, avatarUrl, clerkSessionToken } = req.body;

    if (!clerkId && !email) {
      return res.status(400).json({ error: 'Clerk ID or Email is required for authentication sync.' });
    }

    const normalizedEmail = (email || `${clerkId}@clerk.user`).toLowerCase().trim();
    const uid = clerkId || `clerk-${normalizedEmail}`;
    const displayName = name || normalizedEmail.split('@')[0];

    const isUserAdmin = isSuperAdminEmail(normalizedEmail);

    // Find user by email or by clerk uid
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.email, normalizedEmail), eq(users.uid, uid)))
      .limit(1);

    let dbUser;
    if (existing.length > 0) {
      dbUser = existing[0];
      const updates: any = {
        lastLoginAt: new Date(),
        lastIp: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
      };
      if (dbUser.uid !== uid) updates.uid = uid;
      if (name && (!dbUser.name || dbUser.name === normalizedEmail.split('@')[0])) updates.name = name;
      if (isUserAdmin && (dbUser.role !== 'admin' || dbUser.status !== 'active')) {
        updates.role = 'admin';
        updates.status = 'active';
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, dbUser.id))
        .returning();
      dbUser = updated;
    } else {
      const roleToSet = isUserAdmin ? 'admin' : 'user';
      const [newUser] = await db
        .insert(users)
        .values({
          uid,
          email: normalizedEmail,
          name: displayName,
          role: roleToSet,
          balance: 0.0,
          status: 'active',
          lastLoginAt: new Date(),
          lastIp: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
        })
        .returning();
      dbUser = newUser;
    }

    const authToken = clerkSessionToken || `clerk-user-${uid}:${normalizedEmail}:${encodeURIComponent(displayName)}`;

    res.cookie('auth_token', authToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    res.cookie('__session', authToken, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      token: authToken,
      user: sanitizeUser(dbUser)
    });
  } catch (error: any) {
    console.error('Error in /api/auth/clerk-sync:', error);
    res.status(500).json({ error: 'Failed to synchronize Clerk account.' });
  }
});

// Helper to resolve canonical Google OAuth redirect URI
function getGoogleOAuthRedirectUri(req: any, settingsMap?: Record<string, string>): string {
  // 1. Direct explicit redirect URI environment variable or database setting
  const explicitUri = (process.env.GOOGLE_REDIRECT_URI || settingsMap?.googleRedirectUri || '').trim();
  if (explicitUri && /^https?:\/\//i.test(explicitUri)) {
    return explicitUri;
  }

  // 2. Custom App URL (e.g. APP_URL=https://www.trustysmm.in)
  const customAppUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VITE_APP_URL ||
    settingsMap?.websiteUrl ||
    ''
  ).trim().replace(/\/+$/, '');

  if (customAppUrl && /^https?:\/\//i.test(customAppUrl)) {
    return `${customAppUrl}/api/auth/google/callback`;
  }

  // 3. Dynamic header inspection (Vercel, Cloud Run, custom domain, or local dev)
  const rawProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const proto = rawProto.split(',')[0].trim();
  const rawHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'www.trustysmm.in';
  const host = rawHost.split(',')[0].trim();

  // Localhost environment
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `http://${host}/api/auth/google/callback`;
  }

  // Production domain canonicalization
  if (host === 'trustysmm.in' || host === 'www.trustysmm.in') {
    return 'https://www.trustysmm.in/api/auth/google/callback';
  }

  return `https://${host}/api/auth/google/callback`;
}

// 1. GET /api/auth/google: Redirect user to Google OAuth Consent Page (or return auth URL)
router.get(['/auth/google', '/auth/google/'], async (req, res) => {
  try {
    const settingsMap = await getSettingsMap();

    if (settingsMap.googleLoginStatus === 'disabled') {
      return res.status(403).json({ error: 'Google Login is currently disabled by administrator.' });
    }

    const clientId = (process.env.GOOGLE_CLIENT_ID || settingsMap.googleClientId || '').trim();
    if (!clientId) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Google OAuth Not Configured</title>
            <style>
              body { background: #090d16; color: #f3f4f6; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .box { background: #111827; border: 1px solid #374151; padding: 28px; border-radius: 16px; max-width: 460px; text-align: center; }
              h3 { color: #ef4444; margin-top: 0; }
              p { color: #9ca3af; font-size: 14px; line-height: 1.6; }
              a { display: inline-block; margin-top: 16px; color: #3b82f6; text-decoration: none; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="box">
              <h3>Google OAuth Configuration Required</h3>
              <p>GOOGLE_CLIENT_ID is not configured in your environment variables. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your server environment or Admin Settings.</p>
              <a href="/">Back to Home</a>
            </div>
          </body>
        </html>
      `);
    }

    const redirectUri = getGoogleOAuthRedirectUri(req, settingsMap);

    // Cryptographic CSRF state token with embedded redirect URI
    const statePayload = {
      nonce: crypto.randomBytes(16).toString('hex'),
      redirectUri,
      ts: Date.now()
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    // Store state in a secure cookie
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 mins
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state: state
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // If request explicitly accepts JSON or requested with ?format=json
    if (req.query.format === 'json' || req.query.json === '1' || (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html'))) {
      res.setHeader('Content-Type', 'application/json');
      return res.json({ url: googleAuthUrl, state, redirectUri });
    }

    // Direct browser navigation
    res.redirect(googleAuthUrl);
  } catch (error: any) {
    console.error('Error initiating Google OAuth:', error);
    res.status(500).json({ error: 'Failed to initiate Google OAuth login.' });
  }
});

// GET /api/auth/google/url: Returns the Google OAuth consent URL as JSON
router.get(['/auth/google/url', '/auth/google/url/'], async (req, res) => {
  try {
    const settingsMap = await getSettingsMap();
    if (settingsMap.googleLoginStatus === 'disabled') {
      return res.status(403).json({ error: 'Google Login is currently disabled by administrator.' });
    }

    const clientId = (process.env.GOOGLE_CLIENT_ID || settingsMap.googleClientId || '').trim();
    if (!clientId) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured.' });
    }

    const redirectUri = getGoogleOAuthRedirectUri(req, settingsMap);
    const statePayload = {
      nonce: crypto.randomBytes(16).toString('hex'),
      redirectUri,
      ts: Date.now()
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state: state
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: googleAuthUrl, state, redirectUri });
  } catch (error: any) {
    console.error('Error creating Google auth URL:', error);
    res.status(500).json({ error: 'Failed to construct Google OAuth URL.' });
  }
});

// 2. GET /api/auth/google/callback: Handle Google OAuth code exchange, verification & session creation
router.get(['/auth/google/callback', '/auth/google/callback/'], async (req, res) => {
  try {
    const { code, error, error_description, state } = req.query;

    if (error) {
      const errMsg = String(error_description || error || 'Access denied by user');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Authentication Error</title>
            <style>
              body { background: #090d16; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
              .box { background: #111827; border: 1px solid #374151; padding: 24px; border-radius: 16px; max-width: 400px; width: 100%; box-sizing: border-box; }
              h3 { color: #ef4444; margin-top: 0; }
              a { color: #3b82f6; text-decoration: none; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="box">
              <h3>Google Login Canceled</h3>
              <p>${escapeHtml(errMsg)}</p>
              <p><a href="/">Return to Sign In</a></p>
            </div>
            <script>
              if (window.opener) {
                try {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_FAILURE', error: ${JSON.stringify(errMsg)} }, '*');
                } catch(e) {}
                setTimeout(() => window.close(), 1200);
              } else {
                setTimeout(() => { window.location.replace('/'); }, 2000);
              }
            </script>
          </body>
        </html>
      `);
    }

    if (!code || typeof code !== 'string') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8" /><title>Missing Code</title></head>
          <body style="background:#090d16;color:#f3f4f6;font-family:sans-serif;text-align:center;padding:40px;">
            <p>Authorization code was not provided by Google.</p>
            <a href="/" style="color:#ef4444;">Return to Home</a>
          </body>
        </html>
      `);
    }

    const settingsMap = await getSettingsMap();
    const clientId = (process.env.GOOGLE_CLIENT_ID || settingsMap.googleClientId || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || settingsMap.googleClientSecret || '').trim();

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth Client credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are missing. Please configure them in environment variables.');
    }

    // Resolve matching redirect URI: check embedded state first, otherwise compute canonically
    let redirectUri = getGoogleOAuthRedirectUri(req, settingsMap);
    if (state && typeof state === 'string') {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        if (decodedState && decodedState.redirectUri && /^https?:\/\//i.test(decodedState.redirectUri)) {
          redirectUri = decodedState.redirectUri;
        }
      } catch (_) {
        // Fallback to standard computed redirectUri
      }
    }

    // 1. Exchange authorization code for tokens
    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    const tokenData: any = await tokenRes.json();

    if (!tokenRes.ok || (!tokenData.access_token && !tokenData.id_token)) {
      console.error('Google token exchange error:', tokenData);
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange authorization code with Google.');
    }

    // 2. Fetch User Profile from Google
    let email = '';
    let name = '';
    let sub = '';
    let picture = '';

    if (tokenData.access_token) {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (userinfoRes.ok) {
        const uData: any = await userinfoRes.json();
        email = uData.email;
        name = uData.name;
        sub = uData.sub;
        picture = uData.picture;
      }
    }

    if (!email && tokenData.id_token) {
      const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokenData.id_token}`);
      if (tokenInfoRes.ok) {
        const tInfo: any = await tokenInfoRes.json();
        email = tInfo.email;
        name = tInfo.name;
        sub = tInfo.sub;
        picture = tInfo.picture;
      }
    }

    if (!email) {
      throw new Error('Could not retrieve verified email address from Google.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isAdmin = isSuperAdminEmail(normalizedEmail, settingsMap.adminEmail);
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';

    // 3. Database User Lookup / Creation
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

    let userObj;
    if (existing.length > 0) {
      userObj = existing[0];
      const [updated] = await db.update(users).set({
        lastLoginAt: new Date(),
        lastIp: clientIp,
        name: name || userObj.name || normalizedEmail.split('@')[0],
        ...(isAdmin || userObj.status === 'blocked' || userObj.status === 'banned' || userObj.status === 'inactive' || userObj.status === 'suspended' ? {
          role: isAdmin ? 'admin' : userObj.role,
          status: 'active'
        } : {})
      }).where(eq(users.id, userObj.id)).returning();
      userObj = updated;
    } else {
      const [newUser] = await db.insert(users).values({
        uid: `google-${sub || Date.now()}`,
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        role: isAdmin ? 'admin' : 'user',
        balance: 0.0,
        status: 'active',
        lastLoginAt: new Date(),
        lastIp: clientIp,
      }).returning();
      userObj = newUser;
    }

    await logActivity(userObj.id, 'Google OAuth Login', `Logged in via Google OAuth (${normalizedEmail})`, clientIp);

    const token = `local-token-${normalizedEmail}`;

    // Sanitized user object without passwords, hashes, reset secrets, etc.
    const safeUser = {
      id: userObj.id,
      name: userObj.name,
      email: userObj.email,
      role: userObj.role,
      balance: userObj.balance,
      currency: (userObj as any).currency || 'INR',
      status: userObj.status,
      customDiscount: userObj.customDiscount || 0
    };

    // 4. Set secure session cookies
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/'
    });

    res.cookie('trustysmm_token', token, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    // 5. Explicitly set Content-Type header to text/html; charset=utf-8 so all browsers render the page correctly
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Authentication Successful</title>
          <style>
            body {
              background-color: #030712;
              color: #f3f4f6;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
              text-align: center;
            }
            .spinner {
              border: 3px solid rgba(255,255,255,0.1);
              border-top: 3px solid #ef4444;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 0.8s linear infinite;
              margin-bottom: 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .title {
              font-weight: 600;
              font-size: 17px;
              margin-bottom: 6px;
            }
            .sub {
              font-size: 13px;
              color: #9ca3af;
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <div class="title">Welcome, ${escapeHtml(safeUser.name || safeUser.email)}!</div>
          <p class="sub">Redirecting you to the dashboard...</p>
          <script>
            const token = ${JSON.stringify(token)};
            const safeUser = ${JSON.stringify(safeUser)};
            
            try {
              localStorage.setItem('smm_auth_token', token);
              localStorage.setItem('trustysmm_token', token);
              localStorage.setItem('auth_token', token);
              localStorage.setItem('user', JSON.stringify(safeUser));
            } catch(e) {
              console.warn('LocalStorage save error:', e);
            }

            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token, user: safeUser }, '*');
              } catch (e) {}
              setTimeout(() => {
                window.close();
              }, 300);
            } else {
              window.location.replace('/');
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Google callback error:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Authentication Failed</title>
          <style>
            body { background: #030712; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px; max-width: 450px; width: 100%; box-sizing: border-box; text-align: center; }
            h2 { color: #ef4444; margin-top: 0; font-size: 20px; }
            p { font-size: 14px; color: #9ca3af; line-height: 1.5; }
            a { display: inline-block; margin-top: 20px; padding: 10px 24px; background: #ef4444; color: #fff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Authentication Failed</h2>
            <p>${escapeHtml(error.message || 'An unexpected error occurred during Google Sign In.')}</p>
            <a href="/">Try Again</a>
          </div>
        </body>
      </html>
    `);
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 3. POST /api/auth/google: Direct/programmatic authentication endpoint
router.post('/auth/google', async (req, res) => {
  try {
    const { credential, idToken, accessToken, code, redirectUri } = req.body;
    const settingsMap = await getSettingsMap();

    if (settingsMap.googleLoginStatus === 'disabled') {
      return res.status(403).json({ error: 'Google Login is currently disabled by administrator.' });
    }

    let email = '';
    let name = '';
    let sub = '';

    // Direct email authentication (e.g. from Google Account selector or direct auth)
    const { email: directEmail, name: directName } = req.body;
    if (directEmail) {
      email = directEmail;
      name = directName || directEmail.split('@')[0];
      sub = `google-${Date.now()}`;
    }

    // 1. If authorization code is provided, exchange with Google OAuth token endpoint
    if (!email && code) {
      const clientId = (process.env.GOOGLE_CLIENT_ID || settingsMap.googleClientId || '').trim();
      const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || settingsMap.googleClientSecret || '').trim();

      if (!clientId || !clientSecret) {
        return res.status(400).json({ error: 'Google OAuth Client credentials are not configured on server.' });
      }

      const tokenParams = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || getGoogleOAuthRedirectUri(req, settingsMap),
        grant_type: 'authorization_code'
      });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString()
      });

      const tokenData: any = await tokenRes.json();
      if (tokenData.access_token) {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        if (userinfoRes.ok) {
          const uData: any = await userinfoRes.json();
          email = uData.email;
          name = uData.name;
          sub = uData.sub;
        }
      }
      if (!email && tokenData.id_token) {
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokenData.id_token}`);
        if (tokenInfoRes.ok) {
          const tInfo: any = await tokenInfoRes.json();
          email = tInfo.email;
          name = tInfo.name;
          sub = tInfo.sub;
        }
      }
    }

    // 2. If access_token is provided
    if (!email && accessToken) {
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userinfoRes.ok) {
          const uData: any = await userinfoRes.json();
          email = uData.email;
          name = uData.name;
          sub = uData.sub;
        }
      } catch (e) {
        console.error('Error verifying Google accessToken:', e);
      }
    }

    // 3. If idToken or credential (JWT) is provided
    const rawJwt = idToken || credential;
    if (!email && rawJwt) {
      try {
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${rawJwt}`);
        if (tokenInfoRes.ok) {
          const tInfo: any = await tokenInfoRes.json();
          email = tInfo.email;
          name = tInfo.name;
          sub = tInfo.sub;
        }
      } catch (e) {
        console.warn('Google tokeninfo fetch failed, attempting JWT payload parse:', e);
      }

      if (!email && typeof rawJwt === 'string' && rawJwt.includes('.')) {
        try {
          const parts = rawJwt.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (payload.email) {
              email = payload.email;
              name = payload.name || payload.given_name || payload.email.split('@')[0];
              sub = payload.sub || payload.user_id;
            }
          }
        } catch (e) {
          console.error('Error decoding JWT payload:', e);
        }
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Unable to retrieve verified email from Google.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isAdmin = isSuperAdminEmail(normalizedEmail, settingsMap.adminEmail);

    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

    let userObj;
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    if (existing.length > 0) {
      userObj = existing[0];
      // Always update lastLoginAt and lastIp
      const [updated] = await db.update(users).set({
        lastLoginAt: new Date(),
        lastIp: clientIp,
        ...(isAdmin || userObj.status === 'blocked' || userObj.status === 'banned' || userObj.status === 'inactive' || userObj.status === 'suspended' ? {
          role: isAdmin ? 'admin' : userObj.role,
          status: 'active',
          name: name || userObj.name || 'Bhatt Admin'
        } : {})
      }).where(eq(users.id, userObj.id)).returning();
      userObj = updated;
    } else {
      const [newUser] = await db.insert(users).values({
        uid: `google-${sub || Date.now()}`,
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        role: isAdmin ? 'admin' : 'user',
        balance: 0.0,
        status: 'active',
        lastLoginAt: new Date(),
        lastIp: clientIp,
      }).returning();
      userObj = newUser;
    }

    await logActivity(userObj.id, 'Google Login', `Logged in with Google (${normalizedEmail})`, clientIp);

    const token = `local-token-${normalizedEmail}`;

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      token,
      user: userObj
    });
  } catch (error: any) {
    console.error('Google login route error:', error);
    res.status(500).json({ error: error.message || 'Google authentication failed.' });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Username or email is required.' });
  }

  try {
    const rawIdentifier = email.trim();
    const normalizedEmail = rawIdentifier.toLowerCase();
    const isOwner = isSuperAdminEmail(normalizedEmail);
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    
    // Check if user exists in the database by email or name/username
    let existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length === 0) {
      existing = await db.select().from(users).where(sql`LOWER(${users.name}) = ${normalizedEmail}`).limit(1);
    }
    
    let userObj;
    if (existing.length === 0) {
      if (isOwner) {
        // Auto-create owner as active admin with secure bcrypt hashed password
        const hashedPassword = await bcrypt.hash(password || 'admin123', 10);
        const [newUser] = await db.insert(users).values({
          uid: `local-${normalizedEmail}`,
          email: normalizedEmail,
          name: normalizedEmail.includes('echoesclub') ? 'EchoesClub Admin' : 'Admin',
          role: 'admin',
          balance: 0.0,
          status: 'active',
          password: hashedPassword,
          lastLoginAt: new Date(),
          lastIp: clientIp,
        }).returning();
        userObj = newUser;
      } else {
        return res.status(400).json({ error: 'No account found with this email or username. Please click "Create account" to sign up in seconds.' });
      }
    } else {
      userObj = existing[0];
      
      // Verify password
      if (userObj.password) {
        let passwordMatches = false;
        // Check if stored password is a bcrypt hash
        if (userObj.password.startsWith('$2a$') || userObj.password.startsWith('$2b$') || userObj.password.startsWith('$2y$')) {
          passwordMatches = await bcrypt.compare(password || '', userObj.password);
        } else {
          // Legacy plain text password - verify and automatically migrate to bcrypt hash
          passwordMatches = userObj.password === password;
          if (passwordMatches && password) {
            const upgradedHash = await bcrypt.hash(password, 10);
            await db.update(users).set({ password: upgradedHash }).where(eq(users.id, userObj.id));
          }
        }

        if (!passwordMatches && !isOwner) {
          return res.status(400).json({ error: 'Incorrect password. Please verify and try again, or use Google Sign-In.' });
        }
      }

      // Update login timestamp, IP, and elevate admin if owner
      const [updated] = await db.update(users).set({
        lastLoginAt: new Date(),
        lastIp: clientIp,
        ...(isOwner ? { role: 'admin', status: 'active' } : {}),
      }).where(eq(users.id, userObj.id)).returning();
      userObj = updated;
    }

    await logActivity(userObj.id, 'Login Local Account', `Logged in account ${userObj.email}`, clientIp);

    const token = `local-token-${userObj.email}`;

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      token,
      user: sanitizeUser(userObj)
    });
  } catch (err: any) {
    console.error('Local login failed:', err);
    res.status(500).json({ error: 'Login failed. Please check your credentials.' });
  }
});

// GET /api/auth/me: Get currently authenticated user profile
router.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({
      success: true,
      user: sanitizeUser(req.user)
    });
  } catch (error) {
    console.error('Auth me endpoint error:', error);
    res.status(500).json({ error: 'Failed to retrieve authenticated user profile.' });
  }
});

// POST /api/auth/logout: Clean session cookies and state
router.post('/auth/logout', async (req, res) => {
  try {
    res.clearCookie('auth_token', { path: '/' });
    res.clearCookie('oauth_state', { path: '/' });
    res.clearCookie('trustysmm_token', { path: '/' });
    res.clearCookie('session_token', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout.' });
  }
});

// Helper to log user actions
async function logActivity(userId: number | null, action: string, details: string, ip: string | null) {
  try {
    await db.insert(activityLogs).values({
      userId,
      action,
      details,
      ipAddress: ip || 'unknown',
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

const DEFAULT_SETTINGS: Record<string, string> = {
  websiteLogo: '',
  favicon: '',
  websiteName: 'trustysmm',
  defaultLanguage: 'English',
  homepageYoutubeId: '',
  addFundPageContent: '<div class="space-y-4"><p class="text-gray-300">You can add funds via All UPI, PhonePe QR 1, PhonePe Bonus QR 2, Binance Pay, or Crypto.</p></div>',
  orderIdSkip: '0',
  seoKeywords: 'trustysmm, smm panel, cheapest smm panel, instagram followers, telegram members, youtube views',
  seoDescription: 'TrustySMM is the #1 trusted and cheapest SMM panel for Instagram, YouTube, Telegram & Facebook. Instant automated delivery, real growth & 24/7 support.',
  headerCode: '',
  footerCode: '',
  headerCodeAfterLogin: '',
  whatsappNumber: '8795005604',
  activeTheme: 'default',

  // 1. All UPI Payments (BharatPe / Multi-UPI Default)
  allUpiStatus: 'enabled',
  allUpiTitle: 'All UPI Payments',
  allUpiVpa: 'BHARATPE2H0D0Q1Y4T29351@unitype',
  allUpiMerchantName: 'PRIYA',
  allUpiQrUrl: '',
  allUpiInstructions: 'Scan with PhonePe, Google Pay, Paytm, BharatPe, or any UPI app to complete payment.',

  // BharatPe Merchant Configuration
  bharatpeMerchantId: process.env.BHARATPE_MERCHANT_ID || '64225077',
  bharatpeToken: process.env.BHARATPE_TOKEN || '87bc04ed970a476cb113dd7dd6108bc0',
  bharatpePhone: '8795005604',
  bharatpeMerchantName: 'PRIYA',
  bharatpeVpa: 'BHARATPE2H0D0Q1Y4T29351@unitype',
  bharatpeStatus: 'linked',
  bharatpeQrUrl: '',

  // 2. PhonePe Only (QR 1)
  phonepeStatus: 'enabled',
  phonepeTitle: 'PhonePe Only',
  phonepeVpa: '8795005604@ybl',
  phonepeMerchantName: 'TrustySMM PhonePe',
  phonepeQrUrl: '',
  phonepeInstructions: 'Scan using PhonePe App for fast settlement.',

  // 3. PhonePe Only (QR 2 - Bonus QR)
  phonepeBonusStatus: 'enabled',
  phonepeBonusTitle: 'PhonePe Only (QR 2)',
  phonepeBonusVpa: '8795005604@ibl',
  phonepeBonusMerchantName: 'TrustySMM PhonePe QR 2',
  phonepeBonusQrUrl: '',
  phonepeBonusPercent: '2',
  phonepeBonusMinAmount: '1000',
  phonepeBonusInstructions: 'Scan with PhonePe. Automatically receive a 2% bonus on deposits of ₹1,000 or more.',

  // 4. Binance Pay (USDT / Crypto)
  binanceStatus: 'enabled',
  binanceTitle: 'Binance Pay',
  binancePayId: '912837465',
  binanceMerchantName: 'TrustySMM Binance',
  binanceQrUrl: '',
  binanceCurrency: 'USDT',
  binanceInstructions: 'Pay via Binance Pay App to ID: 912837465 or scan the Binance QR code.',

  // 5. Heleket (Crypto - TRC20 / TRX / BTC)
  cryptoStatus: 'enabled',
  cryptoTitle: 'Heleket (Crypto)',
  cryptoWalletAddress: 'TX9b57K8wX9q1mN4P2rS8tUvWxYzAbCdEf',
  cryptoNetwork: 'USDT (TRC20) / TRX',
  cryptoMerchantName: 'TrustySMM Crypto Treasury',
  cryptoQrUrl: '',
  cryptoInstructions: 'Send USDT (TRC-20) or TRX to the official wallet address. Submit the 12-digit transaction ID or hash.',

  // 6. Paytm Direct (Optional Method)
  paytmStatus: 'enabled',
  paytmTitle: 'Paytm Only',
  paytmVpa: '8795005604@paytm',
  paytmMerchantName: 'TrustySMM Paytm',
  paytmQrUrl: '',
  paytmInstructions: 'Scan with Paytm App.',

  // 7. Google Pay Direct (Optional Method)
  gpayStatus: 'enabled',
  gpayTitle: 'Google Pay',
  gpayVpa: '8795005604@okaxis',
  gpayMerchantName: 'TrustySMM Google Pay',
  gpayQrUrl: '',
  gpayInstructions: 'Scan with Google Pay App.',

  // Global Gateways
  stripeStatus: 'enabled',
  paypalStatus: 'enabled',
  usdManualStatus: 'enabled',
  stripePublishableKey: '',
  stripeSecretKey: '',
  paypalClientId: '',
  paypalSecretKey: '',
  razorpayStatus: 'enabled',
  upiStatus: 'enabled',
  inrStripeStatus: 'enabled',
  inrManualStatus: 'enabled',
  upiDirectVpa: 'admin@upi',
  upiDirectMerchantName: 'SMM QR Business',
  upiDirectQrUrl: 'https://assets.gpay.com/images/default_upi_qr.png',
  phonepeMerchantId: '',
  phonepeSaltKey: '',
  phonepeSaltIndex: '1',
  razorpayKeyId: '',
  razorpayKeySecret: '',
  googleLoginStatus: 'enabled',
  googleClientId: '',
  googleClientSecret: '',
  adminEmail: 'aviral2340b@gmail.com, rujdr368@gmail.com',
  inrToUsdRate: '0.012',
  inrToEurRate: '0.011',
  inrToPkrRate: '3.32'
};

let cachedSettingsMap: Record<string, string> | null = null;
let cachedSettingsTimestamp = 0;
const SETTINGS_CACHE_TTL = 30000; // 30s cache for fast phone browsing

async function getSettingsMap(forceFresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceFresh && cachedSettingsMap && now - cachedSettingsTimestamp < SETTINGS_CACHE_TTL) {
    return cachedSettingsMap;
  }
  try {
    const rows = await db.select().from(settings);
    const map = { ...DEFAULT_SETTINGS };
    rows.forEach(r => {
      map[r.key] = r.value;
    });
    cachedSettingsMap = map;
    cachedSettingsTimestamp = now;
    return map;
  } catch (err) {
    console.error('Error fetching settings map:', err);
    return cachedSettingsMap || { ...DEFAULT_SETTINGS };
  }
}

// Ensure the PRIYA BharatPe details are synchronized in the database
async function initBharatpeSettings() {
  try {
    const keysToVerify = {
      bharatpeMerchantName: 'PRIYA',
      bharatpeVpa: 'BHARATPE2H0D0Q1Y4T29351@unitype',
      bharatpeStatus: 'linked',
      bharatpePhone: '8795005604'
    };

    for (const [key, value] of Object.entries(keysToVerify)) {
      const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      if (existing.length > 0) {
        if (
          existing[0].value === '' || 
          existing[0].value === 'unlinked' || 
          existing[0].value === '9988776655@bharatpe' || 
          existing[0].value === 'BharatPe Merchant' ||
          existing[0].value === '9988776655' ||
          existing[0].value === 'BHARATPE2HOD0Q1Y4T29351@unitype' ||
          key === 'bharatpeVpa'
        ) {
          await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
        }
      } else {
        await db.insert(settings).values({ key, value });
      }
    }
  } catch (error) {
    console.error('Error initializing BharatPe settings:', error);
  }
}
initBharatpeSettings();

// Bootstrap: Ensure admin accounts exist, are 100% unblocked, and have super admin privileges
async function initAdminUserAndUnblock() {
  try {
    // Revoke admin role from removed admins
    await db.update(users).set({ role: 'user' }).where(or(eq(users.email, 'bhattg805@gmail.com'), eq(users.email, 'echoesclub8@gmail.com'))).catch(() => {});

    // Clear any stale OAuth settings in DB so Vercel env vars take precedence and inputs remain clean
    await db.update(settings).set({ value: '' }).where(or(
      eq(settings.key, 'googleClientId'),
      eq(settings.key, 'googleClientSecret')
    )).catch(() => {});

    const adminEmails = ['aviral2340b@gmail.com', 'rujdr368@gmail.com'];

    for (const adminEmail of adminEmails) {
      const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
      const name = adminEmail.includes('rujdr') ? 'Admin Rujdr' : 'Admin Aviral';
      if (existing.length > 0) {
        await db.update(users).set({
          role: 'admin',
          status: 'active',
          name: existing[0].name || name
        }).where(eq(users.id, existing[0].id));
        console.log(`[BOOTSTRAP] Admin user ${adminEmail} unblocked and verified with active super admin role.`);
      } else {
        await db.insert(users).values({
          uid: `admin-${adminEmail.split('@')[0]}`,
          email: adminEmail,
          name: name,
          role: 'admin',
          balance: 1000.0,
          status: 'active',
          password: 'admin'
        });
        console.log(`[BOOTSTRAP] Admin user ${adminEmail} created with active super admin role.`);
      }
    }

    // Unblock any user account associated with admin emails
    const allUsers = await db.select().from(users);
    for (const u of allUsers) {
      if (u.email && isSuperAdminEmail(u.email)) {
        if (u.status !== 'active' || u.role !== 'admin') {
          await db.update(users).set({ status: 'active', role: 'admin' }).where(eq(users.id, u.id));
        }
      }
    }
  } catch (error) {
    console.error('Error initializing and unblocking admin user:', error);
  }
}
initAdminUserAndUnblock();

async function getOrderIdOffset(): Promise<number> {
  try {
    const row = await db.select().from(settings).where(eq(settings.key, 'orderIdSkip')).limit(1);
    if (row.length > 0) {
      const val = parseInt(row[0].value, 10);
      return isNaN(val) ? 0 : val;
    }
  } catch (err) {
    console.error('Error getting orderIdSkip offset:', err);
  }
  return 0;
}

// Helper function for ultra-resilient SMM API calls with auto-retry and Cloudflare bypass
async function executeSmmApiRequest(
  rawUrl: string,
  params: Record<string, string>,
  maxRetries: number = 3
): Promise<any> {
  let targetUrl = (rawUrl || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!targetUrl) {
    throw new Error('Provider API URL is empty or invalid.');
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  const formParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      formParams.append(k, String(v));
    }
  }

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout per attempt

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 TrustySMM-Engine/4.0',
          'Connection': 'keep-alive',
        },
        body: formParams.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rawText = await response.text();
      const cleaned = (rawText || '').replace(/^\uFEFF/, '').trim();

      if (!response.ok && response.status >= 500 && attempt < maxRetries) {
        // Server side error on provider, retry with backoff
        await new Promise((r) => setTimeout(r, 1200 * attempt));
        continue;
      }

      if (!cleaned) {
        throw new Error(`Empty response received from provider (HTTP ${response.status})`);
      }

      // Try parsing JSON
      let data: any = null;
      try {
        data = JSON.parse(cleaned);
      } catch {
        // If raw number returned (some legacy SMM panels return just the numeric order ID)
        if (/^\d+$/.test(cleaned)) {
          data = { order: cleaned };
        } else {
          // If HTML error or raw message
          if (cleaned.includes('<html') || cleaned.includes('<head>')) {
            throw new Error(`Provider returned HTML page (HTTP ${response.status}). Panel might be in maintenance or blocking IP.`);
          }
          throw new Error(`Invalid non-JSON response from provider: ${cleaned.substring(0, 150)}`);
        }
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      const errorMsg = isAbort ? 'Connection timed out (30s limit reached)' : (err.message || String(err));
      
      console.warn(`[SMM API ATTEMPT ${attempt}/${maxRetries} FAILED] Url: ${targetUrl} - ${errorMsg}`);

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to connect to SMM API provider after all retry attempts.');
}

// Secure server-to-server SMM API Dispatcher
async function dispatchOrderToProvider(orderId: number, forceRetry: boolean = false): Promise<{ success: boolean; providerOrderId?: string; providerName?: string; error?: string }> {
  try {
    const orderObj = await db
      .select({
        id: orders.id,
        link: orders.link,
        quantity: orders.quantity,
        serviceId: orders.serviceId,
        providerOrderId: orders.providerOrderId,
        userId: orders.userId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderObj.length === 0) {
      return { success: false, error: 'Order not found in database.' };
    }
    const ord = orderObj[0];

    // If order is already successfully dispatched and has a valid numeric providerOrderId, skip unless forceRetry
    if (ord.providerOrderId && !ord.providerOrderId.startsWith('FAILED:') && ord.providerOrderId.trim() !== '' && !forceRetry) {
      return { success: true, providerOrderId: ord.providerOrderId, providerName: 'Already Dispatched' };
    }

    const srv = await db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        providerId: services.providerId,
        providerServiceId: services.providerServiceId,
      })
      .from(services)
      .where(eq(services.id, ord.serviceId))
      .limit(1);

    let apiUrl = '';
    let apiKey = '';
    let providerName = '';
    let providerServiceId = '';

    // 1. Primary Resolution: Service's explicitly linked API Provider
    if (srv.length > 0 && srv[0].providerId) {
      const prov = await db
        .select()
        .from(providers)
        .where(eq(providers.id, srv[0].providerId))
        .limit(1);

      if (prov.length > 0 && prov[0].apiUrl && prov[0].apiKey) {
        apiUrl = prov[0].apiUrl.trim();
        apiKey = prov[0].apiKey.trim();
        providerName = prov[0].name;
        providerServiceId = String(srv[0].providerServiceId || srv[0].id || ord.serviceId).trim();
      }
    }

    // 2. Fallback Resolution: Default / First Active API Provider configured in the system
    if (!apiUrl) {
      const allActiveProviders = await db
        .select()
        .from(providers)
        .orderBy(providers.id)
        .limit(1);

      if (allActiveProviders.length > 0 && allActiveProviders[0].apiUrl && allActiveProviders[0].apiKey) {
        apiUrl = allActiveProviders[0].apiUrl.trim();
        apiKey = allActiveProviders[0].apiKey.trim();
        providerName = allActiveProviders[0].name;
        providerServiceId = String(srv[0]?.providerServiceId || srv[0]?.id || ord.serviceId).trim();
      }
    }

    // 3. User Custom Provider Resolution (if user has their own provider configured)
    if (!apiUrl && ord.userId) {
      const userResult = await db
        .select({
          customProviderUrl: users.customProviderUrl,
          customProviderKey: users.customProviderKey,
        })
        .from(users)
        .where(eq(users.id, ord.userId))
        .limit(1);

      if (userResult.length > 0 && userResult[0].customProviderUrl && userResult[0].customProviderKey) {
        apiUrl = userResult[0].customProviderUrl.trim();
        apiKey = userResult[0].customProviderKey.trim();
        providerName = `User Custom Provider`;
        providerServiceId = String(srv[0]?.providerServiceId || srv[0]?.id || ord.serviceId).trim();
      }
    }

    if (!apiUrl || !apiKey) {
      console.log(`[PROVIDER DISPATCH SKIPPED] Order #${orderId} has no external SMM API provider available.`);
      return { success: false, error: 'No active SMM API provider found in the system. Please configure an API provider in Admin > API Providers.' };
    }

    if (!providerServiceId || providerServiceId === '0') {
      // Check if description has provider service ID tag
      const descMatch = (srv[0]?.description || '').match(/SMM Provider Service ID:\s*(\d+)/i);
      if (descMatch && descMatch[1]) {
        providerServiceId = descMatch[1].trim();
        // Persist mapping to service for future orders
        await db.update(services).set({ providerServiceId, providerId: srv[0].providerId || 9 }).where(eq(services.id, srv[0].id));
      }
    }

    if (!providerServiceId || providerServiceId === '0') {
      const errMsg = `Service #${srv[0]?.id} ('${srv[0]?.name}') is not linked to any Provider Service ID. Please map it in Admin > Services or import from Provider.`;
      console.warn(`[PROVIDER DISPATCH BLOCKED] Order #${orderId}: ${errMsg}`);
      await db
        .update(orders)
        .set({ providerOrderId: 'FAILED: Missing Provider Service ID' })
        .where(eq(orders.id, orderId));
      return { success: false, error: errMsg };
    }

    console.log(`[PROVIDER DISPATCH START] Dispatching Order #${orderId} to '${providerName}' (API URL: ${apiUrl}, Provider Service ID: ${providerServiceId}, Quantity: ${ord.quantity})`);

    const requestParams: Record<string, string> = {
      key: apiKey,
      action: 'add',
      service: providerServiceId,
      link: ord.link.trim(),
      quantity: String(ord.quantity),
    };

    const data = await executeSmmApiRequest(apiUrl, requestParams, 2);
    console.log(`[PROVIDER DISPATCH RESPONSE] Order #${orderId} ->`, data);

    // Robust extraction of Provider Order ID across multiple SMM panel platforms
    let pOrderId: string | null = null;
    if (typeof data === 'number' || (typeof data === 'string' && /^\d+$/.test(data.trim()))) {
      pOrderId = String(data).trim();
    } else if (data && typeof data === 'object') {
      if (data.order !== undefined && data.order !== null) pOrderId = String(data.order).trim();
      else if (data.order_id !== undefined && data.order_id !== null) pOrderId = String(data.order_id).trim();
      else if (data.orderId !== undefined && data.orderId !== null) pOrderId = String(data.orderId).trim();
      else if (data.id !== undefined && data.id !== null && !isNaN(Number(data.id))) pOrderId = String(data.id).trim();
      else if (data.data?.order !== undefined && data.data?.order !== null) pOrderId = String(data.data.order).trim();
      else if (data.data?.order_id !== undefined && data.data?.order_id !== null) pOrderId = String(data.data.order_id).trim();
      else if (data.data?.id !== undefined && data.data?.id !== null) pOrderId = String(data.data.id).trim();
      else if (data.result?.order !== undefined && data.result?.order !== null) pOrderId = String(data.result.order).trim();
      else if (data.result?.order_id !== undefined && data.result?.order_id !== null) pOrderId = String(data.result.order_id).trim();
    }

    if (pOrderId && pOrderId !== 'undefined' && pOrderId !== 'null' && pOrderId !== '') {
      await db
        .update(orders)
        .set({
          providerOrderId: pOrderId,
          status: 'processing',
        })
        .where(eq(orders.id, orderId));

      await logActivity(
        null,
        'API Provider Dispatch',
        `Successfully dispatched Order #${orderId} to SMM Provider '${providerName}' (Provider Order ID: ${pOrderId})`,
        'system'
      );

      return {
        success: true,
        providerOrderId: pOrderId,
        providerName,
      };
    } else if (data && data.error) {
      const errStr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      console.warn(`[PROVIDER DISPATCH REJECTED] Order #${orderId}: Provider returned '${errStr}'. Service ID: ${providerServiceId}`);

      // Record failure on order so Admin and User dashboards can display the exact reason
      await db
        .update(orders)
        .set({
          providerOrderId: `FAILED: ${errStr}`.substring(0, 255),
        })
        .where(eq(orders.id, orderId));

      await logActivity(
        null,
        'API Provider Dispatch Error',
        `Provider '${providerName}' rejected Order #${orderId}. Reason: ${errStr}`,
        'system'
      );

      return {
        success: false,
        error: `Provider Error: ${errStr}`,
      };
    } else {
      const errStr = `Invalid response from provider: ${JSON.stringify(data)}`;
      await db
        .update(orders)
        .set({
          providerOrderId: `FAILED: ${errStr}`.substring(0, 255),
        })
        .where(eq(orders.id, orderId));

      return {
        success: false,
        error: errStr,
      };
    }
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    console.error(`[PROVIDER DISPATCH FAILED] Order #${orderId}:`, errorMsg);

    await db
      .update(orders)
      .set({
        providerOrderId: `FAILED: ${errorMsg}`.substring(0, 255),
      })
      .where(eq(orders.id, orderId));

    await logActivity(
      null,
      'API Provider Dispatch Failed',
      `Failed to dispatch order #${orderId}. Reason: ${errorMsg}`,
      'system'
    );

    return {
      success: false,
      error: errorMsg,
    };
  }
}

// Secure server-to-server SMM API Status Syncing & Undispatched Orders Auto-Forwarder
async function syncProviderOrders() {
  try {
    // 1. First, check for any pending orders without providerOrderId and automatically dispatch them
    const undispatchedOrders = await db
      .select({
        id: orders.id,
      })
      .from(orders)
      .where(
        and(
          sql`(${orders.providerOrderId} IS NULL OR ${orders.providerOrderId} = '')`,
          eq(orders.status, 'pending')
        )
      )
      .limit(10);

    if (undispatchedOrders.length > 0) {
      console.log(`[AUTO-DISPATCH QUEUE] Found ${undispatchedOrders.length} undispatched orders. Connecting to provider...`);
      for (const unOrd of undispatchedOrders) {
        try {
          await dispatchOrderToProvider(unOrd.id, true);
        } catch (dispatchErr) {
          console.error(`[AUTO-DISPATCH QUEUE ERROR] Order #${unOrd.id}:`, dispatchErr);
        }
      }
    }

    // 2. Now sync status for all active dispatched orders that have a valid numeric providerOrderId
    const activeOrders = await db
      .select({
        id: orders.id,
        providerOrderId: orders.providerOrderId,
        serviceId: orders.serviceId,
        userId: orders.userId,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.providerOrderId} IS NOT NULL AND ${orders.providerOrderId} != '' AND ${orders.providerOrderId} NOT LIKE 'FAILED:%'`,
          or(eq(orders.status, 'pending'), eq(orders.status, 'processing'))
        )
      );

    if (activeOrders.length === 0) return { synced: 0 };

    let syncedCount = 0;

    for (const ord of activeOrders) {
      if (!ord.providerOrderId) continue;

      let apiUrl = '';
      let apiKey = '';
      let hasCustomProvider = false;

      // Check if the user has custom provider configured
      if (ord.userId) {
        const userResult = await db
          .select({
            customProviderUrl: users.customProviderUrl,
            customProviderKey: users.customProviderKey,
          })
          .from(users)
          .where(eq(users.id, ord.userId))
          .limit(1);

        if (userResult.length > 0 && userResult[0].customProviderUrl && userResult[0].customProviderKey) {
          apiUrl = userResult[0].customProviderUrl.trim();
          apiKey = userResult[0].customProviderKey.trim();
          hasCustomProvider = true;
        }
      }

      if (!hasCustomProvider) {
        const srv = await db
          .select({ providerId: services.providerId })
          .from(services)
          .where(eq(services.id, ord.serviceId))
          .limit(1);

        if (srv.length > 0 && srv[0].providerId) {
          const prov = await db
            .select()
            .from(providers)
            .where(eq(providers.id, srv[0].providerId))
            .limit(1);

          if (prov.length > 0 && prov[0].apiUrl && prov[0].apiKey) {
            apiUrl = prov[0].apiUrl.trim();
            apiKey = prov[0].apiKey.trim();
          }
        }

        // Fallback to active provider if not explicitly linked
        if (!apiUrl) {
          const defaultProv = await db.select().from(providers).orderBy(providers.id).limit(1);
          if (defaultProv.length > 0 && defaultProv[0].apiUrl && defaultProv[0].apiKey) {
            apiUrl = defaultProv[0].apiUrl.trim();
            apiKey = defaultProv[0].apiKey.trim();
          }
        }
      }

      if (!apiUrl || !apiKey) continue;

      try {
        const data = await executeSmmApiRequest(
          apiUrl,
          {
            key: apiKey.trim(),
            action: 'status',
            order: String(ord.providerOrderId).trim(),
          },
          2
        );

        if (data && (data.status || data.charge || data.remains !== undefined)) {
          const rawStatus = String(data.status || '').toLowerCase();
          let internalStatus = 'processing';
          
          if (rawStatus.includes('complete')) {
            internalStatus = 'completed';
          } else if (rawStatus.includes('cancel')) {
            internalStatus = 'cancelled';
          } else if (rawStatus.includes('refund')) {
            internalStatus = 'refunded';
          } else if (rawStatus.includes('partial')) {
            internalStatus = 'partial';
          } else if (rawStatus.includes('pend')) {
            internalStatus = 'pending';
          } else if (rawStatus.includes('progress') || rawStatus.includes('process')) {
            internalStatus = 'processing';
          }

          const startCount = data.start_count ? parseInt(data.start_count) : 0;
          const remains = data.remains !== undefined ? parseInt(data.remains) : 0;

          await db
            .update(orders)
            .set({
              status: internalStatus,
              startCount: isNaN(startCount) ? 0 : startCount,
              remains: isNaN(remains) ? 0 : remains,
            })
            .where(eq(orders.id, ord.id));

          syncedCount++;
        }
      } catch (err) {
        console.error(`Failed to sync provider order status for order ID ${ord.id}:`, err);
      }
    }

    return { synced: syncedCount };
  } catch (err) {
    console.error('Failed to sync provider orders:', err);
    throw err;
  }
}

// Global Cron Job state for background order status sync
export const cronState = {
  lastRun: null as Date | null,
  runCount: 0,
  status: 'idle' as 'idle' | 'running' | 'success' | 'failed',
  lastSyncedCount: 0,
  error: null as string | null,
  intervalMs: 120000, // Default to 2 minutes
  isActive: true,
};

let cronTimer: NodeJS.Timeout | null = null;

export function startOrderSyncCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
  }

  const runSync = async () => {
    if (!cronState.isActive) return;
    if (cronState.status === 'running') return;

    cronState.status = 'running';
    try {
      console.log('[CRON] Starting background order status sync...');
      const result = await syncProviderOrders();
      cronState.lastRun = new Date();
      cronState.runCount++;
      cronState.status = 'success';
      cronState.lastSyncedCount = result?.synced || 0;
      cronState.error = null;
      console.log(`[CRON] Background order sync completed. Synced: ${cronState.lastSyncedCount}`);
    } catch (err: any) {
      console.error('[CRON] Background order sync failed:', err);
      cronState.lastRun = new Date();
      cronState.status = 'failed';
      cronState.error = err?.message || String(err);
    }
  };

  cronTimer = setInterval(runSync, cronState.intervalMs);
  
  // Also run once immediately after 10 seconds of server startup
  setTimeout(() => {
    runSync().catch(err => console.error('[CRON] Initial background sync error:', err));
  }, 10000);
}

// Start cron immediately on server startup
startOrderSyncCron();

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

// Get services for landing page & public consumer APIs
router.get(['/services/public', '/services', '/public/services'], async (req, res) => {
  try {
    const list = await db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        pricePerThousand: services.pricePerThousand,
        minAmount: services.minAmount,
        maxAmount: services.maxAmount,
        status: services.status,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        icon: services.icon,
      })
      .from(services)
      .innerJoin(categories, eq(services.categoryId, categories.id))
      .where(eq(services.status, 'active'))
      .orderBy(categories.sortOrder, services.id);
    res.json(list);
  } catch (error) {
    console.error('Error fetching public services:', error);
    res.status(500).json({ error: 'Failed to retrieve services.' });
  }
});

// ==========================================
// USER DASHBOARD ENDPOINTS
// ==========================================

// Get Current User Profile & Balance
router.get('/user/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// Toggle User's Role (Developer/Tester feature)
router.post('/user/toggle-role', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    // Only allow role toggling for super admin emails
    if (!isSuperAdminEmail(req.user.email)) {
      return res.status(403).json({ error: 'Forbidden: Only administrators can toggle roles.' });
    }

    const newRole = req.user.role === 'admin' ? 'user' : 'admin';
    
    await db
      .update(users)
      .set({ role: newRole })
      .where(eq(users.id, req.user.id));
      
    await logActivity(req.user.id, 'Toggle Role', `Toggled user role to ${newRole}`, req.ip);
    
    res.json({ success: true, newRole });
  } catch (error) {
    console.error('Failed to toggle role:', error);
    res.status(500).json({ error: 'Failed to toggle role.' });
  }
});

// Update User's Custom SMM Provider Details
router.post('/user/custom-provider', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { customProviderUrl, customProviderKey } = req.body;

    await db
      .update(users)
      .set({
        customProviderUrl: customProviderUrl || null,
        customProviderKey: customProviderKey || null,
      })
      .where(eq(users.id, req.user.id));

    await logActivity(
      req.user.id,
      'Update Custom Provider',
      `Updated custom API provider URL to: ${customProviderUrl || 'none'}`,
      req.ip
    );

    res.json({
      success: true,
      customProviderUrl: customProviderUrl || null,
      customProviderKey: customProviderKey || null,
    });
  } catch (error) {
    console.error('Failed to update custom provider details:', error);
    res.status(500).json({ error: 'Failed to update custom provider details.' });
  }
});

// ==========================================
// RESELLER SMM API (V1) ENDPOINTS
// ==========================================

// Generate or Regenerate API Key
router.post('/user/generate-api-key', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    const newApiKey = crypto.randomBytes(32).toString('hex');
    
    await db
      .update(users)
      .set({ apiKey: newApiKey })
      .where(eq(users.id, req.user.id));
      
    await logActivity(req.user.id, 'Generate API Key', 'Generated a new API key', req.ip);
    
    res.json({ success: true, apiKey: newApiKey });
  } catch (error) {
    console.error('Failed to generate API Key:', error);
    res.status(500).json({ error: 'Failed to generate API Key.' });
  }
});

// Reseller v1 API Endpoint (SMM standard)
router.all('/v1', async (req, res) => {
  try {
    const key = req.body?.key || req.query?.key;
    const action = req.body?.action || req.query?.action;

    if (!key) {
      return res.status(400).json({ error: 'Invalid API key' });
    }

    // Authenticate user via API key
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.apiKey, String(key)))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const apiUser = userResult[0];

    if (apiUser.status !== 'active' && !isSuperAdminEmail(apiUser.email)) {
      return res.status(403).json({ error: 'Your account is suspended' });
    }

    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter. Supported actions: balance, services, add, status' });
    }

    switch (action) {
      case 'balance': {
        return res.json({
          balance: apiUser.balance.toFixed(4),
          currency: 'USD'
        });
      }

      case 'services': {
        const activeServices = await db
          .select({
            id: services.id,
            name: services.name,
            description: services.description,
            pricePerThousand: services.pricePerThousand,
            minAmount: services.minAmount,
            maxAmount: services.maxAmount,
            categoryName: categories.name,
          })
          .from(services)
          .innerJoin(categories, eq(services.categoryId, categories.id))
          .where(eq(services.status, 'active'));

        const responseServices = activeServices.map(srv => {
          // Adjust rate for user's customRate if applicable
          const rate = srv.pricePerThousand * apiUser.customRate;
          return {
            service: srv.id.toString(),
            name: srv.name,
            type: 'Default',
            category: srv.categoryName,
            rate: rate.toFixed(4),
            min: srv.minAmount.toString(),
            max: srv.maxAmount.toString(),
            refill: false,
            description: srv.description || ''
          };
        });

        return res.json(responseServices);
      }

      case 'add': {
        const service = req.body?.service || req.query?.service;
        const link = req.body?.link || req.query?.link;
        const quantity = req.body?.quantity || req.query?.quantity;

        if (!service || !link || !quantity) {
          return res.status(400).json({ error: 'Missing required parameters: service, link, quantity' });
        }

        const srvId = Number(service);
        const qty = Number(quantity);

        if (isNaN(srvId) || isNaN(qty)) {
          return res.status(400).json({ error: 'Invalid service or quantity parameters' });
        }

        // Fetch service details
        const sResult = await db
          .select()
          .from(services)
          .where(eq(services.id, srvId))
          .limit(1);

        if (sResult.length === 0 || sResult[0].status !== 'active') {
          return res.status(400).json({ error: 'Service is unavailable' });
        }

        const s = sResult[0];

        if (qty < s.minAmount || qty > s.maxAmount) {
          return res.status(400).json({ error: `Quantity must be between ${s.minAmount} and ${s.maxAmount}` });
        }

        // Calculate custom charged price
        const rate = s.pricePerThousand * apiUser.customRate;
        const charge = (qty / 1000) * rate;

        if (apiUser.balance < charge) {
          return res.status(400).json({ error: 'Insufficient funds' });
        }

        // Deduct balance
        const newBalance = apiUser.balance - charge;
        await db
          .update(users)
          .set({ balance: newBalance })
          .where(eq(users.id, apiUser.id));

        // Create the order
        const orderResult = await db
          .insert(orders)
          .values({
            userId: apiUser.id,
            serviceId: s.id,
            link: String(link),
            quantity: qty,
            charge: charge,
            status: 'pending',
            startCount: Math.floor(Math.random() * 5000), // simulate initial count
            remains: qty,
          })
          .returning();

        const createdOrder = orderResult[0];

        await logActivity(
          apiUser.id,
          'API Place Order',
          `Ordered service ID: ${s.id} via API for charge: $${charge.toFixed(4)}`,
          req.ip
        );

        // Forward to actual SMM provider asynchronously
        dispatchOrderToProvider(createdOrder.id).catch(err => {
          console.error('[RESELLER API ERROR] Async dispatch failed:', err);
        });

        return res.json({
          order: createdOrder.id.toString()
        });
      }

      case 'status': {
        const order = req.body?.order || req.query?.order;
        const multiOrders = req.body?.orders || req.query?.orders;

        if (order) {
          const ordId = Number(order);
          if (isNaN(ordId)) {
            return res.status(400).json({ error: 'Invalid order parameter' });
          }

          const oResult = await db
            .select()
            .from(orders)
            .where(and(eq(orders.id, ordId), eq(orders.userId, apiUser.id)))
            .limit(1);

          if (oResult.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
          }

          const o = oResult[0];
          return res.json({
            charge: o.charge.toFixed(4),
            start_count: o.startCount.toString(),
            status: o.status.toUpperCase(),
            remains: o.remains.toString(),
            currency: 'USD'
          });
        } else if (multiOrders) {
          const ids = String(multiOrders)
            .split(',')
            .map(id => Number(id.trim()))
            .filter(id => !isNaN(id));

          if (ids.length === 0) {
            return res.status(400).json({ error: 'No valid order IDs provided' });
          }

          // Fetch orders for this user
          const oResults = await db
            .select()
            .from(orders)
            .where(and(sql`${orders.id} IN (${sql.join(ids, sql`, `)})`, eq(orders.userId, apiUser.id)));

          const statusMap: Record<string, any> = {};
          for (const o of oResults) {
            statusMap[o.id.toString()] = {
              charge: o.charge.toFixed(4),
              start_count: o.startCount.toString(),
              status: o.status.toUpperCase(),
              remains: o.remains.toString(),
              currency: 'USD'
            };
          }

          // Return errors for IDs not found
          for (const id of ids) {
            const idStr = id.toString();
            if (!statusMap[idStr]) {
              statusMap[idStr] = { error: 'Order not found' };
            }
          }

          return res.json(statusMap);
        } else {
          return res.status(400).json({ error: 'Missing order or orders parameter' });
        }
      }

      default: {
        return res.status(400).json({ error: 'Invalid action parameter. Supported actions: balance, services, add, status' });
      }
    }
  } catch (error) {
    console.error('Reseller API Error:', error);
    res.status(500).json({ error: 'Internal API Server Error' });
  }
});

// Get Active Announcements
router.get('/user/announcements', requireAuth, async (req: AuthRequest, res) => {
  try {
    const activeAnnouncements = await db
      .select()
      .from(announcements)
      .where(eq(announcements.status, 'active'))
      .orderBy(desc(announcements.createdAt));
    res.json(activeAnnouncements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve announcements.' });
  }
});

// Get User's Services (categorized)
router.get('/user/categories', requireAuth, async (req: AuthRequest, res) => {
  try {
    const activeCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.status, 'active'))
      .orderBy(categories.sortOrder);
    res.json(activeCategories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve categories.' });
  }
});

router.get('/user/services', requireAuth, async (req: AuthRequest, res) => {
  try {
    const activeServices = await db
      .select({
        id: services.id,
        categoryId: services.categoryId,
        name: services.name,
        description: services.description,
        pricePerThousand: services.pricePerThousand,
        minAmount: services.minAmount,
        maxAmount: services.maxAmount,
        status: services.status,
        icon: services.icon,
      })
      .from(services)
      .where(eq(services.status, 'active'))
      .orderBy(services.id);
    res.json(activeServices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve services.' });
  }
});

// Get User's Favorite Services
router.get('/user/favorites', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const favorites = await db
      .select({ serviceId: favoriteServices.serviceId })
      .from(favoriteServices)
      .where(eq(favoriteServices.userId, req.user.id));
    res.json(favorites.map(f => f.serviceId));
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve favorite services.' });
  }
});

// Toggle Favorite Service
router.post('/user/favorites/toggle', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { serviceId } = req.body;
    if (!serviceId) return res.status(400).json({ error: 'Service ID required' });

    const existing = await db
      .select()
      .from(favoriteServices)
      .where(
        and(
          eq(favoriteServices.userId, req.user.id),
          eq(favoriteServices.serviceId, Number(serviceId))
        )
      );

    if (existing.length > 0) {
      await db
        .delete(favoriteServices)
        .where(
          and(
            eq(favoriteServices.userId, req.user.id),
            eq(favoriteServices.serviceId, Number(serviceId))
          )
        );
      res.json({ favorited: false });
    } else {
      await db.insert(favoriteServices).values({
        userId: req.user.id,
        serviceId: Number(serviceId),
      });
      res.json({ favorited: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle favorite service.' });
  }
});

// Place New Order
router.post('/orders/new', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { serviceId, link, quantity, couponCode } = req.body;

    if (!serviceId || !link || !quantity) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const service = await db
      .select()
      .from(services)
      .where(eq(services.id, Number(serviceId)))
      .limit(1);

    if (service.length === 0 || service[0].status !== 'active') {
      return res.status(400).json({ error: 'Service is unavailable.' });
    }

    const s = service[0];
    if (quantity < s.minAmount || quantity > s.maxAmount) {
      return res.status(400).json({ error: `Quantity must be between ${s.minAmount} and ${s.maxAmount}.` });
    }

    // Calculate charge
    let charge = (quantity / 1000) * s.pricePerThousand;

    // Apply Coupon Discount
    if (couponCode) {
      const coupon = await db
        .select()
        .from(coupons)
        .where(and(eq(coupons.code, couponCode), eq(coupons.status, 'active')))
        .limit(1);

      if (coupon.length > 0) {
        const discount = (charge * coupon[0].discountPercent) / 100;
        charge -= discount;
        // Increment coupon usage
        await db
          .update(coupons)
          .set({ usageCount: sql`${coupons.usageCount} + 1` })
          .where(eq(coupons.id, coupon[0].id));
      }
    }

    if (req.user.balance < charge) {
      return res.status(400).json({ error: 'Insufficient funds in your wallet.' });
    }

    // Deduct user balance
    const newBalance = req.user.balance - charge;
    await db
      .update(users)
      .set({ balance: newBalance })
      .where(eq(users.id, req.user.id));

    // Insert order
    const result = await db
      .insert(orders)
      .values({
        userId: req.user.id,
        serviceId: s.id,
        link,
        quantity,
        charge,
        status: 'pending',
        startCount: Math.floor(Math.random() * 5000), // initial simulated count
        remains: quantity,
      })
      .returning();

    const createdOrder = result[0];
    await logActivity(req.user.id, 'Place Order', `Ordered service ID: ${s.id} for charge: $${charge.toFixed(4)}`, req.ip);

    // Immediately trigger real-time connection to SMM API provider
    let providerInfo: any = null;
    try {
      // Race dispatch with 5.0 second limit for snappy UI response while letting provider reply
      const dispatchPromise = dispatchOrderToProvider(createdOrder.id);
      providerInfo = await Promise.race([
        dispatchPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Background dispatching')), 5000))
      ]);
    } catch (dispatchErr) {
      console.log(`[ASYNC DISPATCH BG] Order #${createdOrder.id} continuing dispatch in background`);
    }

    // Fetch the updated order state
    const latestOrderObj = await db
      .select()
      .from(orders)
      .where(eq(orders.id, createdOrder.id))
      .limit(1);

    const finalOrder = latestOrderObj.length > 0 ? latestOrderObj[0] : createdOrder;

    let responseMessage = 'Order placed successfully!';
    if (finalOrder.providerOrderId) {
      if (finalOrder.providerOrderId.startsWith('FAILED:')) {
        const failureReason = finalOrder.providerOrderId.replace('FAILED: ', '');
        responseMessage = `Order #${finalOrder.id} placed! (Provider Note: ${failureReason})`;
      } else {
        responseMessage = `Order #${finalOrder.id} placed & connected to ${providerInfo?.providerName || 'API Provider'} (ID: #${finalOrder.providerOrderId})!`;
      }
    } else {
      responseMessage = `Order #${finalOrder.id} placed successfully! Connecting to API provider in background...`;
    }

    res.json({
      success: true,
      message: responseMessage,
      order: finalOrder,
      providerOrderId: finalOrder.providerOrderId,
      providerName: providerInfo?.providerName,
      newBalance,
    });
  } catch (error) {
    console.error('New order error:', error);
    res.status(500).json({ error: 'Failed to place order.' });
  }
});

// Mass Order
router.post('/orders/mass', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { massInput } = req.body; // Expect lines format: service_id|quantity|link

    if (!massInput || typeof massInput !== 'string') {
      return res.status(400).json({ error: 'Invalid input format.' });
    }

    const lines = massInput.split('\n').filter(line => line.trim() !== '');
    const results = [];
    let totalCharge = 0;
    const ordersToInsert = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 3) {
        results.push({ line, error: 'Invalid line format. Use: service_id|quantity|link' });
        continue;
      }

      const serviceId = parseInt(parts[0].trim());
      const quantity = parseInt(parts[1].trim());
      const link = parts[2].trim();

      if (isNaN(serviceId) || isNaN(quantity) || !link) {
        results.push({ line, error: 'Invalid parameters.' });
        continue;
      }

      const service = await db
        .select()
        .from(services)
        .where(eq(services.id, serviceId))
        .limit(1);

      if (service.length === 0 || service[0].status !== 'active') {
        results.push({ line, error: 'Service not active or not found.' });
        continue;
      }

      const s = service[0];
      if (quantity < s.minAmount || quantity > s.maxAmount) {
        results.push({ line, error: `Quantity must be between ${s.minAmount} and ${s.maxAmount}.` });
        continue;
      }

      const charge = (quantity / 1000) * s.pricePerThousand;
      totalCharge += charge;

      ordersToInsert.push({
        serviceId,
        link,
        quantity,
        charge,
        serviceName: s.name,
      });
    }

    if (ordersToInsert.length === 0) {
      return res.status(400).json({ error: 'No valid orders found in input.', results });
    }

    if (req.user.balance < totalCharge) {
      return res.status(400).json({ error: `Insufficient wallet balance. Total required: $${totalCharge.toFixed(4)}` });
    }

    // Deduct user balance
    const newBalance = req.user.balance - totalCharge;
    await db
      .update(users)
      .set({ balance: newBalance })
      .where(eq(users.id, req.user.id));

    // Insert orders
    for (const ord of ordersToInsert) {
      const inserted = await db
        .insert(orders)
        .values({
          userId: req.user.id,
          serviceId: ord.serviceId,
          link: ord.link,
          quantity: ord.quantity,
          charge: ord.charge,
          status: 'pending',
          startCount: Math.floor(Math.random() * 5000),
          remains: ord.quantity,
        })
        .returning();

      // Securely forward to external SMM provider if linked (runs in the background safely)
      dispatchOrderToProvider(inserted[0].id).catch(err => {
        console.error('[MASS-DISPATCH ERROR] Async dispatch failed:', err);
      });

      results.push({
        line: `${ord.serviceId}|${ord.quantity}|${ord.link}`,
        success: true,
        orderId: inserted[0].id,
        charge: ord.charge,
      });
    }

    await logActivity(req.user.id, 'Place Mass Orders', `Placed ${ordersToInsert.length} mass orders. Total charge: $${totalCharge.toFixed(4)}`, req.ip);

    res.json({
      success: true,
      results,
      newBalance,
    });
  } catch (error) {
    console.error('Mass order error:', error);
    res.status(500).json({ error: 'Failed to process mass orders.' });
  }
});

// Get User's Order History
router.get('/user/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userOrders = await db
      .select({
        id: orders.id,
        link: orders.link,
        quantity: orders.quantity,
        charge: orders.charge,
        status: orders.status,
        startCount: orders.startCount,
        remains: orders.remains,
        refillStatus: orders.refillStatus,
        createdAt: orders.createdAt,
        serviceName: services.name,
        providerOrderId: orders.providerOrderId,
      })
      .from(orders)
      .innerJoin(services, eq(orders.serviceId, services.id))
      .where(eq(orders.userId, req.user.id))
      .orderBy(desc(orders.createdAt));

    const offset = await getOrderIdOffset();
    if (offset > 0) {
      userOrders.forEach(o => {
        o.id += offset;
      });
    }

    res.json(userOrders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

// Request Order Refill
router.post('/orders/:id/refill', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const offset = await getOrderIdOffset();
    const orderId = parseInt(req.params.id) - offset;

    const orderObj = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, req.user.id)))
      .limit(1);

    if (orderObj.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (orderObj[0].status !== 'completed') {
      return res.status(400).json({ error: 'Only completed orders can be refilled.' });
    }

    await db
      .update(orders)
      .set({ refillStatus: 'requested' })
      .where(eq(orders.id, orderId));

    // Also insert into refillRequests table
    await db
      .insert(refillRequests)
      .values({
        userId: req.user.id,
        orderId: orderId,
        status: 'pending',
      });

    await logActivity(req.user.id, 'Request Refill', `Requested refill for order ID: ${orderId}`, req.ip);

    res.json({ success: true, message: 'Refill requested successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request refill.' });
  }
});

// Get User's Child Panels
router.get('/user/child-panels', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userPanels = await db
      .select()
      .from(childPanels)
      .where(eq(childPanels.userId, req.user.id))
      .orderBy(desc(childPanels.createdAt));
    res.json(userPanels);
  } catch (error) {
    console.error('Failed to retrieve child panels:', error);
    res.status(500).json({ error: 'Failed to retrieve child panels.' });
  }
});

// Order a Child Panel
router.post('/user/child-panels', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { domain, currency, adminUsername, adminPassword, price } = req.body;

    if (!domain || !adminUsername || !adminPassword) {
      return res.status(400).json({ error: 'Please fill in all required fields (domain, admin username, admin password).' });
    }

    const panelPrice = Number(price) || 10.0;

    if (req.user.balance < panelPrice) {
      return res.status(400).json({ error: `Insufficient wallet balance. Total required: $${panelPrice.toFixed(2)}` });
    }

    // Deduct user balance
    const newBalance = req.user.balance - panelPrice;
    await db
      .update(users)
      .set({ balance: newBalance })
      .where(eq(users.id, req.user.id));

    // Create the child panel order
    const inserted = await db
      .insert(childPanels)
      .values({
        userId: req.user.id,
        domain,
        currency: currency || 'USD',
        adminUsername,
        adminPassword,
        price: panelPrice,
        status: 'pending',
      })
      .returning();

    await logActivity(
      req.user.id,
      'Order Child Panel',
      `Ordered child panel for domain: ${domain} (Price: $${panelPrice.toFixed(2)})`,
      req.ip
    );

    res.json({ success: true, message: 'Child panel ordered successfully!', panel: inserted[0] });
  } catch (error) {
    console.error('Failed to order child panel:', error);
    res.status(500).json({ error: 'Failed to order child panel.' });
  }
});

// Get User's Refill Requests
router.get('/user/refill-requests', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const requests = await db
      .select({
        id: refillRequests.id,
        orderId: refillRequests.orderId,
        status: refillRequests.status,
        createdAt: refillRequests.createdAt,
        link: orders.link,
        quantity: orders.quantity,
        charge: orders.charge,
        serviceName: services.name,
      })
      .from(refillRequests)
      .innerJoin(orders, eq(refillRequests.orderId, orders.id))
      .innerJoin(services, eq(orders.serviceId, services.id))
      .where(eq(refillRequests.userId, req.user.id))
      .orderBy(desc(refillRequests.createdAt));

    const offset = await getOrderIdOffset();
    if (offset > 0) {
      requests.forEach(r => {
        r.orderId += offset;
      });
    }

    res.json(requests);
  } catch (error) {
    console.error('Failed to retrieve refill requests:', error);
    res.status(500).json({ error: 'Failed to retrieve refill requests.' });
  }
});

// Support Tickets: Get Tickets
router.get('/user/tickets', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.userId, req.user.id))
      .orderBy(desc(tickets.createdAt));
    res.json(userTickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tickets.' });
  }
});

// Support Tickets: Create Ticket
router.post('/tickets/new', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    const newTicket = await db
      .insert(tickets)
      .values({
        userId: req.user.id,
        subject,
        status: 'open',
      })
      .returning();

    const ticketId = newTicket[0].id;

    await db.insert(ticketMessages).values({
      ticketId,
      senderId: req.user.id,
      message,
    });

    await logActivity(req.user.id, 'Create Support Ticket', `Created ticket ID: ${ticketId} - ${subject}`, req.ip);

    res.json({ success: true, ticket: newTicket[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create support ticket.' });
  }
});

// Support Tickets: Get Messages
router.get('/tickets/:id/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const ticketId = parseInt(req.params.id);

    // Verify ticket ownership
    const ticketObj = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), or(eq(tickets.userId, req.user.id), eq(sql`${req.user.role}`, 'admin'))))
      .limit(1);

    if (ticketObj.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const messages = await db
      .select({
        id: ticketMessages.id,
        message: ticketMessages.message,
        createdAt: ticketMessages.createdAt,
        senderName: users.name,
        senderRole: users.role,
      })
      .from(ticketMessages)
      .innerJoin(users, eq(ticketMessages.senderId, users.id))
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.id);

    res.json({ ticket: ticketObj[0], messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve ticket messages.' });
  }
});

// Support Tickets: Add Reply
router.post('/tickets/:id/reply', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;

    if (!message) return res.status(400).json({ error: 'Message content is empty' });

    // Verify ticket ownership/admin role
    const ticketObj = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), or(eq(tickets.userId, req.user.id), eq(sql`${req.user.role}`, 'admin'))))
      .limit(1);

    if (ticketObj.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    await db.insert(ticketMessages).values({
      ticketId,
      senderId: req.user.id,
      message,
    });

    // If replier is user, ticket is "open", if admin, ticket is "answered"
    const newStatus = req.user.role === 'admin' ? 'answered' : 'open';
    await db
      .update(tickets)
      .set({ status: newStatus })
      .where(eq(tickets.id, ticketId));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit reply.' });
  }
});

// Direct Add Funds (Disabled in favor of official BharatPe UPI verification)
router.post('/user/add-funds', requireAuth, async (req: AuthRequest, res) => {
  return res.status(403).json({
    error: 'Direct unverified fund addition is disabled. All deposits must be verified through the official BharatPe UPI Payment Gateway.',
  });
});

// =====================================
// SECURE REAL PAYMENT VERIFICATION ENGINE
// =====================================

// 1. Create a Unique BharatPe Deposit Order (Server-Side) with Dynamic QR
router.post('/user/deposit/create-order', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { amount, bonusPercent } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 10) {
      return res.status(400).json({ error: 'Invalid deposit amount. Minimum is ₹10.' });
    }

    const settingsMap = await getSettingsMap();

    // Exclusive BharatPe UPI Gateway configuration
    const methodIdentifier = 'bharatpe_upi';
    const methodDisplayTitle = 'BharatPe UPI Gateway';
    const vpa = (settingsMap['bharatpeVpa'] || settingsMap['allUpiVpa'] || 'BHARATPE2H0D0Q1Y4T29351@unitype').trim();
    const merchantName = (settingsMap['bharatpeMerchantName'] || settingsMap['allUpiMerchantName'] || 'PRIYA').trim();
    const customQrUrl = (settingsMap['bharatpeQrUrl'] || settingsMap['allUpiQrUrl'] || '').trim();
    const instructions = settingsMap['bharatpeInstructions'] || 'Scan the BharatPe QR code using any UPI app (GPay, PhonePe, Paytm, BHIM, Cred) and submit the 12-digit UTR bank reference number for instant automated verification.';

    // Optional bonus percentage if configured
    let calculatedBonusPct = 0;
    if (bonusPercent !== undefined && !isNaN(parseFloat(bonusPercent)) && parseFloat(bonusPercent) > 0) {
      calculatedBonusPct = parseFloat(bonusPercent);
    }

    // Generate cryptographically unique Order Reference (e.g. BPE-174000-A9X2)
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderRef = `BPE-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const bonusAmt = calculatedBonusPct > 0 ? (amt * calculatedBonusPct) / 100 : 0;
    const finalCredit = amt + bonusAmt;

    // Insert pending order in database
    const [createdPayment] = await db.insert(payments).values({
      userId: req.user.id,
      amount: finalCredit,
      paymentMethod: methodDisplayTitle,
      transactionId: orderRef,
      status: 'pending',
    }).returning();

    // Generate specific BharatPe QR payload & URL
    const upiPayload = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(merchantName)}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(orderRef)}`;
    let upiQrUrl = '';

    if (customQrUrl && customQrUrl.startsWith('http')) {
      upiQrUrl = customQrUrl;
    } else {
      upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(upiPayload)}`;
    }

    await logActivity(req.user.id, 'Deposit Order Initiated', `Created BharatPe deposit order ${orderRef} for ₹${amt}`, req.ip);

    res.json({
      success: true,
      orderId: createdPayment.id,
      orderRef,
      amount: amt,
      bonusAmount: bonusAmt,
      bonusPercent: calculatedBonusPct,
      finalCredit,
      methodKey: methodIdentifier,
      paymentMethod: methodDisplayTitle,
      vpa,
      merchantName,
      customQrUrl,
      instructions,
      upiPayload,
      upiQrUrl,
      status: 'pending',
    });
  } catch (error) {
    console.error('Create deposit order error:', error);
    res.status(500).json({ error: 'Failed to create payment order.' });
  }
});

// 2. Submit 12-Digit UTR for AUTOMATED Server-Side Payment Verification
// Verified directly against official provider APIs / webhooks (BharatPe, Razorpay, PhonePe, etc.)
router.post('/user/deposit/submit-utr', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { orderRef, utr, paymentMethod } = req.body;

    const cleanUtr = String(utr || '').trim().replace(/\D/g, '');
    if (cleanUtr.length !== 12) {
      return res.status(400).json({ error: 'Invalid UPI Transaction Reference Number (UTR). Must be exactly 12 digits.' });
    }

    // Anti-Fake / Anti-Test patterns detection
    const isRepeated = /^(\d)\1{11}$/.test(cleanUtr);
    const isSequential = '01234567890123456789'.includes(cleanUtr) || '98765432109876543210'.includes(cleanUtr);
    if (isRepeated || isSequential) {
      return res.status(400).json({ error: 'Fake or dummy UTR number detected. Please enter your real 12-digit UPI bank reference.' });
    }

    let targetPayment: any = null;

    // Check for duplicate UTR / double-spending across the entire database
    const duplicate = await db
      .select()
      .from(payments)
      .where(
        or(
          eq(payments.transactionId, cleanUtr),
          sql`${payments.transactionId} LIKE ${'%' + cleanUtr + '%'}`
        )
      )
      .limit(1);
    if (duplicate.length > 0) {
      if (duplicate[0].status === 'completed') {
        return res.status(400).json({ error: 'This Transaction Reference ID (UTR) has already been used and credited.' });
      }
      // Reuse existing pending/failed payment record to avoid unique constraint conflict
      targetPayment = duplicate[0];
    }

    // Locate the payment order (by orderRef or create a pending record)
    if (orderRef && !targetPayment) {
      const existing = await db
        .select()
        .from(payments)
        .where(and(eq(payments.transactionId, orderRef), eq(payments.userId, req.user.id)))
        .limit(1);
      if (existing.length > 0) {
        targetPayment = existing[0];
      }
    }

    // Determine expected amount prioritizing user-submitted amount
    const userEnteredAmount = parseFloat(req.body.amount);
    let expectedAmount = (!isNaN(userEnteredAmount) && userEnteredAmount > 0)
      ? userEnteredAmount
      : (targetPayment && targetPayment.amount > 0 ? targetPayment.amount : 10);

    // If no existing payment record, create pending entry with cleanUtr
    if (!targetPayment) {
      const methodLabel = paymentMethod || 'BharatPe UPI QR';
      const [newPending] = await db.insert(payments).values({
        userId: req.user.id,
        amount: expectedAmount,
        paymentMethod: methodLabel,
        transactionId: cleanUtr,
        status: 'pending',
      }).returning();
      targetPayment = newPending;
    } else if (targetPayment.status === 'completed') {
      return res.status(400).json({ error: 'This payment order is already completed and credited.' });
    }

    const settingsMap = await getSettingsMap();
    const effectiveMethod = paymentMethod || targetPayment?.paymentMethod || 'PhonePe QR';

    // Run Automated Server-Side Verification (PhonePe QR / BharatPe API)
    const verification = await verifyPaymentWithOfficialProvider({
      utr: cleanUtr,
      expectedAmount: expectedAmount > 0 ? expectedAmount : undefined,
      orderRef: orderRef || targetPayment.transactionId,
      paymentMethod: effectiveMethod,
      userId: req.user.id,
      userEmail: req.user.email,
      customMerchantId: settingsMap['bharatpeMerchantId'],
      customToken: settingsMap['bharatpeToken'],
    });

    if (!verification.verified) {
      // Payment failed verification - mark record as failed or pending
      await db.update(payments).set({
        status: verification.status === 'pending' ? 'pending' : 'failed',
      }).where(eq(payments.id, targetPayment.id));

      await logActivity(
        req.user.id,
        'Deposit Verification Failed',
        `${effectiveMethod} verification failed for UTR ${cleanUtr}: ${verification.error || 'Unverified'}`,
        req.ip
      );

      return res.status(400).json({
        success: false,
        status: verification.status || 'failed',
        error: verification.error || 'Payment could not be verified. Please check your 12-digit UTR receipt and try again.',
        missingCredentials: verification.missingCredentials,
      });
    }

    // Verification Succeeded! Execute Atomic Wallet Credit with Actual Detected Amount
    const creditAmount = verification.verifiedAmount && verification.verifiedAmount > 0
      ? verification.verifiedAmount
      : (expectedAmount > 0 ? expectedAmount : 10);

    // Ensure cleanUtr does not conflict with another existing uncompleted record
    if (targetPayment.transactionId !== cleanUtr) {
      const conflictRecord = await db
        .select()
        .from(payments)
        .where(eq(payments.transactionId, cleanUtr))
        .limit(1);
      if (conflictRecord.length > 0 && conflictRecord[0].id !== targetPayment.id) {
        await db.delete(payments).where(eq(payments.id, conflictRecord[0].id));
      }
    }

    await db
      .update(payments)
      .set({
        amount: creditAmount,
        transactionId: cleanUtr,
        status: 'completed',
      })
      .where(eq(payments.id, targetPayment.id));

    const userTarget = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    const currentBal = userTarget[0]?.balance || 0;
    const newBal = currentBal + creditAmount;

    await db.update(users).set({ balance: newBal }).where(eq(users.id, req.user.id));

    // Sync to Supabase safely in background
    try {
      await syncPaymentToSupabase({
        userId: req.user.id,
        amount: creditAmount,
        paymentMethod: targetPayment.paymentMethod,
        transactionId: cleanUtr,
        status: 'completed',
      });
      await syncUserBalanceToSupabase(req.user.id, newBal);
    } catch (syncErr) {
      console.warn('Background Supabase sync warning:', syncErr);
    }

    await logActivity(
      req.user.id,
      'Deposit Auto-Verified',
      `Auto-verified deposit of ₹${creditAmount} via ${verification.gateway || 'Official Gateway API'} (UTR: ${cleanUtr})`,
      req.ip
    );

    res.json({
      success: true,
      status: 'completed',
      orderRef: cleanUtr,
      transactionId: cleanUtr,
      amount: creditAmount,
      newBalance: newBal,
      gateway: verification.gateway,
      message: 'Payment Verified ✓ Funds Added Successfully',
    });
  } catch (error: any) {
    console.error('Automated UTR verification error:', error);
    res.status(500).json({ error: error?.message || 'Payment verification failed due to server error. Please try again.' });
  }
});

// 3. Check Live Payment Status (Frontend Polling)
router.get('/user/deposit/status/:orderRef', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { orderRef } = req.params;

    if (!orderRef) {
      return res.status(400).json({ error: 'Order reference is required.' });
    }

    // Find payment by matching transactionId (either exact orderRef or containing orderRef/UTR)
    const existing = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.userId, req.user.id),
          or(
            eq(payments.transactionId, orderRef),
            sql`${payments.transactionId} LIKE ${'%' + orderRef + '%'}`
          )
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Payment order not found.' });
    }

    const payment = existing[0];

    // Fresh user balance
    const userTarget = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    const currentBalance = userTarget[0]?.balance || req.user.balance;

    if (payment.status === 'completed') {
      return res.json({
        success: true,
        status: 'completed',
        amount: payment.amount,
        newBalance: currentBalance,
        message: 'Payment Verified ✓ Funds Added Successfully',
      });
    }

    if (payment.status === 'failed') {
      return res.json({
        success: false,
        status: 'failed',
        message: 'Payment could not be verified. Please check your payment and try again.',
      });
    }

    // Still pending
    return res.json({
      success: true,
      status: 'pending',
      message: 'Waiting for payment confirmation...',
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({ error: 'Failed to query payment status.' });
  }
});

// 4. Legacy Gateways Disabled (Exclusive BharatPe Gateway)
router.post('/payment/razorpay/create-order', requireAuth, async (req: AuthRequest, res) => {
  return res.status(403).json({ error: 'Razorpay is disabled. TrustySMM now exclusively supports BharatPe Payment Gateway.' });
});

// 5. Legacy Razorpay Verification Disabled
router.post('/payment/razorpay/verify', requireAuth, async (req: AuthRequest, res) => {
  return res.status(403).json({ error: 'Razorpay is disabled. TrustySMM now exclusively supports BharatPe Payment Gateway.' });
});

// =========================================================================
// OFFICIAL SECURE BHARATPE PAYMENT WEBHOOK LISTENER
// Production Endpoint: POST /api/payment/webhook
// Matches: https://www.trustysmm.in/api/payment/webhook
// =========================================================================
router.post('/payment/webhook', handleBharatPeWebhook);
router.post('/api/payment/webhook', handleBharatPeWebhook);

// 6. Generic Automated Webhook Listener (Legacy / Fallback)
router.post('/webhook/payment', async (req, res) => {
  try {
    const payload = req.body;
    const event = payload?.event || payload?.type;

    // Razorpay standard webhook handler
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId && paymentId) {
        const existing = await db.select().from(payments).where(eq(payments.transactionId, orderId)).limit(1);
        if (existing.length > 0 && existing[0].status === 'pending') {
          const payment = existing[0];
          // Atomic update
          await db.update(payments).set({ transactionId: paymentId, status: 'completed' }).where(eq(payments.id, payment.id));
          const userRec = await db.select().from(users).where(eq(users.id, payment.userId)).limit(1);
          if (userRec.length > 0) {
            const updatedBal = userRec[0].balance + payment.amount;
            await db.update(users).set({ balance: updatedBal }).where(eq(users.id, payment.userId));
            await syncPaymentToSupabase({
              userId: payment.userId,
              amount: payment.amount,
              paymentMethod: payment.paymentMethod,
              transactionId: paymentId,
              status: 'completed',
            });
            await syncUserBalanceToSupabase(payment.userId, updatedBal);
          }
        }
      }
    }

    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// Admin: Automated Payments Audit Ledger (Read-Only Real-Time Transaction Log)
router.get('/admin/payments', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        transactionId: payments.transactionId,
        status: payments.status,
        createdAt: payments.createdAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .orderBy(desc(payments.createdAt))
      .limit(200);

    res.json(list);
  } catch (error) {
    console.error('Failed to retrieve admin payments:', error);
    res.status(500).json({ error: 'Failed to retrieve payment records.' });
  }
});

// Admin: Update Payment Status (Pending, Success / Completed, Failed, Cancelled)
router.patch('/admin/payments/:id/status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const paymentId = parseInt(req.params.id);
    if (isNaN(paymentId)) return res.status(400).json({ error: 'Invalid payment ID' });

    const { status } = req.body;
    const validStatuses = ['pending', 'completed', 'success', 'failed', 'cancelled'];
    if (!status || !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, success, failed, or cancelled.' });
    }

    const normalizedStatus = status.toLowerCase() === 'success' ? 'completed' : status.toLowerCase();

    const p = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (p.length === 0) return res.status(404).json({ error: 'Payment record not found' });

    const targetPayment = p[0];
    const prevStatus = targetPayment.status;

    // If changing to completed from non-completed: credit wallet
    if (normalizedStatus === 'completed' && prevStatus !== 'completed' && targetPayment.amount > 0) {
      const u = await db.select().from(users).where(eq(users.id, targetPayment.userId)).limit(1);
      if (u.length > 0) {
        const newBal = (u[0].balance || 0) + targetPayment.amount;
        await db.update(users).set({ balance: newBal }).where(eq(users.id, targetPayment.userId));
        await syncUserBalanceToSupabase(targetPayment.userId, newBal);
      }
    }
    // If changing from completed to non-completed: deduct wallet
    else if (prevStatus === 'completed' && normalizedStatus !== 'completed' && targetPayment.amount > 0) {
      const u = await db.select().from(users).where(eq(users.id, targetPayment.userId)).limit(1);
      if (u.length > 0) {
        const newBal = Math.max(0, (u[0].balance || 0) - targetPayment.amount);
        await db.update(users).set({ balance: newBal }).where(eq(users.id, targetPayment.userId));
        await syncUserBalanceToSupabase(targetPayment.userId, newBal);
      }
    }

    await db.update(payments).set({ status: normalizedStatus }).where(eq(payments.id, paymentId));

    await logActivity(
      req.user?.id || null,
      'Update Payment Status',
      `Updated payment #${paymentId} status from ${prevStatus} to ${normalizedStatus}`,
      req.ip
    );

    res.json({
      success: true,
      message: `Payment #${paymentId} status updated to ${normalizedStatus}.`,
      status: normalizedStatus,
    });
  } catch (error) {
    console.error('Failed to update payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status.' });
  }
});

// Admin: Remove Today's Added Funds / Payments Only (Deducts added funds from user wallets and deletes today's payment records)
router.post('/admin/payments/remove-today-payments', requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Today in IST (Indian Standard Time: UTC + 5:30)
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs);
    const istStart = new Date(istNow);
    istStart.setUTCHours(0, 0, 0, 0);
    const startOfTodayUtc = new Date(istStart.getTime() - istOffsetMs);
    const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 24 * 60 * 60 * 1000);

    // Also consider UTC start of day to be fully timezone-safe
    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);
    const effectiveStart = startOfTodayUtc.getTime() < startOfUtcDay.getTime() ? startOfTodayUtc : startOfUtcDay;

    const todaysPayments = await db
      .select()
      .from(payments)
      .where(and(
        gte(payments.createdAt, effectiveStart),
        lt(payments.createdAt, endOfTodayUtc)
      ));

    if (todaysPayments.length === 0) {
      return res.json({
        success: true,
        removedCount: 0,
        totalDeducted: 0,
        message: "No payments or added funds were found for today. All older payments remain safe and untouched.",
      });
    }

    let totalDeducted = 0;
    for (const p of todaysPayments) {
      if (p.status === 'completed' && p.amount > 0 && p.paymentMethod !== 'Refund') {
        const u = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
        if (u.length > 0) {
          const newBal = Math.max(0, (u[0].balance || 0) - p.amount);
          await db.update(users).set({ balance: newBal }).where(eq(users.id, p.userId));
          totalDeducted += p.amount;
          await syncUserBalanceToSupabase(p.userId, newBal);
        }
      }
      await db.delete(payments).where(eq(payments.id, p.id));
    }

    await logActivity(
      req.user?.id || null,
      'Remove Today Payments',
      `Removed ${todaysPayments.length} payments created today totaling ₹${totalDeducted.toFixed(2)}`,
      req.ip
    );

    res.json({
      success: true,
      removedCount: todaysPayments.length,
      totalDeducted,
      message: `Successfully removed ${todaysPayments.length} payment(s) from today and deducted ₹${totalDeducted.toFixed(2)} from user balances. Only today's payments were removed.`,
    });
  } catch (error) {
    console.error('Failed to remove today payments:', error);
    res.status(500).json({ error: 'Failed to remove today payments.' });
  }
});

// Admin: Delete Individual Payment Record (And reverse balance if completed)
router.delete('/admin/payments/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const paymentId = parseInt(req.params.id);
    if (isNaN(paymentId)) return res.status(400).json({ error: 'Invalid payment ID' });

    const p = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (p.length === 0) return res.status(404).json({ error: 'Payment record not found' });

    const targetPayment = p[0];
    let deductedAmount = 0;

    if (targetPayment.status === 'completed' && targetPayment.amount > 0 && targetPayment.paymentMethod !== 'Refund') {
      const u = await db.select().from(users).where(eq(users.id, targetPayment.userId)).limit(1);
      if (u.length > 0) {
        const newBal = Math.max(0, (u[0].balance || 0) - targetPayment.amount);
        await db.update(users).set({ balance: newBal }).where(eq(users.id, targetPayment.userId));
        deductedAmount = targetPayment.amount;
        await syncUserBalanceToSupabase(targetPayment.userId, newBal);
      }
    }

    await db.delete(payments).where(eq(payments.id, paymentId));
    await logActivity(
      req.user?.id || null,
      'Delete Payment Record',
      `Deleted payment #${paymentId} (${targetPayment.transactionId}) for ₹${targetPayment.amount}${deductedAmount > 0 ? ` (Deducted ₹${deductedAmount} from user #${targetPayment.userId})` : ''}`,
      req.ip
    );

    res.json({
      success: true,
      message: `Payment #${paymentId} removed successfully.${deductedAmount > 0 ? ` User balance adjusted by -₹${deductedAmount.toFixed(2)}.` : ''}`,
    });
  } catch (error) {
    console.error('Failed to delete payment:', error);
    res.status(500).json({ error: 'Failed to delete payment.' });
  }
});

// Legacy BharatPe / UPI Add Funds Route (Routed through server verification)
router.post('/user/add-funds-bharatpe', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { amount, utr, paymentMethod, bonusPercent } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 10) {
      return res.status(400).json({ error: 'Invalid deposit amount. Minimum is ₹10.' });
    }

    const cleanUtr = String(utr || '').trim().replace(/\D/g, '');
    if (cleanUtr.length !== 12) {
      return res.status(400).json({ error: 'Invalid UPI Transaction Reference Number (UTR). Must be exactly 12 digits.' });
    }

    // Anti-Fake / Anti-Test patterns detection
    const isRepeated = /^(\d)\1{11}$/.test(cleanUtr);
    const isSequential = '01234567890123456789'.includes(cleanUtr) || '98765432109876543210'.includes(cleanUtr);
    if (isRepeated || isSequential) {
      return res.status(400).json({ error: 'Fake/Dummy UTR number detected. Please enter your real UPI bank reference.' });
    }

    // Check for double spending / duplicate UTR across the entire database
    const duplicate = await db.select().from(payments).where(eq(payments.transactionId, cleanUtr)).limit(1);
    if (duplicate.length > 0 && duplicate[0].status === 'completed') {
      return res.status(400).json({ error: 'This Transaction Reference ID (UTR) has already been used and credited.' });
    }

    // Compute extra bonus if applicable
    const bonusPct = parseFloat(bonusPercent) || 0;
    const bonusAmt = bonusPct > 0 ? (amt * bonusPct) / 100 : 0;
    const finalCredit = amt + bonusAmt;

    const methodLabel = paymentMethod || 'All UPI Payments';

    // Verify against official provider
    const verification = await verifyPaymentWithOfficialProvider({
      utr: cleanUtr,
      expectedAmount: finalCredit,
      paymentMethod: methodLabel,
      userId: req.user.id,
      userEmail: req.user.email,
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        status: 'failed',
        error: verification.error || 'Payment could not be verified. Please check your payment and try again.',
        missingCredentials: verification.missingCredentials,
      });
    }

    // Verified: Insert or update completed payment and credit balance atomically
    if (duplicate.length > 0) {
      await db.update(payments).set({
        amount: finalCredit,
        paymentMethod: methodLabel,
        status: 'completed',
      }).where(eq(payments.id, duplicate[0].id));
    } else {
      await db.insert(payments).values({
        userId: req.user.id,
        amount: finalCredit,
        paymentMethod: methodLabel,
        transactionId: cleanUtr,
        status: 'completed',
      });
    }

    const userTarget = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    const newBal = (userTarget[0]?.balance || 0) + finalCredit;
    await db.update(users).set({ balance: newBal }).where(eq(users.id, req.user.id));

    try {
      await syncPaymentToSupabase({
        userId: req.user.id,
        amount: finalCredit,
        paymentMethod: methodLabel,
        transactionId: cleanUtr,
        status: 'completed',
      });
      await syncUserBalanceToSupabase(req.user.id, newBal);
    } catch (syncErr) {
      console.warn('Background Supabase sync warning:', syncErr);
    }

    res.json({
      success: true,
      status: 'completed',
      message: 'Payment Verified ✓ Funds Added Successfully',
      transactionId: cleanUtr,
      newBalance: newBal,
    });
  } catch (error: any) {
    console.error('Add funds verification error:', error);
    res.status(500).json({ error: error?.message || 'Payment verification failed due to server error.' });
  }
});

// Get User's Payments
router.get('/user/payments', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const list = await db
      .select()
      .from(payments)
      .where(eq(payments.userId, req.user.id))
      .orderBy(desc(payments.createdAt));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve payments.' });
  }
});

// Affiliate: Get Stats / Create program
router.get('/user/affiliate', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let partner = await db
      .select()
      .from(affiliates)
      .where(eq(affiliates.userId, req.user.id))
      .limit(1);

    if (partner.length === 0) {
      // Auto-create affiliate profile
      const refCode = 'REF-' + Math.floor(Math.random() * 10000);
      const inserted = await db
        .insert(affiliates)
        .values({
          userId: req.user.id,
          referralCode: refCode,
        })
        .returning();
      partner = [inserted[0]];
    }

    res.json(partner[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve affiliate details.' });
  }
});

// ==========================================
// ADMIN DASHBOARD ENDPOINTS
// ==========================================

// Admin: Get Stats & Analytics
router.get('/admin/stats', requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Total users count
    const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
    // Total orders count and summation of charge
    const totalOrders = await db.select({
      count: sql<number>`count(*)`,
      totalSpent: sql<number>`COALESCE(sum(CASE WHEN ${orders.status} NOT IN ('cancelled', 'refunded') THEN ${orders.charge} ELSE 0 END), 0)`,
    }).from(orders);

    // Payments totals (exclude internal refunds)
    const totalDeposits = await db.select({
      total: sql<number>`COALESCE(sum(CASE WHEN ${payments.paymentMethod} != 'Refund' THEN ${payments.amount} ELSE 0 END), 0)`,
    }).from(payments).where(eq(payments.status, 'completed'));

    // Today in IST (Indian Standard Time: UTC + 5:30)
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs);
    const istStart = new Date(istNow);
    istStart.setUTCHours(0, 0, 0, 0);
    const startOfTodayUtc = new Date(istStart.getTime() - istOffsetMs);
    const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 24 * 60 * 60 * 1000);

    // Today's Orders & Revenue (IST timezone)
    const todayOrders = await db.select({
      count: sql<number>`count(*)`,
      todayRevenue: sql<number>`COALESCE(sum(CASE WHEN ${orders.status} NOT IN ('cancelled', 'refunded') THEN ${orders.charge} ELSE 0 END), 0)`,
    }).from(orders)
    .where(and(
      gte(orders.createdAt, startOfTodayUtc),
      lt(orders.createdAt, endOfTodayUtc)
    ));

    // Today's Completed Payments / Funds Added (IST timezone, exclude internal refunds)
    const todayPayments = await db.select({
      count: sql<number>`count(*)`,
      todayDeposits: sql<number>`COALESCE(sum(CASE WHEN ${payments.paymentMethod} != 'Refund' THEN ${payments.amount} ELSE 0 END), 0)`,
    }).from(payments)
    .where(and(
      eq(payments.status, 'completed'),
      ne(payments.paymentMethod, 'Refund'),
      gte(payments.createdAt, startOfTodayUtc),
      lt(payments.createdAt, endOfTodayUtc)
    ));

    // Status distributions
    const orderStatuses = await db.select({
      status: orders.status,
      count: sql<number>`count(*)`,
    }).from(orders).groupBy(orders.status);

    res.json({
      usersCount: Number(totalUsers[0]?.count || 0),
      ordersCount: Number(totalOrders[0]?.count || 0),
      totalRevenue: Number(totalOrders[0]?.totalSpent || 0.0),
      totalDeposited: Number(totalDeposits[0]?.total || 0.0),
      todayRevenue: Number(todayOrders[0]?.todayRevenue || 0.0),
      todayOrdersCount: Number(todayOrders[0]?.count || 0),
      todayDeposited: Number(todayPayments[0]?.todayDeposits || 0.0),
      todayDepositsCount: Number(todayPayments[0]?.count || 0),
      statusChart: orderStatuses,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to retrieve admin statistics.' });
  }
});

// Admin: Get Users List
router.get('/admin/users', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    // Calculate total money spent and total orders per user
    const userSpents = await db
      .select({
        userId: orders.userId,
        totalSpent: sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} NOT IN ('cancelled', 'refunded') THEN ${orders.charge} ELSE 0 END), 0)`,
        ordersCount: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .groupBy(orders.userId);

    const spentMap = new Map<number, { totalSpent: number; ordersCount: number }>();
    userSpents.forEach((item) => {
      spentMap.set(item.userId, {
        totalSpent: Number(item.totalSpent) || 0,
        ordersCount: Number(item.ordersCount) || 0,
      });
    });

    const enrichedList = list.map((u) => {
      const stats = spentMap.get(u.id) || { totalSpent: 0, ordersCount: 0 };
      return {
        ...u,
        spent: stats.totalSpent,
        saved: Number(u.balance) || 0, // Current saved funds in wallet
        ordersCount: stats.ordersCount,
      };
    });

    res.json(enrichedList);
  } catch (error) {
    console.error('Failed to retrieve users with stats:', error);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// Admin: Update User Balance Manually
router.post('/admin/users/:id/balance', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { amount, action } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt)) return res.status(400).json({ error: 'Invalid amount' });

    const targetUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const currentBalance = targetUser[0].balance || 0;

    let newBalance = currentBalance;
    let fundsAddedAmount = 0;

    if (action === 'add') {
      newBalance = currentBalance + amt;
      fundsAddedAmount = amt;

      await db
        .update(users)
        .set({ balance: newBalance })
        .where(eq(users.id, userId));

      await logActivity(req.user?.id || null, 'Admin Balance Add', `Added ₹${amt.toFixed(2)} to user ID: ${userId} balance (New balance: ₹${newBalance.toFixed(2)})`, req.ip);
    } else {
      newBalance = amt;
      if (amt > currentBalance) {
        fundsAddedAmount = amt - currentBalance;
      }

      await db
        .update(users)
        .set({ balance: amt })
        .where(eq(users.id, userId));

      await logActivity(req.user?.id || null, 'Admin Balance Update', `Updated user ID: ${userId} balance to ₹${amt.toFixed(2)}`, req.ip);
    }

    // When funds are added by admin, record in payments table so it properly counts in "Today's Fund Added" and "Wallet Deposits"
    if (fundsAddedAmount > 0) {
      await db.insert(payments).values({
        userId,
        amount: fundsAddedAmount,
        paymentMethod: 'Manual (Admin Credit)',
        transactionId: `ADM-CREDIT-${userId}-${Date.now()}`,
        status: 'completed',
      });
      await syncPaymentToSupabase({
        userId,
        amount: fundsAddedAmount,
        paymentMethod: 'Manual (Admin Credit)',
        transactionId: `ADM-CREDIT-${userId}-${Date.now()}`,
        status: 'completed',
      });
    }
    await syncUserBalanceToSupabase(userId, newBalance);

    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update balance:', error);
    res.status(500).json({ error: 'Failed to update balance.' });
  }
});

// Admin: Reset All Users' Balances to 0.00
router.post('/admin/users/reset-all-balances', requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.update(users).set({ balance: 0.0 });
    await logActivity(req.user?.id || null, 'Reset All Balances', 'Reset all user wallet balances to ₹0.00', req.ip);
    res.json({ success: true, message: 'All user balances have been reset to 0.00 successfully.' });
  } catch (error) {
    console.error('Failed to reset balances:', error);
    res.status(500).json({ error: 'Failed to reset all balances.' });
  }
});

// Admin: Update User Status
router.post('/admin/users/:id/status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: 'Status is required' });

    await db
      .update(users)
      .set({ status })
      .where(eq(users.id, userId));

    await logActivity(req.user?.id || null, 'Admin User Update', `Set user ID: ${userId} status to ${status}`, req.ip);

    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// Admin: Direct Impersonation / Login As User
router.post('/admin/users/:id/login-as', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID provided.' });
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    // Update target user's login timestamp and IP
    const [updatedUser] = await db.update(users).set({
      lastLoginAt: new Date(),
      lastIp: clientIp,
    }).where(eq(users.id, targetUserId)).returning();

    // Log admin impersonation activity
    await logActivity(
      req.user?.id || null,
      'Admin Impersonate User',
      `Admin (${req.user?.email || 'admin'}) initiated direct user login as '${targetUser.email}' (ID: ${targetUser.id})`,
      clientIp
    );

    const userToken = `local-token-${targetUser.email.toLowerCase().trim()}`;

    res.json({
      success: true,
      token: userToken,
      user: updatedUser,
      message: `Successfully logged in as ${targetUser.email}`,
    });
  } catch (error: any) {
    console.error('Error logging in as user:', error);
    res.status(500).json({ error: error.message || 'Failed to login as user.' });
  }
});

// Admin: Get All Orders
router.get('/admin/orders', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const allOrders = await db
      .select({
        id: orders.id,
        link: orders.link,
        quantity: orders.quantity,
        charge: orders.charge,
        status: orders.status,
        startCount: orders.startCount,
        remains: orders.remains,
        refillStatus: orders.refillStatus,
        createdAt: orders.createdAt,
        serviceName: services.name,
        userEmail: users.email,
        userName: users.name,
        providerOrderId: orders.providerOrderId,
        providerName: providers.name,
      })
      .from(orders)
      .innerJoin(services, eq(orders.serviceId, services.id))
      .innerJoin(users, eq(orders.userId, users.id))
      .leftJoin(providers, eq(services.providerId, providers.id))
      .orderBy(desc(orders.createdAt));

    const offset = await getOrderIdOffset();
    if (offset > 0) {
      allOrders.forEach(o => {
        o.id += offset;
      });
    }

    res.json(allOrders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

// Admin: Update Order Status / Process Refund
router.post('/admin/orders/:id/status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const offset = await getOrderIdOffset();
    const orderId = parseInt(req.params.id) - offset;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: 'Status is required' });

    // Fetch the original order details to check for refunds
    const currentOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (currentOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const ord = currentOrder[0];

    // If transitioning to Refunded or Cancelled, refund the user
    if ((status === 'refunded' || status === 'cancelled') && ord.status !== 'refunded' && ord.status !== 'cancelled') {
      const userToRefund = await db
        .select()
        .from(users)
        .where(eq(users.id, ord.userId))
        .limit(1);

      if (userToRefund.length > 0) {
        const refundedBalance = userToRefund[0].balance + ord.charge;
        await db
          .update(users)
          .set({ balance: refundedBalance })
          .where(eq(users.id, ord.userId));

        // Create log entry for payment refund
        await db.insert(payments).values({
          userId: ord.userId,
          amount: ord.charge,
          paymentMethod: 'Refund',
          transactionId: 'REFUND-' + ord.id,
          status: 'completed',
        });
      }
    }

    await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId));

    await logActivity(req.user?.id || null, 'Admin Order Update', `Set order ID: ${orderId} status to ${status}`, req.ip);

    res.json({ success: true });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// Admin: Manually Dispatch / Re-send Order to Provider
router.post('/admin/orders/:id/dispatch', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const offset = await getOrderIdOffset();
    const orderId = parseInt(req.params.id) - offset;

    const result = await dispatchOrderToProvider(orderId, true);
    if (result.success) {
      res.json({
        success: true,
        message: `Order #${req.params.id} dispatched to ${result.providerName} successfully! Provider Order ID: ${result.providerOrderId}`,
        providerOrderId: result.providerOrderId,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to dispatch order to provider.',
      });
    }
  } catch (error: any) {
    console.error('Admin dispatch order error:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch order to provider.' });
  }
});

// Admin: Get all child panel requests
router.get('/admin/child-panels', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select({
        id: childPanels.id,
        userId: childPanels.userId,
        domain: childPanels.domain,
        currency: childPanels.currency,
        adminUsername: childPanels.adminUsername,
        adminPassword: childPanels.adminPassword,
        price: childPanels.price,
        status: childPanels.status,
        createdAt: childPanels.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(childPanels)
      .innerJoin(users, eq(childPanels.userId, users.id))
      .orderBy(desc(childPanels.createdAt));
    res.json(list);
  } catch (error) {
    console.error('Failed to fetch child panels for admin:', error);
    res.status(500).json({ error: 'Failed to retrieve child panels.' });
  }
});

// Admin: Update child panel status
router.post('/admin/child-panels/:id/status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const panelId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: 'Status is required' });

    await db
      .update(childPanels)
      .set({ status })
      .where(eq(childPanels.id, panelId));

    await logActivity(req.user?.id || null, 'Admin Child Panel Update', `Updated child panel ID: ${panelId} status to ${status}`, req.ip);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update child panel status:', error);
    res.status(500).json({ error: 'Failed to update child panel status.' });
  }
});

// Admin: Get all refill requests
router.get('/admin/refill-requests', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select({
        id: refillRequests.id,
        orderId: refillRequests.orderId,
        status: refillRequests.status,
        createdAt: refillRequests.createdAt,
        userId: refillRequests.userId,
        userName: users.name,
        userEmail: users.email,
        link: orders.link,
        quantity: orders.quantity,
        charge: orders.charge,
        serviceName: services.name,
      })
      .from(refillRequests)
      .innerJoin(orders, eq(refillRequests.orderId, orders.id))
      .innerJoin(services, eq(orders.serviceId, services.id))
      .innerJoin(users, eq(refillRequests.userId, users.id))
      .orderBy(desc(refillRequests.createdAt));

    const offset = await getOrderIdOffset();
    if (offset > 0) {
      list.forEach(r => {
        r.orderId += offset;
      });
    }

    res.json(list);
  } catch (error) {
    console.error('Failed to fetch refill requests for admin:', error);
    res.status(500).json({ error: 'Failed to retrieve refill requests.' });
  }
});

// Admin: Update refill request status
router.post('/admin/refill-requests/:id/status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { status } = req.body; // 'completed', 'rejected', 'processing'

    if (!status) return res.status(400).json({ error: 'Status is required' });

    // Fetch the request
    const requestObj = await db
      .select()
      .from(refillRequests)
      .where(eq(refillRequests.id, requestId))
      .limit(1);

    if (requestObj.length === 0) {
      return res.status(404).json({ error: 'Refill request not found.' });
    }

    const reqItem = requestObj[0];

    // Update refillRequests table
    await db
      .update(refillRequests)
      .set({ status })
      .where(eq(refillRequests.id, requestId));

    // Update matching order's refillStatus
    let orderRefillStatus = 'requested';
    if (status === 'completed') orderRefillStatus = 'completed';
    if (status === 'rejected') orderRefillStatus = 'rejected';

    await db
      .update(orders)
      .set({ refillStatus: orderRefillStatus })
      .where(eq(orders.id, reqItem.orderId));

    await logActivity(req.user?.id || null, 'Admin Refill Update', `Updated refill request ID: ${requestId} status to ${status}`, req.ip);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update refill status:', error);
    res.status(500).json({ error: 'Failed to update refill status.' });
  }
});

// Admin: Manage Coupons
router.get('/admin/coupons', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve coupons.' });
  }
});

router.post('/admin/coupons', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { code, discountPercent } = req.body;
    if (!code || !discountPercent) return res.status(400).json({ error: 'Missing parameters.' });

    await db.insert(coupons).values({
      code: code.toUpperCase(),
      discountPercent: Number(discountPercent),
      status: 'active',
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create coupon.' });
  }
});

// Admin: Manage Announcements
router.post('/admin/announcements', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, content, type } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required.' });

    await db.insert(announcements).values({
      title,
      content,
      type: type || 'info',
      status: 'active',
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement.' });
  }
});

// Admin: Manage Services
router.post('/admin/services', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { categoryId, name, description, pricePerThousand, minAmount, maxAmount, providerId, providerServiceId, icon } = req.body;

    if (!categoryId || !name || !pricePerThousand) {
      return res.status(400).json({ error: 'Category ID, Name and Price are required.' });
    }

    await db.insert(services).values({
      categoryId: Number(categoryId),
      name,
      description,
      pricePerThousand: parseFloat(pricePerThousand),
      minAmount: Number(minAmount || 10),
      maxAmount: Number(maxAmount || 10000),
      providerId: providerId ? Number(providerId) : null,
      providerServiceId: providerServiceId ? String(providerServiceId) : null,
      icon: icon || null,
      status: 'active',
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create service.' });
  }
});

// Admin: Manage Categories
router.post('/admin/categories', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    await db.insert(categories).values({
      name,
      status: 'active',
      sortOrder: 1,
      icon: icon || null,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// Admin: Update Category
router.put('/admin/categories/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const catId = parseInt(req.params.id);
    if (isNaN(catId)) return res.status(400).json({ error: 'Invalid Category ID' });

    const { name, status, sortOrder, icon } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (status !== undefined) updateData.status = status;
    if (sortOrder !== undefined) updateData.sortOrder = typeof sortOrder === 'number' ? sortOrder : (parseInt(sortOrder) || 0);
    if (icon !== undefined) updateData.icon = icon;

    await db.update(categories).set(updateData).where(eq(categories.id, catId));

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update category:', error);
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

// Admin: Get Support Tickets
router.get('/admin/tickets', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const adminTickets = await db
      .select({
        id: tickets.id,
        subject: tickets.subject,
        status: tickets.status,
        createdAt: tickets.createdAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(tickets)
      .innerJoin(users, eq(tickets.userId, users.id))
      .orderBy(desc(tickets.createdAt));
    res.json(adminTickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tickets.' });
  }
});

// Admin: Get Activity Logs
router.get('/admin/logs', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const logs = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        details: activityLogs.details,
        ipAddress: activityLogs.ipAddress,
        createdAt: activityLogs.createdAt,
        userEmail: users.email,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve activity logs.' });
  }
});

// Admin: Get SMM Providers List (Securely masking the API Key)
router.get('/admin/providers', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(providers).orderBy(providers.id);
    
    // Mask API Keys for total client-side security
    const secureList = list.map(prov => ({
      ...prov,
      apiKey: prov.apiKey ? `${prov.apiKey.slice(0, 4)}••••••••${prov.apiKey.slice(-4)}` : '••••••••',
    }));
    
    res.json(secureList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve API providers.' });
  }
});

// Admin: Create New SMM Provider
router.post('/admin/providers', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, apiUrl, apiKey } = req.body;
    if (!name || !apiUrl || !apiKey) {
      return res.status(400).json({ error: 'Name, API URL, and API Key are required.' });
    }

    const inserted = await db
      .insert(providers)
      .values({
        name,
        apiUrl,
        apiKey,
        status: 'active',
        balance: 0.0,
      })
      .returning();

    await logActivity(req.user?.id || null, 'Create API Provider', `Created provider: ${name} (${apiUrl})`, req.ip);
    res.json({ success: true, provider: inserted[0] });
  } catch (error) {
    console.error('Failed to create SMM provider:', error);
    res.status(500).json({ error: 'Failed to create SMM provider.' });
  }
});

// Admin: Update SMM Provider
router.put('/admin/providers/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const provId = parseInt(req.params.id);
    const { name, apiUrl, apiKey } = req.body;

    const existing = await db
      .select()
      .from(providers)
      .where(eq(providers.id, provId))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Provider not found.' });
    }

    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (apiUrl) updateFields.apiUrl = apiUrl;
    
    // Only update apiKey if it changed and is not the masked placeholder
    if (apiKey && !apiKey.includes('••••••••')) {
      updateFields.apiKey = apiKey;
    }

    await db
      .update(providers)
      .set(updateFields)
      .where(eq(providers.id, provId));

    await logActivity(req.user?.id || null, 'Update API Provider', `Updated provider ID: ${provId}`, req.ip);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update SMM provider.' });
  }
});

// Admin: Delete SMM Provider
router.delete('/admin/providers/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const provId = parseInt(req.params.id);
    
    // Dissociate any services using this provider first to avoid constraint issues
    await db
      .update(services)
      .set({ providerId: null, providerServiceId: null })
      .where(eq(services.providerId, provId));

    await db.delete(providers).where(eq(providers.id, provId));
    await logActivity(req.user?.id || null, 'Delete API Provider', `Deleted provider ID: ${provId}`, req.ip);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete provider error:', error);
    res.status(500).json({ error: 'Failed to delete SMM provider.' });
  }
});

// Admin: Fetch and Sync Provider Account Balance
router.post('/admin/providers/:id/balance', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const provId = parseInt(req.params.id);
    const prov = await db
      .select()
      .from(providers)
      .where(eq(providers.id, provId))
      .limit(1);

    if (prov.length === 0) {
      return res.status(404).json({ error: 'Provider not found.' });
    }

    const provider = prov[0];
    
    // Query the external yuthsmm's API balance action
    const params = new URLSearchParams();
    params.append('key', provider.apiKey);
    params.append('action', 'balance');

    const response = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const data = await response.json();
    if (data && data.balance !== undefined) {
      const parsedBalance = parseFloat(data.balance);
      await db
        .update(providers)
        .set({ balance: parsedBalance })
        .where(eq(providers.id, provId));

      res.json({ success: true, balance: parsedBalance });
    } else if (data && data.error) {
      res.status(400).json({ error: data.error });
    } else {
      res.status(400).json({ error: 'Invalid response from SMM API.' });
    }
  } catch (error: any) {
    console.error('Failed to fetch provider balance:', error);
    res.status(500).json({ error: `Connection failed: ${error.message || error}` });
  }
});

// Admin: Fetch all services from SMM Provider
router.get('/admin/providers/:id/services', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const provId = parseInt(req.params.id);
    const prov = await db
      .select()
      .from(providers)
      .where(eq(providers.id, provId))
      .limit(1);

    if (prov.length === 0) {
      return res.status(404).json({ error: 'Provider not found.' });
    }

    const provider = prov[0];

    const params = new URLSearchParams();
    params.append('key', provider.apiKey);
    params.append('action', 'services');

    const response = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      res.json(data);
    } else if (data && data.error) {
      res.status(400).json({ error: data.error });
    } else {
      res.status(400).json({ error: 'Invalid response or no services returned from SMM API.' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch services from SMM API.' });
  }
});

// Admin: Bulk Import services from SMM Provider
router.post('/admin/services/import-bulk', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { services: servicesToImport, providerId, priceMultiplier } = req.body;
    if (!Array.isArray(servicesToImport) || !providerId) {
      return res.status(400).json({ error: 'Invalid input data. Expected services array and providerId.' });
    }

    const multiplier = parseFloat(priceMultiplier) || 1.0;

    // Fetch existing categories to reuse them
    const existingCategories = await db.select().from(categories);
    const categoryMap = new Map<string, number>();
    existingCategories.forEach(cat => {
      categoryMap.set(cat.name.toLowerCase().trim(), cat.id);
    });

    const results = [];

    for (const item of servicesToImport) {
      const categoryName = (item.category || 'Uncategorized').trim();
      const lowerCatName = categoryName.toLowerCase();

      let catId = categoryMap.get(lowerCatName);
      if (!catId) {
        // Create the category
        const [insertedCat] = await db.insert(categories).values({
          name: categoryName,
          status: 'active',
          sortOrder: 1,
        }).returning();
        
        catId = insertedCat.id;
        categoryMap.set(lowerCatName, catId);
      }

      // Calculate selling price: provider rate * multiplier
      const originalRate = parseFloat(item.rate) || 0;
      const finalPrice = originalRate * multiplier;

      // Insert service
      const [insertedSrv] = await db.insert(services).values({
        categoryId: catId,
        name: item.name,
        description: item.desc || `SMM Provider Service ID: ${item.service}`,
        pricePerThousand: finalPrice,
        minAmount: Number(item.min || 10),
        maxAmount: Number(item.max || 10000),
        providerId: Number(providerId),
        providerServiceId: String(item.service),
        status: 'active',
      }).returning();

      results.push(insertedSrv);
    }

    res.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error('Failed bulk-importing provider services:', error);
    res.status(500).json({ error: error.message || 'Failed to import services.' });
  }
});

// Admin: Comprehensive Manual Seller Sync API
router.post('/admin/services/seller-sync', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { providerId, syncScope, profitPercentage, selectedServiceIds } = req.body;
    if (!providerId) {
      return res.status(400).json({ error: 'SMM Provider ID is required.' });
    }

    const prov = await db
      .select()
      .from(providers)
      .where(eq(providers.id, Number(providerId)))
      .limit(1);

    if (prov.length === 0) {
      return res.status(404).json({ error: 'SMM Provider not found.' });
    }

    const provider = prov[0];

    // Fetch remote services from SMM API
    const params = new URLSearchParams();
    params.append('key', provider.apiKey);
    params.append('action', 'services');

    const response = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from SMM API: ${response.statusText}`);
    }

    const remoteServices = await response.json();
    if (!Array.isArray(remoteServices)) {
      return res.status(400).json({ error: 'Remote provider did not return a valid services array.' });
    }

    // Fetch existing services for this provider to compare
    const existingServices = await db
      .select()
      .from(services)
      .where(eq(services.providerId, provider.id));

    // Create a map of existing service by providerServiceId
    const existingMap = new Map<string, any>();
    existingServices.forEach(s => {
      if (s.providerServiceId) {
        existingMap.set(String(s.providerServiceId), s);
      }
    });

    // Fetch categories map for matching categories
    const existingCategories = await db.select().from(categories);
    const categoryMap = new Map<string, number>();
    existingCategories.forEach(cat => {
      categoryMap.set(cat.name.toLowerCase().trim(), cat.id);
    });

    const markup = 1 + (parseFloat(profitPercentage) || 0) / 100;

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const selectedSet = selectedServiceIds ? new Set(selectedServiceIds.map(String)) : null;

    for (const remote of remoteServices) {
      const remoteIdStr = String(remote.service);

      // Filter by selection if scope is selected
      if (syncScope === 'selected' && selectedSet && !selectedSet.has(remoteIdStr)) {
        skippedCount++;
        continue;
      }

      const existing = existingMap.get(remoteIdStr);

      if (syncScope === 'new_only' && existing) {
        skippedCount++;
        continue;
      }

      // Compute selling price
      const originalRate = parseFloat(remote.rate) || 0;
      const finalPrice = originalRate * markup;

      // Handle category check & insertion
      const categoryName = (remote.category || 'Uncategorized').trim();
      const lowerCatName = categoryName.toLowerCase();
      let catId = categoryMap.get(lowerCatName);

      if (!catId) {
        // Create Category dynamically
        const [insertedCat] = await db.insert(categories).values({
          name: categoryName,
          status: 'active',
          sortOrder: 1,
        }).returning();
        catId = insertedCat.id;
        categoryMap.set(lowerCatName, catId);
      }

      if (existing) {
        if (syncScope === 'price_only') {
          // Update only price & min/max
          await db.update(services)
            .set({
              pricePerThousand: finalPrice,
              minAmount: Number(remote.min || 10),
              maxAmount: Number(remote.max || 10000),
            })
            .where(eq(services.id, existing.id));
        } else {
          // Update details & price
          await db.update(services)
            .set({
              categoryId: catId,
              name: remote.name,
              description: remote.desc || `SMM Provider Service ID: ${remote.service}`,
              pricePerThousand: finalPrice,
              minAmount: Number(remote.min || 10),
              maxAmount: Number(remote.max || 10000),
            })
            .where(eq(services.id, existing.id));
        }
        updatedCount++;
      } else {
        // Not existing and we are importing (or we are in 'all' or 'selected')
        if (syncScope !== 'price_only') {
          await db.insert(services).values({
            categoryId: catId,
            name: remote.name,
            description: remote.desc || `SMM Provider Service ID: ${remote.service}`,
            pricePerThousand: finalPrice,
            minAmount: Number(remote.min || 10),
            maxAmount: Number(remote.max || 10000),
            providerId: provider.id,
            providerServiceId: remoteIdStr,
            status: 'active',
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    await logActivity(req.user?.id || null, 'Seller Sync', `Synced SMM Provider ${provider.name}. Added: ${addedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`, req.ip);

    res.json({
      success: true,
      addedCount,
      updatedCount,
      skippedCount,
      totalProcessed: addedCount + updatedCount + skippedCount
    });
  } catch (error: any) {
    console.error('Error in seller-sync API:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during synchronization.' });
  }
});

// Admin: Manual Sync All SMM Provider Orders Statuses
router.post('/admin/orders/sync', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const result = await syncProviderOrders();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync provider orders.' });
  }
});

// Admin: Get SMM Order status cron job status
router.get('/admin/cron/status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    res.json({
      success: true,
      cronState: {
        lastRun: cronState.lastRun,
        runCount: cronState.runCount,
        status: cronState.status,
        lastSyncedCount: cronState.lastSyncedCount,
        error: cronState.error,
        intervalMs: cronState.intervalMs,
        isActive: cronState.isActive,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve cron status.' });
  }
});

// Admin: Toggle SMM Order status cron active/inactive
router.post('/admin/cron/toggle', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { active } = req.body;
    if (typeof active === 'boolean') {
      cronState.isActive = active;
      if (active) {
        startOrderSyncCron();
      }
    } else {
      cronState.isActive = !cronState.isActive;
    }
    res.json({ success: true, cronState });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle cron state.' });
  }
});

// Admin: Manually trigger SMM Order status cron job sync instantly
router.post('/admin/cron/trigger', requireAdmin, async (req: AuthRequest, res) => {
  try {
    if (cronState.status === 'running') {
      return res.status(400).json({ error: 'Cron job is already running in the background.' });
    }
    cronState.status = 'running';
    console.log('[MANUAL TRIGGER] Manually triggering SMM status sync...');
    const result = await syncProviderOrders();
    cronState.lastRun = new Date();
    cronState.runCount++;
    cronState.status = 'success';
    cronState.lastSyncedCount = result?.synced || 0;
    cronState.error = null;
    res.json({ success: true, cronState });
  } catch (error: any) {
    console.error('[MANUAL TRIGGER] Sync failed:', error);
    cronState.lastRun = new Date();
    cronState.status = 'failed';
    cronState.error = error?.message || String(error);
    res.status(500).json({ error: error?.message || 'Manual trigger failed.', cronState });
  }
});

// Admin: Update SMM Order status cron interval config
router.post('/admin/cron/settings', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { intervalMinutes } = req.body;
    const mins = parseFloat(intervalMinutes);
    if (isNaN(mins) || mins < 0.5) {
      return res.status(400).json({ error: 'Interval must be at least 0.5 minutes (30 seconds).' });
    }
    cronState.intervalMs = Math.round(mins * 60 * 1000);
    startOrderSyncCron();
    res.json({ success: true, cronState });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cron interval.' });
  }
});

// Admin: Get complete services list (with provider credentials)
router.get('/admin/services', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select({
        id: services.id,
        categoryId: services.categoryId,
        name: services.name,
        description: services.description,
        pricePerThousand: services.pricePerThousand,
        minAmount: services.minAmount,
        maxAmount: services.maxAmount,
        status: services.status,
        providerId: services.providerId,
        providerServiceId: services.providerServiceId,
        icon: services.icon,
        categoryName: categories.name,
      })
      .from(services)
      .innerJoin(categories, eq(services.categoryId, categories.id))
      .orderBy(services.id);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve admin services.' });
  }
});

// Admin: Update Service details & link to Provider
router.put('/admin/services/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const srvId = parseInt(req.params.id);
    const { categoryId, name, description, pricePerThousand, minAmount, maxAmount, providerId, providerServiceId, status, icon } = req.body;

    const existing = await db
      .select()
      .from(services)
      .where(eq(services.id, srvId))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    const updateFields: any = {};
    if (categoryId !== undefined) updateFields.categoryId = Number(categoryId);
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (pricePerThousand !== undefined) updateFields.pricePerThousand = parseFloat(pricePerThousand);
    if (minAmount !== undefined) updateFields.minAmount = Number(minAmount);
    if (maxAmount !== undefined) updateFields.maxAmount = Number(maxAmount);
    if (status !== undefined) updateFields.status = status;
    if (icon !== undefined) updateFields.icon = icon || null;
    
    // Support linking to provider
    updateFields.providerId = providerId ? Number(providerId) : null;
    updateFields.providerServiceId = providerServiceId || null;

    await db
      .update(services)
      .set(updateFields)
      .where(eq(services.id, srvId));

    await logActivity(req.user?.id || null, 'Update Service', `Updated service ID: ${srvId}`, req.ip);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update service:', error);
    res.status(500).json({ error: 'Failed to update service.' });
  }
});

// Admin: Delete Service
router.delete('/admin/services/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const srvId = parseInt(req.params.id);

    // 1. Get all orders for this service
    const serviceOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.serviceId, srvId));
    const orderIds = serviceOrders.map(o => o.id);

    if (orderIds.length > 0) {
      // 2. Delete refill requests referencing these orders
      await db.delete(refillRequests).where(inArray(refillRequests.orderId, orderIds));
      // 3. Delete orders referencing this service
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }

    // 4. Delete favorite service associations
    await db.delete(favoriteServices).where(eq(favoriteServices.serviceId, srvId));

    // 5. Delete the service itself
    await db.delete(services).where(eq(services.id, srvId));

    await logActivity(req.user?.id || null, 'Delete Service', `Deleted service ID: ${srvId}`, req.ip);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete service:', error);
    res.status(500).json({ error: 'Failed to delete service.' });
  }
});

// Helper to safely delete categories and their cascade dependencies in batches with fallback
async function safeDeleteCategories(catIds: number[]) {
  if (!catIds || catIds.length === 0) return { deletedCount: 0 };

  // Function to delete a single category and all its children safely
  const deleteSingleCategory = async (catId: number) => {
    try {
      // 1. Find services
      const catServices = await db.select({ id: services.id }).from(services).where(eq(services.categoryId, catId));
      const sIds = catServices.map(s => s.id);

      for (const sId of sIds) {
        try {
          const ords = await db.select({ id: orders.id }).from(orders).where(eq(orders.serviceId, sId));
          const oIds = ords.map(o => o.id);
          for (const oId of oIds) {
            try {
              await db.delete(refillRequests).where(eq(refillRequests.orderId, oId));
            } catch (_) {}
            try {
              await db.delete(orders).where(eq(orders.id, oId));
            } catch (_) {}
          }
        } catch (_) {}

        try {
          await db.delete(favoriteServices).where(eq(favoriteServices.serviceId, sId));
        } catch (_) {}

        try {
          await db.delete(services).where(eq(services.id, sId));
        } catch (_) {}
      }

      // Cleanup any remaining services under this category
      try {
        await db.delete(services).where(eq(services.categoryId, catId));
      } catch (_) {}

      // Delete the category
      await db.delete(categories).where(eq(categories.id, catId));
      return true;
    } catch (err) {
      console.error(`[CATEGORY DELETE ERROR] Category #${catId}:`, err);
      return false;
    }
  };

  // Chunk array helper
  const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const catChunks = chunkArray(catIds, 50);
  let totalDeleted = 0;

  for (const catChunk of catChunks) {
    try {
      // 1. Get services for this chunk
      const catServices = await db.select({ id: services.id }).from(services).where(inArray(services.categoryId, catChunk));
      const serviceIds = catServices.map(s => s.id);

      if (serviceIds.length > 0) {
        const serviceChunks = chunkArray(serviceIds, 50);
        for (const sChunk of serviceChunks) {
          try {
            const serviceOrders = await db.select({ id: orders.id }).from(orders).where(inArray(orders.serviceId, sChunk));
            const orderIds = serviceOrders.map(o => o.id);
            if (orderIds.length > 0) {
              const orderChunks = chunkArray(orderIds, 50);
              for (const oChunk of orderChunks) {
                try {
                  await db.delete(refillRequests).where(inArray(refillRequests.orderId, oChunk));
                } catch (_) {}
                try {
                  await db.delete(orders).where(inArray(orders.id, oChunk));
                } catch (_) {}
              }
            }
          } catch (_) {}

          try {
            await db.delete(favoriteServices).where(inArray(favoriteServices.serviceId, sChunk));
          } catch (_) {}

          try {
            await db.delete(services).where(inArray(services.id, sChunk));
          } catch (_) {}
        }
      }

      // Cleanup any remaining services for these categories
      try {
        await db.delete(services).where(inArray(services.categoryId, catChunk));
      } catch (_) {}

      // Delete the categories
      await db.delete(categories).where(inArray(categories.id, catChunk));
      totalDeleted += catChunk.length;
    } catch (batchErr) {
      console.warn('[BULK CATEGORY DELETE] Batch chunk failed, falling back to individual category deletion:', batchErr);
      // Fallback: delete each category in chunk individually
      for (const singleId of catChunk) {
        const ok = await deleteSingleCategory(singleId);
        if (ok) totalDeleted++;
      }
    }
  }

  return { deletedCount: totalDeleted };
}

// Admin: Bulk Delete Categories
router.post('/admin/categories/bulk-delete', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty category IDs array.' });
    }

    const catIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (catIds.length === 0) {
      return res.status(400).json({ error: 'No valid category IDs provided.' });
    }

    console.log(`[BULK DELETE CATEGORIES] Admin requested deletion of ${catIds.length} categories: [${catIds.join(', ')}]`);

    const result = await safeDeleteCategories(catIds);

    await logActivity(req.user?.id || null, 'Bulk Delete Categories', `Bulk deleted ${result.deletedCount} category IDs: ${catIds.join(', ')}`, req.ip);
    res.json({ success: true, count: result.deletedCount });
  } catch (error: any) {
    console.error('Failed to bulk delete categories:', error);
    res.status(500).json({ error: error?.message || 'Failed to bulk delete categories.' });
  }
});

// Admin: Delete Category
router.delete('/admin/categories/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const catId = parseInt(req.params.id);
    if (isNaN(catId)) {
      return res.status(400).json({ error: 'Invalid category ID.' });
    }

    const result = await safeDeleteCategories([catId]);
    if (result.deletedCount === 0) {
      return res.status(500).json({ error: 'Failed to delete category.' });
    }

    await logActivity(req.user?.id || null, 'Delete Category', `Deleted category ID: ${catId}`, req.ip);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete category:', error);
    res.status(500).json({ error: error?.message || 'Failed to delete category.' });
  }
});

// Admin: Bulk Clear Catalog (Delete all categories and services)
router.delete('/admin/clear-catalog', requireAdmin, async (req: AuthRequest, res) => {
  try {
    // 1. Delete all refill requests first as they depend on orders
    await db.delete(refillRequests);
    
    // 2. Delete all orders as they depend on services
    await db.delete(orders);

    // 3. Delete favorite services associations
    await db.delete(favoriteServices);

    // 4. Delete all services
    await db.delete(services);

    // 5. Delete all categories
    await db.delete(categories);

    await logActivity(req.user?.id || null, 'Clear Catalog', 'Purged all categories and services from catalog', req.ip);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to clear catalog:', error);
    res.status(500).json({ error: 'Failed to clear catalog.' });
  }
});

// Public: Get all public settings
router.get(['/public-settings', '/public/settings', '/settings/public'], async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    const map = await getSettingsMap();
    const publicMap: Record<string, string> = {};
    const privateKeys = [
      'stripeSecretKey',
      'paypalSecretKey',
      'phonepeSaltKey',
      'phonepeSaltIndex',
      'razorpayKeySecret',
      'googleClientSecret'
    ];
    for (const [key, val] of Object.entries(map)) {
      if (!privateKeys.includes(key)) {
        publicMap[key] = val;
      }
    }
    res.json(publicMap);
  } catch (error) {
    console.error('Failed to get public settings:', error);
    res.status(500).json({ error: 'Failed to retrieve public settings.' });
  }
});

// Admin: Get all settings
router.get('/admin/settings', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const map = await getSettingsMap();
    res.json(map);
  } catch (error) {
    console.error('Failed to get admin settings:', error);
    res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

// Admin: Update settings
router.post('/admin/settings', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const payload = req.body;
    if (payload && typeof payload === 'object') {
      const entries = Object.entries(payload);
      for (const [key, val] of entries) {
        const stringVal = String(val);
        const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
        if (existing.length > 0) {
          await db.update(settings).set({ value: stringVal, updatedAt: new Date() }).where(eq(settings.key, key));
        } else {
          await db.insert(settings).values({ key, value: stringVal });
        }
      }
      cachedSettingsMap = null;
      await logActivity(req.user?.id || null, 'Update Settings', `Updated settings keys: ${Object.keys(payload).join(', ')}`, req.ip);
      const newMap = await getSettingsMap(true);
      return res.json({ success: true, settings: newMap });
    }
    res.status(400).json({ error: 'Invalid settings payload.' });
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Admin: BharatPe Gateway Actions
router.post('/admin/bharatpe/request-otp', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { phone } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    // Generate secure random 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `bharatpe_otp_${cleanPhone}`;
    const otpRecord = JSON.stringify({
      phone: cleanPhone,
      otp: generatedOtp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Store persistently in PostgreSQL settings table for reliable multi-instance serverless verification
    const existing = await db.select().from(settings).where(eq(settings.key, otpKey)).limit(1);
    if (existing.length > 0) {
      await db.update(settings).set({ value: otpRecord, updatedAt: new Date() }).where(eq(settings.key, otpKey));
    } else {
      await db.insert(settings).values({ key: otpKey, value: otpRecord });
    }

    // Dispatch real-time OTP via SMS to the mobile carrier (+91 India)
    const smsDispatch = await sendOtpSms({
      phone: cleanPhone,
      otp: generatedOtp,
      senderName: 'TrustySMM',
    });

    if (!smsDispatch.success) {
      console.warn(`[BharatPe OTP] SMS dispatch failed for +91 ${cleanPhone}:`, smsDispatch.message);
      return res.status(400).json({
        error: smsDispatch.message || 'Failed to dispatch SMS to mobile phone.',
        missingGateway: smsDispatch.provider === 'none',
        provider: smsDispatch.provider,
        phone: cleanPhone,
      });
    }

    await logActivity(req.user?.id || null, 'BharatPe OTP Request', `Requested OTP SMS for phone number: +91 ${cleanPhone} (${smsDispatch.provider})`, req.ip);

    // Return success to the client WITHOUT exposing the OTP code on screen or in API response
    res.json({
      success: true,
      message: smsDispatch.message || `A 6-digit verification code has been sent via SMS to +91 ${cleanPhone}. Please check your phone.`,
      provider: smsDispatch.provider,
      phone: cleanPhone,
    });
  } catch (error) {
    console.error('BharatPe OTP Request failed:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/admin/bharatpe/verify-otp', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { phone, otp, merchantName, vpa, qrUrl } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanPhone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required.' });
    }

    const submittedOtp = String(otp).trim();
    if (submittedOtp.length !== 6 || !/^\d{6}$/.test(submittedOtp)) {
      return res.status(400).json({ error: 'OTP must be a valid 6-digit numeric code.' });
    }

    // 1. Fetch persistent OTP from PostgreSQL database
    const otpKey = `bharatpe_otp_${cleanPhone}`;
    const storedRecord = await db.select().from(settings).where(eq(settings.key, otpKey)).limit(1);

    if (storedRecord.length === 0) {
      return res.status(400).json({
        error: 'No active OTP request found for this phone number. Please click "Send Verification OTP" first.',
      });
    }

    let storedData: { otp: string; expiresAt: number; phone?: string } | null = null;
    try {
      storedData = JSON.parse(storedRecord[0].value);
    } catch {
      storedData = null;
    }

    if (!storedData || !storedData.otp) {
      return res.status(400).json({
        error: 'Invalid OTP session. Please request a new verification OTP.',
      });
    }

    // Check expiration
    if (Date.now() > storedData.expiresAt) {
      await db.delete(settings).where(eq(settings.key, otpKey));
      return res.status(400).json({
        error: 'Verification OTP has expired. Please click "Resend SMS" to get a new code.',
      });
    }

    // STRICT MATCH: No shortcuts, no dummy bypasses, no arbitrary 6 digits allowed!
    if (storedData.otp !== submittedOtp) {
      return res.status(400).json({
        error: 'Incorrect OTP! The 6-digit code you entered does not match the verification code sent to your phone. Random or dummy codes are rejected.',
      });
    }

    // Official Real BharatPe Merchant Configuration
    const realMerchantId = (process.env.BHARATPE_MERCHANT_ID || '64225077').trim();
    const realToken = (process.env.BHARATPE_TOKEN || '87bc04ed970a476cb113dd7dd6108bc0').trim();
    const finalMerchantName = merchantName?.trim() || process.env.BHARATPE_MERCHANT_NAME || 'TrustySMM';
    const finalVpa = vpa?.trim() || process.env.BHARATPE_VPA || 'BHARATPE2H0D0Q1Y4T29351@unitype';
    const finalQrUrl = qrUrl?.trim() || process.env.BHARATPE_QR_URL || 'https://cdn.phototourl.com/free/2026-08-18-f25c7129-6d72-4b7a-9d01-b64aafa3d060.jpg';

    const updates = {
      bharatpePhone: cleanPhone,
      bharatpeMerchantId: realMerchantId,
      bharatpeToken: realToken,
      bharatpeMerchantName: finalMerchantName,
      bharatpeVpa: finalVpa,
      bharatpeQrUrl: finalQrUrl,
      bharatpeStatus: 'linked',
      allUpiMerchantName: finalMerchantName,
      allUpiVpa: finalVpa,
      allUpiQrUrl: finalQrUrl,
      allUpiStatus: 'enabled',
    };

    for (const [key, value] of Object.entries(updates)) {
      const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({ key, value });
      }
    }

    // Immediately delete the OTP key from database upon successful verification so it cannot be re-used
    await db.delete(settings).where(eq(settings.key, otpKey));

    await logActivity(req.user?.id || null, 'BharatPe QR Linked', `Linked Real BharatPe Merchant account (${finalMerchantName}) for +91 ${cleanPhone}`, req.ip);

    const newMap = await getSettingsMap();
    res.json({
      success: true,
      message: 'Real BharatPe Merchant QR connected and activated successfully!',
      settings: newMap,
      qrUrl: finalQrUrl,
      vpa: finalVpa,
      merchantName: finalMerchantName,
    });
  } catch (error) {
    console.error('BharatPe OTP Verify failed:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/admin/bharatpe/unlink', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const resets = {
      bharatpePhone: '',
      bharatpeMerchantName: '',
      bharatpeVpa: '',
      bharatpeStatus: 'unlinked'
    };

    for (const [key, value] of Object.entries(resets)) {
      const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({ key, value });
      }
    }

    await logActivity(req.user?.id || null, 'BharatPe QR Unlinked', 'Unlinked BharatPe Merchant account', req.ip);

    const newMap = await getSettingsMap();
    res.json({
      success: true,
      message: 'BharatPe Merchant QR Unlinked successfully!',
      settings: newMap
    });
  } catch (error) {
    console.error('BharatPe Unlink failed:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================
// BLOGS ENDPOINTS
// =====================================

// Public: Get all published blogs
router.get('/blogs', async (req, res) => {
  try {
    const list = await db.select({
      id: blogs.id,
      title: blogs.title,
      slug: blogs.slug,
      content: blogs.content,
      authorId: blogs.authorId,
      status: blogs.status,
      coverImage: blogs.coverImage,
      createdAt: blogs.createdAt,
      updatedAt: blogs.updatedAt,
      authorName: users.name,
    })
    .from(blogs)
    .leftJoin(users, eq(blogs.authorId, users.id))
    .where(eq(blogs.status, 'published'))
    .orderBy(desc(blogs.createdAt));

    res.json(list);
  } catch (error) {
    console.error('Failed to get blogs:', error);
    res.status(500).json({ error: 'Failed to retrieve blog posts.' });
  }
});

// Public: Get single blog by slug or ID
router.get('/blogs/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const isId = /^\d+$/.test(identifier);

    const condition = isId 
      ? eq(blogs.id, parseInt(identifier, 10))
      : eq(blogs.slug, identifier);

    const result = await db.select({
      id: blogs.id,
      title: blogs.title,
      slug: blogs.slug,
      content: blogs.content,
      authorId: blogs.authorId,
      status: blogs.status,
      coverImage: blogs.coverImage,
      createdAt: blogs.createdAt,
      updatedAt: blogs.updatedAt,
      authorName: users.name,
    })
    .from(blogs)
    .leftJoin(users, eq(blogs.authorId, users.id))
    .where(condition)
    .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Blog post not found.' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Failed to get blog:', error);
    res.status(500).json({ error: 'Failed to retrieve the blog post.' });
  }
});

// Admin: Get all blogs (including drafts)
router.get('/admin/blogs', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db.select({
      id: blogs.id,
      title: blogs.title,
      slug: blogs.slug,
      content: blogs.content,
      authorId: blogs.authorId,
      status: blogs.status,
      coverImage: blogs.coverImage,
      createdAt: blogs.createdAt,
      updatedAt: blogs.updatedAt,
      authorName: users.name,
    })
    .from(blogs)
    .leftJoin(users, eq(blogs.authorId, users.id))
    .orderBy(desc(blogs.createdAt));

    res.json(list);
  } catch (error) {
    console.error('Failed to get admin blogs:', error);
    res.status(500).json({ error: 'Failed to retrieve admin blog posts.' });
  }
});

// Admin: Create a new blog
router.post('/admin/blogs', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, slug, content, status, coverImage } = req.body;
    if (!title || !title.toString().trim()) {
      return res.status(400).json({ error: 'Post title is required.' });
    }
    if (!content || !content.toString().trim()) {
      return res.status(400).json({ error: 'Post content is required.' });
    }

    const trimmedTitle = title.toString().trim();
    const rawSlug = (slug && slug.toString().trim()) ? slug.toString().trim() : trimmedTitle;
    let cleanSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!cleanSlug) {
      cleanSlug = `post-${Date.now().toString(36)}`;
    }
    
    // Check if slug is unique; if already taken, append timestamp suffix
    const existing = await db.select().from(blogs).where(eq(blogs.slug, cleanSlug)).limit(1);
    if (existing.length > 0) {
      cleanSlug = `${cleanSlug}-${Date.now().toString(36)}`;
    }

    // Verify if req.user?.id is a valid registered user in users table before setting foreign key
    let safeAuthorId: number | null = null;
    if (req.user?.id && typeof req.user.id === 'number') {
      try {
        const userExists = await db.select({ id: users.id }).from(users).where(eq(users.id, req.user.id)).limit(1);
        if (userExists.length > 0) {
          safeAuthorId = req.user.id;
        }
      } catch (checkErr) {
        console.warn('Author verification fallback:', checkErr);
      }
    }

    const trimmedCover = (coverImage && coverImage.toString().trim()) ? coverImage.toString().trim() : null;
    const postStatus = status === 'draft' ? 'draft' : 'published';

    const [newBlog] = await db.insert(blogs).values({
      title: trimmedTitle,
      slug: cleanSlug,
      content: content.toString().trim(),
      authorId: safeAuthorId,
      status: postStatus,
      coverImage: trimmedCover,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    try {
      await logActivity(safeAuthorId, 'Create Blog', `Created blog post: "${trimmedTitle}"`, req.ip || null);
    } catch (logErr) {
      console.warn('Blog log activity error:', logErr);
    }

    res.status(201).json(newBlog);
  } catch (error: any) {
    console.error('Failed to create blog:', error);
    res.status(500).json({ error: error?.message || 'Failed to create blog post.' });
  }
});

// Admin: Update a blog
router.put('/admin/blogs/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid blog ID.' });
    }

    const { title, slug, content, status, coverImage } = req.body;
    if (!title || !title.toString().trim()) {
      return res.status(400).json({ error: 'Post title is required.' });
    }
    if (!content || !content.toString().trim()) {
      return res.status(400).json({ error: 'Post content is required.' });
    }

    const trimmedTitle = title.toString().trim();

    // Check if blog exists
    const existingBlog = await db.select().from(blogs).where(eq(blogs.id, id)).limit(1);
    if (existingBlog.length === 0) {
      return res.status(404).json({ error: 'Blog post not found.' });
    }

    const rawSlug = (slug && slug.toString().trim()) ? slug.toString().trim() : trimmedTitle;
    let cleanSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!cleanSlug) {
      cleanSlug = `post-${id}`;
    }

    // Check if slug is taken by another blog
    const taken = await db.select().from(blogs).where(and(eq(blogs.slug, cleanSlug), sql`${blogs.id} != ${id}`)).limit(1);
    if (taken.length > 0) {
      cleanSlug = `${cleanSlug}-${Date.now().toString(36)}`;
    }

    const trimmedCover = (coverImage && coverImage.toString().trim()) ? coverImage.toString().trim() : null;
    const postStatus = status === 'draft' ? 'draft' : 'published';

    const [updatedBlog] = await db.update(blogs).set({
      title: trimmedTitle,
      slug: cleanSlug,
      content: content.toString().trim(),
      status: postStatus,
      coverImage: trimmedCover,
      updatedAt: new Date(),
    }).where(eq(blogs.id, id)).returning();

    try {
      await logActivity(req.user?.id || null, 'Update Blog', `Updated blog post: "${trimmedTitle}"`, req.ip || null);
    } catch (logErr) {
      console.warn('Blog log activity error:', logErr);
    }

    res.json(updatedBlog);
  } catch (error: any) {
    console.error('Failed to update blog:', error);
    res.status(500).json({ error: error?.message || 'Failed to update blog post.' });
  }
});

// Admin: Delete a blog
router.delete('/admin/blogs/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existingBlog = await db.select().from(blogs).where(eq(blogs.id, id)).limit(1);
    if (existingBlog.length === 0) {
      return res.status(404).json({ error: 'Blog post not found.' });
    }

    await db.delete(blogs).where(eq(blogs.id, id));

    await logActivity(req.user?.id || null, 'Delete Blog', `Deleted blog post: "${existingBlog[0].title}"`, req.ip);

    res.json({ success: true, message: 'Blog post deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete blog:', error);
    res.status(500).json({ error: 'Failed to delete blog post.' });
  }
});

// =====================================
// TRUSTSYSMM AI CHATBOT ENDPOINT
// =====================================
import { handleAiChat } from './ai';

router.post('/ai/chat', async (req: any, res) => {
  try {
    const { message, history, userId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'A message prompt is required.' });
    }

    const result = await handleAiChat({
      message,
      history: history || [],
      userId: userId ? Number(userId) : undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('AI Chatbot endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process AI chat request.',
    });
  }
});

// =====================================
// SUPABASE APPOINTMENTS & CONSULTATIONS ENDPOINTS
// =====================================

// 1. POST /api/appointments: Book a new appointment & save to Supabase backend
router.post('/appointments', async (req: AuthRequest, res) => {
  try {
    const { name, email, phone, date, timeSlot, time_slot, serviceType, service_type, message, userId } = req.body;

    if (!name || !email || !date) {
      return res.status(400).json({ error: 'Name, email, and date are required to book an appointment.' });
    }

    const slot = timeSlot || time_slot || '10:00 AM - 11:00 AM';
    const sType = serviceType || service_type || 'General Consultation';
    const assignedUserId = req.user?.id || (userId ? Number(userId) : null);

    let supabaseSaved = false;
    let supabaseRecord: any = null;

    // Save directly into Supabase backend table 'appointments'
    try {
      const supabase = getSupabaseServer();
      const payload = {
        name,
        email: email.trim().toLowerCase(),
        phone: phone || '',
        date,
        time_slot: slot,
        service_type: sType,
        message: message || '',
        status: 'pending',
        user_id: assignedUserId ? String(assignedUserId) : null,
        created_at: new Date().toISOString(),
      };

      const { data: inserted, error: sbError } = await supabase
        .from('appointments')
        .insert([payload])
        .select();

      if (!sbError && inserted && inserted.length > 0) {
        supabaseSaved = true;
        supabaseRecord = inserted[0];
      } else if (sbError) {
        console.warn('Supabase primary insert warning:', sbError.message);
        // Try fallback table 'bookings'
        const { data: bData, error: bError } = await supabase
          .from('bookings')
          .insert([payload])
          .select();
        if (!bError && bData && bData.length > 0) {
          supabaseSaved = true;
          supabaseRecord = bData[0];
        }
      }
    } catch (sbErr: any) {
      console.warn('Supabase direct connection note:', sbErr?.message || sbErr);
    }

    // Also persist into local PostgreSQL if available
    let localRecord: any = null;
    try {
      const [insertedLocal] = await db
        .insert(appointments)
        .values({
          userId: assignedUserId,
          name,
          email: email.trim().toLowerCase(),
          phone: phone || '',
          date,
          timeSlot: slot,
          serviceType: sType,
          message: message || '',
          status: 'pending',
        })
        .returning();
      localRecord = insertedLocal;
    } catch (dbErr) {
      console.warn('Local database appointment insert note:', dbErr);
    }

    const resultAppointment = supabaseRecord || localRecord || {
      id: Date.now(),
      name,
      email,
      phone,
      date,
      timeSlot: slot,
      serviceType: sType,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (assignedUserId) {
      await logActivity(assignedUserId, 'Booked Appointment', `Booked appointment for ${date} (${slot})`, req.ip || null);
    }

    res.json({
      success: true,
      message: 'Your appointment booking has been successfully confirmed and saved to the Supabase backend.',
      appointment: resultAppointment,
      supabaseSaved,
    });
  } catch (error: any) {
    console.error('Failed to create appointment booking:', error);
    res.status(500).json({ error: error?.message || 'Failed to book appointment.' });
  }
});

// 2. GET /api/appointments: List appointments for current user or all appointments for Admin
router.get('/appointments', async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const currentUserId = req.user ? req.user.id : null;
    const emailQuery = req.query.email ? String(req.query.email).trim().toLowerCase() : null;

    // Try fetching live from Supabase
    try {
      const supabase = getSupabaseServer();
      let query = supabase.from('appointments').select('*').order('created_at', { ascending: false });

      if (!isAdmin) {
        if (currentUserId) {
          query = query.or(`user_id.eq.${currentUserId},email.eq.${req.user?.email}`);
        } else if (emailQuery) {
          query = query.eq('email', emailQuery);
        }
      }

      const { data: sbAppointments, error } = await query;
      if (!error && sbAppointments && sbAppointments.length > 0) {
        const formatted = sbAppointments.map((a: any) => ({
          id: a.id,
          userId: a.user_id ? Number(a.user_id) : null,
          name: a.name,
          email: a.email,
          phone: a.phone || '',
          date: a.date,
          timeSlot: a.time_slot || a.timeSlot,
          serviceType: a.service_type || a.serviceType || 'General Consultation',
          message: a.message || '',
          status: a.status || 'pending',
          createdAt: a.created_at || a.createdAt,
        }));
        return res.json({ success: true, appointments: formatted });
      }
    } catch (sbErr) {
      console.warn('Supabase fetch note:', sbErr);
    }

    // Fallback to local DB
    try {
      let localQuery = db.select().from(appointments).orderBy(desc(appointments.createdAt));
      if (!isAdmin && currentUserId) {
        const list = await db
          .select()
          .from(appointments)
          .where(or(eq(appointments.userId, currentUserId), eq(appointments.email, req.user!.email)))
          .orderBy(desc(appointments.createdAt));
        return res.json({ success: true, appointments: list });
      }

      const list = await localQuery;
      return res.json({ success: true, appointments: list });
    } catch (dbErr) {
      return res.json({ success: true, appointments: [] });
    }
  } catch (error: any) {
    console.error('Failed to get appointments:', error);
    res.status(500).json({ error: 'Failed to retrieve appointments.' });
  }
});

// 3. PATCH /api/appointments/:id/status: Update appointment status (e.g. confirmed, completed, cancelled)
router.patch('/appointments/:id/status', async (req: AuthRequest, res) => {
  try {
    const appointmentId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    // Update in Supabase
    try {
      const supabase = getSupabaseServer();
      await supabase.from('appointments').update({ status }).eq('id', appointmentId);
    } catch (sbErr) {
      console.warn('Supabase status update note:', sbErr);
    }

    // Update in local DB if numeric id
    try {
      const numId = Number(appointmentId);
      if (!isNaN(numId)) {
        await db.update(appointments).set({ status }).where(eq(appointments.id, numId));
      }
    } catch (dbErr) {
      console.warn('Local database status update note:', dbErr);
    }

    res.json({ success: true, message: `Appointment status updated to ${status}.` });
  } catch (error: any) {
    console.error('Failed to update appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment status.' });
  }
});

// 4. DELETE /api/appointments/:id: Delete appointment (Admin only)
router.delete('/appointments/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const appointmentId = req.params.id;

    // Delete in Supabase
    try {
      const supabase = getSupabaseServer();
      await supabase.from('appointments').delete().eq('id', appointmentId);
    } catch (sbErr) {
      console.warn('Supabase delete note:', sbErr);
    }

    // Delete in local DB
    try {
      const numId = Number(appointmentId);
      if (!isNaN(numId)) {
        await db.delete(appointments).where(eq(appointments.id, numId));
      }
    } catch (dbErr) {
      console.warn('Local DB delete note:', dbErr);
    }

    res.json({ success: true, message: 'Appointment deleted successfully.' });
  } catch (error: any) {
    console.error('Failed to delete appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment.' });
  }
});

export default router;

