import {useTranslation} from 'react-i18next';
import {selectUserName, setUserName} from '../../redux/slice/userNameSlice';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {
  selectCurrencyCode,
  selectCurrencyId,
  selectCurrencyName,
  selectCurrencySymbol,
  setCurrencyData,
} from '../../redux/slice/currencyDataSlice';
import {useCallback} from 'react';
import {getAppVersion} from '../../utils/getVersion';
import {useTheme} from '../../context/ThemeContext';
import {useDialog} from '../../context/DialogContext';
import {updateUserById, updateCurrencyById, deleteAllData, getAllData} from '../../cloud';
import {updateCloudPreferences} from '../../cloud/preferences';
import {useCloudAuth} from '../../context/CloudAuthContext';
import type {ExportData} from '../../backend/export/format';
import {Linking} from 'react-native';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {appendErrorLog} from '../../utils/errorLog';
import {requireCloudUser} from '../../cloud/records';

/**
 * Result of an export attempt.
 * - 'saved'     — the file reached somewhere the user can retrieve it.
 * - 'cancelled' — the user dismissed the iOS share sheet; nothing left the app.
 * - 'failed'    — permission denied or the write threw; an error was surfaced.
 */
export type ExportOutcome = 'saved' | 'cancelled' | 'failed';

const useSettings = () => {
  const {t} = useTranslation();
  const userName = useAppSelector(selectUserName);
  const userId = useAppSelector(selectUserId);
  const currencyId = useAppSelector(selectCurrencyId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const currencyName = useAppSelector(selectCurrencyName);
  const currencySymbol = useAppSelector(selectCurrencySymbol);
  const {colors, themeMode} = useTheme();
  const {email, signOut, reload} = useCloudAuth();
  const {showDialog, showAlert} = useDialog();
  const appVersion = getAppVersion();

  const dispatch = useAppDispatch();

  const handlePreferenceUpdate = useCallback(
    async (patch: Partial<NonNullable<ExportData['preferences']>>): Promise<boolean> => {
      try {
        await updateCloudPreferences(patch);
        return true;
      } catch {
        await showAlert({
          type: 'error',
          message: 'Could not save your preference to the cloud. Check your connection and try again.',
        });
        return false;
      }
    },
    [showAlert],
  );

  const handleThemeSelection = useCallback(
    async (theme: string) => {
      if (theme !== 'system' && theme !== 'light' && theme !== 'dark') {
        await showAlert({type: 'error', message: 'Please select a valid theme.'});
        return;
      }
      await handlePreferenceUpdate({theme});
    },
    [handlePreferenceUpdate, showAlert],
  );

  const handleNameUpdate = useCallback(
    async (newName: string) => {
      try {
        if (!userId) throw new Error('Your account is not ready.');
        await updateUserById(userId, {username: newName});
        dispatch(setUserName(newName));
      } catch (error) {
        if (__DEV__) {
          console.error('Error updating the name:', error);
        }
        await showAlert({
          type: 'error',
          message: 'Could not save your name to the cloud. Check your connection and try again.',
        });
      }
    },
    [userId, dispatch, showAlert],
  );

  const handleCurrencyUpdate = useCallback(
    async (currency: {code: string; name: string; symbol: string}) => {
      try {
        if (!currencyId) throw new Error('Your currency is not ready.');
        await updateCurrencyById(currencyId, {
          name: currency.name,
          code: currency.code,
          symbol: currency.symbol,
        });
        const updatedCurrencyData = {
          currencyId,
          currencyName: currency.name,
          currencySymbol: currency.symbol,
          currencyCode: currency.code,
        };
        dispatch(setCurrencyData(updatedCurrencyData));
      } catch (error) {
        if (__DEV__) {
          console.error('Error updating the currency:', error);
        }
        await showAlert({
          type: 'error',
          message: 'Could not save your currency to the cloud. Check your connection and try again.',
        });
      }
    },
    [currencyId, dispatch, showAlert],
  );

  /**
   * Delete-everything flow, with the backup step treated as a real gate.
   *
   * This used to `await exportFn()` for its side effects only and then wipe
   * regardless: a denied Android storage permission, a failed write, or a
   * dismissed iOS share sheet all left the user believing they had a backup
   * while their data was permanently destroyed. Since there is no telemetry,
   * nobody would ever have heard about it.
   *
   * Now: asking for a backup that does not get saved ABORTS the delete. The
   * user can retry or explicitly choose Skip, which is a deliberate,
   * backup-free deletion rather than an accidental one.
   */
  const handleDeleteAllData = useCallback(
    async (exportFn?: () => Promise<ExportOutcome>) => {
      const wantsBackup = await showDialog({
        type: 'info',
        message: t('settings.deleteBackupPrompt'),
        okLabel: t('settings.export'),
        cancelLabel: t('common.skip'),
      });

      if (wantsBackup) {
        let outcome: ExportOutcome = 'failed';
        try {
          outcome = exportFn ? await exportFn() : 'failed';
        } catch {
          outcome = 'failed';
        }
        if (outcome !== 'saved') {
          // 'failed' has already surfaced its own error (or the storage-permission
          // dialog); 'cancelled' means the user backed out of the share sheet.
          // Either way there is no backup, so stop before the irreversible step.
          await showAlert({
            type: 'error',
            message: t('settings.deleteBackupFailed'),
          });
          return;
        }
      }

      const confirmed = await showDialog({
        type: 'warning',
        message: `Permanently delete all expenses, categories, debtors, debts, spending limits, and currency records from the cloud for ${email || 'your signed-in Google account'}? This cannot be undone. Your Google account and sign-in will be retained.`,
        okLabel: 'Delete',
      });
      if (!confirmed) return;

      try {
        requireCloudUser(userId);
        await getAllData();
        requireCloudUser(userId);
        await deleteAllData();
        reload();
      } catch (error) {
        // Never leave the user on a "deleted" screen with their data intact.
        appendErrorLog(error instanceof Error ? error : new Error(String(error)), false);
        await showAlert({
          type: 'error',
          message:
            'Could not complete cloud data deletion. Check your connection and reload your account before trying again.',
        });
        return;
      }
    },
    [email, userId, reload, showAlert, showDialog, t],
  );

  const handleSignOut = useCallback(async () => {
    const confirmed = await showDialog({
      type: 'warning',
      message: `Sign out of ${email || 'your Google account'} on this device? This clears the device session only. Your cloud records will not be deleted.`,
      okLabel: 'Sign out',
    });
    if (!confirmed) return;
    try {
      await signOut();
    } catch {
      await showAlert({type: 'error', message: 'Could not sign out. Please try again.'});
    }
  }, [email, showDialog, showAlert, signOut]);

  const handleExportResult = useCallback(
    async (success: boolean) => {
      if (success) {
        await showAlert({
          type: 'success',
          message: t('settings.exportSuccess'),
        });
      } else {
        await showAlert({
          type: 'error',
          message: t('settings.exportError'),
        });
      }
    },
    [showAlert, t],
  );

  const requestStorageViaDialog = useCallback(async () => {
    const confirmed = await showDialog({
      type: 'warning',
      message: t('settings.storagePermission'),
    });
    if (confirmed) {
      Linking.openSettings();
    }
  }, [showDialog, t]);

  return {
    appVersion,
    colors,
    handleThemeSelection,
    handleNameUpdate,
    handleCurrencyUpdate,
    selectedTheme: themeMode,
    userName,
    currencySymbol,
    currencyCode,
    currencyName,
    handleDeleteAllData,
    email,
    handleSignOut,
    handlePreferenceUpdate,
    handleExportResult,
    showAlert,
    requestStorageViaDialog,
  };
};

export default useSettings;
