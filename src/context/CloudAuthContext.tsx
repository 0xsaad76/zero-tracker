import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {GoogleSignin, isSuccessResponse} from '@react-native-google-signin/google-signin';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../cloud/client';
import {GOOGLE_WEB_CLIENT_ID} from '../config/supabase';
import {mutateCloudData, readCloudData, requireCloudUser, setCloudUser, type CloudData} from '../cloud/records';
import {moveLegacyData, readLegacyData} from '../cloud/legacy';
import {hydrateUserData} from '../redux/slice/userIdSlice';
import {setIsOnboarded} from '../redux/slice/isOnboardedSlice';
import {useAppDispatch} from '../redux/hooks';
import {restoreBackupPreferences} from '../utils/backupPreferences';
import {clearYearsCache} from '../utils/availableYearsCache';
import {clearErrorLog} from '../utils/errorLog';
import {useThemeColors} from './ThemeContext';
import {clearInvestmentReminders} from '../investments/reminders';
import StorageService from '../utils/asyncStorageService';

const EXPECTED_SESSION = 'cloudSessionExpected';

interface AuthContext {
  email: string;
  signOut: () => Promise<void>;
  reload: () => void;
}
const Context = createContext<AuthContext | null>(null);
export function useCloudAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('CloudAuthProvider is missing');
  return value;
}

