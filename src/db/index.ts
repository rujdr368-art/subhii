import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import * as schema from './schema';

const { Pool } = pg;

// Function to normalize and sanitize database connection string
export function normalizeDatabaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();

  // 1. Remove bracket placeholders e.g. postgres:[mukulbhatt@123]@... -> postgres:mukulbhatt%40123@...
  url = url.replace(/:\[([^\]]+)\]@/, (m, p) => ':' + encodeURIComponent(p) + '@');

  // 2. If password contains unescaped special characters (e.g. '@' or '#'), encode it properly
  const match = url.match(/^(postgres(?:ql)?:\/\/[^:]+):([^@]+)@(.+)$/);
  if (match) {
    const [, protocolAndUser, rawPassword, rest] = match;
    if (rawPassword.includes('@') || rawPassword.includes('#') || rawPassword.includes('[') || rawPassword.includes(']')) {
      const decoded = decodeURIComponent(rawPassword);
      url = `${protocolAndUser}:${encodeURIComponent(decoded)}@${rest}`;
    }
  }

  // 3. Supabase IPv4 compatibility:
  if (url.includes('db.pchkjgylstqphewaybjm.supabase.co')) {
    url = url
      .replace('postgresql://postgres:', 'postgresql://postgres.pchkjgylstqphewaybjm:')
      .replace('postgres://postgres:', 'postgres://postgres.pchkjgylstqphewaybjm:')
      .replace('db.pchkjgylstqphewaybjm.supabase.co:5432', 'aws-0-ap-northeast-2.pooler.supabase.com:6543')
      .replace('db.pchkjgylstqphewaybjm.supabase.co', 'aws-0-ap-northeast-2.pooler.supabase.com:6543');
  }

  return url;
}

export const isRemoteDbConfigured = Boolean(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  (process.env.SQL_HOST && process.env.SQL_HOST !== 'localhost' && process.env.SQL_HOST !== '127.0.0.1')
);

// Embedded PostgreSQL (PGlite) instance for instant, standalone execution when no external DB is configured
let pgliteInstance: PGlite | null = null;
let pgliteInitPromise: Promise<void> | null = null;

async function getPglite(): Promise<PGlite> {
  if (!pgliteInstance) {
    pgliteInstance = new PGlite();
    pgliteInitPromise = (async () => {
      try {
        const schemaPath = path.join(process.cwd(), 'database_schema.sql');
        if (fs.existsSync(schemaPath)) {
          let schemaSql = fs.readFileSync(schemaPath, 'utf-8');
          // Strip Supabase-specific RLS policies for embedded mode
          schemaSql = schemaSql.replace(/ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;[\s\S]*?USING \(true\);/g, '');
          await pgliteInstance!.exec(schemaSql);
          console.log('[DB] Embedded PostgreSQL engine initialized with schema and seed data.');
        }
      } catch (e) {
        console.warn('[DB] Embedded PostgreSQL schema initialization note:', e);
      }
    })();
  }
  if (pgliteInitPromise) {
    await pgliteInitPromise;
  }
  return pgliteInstance;
}

// Eagerly initialize embedded DB in the background when not using remote DB
if (!isRemoteDbConfigured) {
  getPglite().catch(() => {});
}

