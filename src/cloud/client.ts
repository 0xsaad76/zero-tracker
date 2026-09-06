import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import * as Keychain from 'react-native-keychain';
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from '../config/supabase';

// Keychain crosses the native bridge. Supabase may ask for the same session
// several times while it initializes, so retain only that credential in RAM
// for this process. The source of truth remains the device's secure store.
const sessionMemoryCache = new Map<string, string | null>();

// Only authentication credentials are persisted. Financial records never go here.
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (sessionMemoryCache.has(key)) return sessionMemoryCache.get(key) ?? null;
    const entry = await Keychain.getGenericPassword({service: key});
    const value = entry ? entry.password : null;
    sessionMemoryCache.set(key, value);
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    const saved = await Keychain.setGenericPassword('session', value, {
      service: key,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!saved) throw new Error('Could not save your sign-in securely.');
    sessionMemoryCache.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await Keychain.resetGenericPassword({service: key});
    sessionMemoryCache.delete(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureSessionStorage,
    storageKey: 'zero-supabase-session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
