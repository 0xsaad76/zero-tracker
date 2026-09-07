import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import TestRenderer, {act} from 'react-test-renderer';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {CloudAuthProvider, useCloudAuth} from '../src/context/CloudAuthContext';
import {supabase} from '../src/cloud/client';
import {GOOGLE_WEB_CLIENT_ID} from '../src/config/supabase';
import {readCloudData, requireCloudUser, setCloudUser, mutateCloudData, type CloudData} from '../src/cloud/records';
import {readLegacyData} from '../src/cloud/legacy';
import {getAllUsers} from '../src/cloud';
import rootReducer from '../src/redux/rootReducer';
import type {Session} from '@supabase/supabase-js';
import {setUserName} from '../src/redux/slice/userNameSlice';
import StorageService from '../src/utils/asyncStorageService';

jest.mock('../src/cloud/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));
jest.mock('../src/cloud/records', () => ({
  readCloudData: jest.fn(),
  mutateCloudData: jest.fn(),
  setCloudUser: jest.fn(),
  requireCloudUser: jest.fn(),
}));
jest.mock('../src/cloud/legacy', () => ({readLegacyData: jest.fn(), moveLegacyData: jest.fn()}));
jest.mock('../src/recurring/service', () => ({runRecurringSchedules: jest.fn()}));
jest.mock('../src/cloud', () => ({getAllUsers: jest.fn()}));
jest.mock('../src/context/ThemeContext', () => ({
  useThemeColors: () => ({
    primaryBackground: '#fff',
    primaryText: '#111',
    accentGreen: '#070',
    secondaryText: '#444',
    accentRed: '#900',
    buttonText: '#fff',
    secondaryAccent: '#ddd',
  }),
}));

let listener: (event: string, session: Session | null) => void;
let identity: string | null;
let data: CloudData;
let renderer: TestRenderer.ReactTestRenderer | undefined;
const session = {
  user: {id: 'account-a', email: 'person@example.test', user_metadata: {full_name: 'Person'}},
  access_token: 'test-token',
} as unknown as Session;
const Consumer = () => {
  const auth = useCloudAuth();
  return (
    <>
      <Text>PRIVATE HOME {auth.email}</Text>
      <TouchableOpacity
        onPress={() => {
          void auth.signOut();
        }}>
        <Text>Test sign out</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={auth.reload}>
        <Text>Test reload</Text>
      </TouchableOpacity>
    </>
  );
};
const render = async (store = configureStore({reducer: rootReducer})) => {
  await act(async () => {
    renderer = TestRenderer.create(
      <Provider store={store}>
        <CloudAuthProvider>
          <Consumer />
        </CloudAuthProvider>
      </Provider>,
    );
  });
};
const output = () => JSON.stringify(renderer!.toJSON());
const press = async (label: string) => {
  const button = renderer!.root
    .findAllByType(TouchableOpacity)
    .find(node => node.findAllByType(Text).some(t => t.props.children === label));
  expect(button).toBeDefined();
  await act(async () => {
    button!.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  StorageService.clearSync();
  identity = null;
  data = {
    users: [{id: 'account-a', username: 'Person', email: 'person@example.test'}],
    categories: [],
    expenses: [],
    debts: [],
    debtors: [],
    budgets: [],
    currencies: [{id: 'account-a', userId: 'account-a', code: 'INR', name: 'Indian Rupee', symbol: '₹'}],
  };
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(cb => {
    listener = cb as typeof listener;
    return {data: {subscription: {unsubscribe: jest.fn()}}} as never;
  });
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session: null}, error: null});
  jest.mocked(setCloudUser).mockImplementation(id => {
    identity = id;
  });
  jest.mocked(requireCloudUser).mockImplementation(id => {
    if (!identity || (id && id !== identity)) throw new Error('Account changed');
    return identity;
  });
  jest.mocked(readLegacyData).mockResolvedValue(null);
  jest.mocked(readCloudData).mockImplementation(async () => data);
  jest.mocked(mutateCloudData).mockImplementation(async mutation => mutation(data));
  jest.mocked(getAllUsers).mockImplementation(async () => data.users);
  jest.mocked(supabase.auth.signOut).mockImplementation(async () => {
    listener('SIGNED_OUT', null);
    return {error: null};
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
});

it('requires login and does not query financial data before authentication', async () => {
  await render();
  expect(output()).toContain('Continue with Google');
  expect(output()).not.toContain('PRIVATE HOME');
  expect(readCloudData).not.toHaveBeenCalled();
});
it('exchanges a native Google ID token and opens the authenticated account', async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValue({type: 'success', data: {idToken: 'google-id-token'}} as never);
  jest.mocked(supabase.auth.signInWithIdToken).mockImplementation(async () => {
    listener('SIGNED_IN', session);
    return {data: {user: session.user, session}, error: null};
  });
  await render();
  await press('Continue with Google');
  expect(GoogleSignin.configure).toHaveBeenCalledWith({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ['email', 'profile'],
  });
  expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({provider: 'google', token: 'google-id-token'});
  expect(output()).toContain('PRIVATE HOME');
});
it('restores an existing secure session without repeating Google signup', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session}, error: null});
  await render();
  expect(output()).toContain('PRIVATE HOME');
  expect(GoogleSignin.signIn).not.toHaveBeenCalled();
});
it('silently rebuilds a missing Supabase session from the saved Google account', async () => {
  StorageService.setBoolean('cloudSessionExpected', true);
  jest.mocked(GoogleSignin.signInSilently).mockResolvedValue({
    type: 'success',
    data: {idToken: 'silent-google-token'},
  } as never);
  jest.mocked(supabase.auth.signInWithIdToken).mockResolvedValue({
    data: {user: session.user, session},
    error: null,
  } as never);
  await render();
  expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({provider: 'google', token: 'silent-google-token'});
  expect(output()).toContain('PRIVATE HOME');
});
it.each([
  ['10', 'not configured for this Android build (code 10)'],
  [10, 'not configured for this Android build (code 10)'],
  ['7', 'Check this device’s internet connection'],
  ['PLAY_SERVICES_NOT_AVAILABLE', 'Google Play Services is missing'],
  ['unknown', 'Google sign-in could not finish'],
])('explains native sign-in error %s without leaking provider details', async (code, message) => {
  jest.mocked(GoogleSignin.signIn).mockRejectedValueOnce({code, message: 'private-provider-token'});
  await render();
  await press('Continue with Google');
  expect(output()).toContain(message);
  expect(output()).not.toContain('private-provider-token');
  expect(output()).not.toContain('PRIVATE HOME');
  expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  expect(readCloudData).not.toHaveBeenCalled();
  expect(renderer!.root.findAllByType(TouchableOpacity)[0].props.disabled).toBe(false);
});
it('keeps cancellation quiet and does not exchange a token', async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({type: 'cancelled', data: null});
  await render();
  await press('Continue with Google');
  expect(renderer!.root.findAllByProps({accessibilityRole: 'alert'})).toHaveLength(0);
  expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
});
it('explains a missing Google token without contacting Supabase', async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({type: 'success', data: {idToken: null}} as never);
  await render();
  await press('Continue with Google');
  expect(output()).toContain('Google returned no sign-in token');
  expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
});
it('distinguishes a cloud-session failure and allows a successful retry', async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValue({type: 'success', data: {idToken: 'google-id-token'}} as never);
  jest.mocked(supabase.auth.signInWithIdToken).mockResolvedValueOnce({
    data: {user: null, session: null},
    error: {code: 'bad_jwt', message: 'private-provider-token'},
  } as never);
  await render();
  await press('Continue with Google');
  expect(output()).toContain('could not start your cloud session');
  expect(output()).not.toContain('private-provider-token');
  expect(output()).not.toContain('PRIVATE HOME');
  expect(readCloudData).not.toHaveBeenCalled();
  jest.mocked(supabase.auth.signInWithIdToken).mockImplementationOnce(async () => {
    listener('SIGNED_IN', session);
    return {data: {user: session.user, session}, error: null};
  });
  await press('Continue with Google');
  expect(output()).toContain('PRIVATE HOME');
  expect(output()).not.toContain('could not start your cloud session');
});
it('keeps private screens hidden on offline bootstrap and recovers on retry', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session}, error: null});
  jest.mocked(readCloudData).mockRejectedValueOnce(new Error('Cloud unavailable'));
  await render();
  expect(output()).not.toContain('PRIVATE HOME');
  expect(output()).toContain('Cloud unavailable');
  await press('Try again');
  expect(output()).toContain('PRIVATE HOME');
});
it('reasserts the restored account identity before retrying bootstrap', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session}, error: null});
  jest.mocked(readCloudData).mockImplementationOnce(async () => {
    setCloudUser(null);
    throw new Error('Please sign in to access your account.');
  });
  await render();
  expect(output()).toContain('Please sign in to access your account.');
  await press('Try again');
  expect(identity).toBe('account-a');
  expect(output()).toContain('PRIVATE HOME');
});
it('clears private screens on sign-out without deleting cloud data', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session}, error: null});
  await render();
  await press('Test sign out');
  expect(output()).toContain('Continue with Google');
  expect(output()).not.toContain('PRIVATE HOME');
  expect(identity).toBeNull();
  expect(mutateCloudData).not.toHaveBeenCalled();
  expect(StorageService.getBoolean('cloudSessionExpected')).toBe(false);
});
it('a failed sign-out can retry bootstrap using its surviving session', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session}, error: null});
  jest.mocked(supabase.auth.signOut).mockResolvedValueOnce({error: new Error('offline')} as never);
  await render();
  await press('Test sign out');
  expect(output()).not.toContain('PRIVATE HOME');
  await press('Try again');
  expect(identity).toBe('account-a');
  expect(output()).toContain('PRIVATE HOME');
});
it('requires explicit migration consent before opening private screens', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session}, error: null});
  jest.mocked(readLegacyData).mockResolvedValue({...data, users: [{id: 'old', username: 'Local', email: ''}]});
  await render();
  expect(output()).toContain('Move my records to this account');
  expect(output()).not.toContain('PRIVATE HOME');
  expect(readCloudData).not.toHaveBeenCalled();
});

