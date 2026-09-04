import * as Keychain from 'react-native-keychain';
import {secureSessionStorage} from '../src/cloud/client';

jest.mock('@supabase/supabase-js', () => ({createClient: jest.fn(() => ({})), processLock: jest.fn()}));

beforeEach(() => jest.clearAllMocks());

it('returns null for an absent session', async () => {
  await expect(secureSessionStorage.getItem('session-key')).resolves.toBeNull();
});

it('stores credentials in the device-only secure store', async () => {
  await secureSessionStorage.setItem('session-key', 'session-token');
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith('session', 'session-token', {
    service: 'session-key',
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
});

it('does not silently accept a failed secure write', async () => {
  jest.mocked(Keychain.setGenericPassword).mockResolvedValueOnce(false);
  await expect(secureSessionStorage.setItem('session-key', 'session-token')).rejects.toThrow('securely');
});

it('removes only the requested session service', async () => {
  await secureSessionStorage.removeItem('session-key');
  expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({service: 'session-key'});
});