export function CloudAuthProvider({children}: {children: React.ReactNode}) {
  const dispatch = useAppDispatch();
  const colors = useThemeColors();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'login' | 'migration' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState<CloudData | null>(null);
  const [revision, setRevision] = useState(0);
  const activeUser = useRef<string | null>(null);
  const signingIn = useRef(false);
  const restoringSession = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const restoreSessionRef = useRef<() => Promise<boolean>>(async () => false);
  const reload = useCallback(() => {
    // A restore or deletion can replace data without changing the account.
    // Discard pending fetches as well as the previous account snapshot.
    const id = sessionRef.current?.user.id ?? null;
    setCloudUser(id);
    activeUser.current = id;
    setStatus(id ? 'loading' : 'login');
    clearYearsCache();
    dispatch({type: 'cloud/reset'});
    setRevision(r => r + 1);
  }, [dispatch]);

  useEffect(() => {
    let alive = true;
    const update = (next: Session | null) => {
      if (!alive) return;
      const id = next?.user.id ?? null;
      sessionRef.current = next;
      if (id) StorageService.setBoolean(EXPECTED_SESSION, true);
      setCloudUser(id);
      if (activeUser.current !== id) {
        activeUser.current = id;
        clearYearsCache();
        clearErrorLog();
        dispatch({type: 'cloud/reset'});
        setLegacy(null);
        setError('');
        setStatus(id ? 'loading' : 'login');
      }
      setSession(next);
      if (!id) setStatus('login');
    };
    const restoreSession = async () => {
      if (!StorageService.getBoolean(EXPECTED_SESSION) || restoringSession.current || signingIn.current) return false;
      restoringSession.current = true;
      setStatus('loading');
      try {
        GoogleSignin.configure({webClientId: GOOGLE_WEB_CLIENT_ID, scopes: ['email', 'profile']});
        const result = await GoogleSignin.signInSilently();
        if (result.type !== 'success' || !result.data.idToken) {
          update(null);
          return false;
        }
        const {data, error: authError} = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.data.idToken,
        });
        if (authError || !data.session) {
          update(null);
          return false;
        }
        update(data.session);
        return true;
      } catch {
        update(null);
        return false;
      } finally {
        restoringSession.current = false;
      }
    };
    restoreSessionRef.current = restoreSession;
    // Keep callbacks synchronous: Supabase holds its auth lock during notification.
    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((event, next) => {
      update(next);
      // A revoked/expired Supabase refresh token should not force the account
      // picker back onto a user who still has a valid Google credential.
      if (event === 'SIGNED_OUT' && StorageService.getBoolean(EXPECTED_SESSION)) void restoreSession();
    });
    void supabase.auth
      .getSession()
      .then(({data, error: authError}) => {
        if (!alive) return;
        if (authError) {
          if (StorageService.getBoolean(EXPECTED_SESSION)) void restoreSession();
          else {
            setError('Could not restore your sign-in. Please try again.');
            setStatus('login');
          }
        } else if (data.session) update(data.session);
        else if (!StorageService.getBoolean(EXPECTED_SESSION)) update(null);
        else void restoreSession();
      })
      .catch(() => {
        if (alive) {
          if (StorageService.getBoolean(EXPECTED_SESSION)) void restoreSession();
          else {
            setError('Could not access secure sign-in storage.');
            setStatus('login');
          }
        }
      });
    const refresh = (state: string) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const listener = AppState.addEventListener('change', refresh);
    return () => {
      alive = false;
      subscription.unsubscribe();
      listener.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [dispatch]);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId || !session) return;
    let alive = true;
    // Reassert the identity for retries and development remounts. A real
    // sign-out changes userId and cancels this effect before any request wins.
    setCloudUser(userId);
    activeUser.current = userId;
    setStatus('loading');
    void (async () => {
      const old = await readLegacyData();
      if (!alive) return;
      requireCloudUser(userId);
      if (old) {
        setLegacy(old);
        setStatus('migration');
        return;
      }
      const data = await readCloudData();
      if (!alive) return;
      requireCloudUser(userId);
      let profile = data.users.find(user => user.id === userId);
      if (!profile) {
        const name = session.user.user_metadata.full_name;
        profile = {
          id: userId,
          username: typeof name === 'string' ? name : 'User',
          email: session.user.email ?? '',
        };
        await mutateCloudData(draft => {
          requireCloudUser(userId);
          if (!draft.users.length) draft.users.push(profile!);
        });
      }
      if (!alive) return;
      restoreBackupPreferences(
        data.preferences ?? {theme: 'system', locale: null, weekStart: 'monday', showBudgetProgress: true},
      );
      dispatch(
        hydrateUserData({
          userId,
          userName: profile.username,
          userEmail: profile.email,
        }),
      );
      dispatch(setIsOnboarded(data.currencies.length > 0));
      setError('');
      setStatus('ready');
    })().catch(e => {
      if (alive) {
        setError(e instanceof Error ? e.message : 'Could not load your account.');
        setStatus('error');
      }
    });
    return () => {
      alive = false;
    };
    // Identity, not token refresh, controls bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, revision, dispatch]);

  const signIn = async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy(true);
    setError('');
    let stage: 'google' | 'supabase' = 'google';
    try {
      GoogleSignin.configure({webClientId: GOOGLE_WEB_CLIENT_ID, scopes: ['email', 'profile']});
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return;
      if (!result.data.idToken) {
        setError('Google returned no sign-in token. Check the Google Web client ID configured for Zero.');
        return;
      }
      stage = 'supabase';
      const {error: authError} = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: result.data.idToken,
      });
      if (authError) throw authError;
    } catch (cause) {
      // Report the failing boundary without displaying/logging provider messages,
      // which can contain account details or tokens. Android status 10 is a
      // developer configuration error, not a connectivity failure.
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
      if (stage === 'supabase') {
        setError(
          'Google sign-in completed, but Zero could not start your cloud session. Check your connection and try again. If it persists, check the Supabase Google provider configuration.',
        );
      } else if (code === '10' || code === 'DEVELOPER_ERROR') {
        setError(
          'Google sign-in is not configured for this Android build (code 10). Register its package name and signing SHA-1 in the same Google Cloud project as the Web client ID. This is an app setup issue, not your account.',
        );
      } else if (code === '7' || code === 'NETWORK_ERROR') {
        setError('Google could not connect. Check this device’s internet connection and try again.');
      } else if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        setError('Google Play Services is missing or needs an update. Update it on this device, then try again.');
      } else {
        setError('Google sign-in could not finish. Please try again.');
      }
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  };

  const signOut = useCallback(async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy(true);
    setCloudUser(null);
    clearYearsCache();
    clearErrorLog();
    dispatch({type: 'cloud/reset'});
    setLegacy(null);
    setStatus('loading');
    StorageService.setBoolean(EXPECTED_SESSION, false);
    let reminderCleanupWarning = '';
    try {
      // Do not leave a previous account's device alarms behind after sign-out.
      try {
        await clearInvestmentReminders();
      } catch {
        // setCloudUser(null) retries on every signed-out startup. Do not trap
        // the user in an account merely because the native reminder bridge failed.
        reminderCleanupWarning = 'Signed out, but Android reminder cleanup will be retried when Zero opens again.';
      }
      const {error: signOutError} = await supabase.auth.signOut({scope: 'local'});
      if (signOutError) throw signOutError;
      await GoogleSignin.signOut().catch(() => {});
      setSession(null);
      sessionRef.current = null;
      activeUser.current = null;
      setError(reminderCleanupWarning);
      setStatus('login');
    } catch {
      // Local credentials survived: restore the matching data identity so
      // retrying bootstrap works, while the cleared screens stay hidden.
      setCloudUser(activeUser.current);
      StorageService.setBoolean(EXPECTED_SESSION, true);
      setError('Could not complete sign-out. Retry to clear your saved sign-in.');
      setStatus('error');
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  }, [dispatch]);

  const retry = () => {
    if (sessionRef.current) reload();
    else void restoreSessionRef.current();
  };

  const migrate = async () => {
    if (!legacy || busy || !session) return;
    setBusy(true);
    setError('');
    try {
      await moveLegacyData(legacy, session.user.email ?? '');
      setLegacy(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The move failed. Your device copy has been preserved.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'ready' && session)
    return <Context.Provider value={{email: session.user.email ?? '', signOut, reload}}>{children}</Context.Provider>;
  const action = (label: string, onPress: () => void, secondary = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={[
        styles.button,
        {backgroundColor: secondary ? colors.secondaryAccent : colors.accentGreen, opacity: busy ? 0.5 : 1},
      ]}>
      <Text style={[styles.buttonText, {color: secondary ? colors.primaryText : colors.buttonText}]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={[styles.page, {backgroundColor: colors.primaryBackground}]}>
      <Text style={[styles.brand, {color: colors.accentGreen}]}>zero</Text>
      <Text style={[styles.title, {color: colors.primaryText}]}>
        {status === 'migration'
          ? 'Bring your spending with you'
          : status === 'error'
            ? 'Your account is safe'
            : 'Your money, in one place'}
      </Text>
      <Text style={[styles.description, {color: colors.secondaryText}]}>
        {status === 'migration'
          ? `Move this device’s existing records to ${session?.user.email ?? 'your Google account'}? After verifying the upload, Zero will remove the device copy. Only continue if these records are yours.`
          : 'Sign in with Google to keep your spending, budgets and debts in your private cloud account. Sign in again after reinstalling to get them back. Internet is required.'}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.description, {color: colors.accentRed}]}>
          {error}
        </Text>
      ) : null}
      {status === 'loading' || busy ? <ActivityIndicator color={colors.accentGreen} style={styles.spinner} /> : null}
      {status === 'login'
        ? action('Continue with Google', () => {
            void signIn();
          })
        : null}
      {status === 'migration'
        ? action('Move my records to this account', () => {
            void migrate();
          })
        : null}
      {status === 'error' ? action('Try again', retry) : null}
      {session && status !== 'loading'
        ? action(
            'Sign out / choose another account',
            () => {
              void signOut();
            },
            true,
          )
        : null}
      <Text style={[styles.footnote, {color: colors.secondaryText}]}>
        Financial records stay in Supabase. Only your secure sign-in, display preferences, and anonymous reminder
        schedule are kept on this device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, justifyContent: 'center', padding: 28, gap: 16},
  brand: {fontSize: 48, fontWeight: '800'},
  title: {fontSize: 27, fontWeight: '700'},
  description: {fontSize: 15, lineHeight: 23},
  button: {padding: 17, borderRadius: 14, alignItems: 'center'},
  buttonText: {fontSize: 15, fontWeight: '600'},
  footnote: {fontSize: 12, lineHeight: 18, marginTop: 8},
  spinner: {marginVertical: 8},
});
