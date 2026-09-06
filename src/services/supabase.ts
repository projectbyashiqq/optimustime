import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { CloudSyncConfig } from '../types';

let cachedClient: SupabaseClient | null = null;
let currentConfigKey = '';
let activeRealtimeChannel: RealtimeChannel | null = null;

export const DEFAULT_SQL_SCHEMA = `-- 1. Create main sync table
CREATE TABLE IF NOT EXISTS optimustime_sync (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE optimustime_sync ENABLE ROW LEVEL SECURITY;

-- 3. Idempotent Policies (Allow Read/Write for Anon Key)
DROP POLICY IF EXISTS "Allow anon read" ON optimustime_sync;
CREATE POLICY "Allow anon read" ON optimustime_sync FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert" ON optimustime_sync;
CREATE POLICY "Allow anon insert" ON optimustime_sync FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update" ON optimustime_sync;
CREATE POLICY "Allow anon update" ON optimustime_sync FOR UPDATE USING (true);

-- 4. Enable Real-Time Broadcast
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'optimustime_sync'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE optimustime_sync;
  END IF;
END $$;
`;

export function getSupabaseClient(config: CloudSyncConfig): SupabaseClient | null {
  if (!config.isEnabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  const configKey = `${config.supabaseUrl}_${config.supabaseAnonKey}`;
  if (cachedClient && currentConfigKey === configKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.supabaseUrl.trim(), config.supabaseAnonKey.trim(), {
      auth: { persistSession: false }
    });
    currentConfigKey = configKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Test connectivity to Supabase
 */
export async function testSupabaseConnection(config: CloudSyncConfig): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Please provide valid Supabase Project URL and Anon Key.' };
  }

  try {
    const { data, error } = await client
      .from('optimustime_sync')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        return { 
          success: false, 
          message: 'Connected to Supabase, but "optimustime_sync" table is missing. Please run the SQL schema script below.' 
        };
      }
      return { success: false, message: `Database error: ${error.message}` };
    }

    return { success: true, message: 'Connection successful! Cloud sync is operational.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Connection failed: ${msg}` };
  }
}

export interface PullCloudResult {
  success: boolean;
  isNotFound?: boolean;
  payload?: Record<string, unknown>;
  updatedAt?: string;
  error?: string;
}

export interface PushCloudResult {
  success: boolean;
  conflict?: boolean;
  remoteUpdatedAt?: string;
  serverUpdatedAt?: string;
  error?: string;
}

/**
 * Push full local state to Supabase Cloud with optional timestamp conflict guarding
 */
export async function pushStateToCloud(
  config: CloudSyncConfig, 
  fullStateBundle: Record<string, unknown>,
  options?: { expectedUpdatedAt?: string; force?: boolean }
): Promise<PushCloudResult> {
  const client = getSupabaseClient(config);
  if (!client) return { success: false, error: 'Supabase client not configured' };

  try {
    // 1. Conflict Guarding: Check if cloud has newer data than local expectedUpdatedAt
    if (!options?.force && options?.expectedUpdatedAt) {
      const { data: remoteData, error: checkError } = await client
        .from('optimustime_sync')
        .select('updated_at')
        .eq('id', 'main_workspace')
        .single();

      if (!checkError && remoteData?.updated_at) {
        const remoteTime = new Date(remoteData.updated_at).getTime();
        const expectedTime = new Date(options.expectedUpdatedAt).getTime();
        // Allow a 2-second grace period for clock skew
        if (remoteTime > expectedTime + 2000) {
          console.warn(`[Sync Conflict] Remote updated_at (${remoteData.updated_at}) > expected (${options.expectedUpdatedAt})`);
          return {
            success: false,
            conflict: true,
            remoteUpdatedAt: remoteData.updated_at,
            error: 'Cloud has newer changes from another device.'
          };
        }
      }
    }

    // 2. Perform safe upsert with updated_at timestamp
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from('optimustime_sync')
      .upsert({
        id: 'main_workspace',
        payload: fullStateBundle,
        updated_at: nowIso
      }, { onConflict: 'id' })
      .select('updated_at')
      .single();

    if (error) {
      console.error('Error pushing state to Supabase:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      serverUpdatedAt: data?.updated_at || nowIso 
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Exception pushing state to Supabase:', err);
    return { success: false, error: msg };
  }
}

/**
 * Pull latest state from Supabase Cloud with detailed status reporting
 */
export async function pullStateFromCloud(config: CloudSyncConfig): Promise<PullCloudResult> {
  const client = getSupabaseClient(config);
  if (!client) return { success: false, error: 'Supabase client not configured' };

  try {
    const { data, error } = await client
      .from('optimustime_sync')
      .select('payload, updated_at')
      .eq('id', 'main_workspace')
      .single();

    if (error) {
      // PostgREST PGRST116 indicates row doesn't exist (clean empty workspace)
      if (error.code === 'PGRST116') {
        return { success: true, isNotFound: true };
      }
      console.warn('Error fetching cloud state:', error);
      return { success: false, error: error.message };
    }

    if (!data || !data.payload) {
      return { success: true, isNotFound: true };
    }

    return {
      success: true,
      payload: data.payload as Record<string, unknown>,
      updatedAt: data.updated_at as string
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Exception pulling state from Supabase:', err);
    return { success: false, error: msg };
  }
}

/**
 * Synchronous / keepalive unload flush for tab close or page hide.
 * Uses browser fetch with keepalive: true hitting Supabase REST API directly.
 */
export function flushStateToCloudBeacon(
  config: CloudSyncConfig, 
  fullStateBundle: Record<string, unknown>
): boolean {
  if (!config.isEnabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return false;
  }

  const endpoint = `${config.supabaseUrl.replace(/\/+$/, '')}/rest/v1/optimustime_sync?on_conflict=id`;
  const nowIso = new Date().toISOString();
  const body = JSON.stringify({
    id: 'main_workspace',
    payload: fullStateBundle,
    updated_at: nowIso
  });

  try {
    if (typeof fetch !== 'undefined') {
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseAnonKey.trim(),
          'Authorization': `Bearer ${config.supabaseAnonKey.trim()}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body,
        keepalive: true
      }).catch(err => console.warn('Unload flush fetch failed:', err));
      return true;
    }
  } catch (err) {
    console.warn('Unload flush exception:', err);
  }

  return false;
}

/**
 * Subscribe to real-time changes across devices
 */
export function subscribeToRealtimeCloud(
  config: CloudSyncConfig, 
  onRemoteUpdate: (newPayload: Record<string, unknown>) => void
): () => void {
  const client = getSupabaseClient(config);
  if (!client || !config.autoRealtimeSync) {
    return () => {};
  }

  if (activeRealtimeChannel) {
    activeRealtimeChannel.unsubscribe();
    activeRealtimeChannel = null;
  }

  try {
    const channel = client
      .channel('optimustime_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'optimustime_sync', filter: 'id=eq.main_workspace' },
        (payload) => {
          if (payload.new && (payload.new as { payload?: Record<string, unknown> }).payload) {
            onRemoteUpdate((payload.new as { payload: Record<string, unknown> }).payload);
          }
        }
      )
      .subscribe();

    activeRealtimeChannel = channel;

    return () => {
      channel.unsubscribe();
      if (activeRealtimeChannel === channel) {
        activeRealtimeChannel = null;
      }
    };
  } catch (err) {
    console.error('Realtime subscription error:', err);
    return () => {};
  }
}
