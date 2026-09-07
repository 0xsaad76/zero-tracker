import React, {useCallback, useMemo, useState} from 'react';
import {Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import HeaderContainer from '../../components/molecules/HeaderContainer';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {gs, hitSlop} from '../../styles/globalStyles';
import {readCloudData} from '../../cloud/records';
import {
  investmentSummary,
  investmentTypeIcon,
  investmentTypeLabel,
  localDate,
  portfolioSummary,
  resolveInvestmentTypes,
  shiftMonth,
  type Investment,
  type InvestmentFlow,
  type InvestmentType,
  type MonthlyValuation,
} from '../../investments/model';
import {deleteInvestment, deleteInvestmentEntry} from '../../investments/service';
import {
  investmentRemindersEnabled,
  requestInvestmentReminderPermission,
  syncInvestmentReminderData,
} from '../../investments/reminders';
import {InvestmentEditor, InvestmentEntryEditor} from './InvestmentEditor';
import InvestmentReports from './InvestmentReports';
import InvestmentTypeManager from './InvestmentTypeManager';
import SchedulesSection from '../../recurring/SchedulesSection';
import {useRecurringSchedules} from '../../recurring/useRecurringSchedules';

type EntryEditor = {
  investment: Investment;
  mode: 'contribution' | 'withdrawal' | 'valuation';
  flow?: InvestmentFlow;
  valuation?: MonthlyValuation;
};

const monthLabel = (month: string) => {
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {month: 'long', year: 'numeric'}).format(new Date(year, value - 1, 1));
};

const Metric = ({label, value, color}: {label: string; value: string; color?: string}) => (
  <View style={styles.metric}>
    <PrimaryText size={10} color={color} style={styles.uppercase}>
      {label}
    </PrimaryText>
    <PrimaryText size={16} weight="bold" variant="number" color={color} numberOfLines={1} style={gs.mt5}>
      {value}
    </PrimaryText>
  </View>
);

const Gain = ({value}: {value: number | null}) => {
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  if (value === null)
    return (
      <PrimaryText size={12} color={colors.secondaryText}>
        Valuation needed
      </PrimaryText>
    );
  return (
    <PrimaryText size={12} weight="semibold" variant="number" color={value < 0 ? colors.accentRed : colors.accentGreen}>
      {value > 0 ? '+' : ''}
      {formatAmount(value)}
    </PrimaryText>
  );
};

