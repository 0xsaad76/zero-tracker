import {ScrollView, Switch, TouchableOpacity, View, Platform, Share} from 'react-native';
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import i18n from '../../i18n';
import Icon from '../../components/atoms/Icons';
import {goBack, navigate} from '../../utils/navigationUtils';
import useSettings, {type ExportOutcome} from './useSettings';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import RNFS from 'react-native-fs';
import {requestStoragePermission} from '../../utils/dataUtils';
import {generateUniqueKey} from '../../backend/export/key';
import {getTimestamp} from '../../utils/dateUtils';
import {CURRENT_EXPORT_VERSION} from '../../backend/export/format';
import {expensesToCsv} from '../../backend/export/csv';
import {SheetManager} from 'react-native-actions-sheet';
import {getWeekStartDay, type WeekStartDay} from '../../utils/weekStart';
import {getWeekdayNames} from '../../utils/dateUtils';
import {Colors} from '../../hooks/useThemeColors';
import {gs, hitSlop} from '../../styles/globalStyles';
import {getShowBudgetProgress} from '../../utils/budgetProgressPreference';
import {getAllData} from '../../cloud';

interface SettingsRowProps {
  icon: string;
  label: string;
  subtitle?: string;
  value?: string;
  valueNode?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  checked?: boolean;
  colors: Colors;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  subtitle,
  value,
  valueNode,
  onPress,
  destructive,
  checked,
  colors,
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
    accessibilityRole={checked !== undefined ? 'switch' : onPress ? 'button' : undefined}
    accessibilityState={checked !== undefined ? {checked} : undefined}>
    <View style={[gs.rowCenter, gs.px14, gs.py12, gs.gap10]}>
      <View style={[gs.size32, gs.rounded8, gs.center, {backgroundColor: colors.secondaryAccent}]}>
        <Icon name={icon} size={16} color={destructive ? colors.accentOrange : colors.secondaryText} />
      </View>
      <View style={[gs.flex1, gs.gap2]}>
        <PrimaryText size={14} weight="medium" color={destructive ? colors.accentOrange : colors.primaryText}>
          {label}
        </PrimaryText>
        {subtitle ? (
          <PrimaryText size={11} color={colors.secondaryText}>
            {subtitle}
          </PrimaryText>
        ) : null}
      </View>
      {value ? (
        <PrimaryText size={13} color={colors.secondaryText}>
          {value}
        </PrimaryText>
      ) : null}
      {valueNode ?? null}
      {onPress && checked === undefined ? <Icon name="chevron-right" size={14} color={colors.secondaryText} /> : null}
    </View>
  </TouchableOpacity>
);

const VARIANT_LABELS = {
  classic: 'settings.darkClassic',
  midnight: 'settings.darkMidnight',
  ghost: 'settings.darkGhost',
} as const;