export const createPool = () => {
  // If a remote database is configured, use node-postgres Pool
  if (isRemoteDbConfigured) {
    if (process.env.SQL_HOST && (process.env.SQL_USER || process.env.SQL_ADMIN_USER) && (process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD)) {
      const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER || 'ai_studio_app_user';
      const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || '';
      const host = process.env.SQL_HOST;
      const database = process.env.SQL_DB_NAME || 'cloud_sql_development_database';
      const isSocket = host.startsWith('/');

      return new Pool({
        host,
        port: parseInt(process.env.SQL_PORT || '5432', 10),
        user,
        password,
        database,
        ssl: isSocket || process.env.SQL_SSL === 'false' ? false : (process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : false),
        connectionTimeoutMillis: 15000,
        max: 10,
        idleTimeoutMillis: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
    }

    const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    const connectionString = normalizeDatabaseUrl(rawUrl);

    if (connectionString) {
      const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
      return new Pool({
        connectionString,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        max: 10,
        idleTimeoutMillis: 30000,
      });
    }
  }

  // Fallback hybrid pool adapter that routes queries through embedded PGlite
  const hybridPool: any = {
    isEmbedded: true,
    query: async (queryTextOrConfig: any, values: any) => {
      const pglite = await getPglite();
      let text: string;
      let params: any;
      let queryOptions: any = {};

      if (typeof queryTextOrConfig === 'object' && queryTextOrConfig !== null) {
        text = queryTextOrConfig.text;
        params = queryTextOrConfig.values || values;
        queryOptions = queryTextOrConfig;
      } else {
        text = queryTextOrConfig;
        params = values;
      }

      const res = await pglite.query(text, params, { rowMode: queryOptions.rowMode });
      return {
        rows: res.rows || [],
        rowCount: res.rows ? res.rows.length : 0,
        command: 'SELECT',
        fields: res.fields || [],
      };
    },
    connect: async () => ({
      query: async (q: any, v: any) => hybridPool.query(q, v),
      release: () => {},
    }),
    on: () => {},
  };

  return hybridPool;
};

const pool = createPool();

// If it's a real pg.Pool, wrap query and connect with connection error handling and automatic PGlite fallback if offline
if (pool instanceof Pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle SQL pool client:', err);
  });

  const originalQuery = pool.query;
  pool.query = (async function (this: any, ...args: any[]) {
    let attempts = 0;
    const maxAttempts = 3;
    while (true) {
      try {
        attempts++;
        return await originalQuery.apply(this, args as any);
      } catch (err: any) {
        const isConnectionError = 
          err?.message?.includes('Connection terminated unexpectedly') ||
          err?.message?.includes('Client has encountered a connection error') ||
          err?.message?.includes('terminating connection due to administrator command') ||
          err?.message?.includes('read ECONNRESET') ||
          err?.message?.includes('ECONNREFUSED') ||
          err?.code === 'ECONNREFUSED' ||
          err?.code === '57P01' || 
          err?.code === '57P02' || 
          err?.code === '57P03' || 
          err?.code === '08006' || 
          err?.code === '08001' || 
          err?.code === '08004';

        if (isConnectionError && attempts < maxAttempts) {
          console.log(`[DB Pool] Re-initiating query operation (attempt ${attempts}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 150 * attempts));
          continue;
        }

        // If remote DB is unreachable (e.g. ECONNREFUSED), gracefully execute on embedded PGlite
        if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
          console.warn('[DB Pool] Remote database connection refused. Delegating query to embedded engine...');
          const pglite = await getPglite();
          const queryTextOrConfig = args[0];
          const values = args[1];
          let text: string;
          let params: any;
          let queryOptions: any = {};

          if (typeof queryTextOrConfig === 'object' && queryTextOrConfig !== null) {
            text = queryTextOrConfig.text;
            params = queryTextOrConfig.values || values;
            queryOptions = queryTextOrConfig;
          } else {
            text = queryTextOrConfig;
            params = values;
          }

          const res = await pglite.query(text, params, { rowMode: queryOptions.rowMode });
          return {
            rows: res.rows || [],
            rowCount: res.rows ? res.rows.length : 0,
            command: 'SELECT',
            fields: res.fields || [],
          };
        }

        throw err;
      }
    }
  } as any);

  const originalConnect = pool.connect;
  pool.connect = (async function (this: any, ...args: any[]) {
    try {
      return await originalConnect.apply(this, args as any);
    } catch (err: any) {
      if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
        return {
          query: async (q: any, v: any) => pool.query(q, v),
          release: () => {},
        };
      }
      throw err;
    }
  } as any);
}

export const db = drizzle(pool as any, { schema });