const InvestingScreen = () => {
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const currentMonth = localDate().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [types, setTypes] = useState<InvestmentType[]>(() => resolveInvestmentTypes());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notificationsReady, setNotificationsReady] = useState(true);
  const [reminderError, setReminderError] = useState('');
  const [assetEditor, setAssetEditor] = useState<Investment | 'new' | null>(null);
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);
  const [entryEditor, setEntryEditor] = useState<EntryEditor | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const {
    schedules: sipSchedules,
    nameOf: sipScheduleName,
    reload: reloadSipSchedules,
  } = useRecurringSchedules('investment');

  const load = useCallback(async (pull = false) => {
    pull ? setRefreshing(true) : setLoading(true);
    try {
      const data = await readCloudData();
      const nextInvestments = (data.investments ?? []).sort((a, b) => a.name.localeCompare(b.name));
      setInvestments(nextInvestments);
      setTypes(resolveInvestmentTypes(data.investmentTypeRegistry));
      setError('');
      try {
        await syncInvestmentReminderData(nextInvestments);
        setReminderError('');
      } catch (caught) {
        setReminderError(caught instanceof Error ? caught.message : 'Investment reminders could not be scheduled.');
      }
      setNotificationsReady(await investmentRemindersEnabled().catch(() => false));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load investments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const selectedSummary = useMemo(() => portfolioSummary(investments, month), [investments, month]);
  const allTimeSummary = useMemo(() => portfolioSummary(investments, currentMonth), [investments, currentMonth]);
  const visibleInvestments = useMemo(
    () => investments.filter(investment => investment.startDate.slice(0, 7) <= month),
    [investments, month],
  );
  const remindersConfigured = investments.some(item => item.reminderEnabled);

  const removeInvestment = (investment: Investment) => {
    Alert.alert(
      `Delete ${investment.name}?`,
      'This permanently deletes its contributions, withdrawals, and valuation history.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteInvestment(investment.id)
              .then(() => load())
              .catch(caught =>
                Alert.alert(
                  'Could not delete investment',
                  caught instanceof Error ? caught.message : 'Please try again.',
                ),
              );
          },
        },
      ],
    );
  };

  const removeEntry = (investment: Investment, id: string, valuation: boolean) => {
    Alert.alert('Delete this entry?', 'The portfolio totals and reports will be recalculated.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteInvestmentEntry(investment.id, id, valuation)
            .then(() => load())
            .catch(caught =>
              Alert.alert('Could not delete entry', caught instanceof Error ? caught.message : 'Please try again.'),
            );
        },
      },
    ]);
  };

  const enableNotifications = async () => {
    try {
      setNotificationsReady(await requestInvestmentReminderPermission());
    } catch (caught) {
      Alert.alert(
        'Could not enable reminders',
        caught instanceof Error ? caught.message : 'Please rebuild the app and try again.',
      );
    }
  };

  return (
    <PrimaryView colors={colors} useBottomPadding={false}>
      <HeaderContainer headerText="Investing" />
      <ScrollView
        style={gs.flex1}
        contentContainerStyle={[gs.pt15, gs.pb100]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accentGreen}
            colors={[colors.accentGreen]}
          />
        }>
        <View style={[gs.rounded16, gs.p15, {backgroundColor: colors.accentGreen}]}>
          <View style={gs.rowBetweenCenter}>
            <TouchableOpacity
              onPress={() => setMonth(value => shiftMonth(value, -1))}
              hitSlop={hitSlop}
              accessibilityLabel="Previous month">
              <Icon name="chevron-left" size={20} color={colors.buttonText} />
            </TouchableOpacity>
            <PrimaryText size={13} weight="semibold" color={colors.buttonText}>
              {monthLabel(month)}
            </PrimaryText>
            <TouchableOpacity
              disabled={month >= currentMonth}
              onPress={() => setMonth(value => shiftMonth(value, 1))}
              hitSlop={hitSlop}
              accessibilityLabel="Next month">
              <Icon
                name="chevron-right"
                size={20}
                color={month >= currentMonth ? `${colors.buttonText}66` : colors.buttonText}
              />
            </TouchableOpacity>
          </View>
          <View style={[gs.row, gs.mt15]}>
            <Metric
              label="Added this month"
              value={formatAmount(selectedSummary.monthlyContributed)}
              color={colors.buttonText}
            />
            <View style={styles.metricDivider} />
            <Metric label="Added all time" value={formatAmount(allTimeSummary.contributed)} color={colors.buttonText} />
          </View>
          <View style={[gs.row, gs.mt15]}>
            <Metric
              label="Portfolio value"
              value={selectedSummary.value === null ? '—' : formatAmount(selectedSummary.value)}
              color={colors.buttonText}
            />
            <View style={styles.metricDivider} />
            <Metric
              label="Net invested"
              value={formatAmount(selectedSummary.contributed - selectedSummary.withdrawn)}
              color={colors.buttonText}
            />
          </View>
          {selectedSummary.due > 0 ? (
            <View style={[gs.rowCenter, gs.gap6, gs.mt15]}>
              <Icon name="alert-circle" size={14} color={colors.buttonText} />
              <PrimaryText size={11} color={colors.buttonText}>
                {selectedSummary.due} monthly {selectedSummary.due === 1 ? 'valuation is' : 'valuations are'} missing
              </PrimaryText>
            </View>
          ) : null}
        </View>

        {remindersConfigured && !notificationsReady ? (
          <TouchableOpacity
            onPress={() => void enableNotifications()}
            style={[
              gs.rowCenter,
              gs.gap10,
              gs.p14,
              gs.rounded12,
              gs.mt10,
              {backgroundColor: colors.secondaryBackground},
            ]}
            accessibilityRole="button">
            <Icon name="alert-triangle" size={18} color={colors.accentOrange} />
            <View style={gs.flex1}>
              <PrimaryText size={12} weight="semibold">
                Investment reminders are off
              </PrimaryText>
              <PrimaryText size={10} color={colors.secondaryText} style={gs.mt3}>
                Tap to allow Android notifications.
              </PrimaryText>
            </View>
            <Icon name="chevron-right" size={16} color={colors.secondaryText} />
          </TouchableOpacity>
        ) : null}

        {reminderError ? (
          <View
            style={[
              gs.rowCenter,
              gs.gap10,
              gs.p14,
              gs.rounded12,
              gs.mt10,
              {backgroundColor: colors.secondaryBackground},
            ]}>
            <Icon name="alert-triangle" size={18} color={colors.accentOrange} />
            <PrimaryText size={11} color={colors.secondaryText} style={gs.flex1}>
              {reminderError}
            </PrimaryText>
          </View>
        ) : null}

        <View style={[gs.rowBetweenCenter, gs.mt20, gs.mb10]}>
          <View style={{flex: 1, minWidth: 0, marginRight: 10}}>
            <PrimaryText size={16} weight="bold">
              Your investments
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} style={gs.mt3} numberOfLines={2}>
              Monthly valuations keep returns accurate.
            </PrimaryText>
          </View>
          <View style={[gs.rowCenter, gs.gap8, gs.flexShrink]}>
            <TouchableOpacity
              onPress={() => setTypeManagerOpen(true)}
              style={[
                gs.rowCenter,
                gs.gap6,
                gs.px12,
                gs.rounded12,
                {height: 40, backgroundColor: colors.secondaryAccent},
              ]}
              accessibilityLabel="Manage investment types"
              accessibilityRole="button">
              <Icon name="tag" size={16} color={colors.primaryText} />
              <PrimaryText size={11} weight="semibold">
                Types
              </PrimaryText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAssetEditor('new')}
              style={[gs.size40, gs.center, gs.rounded12, {backgroundColor: colors.primaryText}]}
              accessibilityLabel="Add investment"
              accessibilityRole="button">
              <Icon name="plus" size={20} color={colors.buttonText} />
            </TouchableOpacity>
          </View>
        </View>

        {loading && investments.length === 0 ? (
          <View style={[gs.p20, gs.itemsCenter]}>
            <PrimaryText color={colors.secondaryText}>Loading investments…</PrimaryText>
          </View>
        ) : error ? (
          <View style={[gs.p15, gs.rounded12, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={12} color={colors.accentRed}>
              {error}
            </PrimaryText>
            <View style={gs.mt10}>
              <PrimaryButton colors={colors} buttonTitle="Try again" size="sm" onPress={() => void load()} />
            </View>
          </View>
        ) : investments.length === 0 ? (
          <View style={[gs.p20, gs.rounded16, gs.itemsCenter, {backgroundColor: colors.containerColor}]}>
            <View style={[gs.size50, gs.center, gs.rounded16, {backgroundColor: colors.secondaryAccent}]}>
              <Icon name="piggy-bank" size={24} color={colors.accentGreen} />
            </View>
            <PrimaryText size={15} weight="semibold" style={gs.mt10}>
              Build your portfolio history
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt5, gs.textCenter]}>
              Add an account with one of your types, or keep it under No type. No market or bank account is connected.
            </PrimaryText>
            <View style={[gs.wFull, gs.mt15]}>
              <PrimaryButton
                colors={colors}
                buttonTitle="Add first investment"
                icon="plus"
                onPress={() => setAssetEditor('new')}
              />
            </View>
          </View>
        ) : visibleInvestments.length === 0 ? (
          <View style={[gs.p15, gs.rounded12, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={12} color={colors.secondaryText} style={gs.textCenter}>
              None of your investments had started in this month.
            </PrimaryText>
          </View>
        ) : (
          visibleInvestments.map(investment => {
            const summary = investmentSummary(investment, month);
            const open = expanded === investment.id;
            const entries: Array<{
              id: string;
              date: string;
              title: string;
              value: number;
              valuation: boolean;
              raw: InvestmentFlow | MonthlyValuation;
            }> = [
              ...investment.flows
                .filter(item => item.date <= (month === currentMonth ? localDate() : `${month}-31`))
                .map(item => ({
                  id: item.id,
                  date: item.date,
                  title: item.type === 'contribution' ? 'Contribution' : 'Withdrawal',
                  value: item.type === 'withdrawal' ? -item.amount : item.amount,
                  valuation: false,
                  raw: item,
                })),
              ...investment.valuations
                .filter(item => item.date <= (month === currentMonth ? localDate() : `${month}-31`))
                .map(item => ({
                  id: item.month,
                  date: item.date,
                  title: 'Monthly valuation',
                  value: item.value,
                  valuation: true,
                  raw: item,
                })),
            ]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, open ? undefined : 0);
            const statusColor =
              summary.status === 'Updated' && !summary.stale
                ? colors.accentGreen
                : summary.status === 'Update due'
                  ? colors.accentOrange
                  : colors.secondaryText;
            return (
              <View key={investment.id} style={[gs.rounded16, gs.mb10, {backgroundColor: colors.containerColor}]}>
                <TouchableOpacity
                  onPress={() => setExpanded(open ? null : investment.id)}
                  style={gs.p14}
                  accessibilityRole="button"
                  accessibilityLabel={`${investment.name}, ${summary.stale && summary.closing ? 'update needed' : summary.status}`}
                  accessibilityState={{expanded: open}}>
                  <View style={gs.rowBetweenCenter}>
                    <View style={[gs.rowCenter, gs.gap10, gs.flex1]}>
                      <View style={[gs.size40, gs.center, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
                        <Icon name={investmentTypeIcon(investment.type)} size={19} color={colors.accentGreen} />
                      </View>
                      <View style={gs.flex1}>
                        <PrimaryText size={14} weight="semibold" numberOfLines={1}>
                          {investment.name}
                        </PrimaryText>
                        <PrimaryText size={10} color={colors.secondaryText} style={gs.mt3}>
                          {investmentTypeLabel(types, investment.type)}
                        </PrimaryText>
                      </View>
                    </View>
                    <View style={gs.itemsEnd}>
                      <PrimaryText size={14} weight="bold" variant="number">
                        {summary.value === null ? '—' : formatAmount(summary.value)}
                      </PrimaryText>
                      <View style={[gs.rowCenter, gs.gap4, gs.mt3]}>
                        <View style={[gs.size8, gs.roundedFull, {backgroundColor: statusColor}]} />
                        <PrimaryText size={9} color={statusColor}>
                          {summary.stale && summary.closing ? 'Update needed' : summary.status}
                        </PrimaryText>
                      </View>
                    </View>
                  </View>
                  <View style={[gs.row, gs.mt15]}>
                    <View style={gs.flex1}>
                      <PrimaryText size={9} color={colors.secondaryText}>
                        NET INVESTED
                      </PrimaryText>
                      <PrimaryText size={12} variant="number" style={gs.mt3}>
                        {formatAmount(summary.contributed - summary.withdrawn)}
                      </PrimaryText>
                    </View>
                    <View style={gs.flex1}>
                      <PrimaryText size={9} color={colors.secondaryText}>
                        GAIN / LOSS
                      </PrimaryText>
                      <View style={gs.mt3}>
                        <Gain value={summary.gain} />
                      </View>
                    </View>
                    <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color={colors.secondaryText} />
                  </View>
                </TouchableOpacity>

                {open ? (
                  <View style={[gs.px14, gs.pb20]}>
                    <View style={{height: 1, backgroundColor: colors.secondaryAccent}} />
                    <PrimaryText size={10} color={colors.secondaryText} style={gs.mt10}>
                      Review day {investment.reviewDay} · Reminder {investment.reminderEnabled ? 'on' : 'off'} · Started{' '}
                      {investment.startDate}
                    </PrimaryText>
                    <View style={[gs.row, gs.gap8, gs.mt15]}>
                      <View style={gs.flex1}>
                        <PrimaryButton
                          colors={colors}
                          buttonTitle="Add"
                          icon="arrow-up-circle"
                          size="sm"
                          variant="secondary"
                          onPress={() => setEntryEditor({investment, mode: 'contribution'})}
                        />
                      </View>
                      <View style={gs.flex1}>
                        <PrimaryButton
                          colors={colors}
                          buttonTitle="Take out"
                          icon="arrow-down-circle"
                          size="sm"
                          variant="secondary"
                          onPress={() => setEntryEditor({investment, mode: 'withdrawal'})}
                        />
                      </View>
                    </View>
                    <View style={gs.mt8}>
                      <PrimaryButton
                        colors={colors}
                        buttonTitle={summary.closing ? 'Update monthly valuation' : 'Add monthly valuation'}
                        icon="check-circle"
                        size="sm"
                        onPress={() => setEntryEditor({investment, mode: 'valuation', valuation: summary.closing})}
                      />
                    </View>
                    <View style={[gs.row, gs.gap8, gs.mt8]}>
                      <View style={gs.flex1}>
                        <PrimaryButton
                          colors={colors}
                          buttonTitle="Edit account"
                          icon="pencil"
                          size="sm"
                          variant="ghost"
                          onPress={() => setAssetEditor(investment)}
                        />
                      </View>
                      <View style={gs.flex1}>
                        <PrimaryButton
                          colors={colors}
                          buttonTitle="Delete"
                          icon="trash-2"
                          size="sm"
                          variant="ghost"
                          onPress={() => removeInvestment(investment)}
                        />
                      </View>
                    </View>

                    {entries.length ? (
                      <PrimaryText size={11} weight="semibold" style={gs.mt15}>
                        History through {monthLabel(month)}
                      </PrimaryText>
                    ) : null}
                    {entries.map(entry => (
                      <View
                        key={`${entry.valuation ? 'v' : 'f'}:${entry.id}`}
                        style={[
                          gs.rowBetweenCenter,
                          gs.py10,
                          {borderBottomWidth: 1, borderBottomColor: colors.secondaryAccent},
                        ]}>
                        <TouchableOpacity
                          style={gs.flex1}
                          onPress={() =>
                            setEntryEditor({
                              investment,
                              mode: entry.valuation ? 'valuation' : (entry.raw as InvestmentFlow).type,
                              ...(entry.valuation
                                ? {valuation: entry.raw as MonthlyValuation}
                                : {flow: entry.raw as InvestmentFlow}),
                            })
                          }>
                          <PrimaryText size={11}>{entry.title}</PrimaryText>
                          <PrimaryText size={9} color={colors.secondaryText} style={gs.mt3}>
                            {entry.date}
                          </PrimaryText>
                        </TouchableOpacity>
                        <PrimaryText
                          size={11}
                          weight="semibold"
                          variant="number"
                          color={entry.value < 0 ? colors.accentOrange : colors.primaryText}>
                          {entry.value > 0 && !entry.valuation ? '+' : ''}
                          {formatAmount(entry.value)}
                        </PrimaryText>
                        <TouchableOpacity
                          onPress={() => removeEntry(investment, entry.id, entry.valuation)}
                          hitSlop={hitSlop}
                          style={gs.ml12}
                          accessibilityLabel={`Delete ${entry.title}`}>
                          <Icon name="trash-2" size={15} color={colors.secondaryText} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {investments.length > 0 ? <InvestmentReports investments={investments} selectedMonth={month} /> : null}

        <SchedulesSection
          title="Scheduled SIPs"
          subtitle="Auto-added on their day each month. Pause or delete anytime."
          schedules={sipSchedules}
          describe={schedule =>
            schedule.target === 'investment' ? `SIP → ${sipScheduleName(schedule)}` : sipScheduleName(schedule)
          }
          onChanged={() => {
            void reloadSipSchedules();
            void load();
          }}
        />
      </ScrollView>

      <InvestmentEditor
        visible={assetEditor !== null}
        investment={assetEditor === 'new' ? undefined : (assetEditor ?? undefined)}
        types={types}
        enabledReminderCount={investments.filter(investment => investment.reminderEnabled).length}
        onClose={() => setAssetEditor(null)}
        onManageTypes={() => {
          setAssetEditor(null);
          setTypeManagerOpen(true);
        }}
        onSaved={() => void load()}
      />
      <InvestmentTypeManager
        visible={typeManagerOpen}
        types={types}
        investments={investments}
        onClose={() => setTypeManagerOpen(false)}
        onSaved={() => load()}
      />
      <InvestmentEntryEditor
        visible={entryEditor !== null}
        investment={entryEditor?.investment}
        mode={entryEditor?.mode ?? 'contribution'}
        month={month}
        flow={entryEditor?.flow}
        valuation={entryEditor?.valuation}
        onClose={() => setEntryEditor(null)}
        onSaved={() => void load()}
      />
    </PrimaryView>
  );
};

const styles = StyleSheet.create({
  metric: {flex: 1, minWidth: 0},
  metricDivider: {width: 1, marginHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.28)'},
  uppercase: {textTransform: 'uppercase', opacity: 0.75},
});

export default InvestingScreen;