const SettingsScreen = () => {
  const {t} = useTranslation();
  const {
    appVersion,
    colors,
    handleThemeSelection,
    handleDarkVariantSelection,
    selectedDarkVariant,
    handleNameUpdate,
    handleCurrencyUpdate,
    selectedTheme,
    userName,
    currencySymbol,
    currencyName,
    handleDeleteAllData,
    email,
    handleSignOut,
    handlePreferenceUpdate,
    handleExportResult,
    requestStorageViaDialog,
  } = useSettings();
  const [showBudgetProgress, setShowBudgetProgressState] = useState(getShowBudgetProgress);

  const toggleBudgetProgress = useCallback(async () => {
    const next = !showBudgetProgress;
    if (await handlePreferenceUpdate({showBudgetProgress: next})) {
      setShowBudgetProgressState(next);
    }
  }, [showBudgetProgress, handlePreferenceUpdate]);

  const handleOpenCurrencySheet = useCallback(() => {
    void SheetManager.show('currency-picker-sheet', {
      payload: {
        selectedCurrency: {code: '', name: currencyName, symbol: currencySymbol},
        onSelect: (currency: {code: string; name: string; symbol: string}) => {
          handleCurrencyUpdate(currency);
        },
      },
    });
  }, [currencyName, currencySymbol, handleCurrencyUpdate]);

  /**
   * Shared write path for every export format. Returns whether the bytes
   * reached somewhere the USER can actually get at, which is not the same as
   * "no exception was thrown":
   *
   * - iOS writes to DocumentDirectoryPath, which is app-private (Info.plist
   *   sets neither UIFileSharingEnabled nor LSSupportsOpeningDocumentsInPlace).
   *   The share sheet is the only way the file escapes the sandbox, so a
   *   DISMISSED share means there is no usable backup, however successful the
   *   write was.
   * - Android writes straight to Downloads, permission-gated on API <= 32. A
   *   denied permission used to return silently here — no error, no result —
   *   so the caller could not tell a refusal from a success.
   *
   * `handleDeleteAllData` gates a permanent wipe on this boolean, so it must
   * never report optimistically.
   */
  const writeAndShareFile = async (fileName: string, contents: string): Promise<ExportOutcome> => {
    try {
      if (Platform.OS === 'ios') {
        const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        await RNFS.writeFile(path, contents, 'utf8');
        const result = await Share.share({
          url: `file://${path}`,
          title: t('settings.exportShareTitle'),
        });
        if (result.action === Share.dismissedAction) {
          return 'cancelled';
        }
        handleExportResult(true);
        return 'saved';
      }

      const storagePermissionGranted = await requestStoragePermission();
      if (!storagePermissionGranted) {
        requestStorageViaDialog();
        return 'failed';
      }
      const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, contents, 'utf8');
      handleExportResult(true);
      return 'saved';
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving file:', error);
      }
      handleExportResult(false);
      return 'failed';
    }
  };

  // handleDeleteAllData awaits this as its backup-before-delete step and will
  // NOT wipe unless it returns 'saved'.
  const exportData = async (): Promise<ExportOutcome> => {
    try {
      const dataToExport = await getAllData();
      const fileName = `zero_v${CURRENT_EXPORT_VERSION}_${getTimestamp()}.json`;
      const jsonData = JSON.stringify(
        {key: generateUniqueKey(), version: CURRENT_EXPORT_VERSION, data: dataToExport},
        null,
        2,
      );
      return await writeAndShareFile(fileName, jsonData);
    } catch {
      await handleExportResult(false);
      return 'failed';
    }
  };

  // One-way spreadsheet export; JSON stays the only restore format.
  const exportCsv = async (): Promise<ExportOutcome> => {
    try {
      const dataToExport = await getAllData();
      return await writeAndShareFile(`zero_expenses_${getTimestamp()}.csv`, expensesToCsv(dataToExport.expenses));
    } catch {
      await handleExportResult(false);
      return 'failed';
    }
  };
  const [weekStart, setWeekStart] = useState<WeekStartDay>(getWeekStartDay);
  const weekStartLabel = getWeekdayNames()[weekStart === 'monday' ? 1 : 0];

  const openWeekStartPicker = useCallback(() => {
    void SheetManager.show('week-start-picker-sheet', {
      payload: {
        current: weekStart,
        onSelect: async (day: 'sunday' | 'monday') => {
          if (await handlePreferenceUpdate({weekStart: day})) {
            setWeekStart(day);
          }
        },
      },
    });
  }, [weekStart, handlePreferenceUpdate]);

  const openThemePicker = useCallback(() => {
    void SheetManager.show('theme-picker-sheet', {
      payload: {
        currentTheme: selectedTheme,
        onSelect: (theme: string) => {
          handleThemeSelection(theme);
        },
        currentVariant: selectedDarkVariant,
        onSelectVariant: (variant: string) => {
          handleDarkVariantSelection(variant);
        },
      },
    });
  }, [selectedTheme, selectedDarkVariant, handleThemeSelection, handleDarkVariantSelection]);

  // Deliberately NOT dismissKeyboardOnTouch: this screen has no text input
  // (name, currency and budget are all edited in sheets), and the wrapper it
  // adds swallows the touch responder before the ScrollView can have it — see
  // the note in PrimaryView.
  return (
    <PrimaryView colors={colors}>
      <View style={[gs.rowCenter, gs.gap10, gs.mt5p]}>
        <TouchableOpacity onPress={() => goBack()} hitSlop={hitSlop}>
          <Icon name="arrow-left" size={22} color={colors.primaryText} />
        </TouchableOpacity>
        <PrimaryText size={22} weight="semibold">
          {t('settings.title')}
        </PrimaryText>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={gs.pb80}>
        <PrimaryText
          size={11}
          weight="semibold"
          color={colors.accentGreen}
          style={[gs.mt20, gs.mb6, {letterSpacing: 0.8}]}>
          {t('settings.sectionPersonalization')}
        </PrimaryText>
        <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
          <SettingsRow
            colors={colors}
            icon="sun-moon"
            label={t('settings.theme')}
            value={
              selectedTheme === 'light'
                ? t('settings.themeLight')
                : selectedTheme === 'dark'
                  ? `${t('settings.themeDark')} · ${t(VARIANT_LABELS[selectedDarkVariant])}`
                  : t('settings.themeSystem')
            }
            onPress={openThemePicker}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="user"
            label={t('settings.name')}
            value={userName}
            onPress={() => {
              void SheetManager.show('change-name-sheet', {
                payload: {
                  currentName: userName,
                  onUpdate: (newName: string) => {
                    handleNameUpdate(newName);
                  },
                },
              });
            }}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="banknote"
            label={t('settings.currency')}
            onPress={handleOpenCurrencySheet}
            valueNode={
              <View style={gs.itemsEnd}>
                <PrimaryText size={13} color={colors.secondaryText} variant="number">
                  {currencySymbol}
                </PrimaryText>
                <PrimaryText size={10} color={colors.secondaryText}>
                  {currencyName}
                </PrimaryText>
              </View>
            }
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="target"
            label={t('settings.spendingLimits')}
            subtitle={t('settings.spendingLimitsSubtitle')}
            onPress={() => navigate('SpendingLimitsScreen')}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="bar-chart-3"
            label={t('settings.showLimitProgress')}
            subtitle={t('settings.showLimitProgressSubtitle')}
            onPress={toggleBudgetProgress}
            checked={showBudgetProgress}
            valueNode={
              <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
                <Switch
                  value={showBudgetProgress}
                  trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}}
                />
              </View>
            }
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="globe"
            label={t('settings.language')}
            value={t('settings.currentLanguage')}
            onPress={() => {
              void SheetManager.show('language-picker-sheet', {
                payload: {
                  currentLanguage: i18n.language,
                  onSelect: async (lang: string) => {
                    await handlePreferenceUpdate({locale: lang === 'en' ? null : lang});
                  },
                },
              });
            }}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="calendar-days"
            label={t('settings.weekStart')}
            value={weekStartLabel}
            onPress={openWeekStartPicker}
          />
        </View>

        <PrimaryText
          size={11}
          weight="semibold"
          color={colors.accentGreen}
          style={[gs.mt20, gs.mb6, {letterSpacing: 0.8}]}>
          Cloud account
        </PrimaryText>
        <View style={[gs.rounded12, gs.overflowHidden, gs.mb8, {backgroundColor: colors.containerColor}]}>
          <SettingsRow colors={colors} icon="cloud" label="Google account" subtitle={email} />
          <PrimaryText size={11} color={colors.secondaryText} style={[gs.px14, gs.pb10]}>
            Your records are stored automatically in your cloud account after each successful save. An internet
            connection is required to load or save data.
          </PrimaryText>
          <SettingsRow
            colors={colors}
            icon="log-out"
            label="Sign out"
            subtitle="Clear this device session without deleting cloud records."
            onPress={handleSignOut}
          />
        </View>
        <PrimaryText
          size={11}
          weight="semibold"
          color={colors.accentGreen}
          style={[gs.mt20, gs.mb6, {letterSpacing: 0.8}]}>
          {t('settings.sectionData')}
        </PrimaryText>
        <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
          <SettingsRow
            colors={colors}
            icon="download"
            label={t('settings.exportData')}
            subtitle={t('settings.exportSubtitle')}
            onPress={() => exportData()}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="file-spreadsheet"
            label={t('settings.exportCsv')}
            subtitle={t('settings.exportCsvSubtitle')}
            onPress={() => exportCsv()}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="trash-2"
            label={t('settings.deleteAllData')}
            subtitle="Permanently delete this account’s cloud records. Google sign-in is retained."
            onPress={() => handleDeleteAllData(exportData)}
            destructive
          />
        </View>

        <PrimaryText
          size={11}
          weight="semibold"
          color={colors.accentGreen}
          style={[gs.mt20, gs.mb6, {letterSpacing: 0.8}]}>
          {t('settings.sectionAbout')}
        </PrimaryText>
        <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
          <SettingsRow colors={colors} icon="info" label={t('settings.version')} value={`v${appVersion}`} />
        </View>
      </ScrollView>
    </PrimaryView>
  );
};

export default SettingsScreen;
