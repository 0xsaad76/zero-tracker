import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

type ReminderRow = {
  id: string;
  day: number;
  completedMonth: string;
  startMonth: string;
};

type ReminderModule = {
  sync(rowsJson: string): Promise<void>;
  clear(): Promise<void>;
  isEnabled(): Promise<boolean>;
};

function nativeReminders(): ReminderModule {
  if (Platform.OS !== 'android') {
    throw new Error('Investment reminders are currently available only on Android.');
  }
  const module = NativeModules.ZeroInvestmentReminders as
    | ReminderModule
    | undefined;
  if (
    !module ||
    typeof module.sync !== 'function' ||
    typeof module.clear !== 'function' ||
    typeof module.isEnabled !== 'function'
  ) {
    throw new Error(
      'Investment reminders are not installed in this app. Register InvestmentRemindersPackage and rebuild the Android app; a JavaScript reload is not enough.',
    );
  }
  return module;
}

let queue: Promise<void> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  // Recover only the private queue tail. The caller receives the original rejection.
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Supply only active, user-approved reminders (maximum 100). Snapshot immediately
 * so later caller mutations cannot change an operation already in the queue. */
export async function syncInvestmentReminders(rows: ReminderRow[]): Promise<void> {
  const json = JSON.stringify(
    rows.map(({ id, day, completedMonth, startMonth }) => ({
      id,
      day,
      completedMonth,
      startMonth,
    })),
  );
  return enqueue(() => nativeReminders().sync(json));
}

export function clearInvestmentReminders(): Promise<void> {
  return enqueue(() => nativeReminders().clear());
}

/** Call from a user gesture. A denied permission or blocked channel returns false;
 * native/setup errors reject so the UI can explain the corrective action. */
export async function requestInvestmentReminderPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  nativeReminders();
  if (Number(Platform.Version) >= 33) {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (!(await PermissionsAndroid.check(permission))) {
      const result = await PermissionsAndroid.request(permission);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
  }
  return investmentRemindersEnabled();
}

/** OS notification permission + channel availability, not the user's saved opt-in. */
export function investmentRemindersEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  return enqueue(() => nativeReminders().isEnabled());
}
