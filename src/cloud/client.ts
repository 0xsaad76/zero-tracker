import 'react-native-url-polyfill/auto';
import {createClient, processLock} from '@supabase/supabase-js';
import * as Keychain from 'react-native-keychain';
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from '../config/supabase';

// Only authentication credentials are persisted. Financial records never go here.
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const entry = await Keychain.getGenericPassword({service: key});
    return entry ? entry.password : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const saved = await Keychain.setGenericPassword('session', value, {
      service: key,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!saved) throw new Error('Could not save your sign-in securely.');
  },
  async removeItem(key: string): Promise<void> {
    await Keychain.resetGenericPassword({service: key});
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureSessionStorage,
    storageKey: 'zero-supabase-session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});