it('clears cached state while reloading data for the same account', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session}, error: null});
  const store = configureStore({reducer: rootReducer});
  await render(store);
  store.dispatch(setUserName('Old cached name'));
  let finish!: (snapshot: CloudData) => void;
  jest.mocked(readCloudData).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await press('Test reload');
  expect(output()).not.toContain('PRIVATE HOME');
  expect(store.getState().userName.userName).toBe('');
  expect(store.getState().userOnboarding.isOnboarded).toBe(false);
  await act(async () => {
    finish(data);
  });
  expect(output()).toContain('PRIVATE HOME');
  expect(store.getState().userName.userName).toBe('Person');
});
it('runs monthly automations at bootstrap only when schedules exist', async () => {
  const {runRecurringSchedules} = jest.requireMock('../src/recurring/service') as {
    runRecurringSchedules: jest.Mock;
  };
  runRecurringSchedules.mockResolvedValue({posted: [], skipped: []});
  jest.mocked(supabase.auth.getSession).mockResolvedValue({data: {session}, error: null});
  await render();
  expect(output()).toContain('PRIVATE HOME');
  expect(runRecurringSchedules).not.toHaveBeenCalled();
  data = {
    ...data,
    recurringSchedules: [
      {
        id: 'sip',
        userId: 'account-a',
        target: 'expense',
        dayOfMonth: 5,
        amount: 200,
        paused: false,
        startMonth: '2026-09',
        lastPostedMonth: null,
        categoryId: 'food',
        title: 'Cash withdrawal',
        description: '',
      },
    ],
  };
  await press('Test reload');
  expect(runRecurringSchedules).toHaveBeenCalledTimes(1);
});
