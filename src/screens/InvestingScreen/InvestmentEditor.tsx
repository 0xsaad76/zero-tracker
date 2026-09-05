import React, {useEffect, useState} from 'react';
import {Alert, Modal, ScrollView, Switch, TouchableOpacity, View} from 'react-native';
import {nanoid} from 'nanoid';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import CustomInput from '../../components/atoms/CustomInput';
import AmountInput from '../../components/atoms/AmountInput';
import DatePicker from '../../components/atoms/DatePicker';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import {gs, hitSlop} from '../../styles/globalStyles';
import {
  investmentBackupSchema,
  localDate,
  monthEnd,
  reviewDate,
  type Investment,
  type InvestmentFlow,
  type InvestmentType,
  type MonthlyValuation,
} from '../../investments/model';
import {saveInvestment, saveInvestmentEntry} from '../../investments/service';
import {requestInvestmentReminderPermission} from '../../investments/reminders';

const parseLocal = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

const ModalHeader = ({title, onClose}: {title: string; onClose: () => void}) => {
  const colors = useThemeColors();
  return (
    <View style={[gs.rowBetweenCenter, gs.mt15, gs.mb20]}>
      <PrimaryText size={20} weight="bold">
        {title}
      </PrimaryText>
      <TouchableOpacity onPress={onClose} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Close">
        <Icon name="x" size={24} color={colors.primaryText} />
      </TouchableOpacity>
    </View>
  );
};

export function InvestmentEditor({
  visible,
  investment,
  types,
  enabledReminderCount,
  onClose,
  onManageTypes,
  onSaved,
}: {
  visible: boolean;
  investment?: Investment;
  types: InvestmentType[];
  enabledReminderCount: number;
  onClose: () => void;
  onManageTypes: () => void;
  onSaved: () => void;
}) {
  const colors = useThemeColors();
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(localDate());
  const [reviewDayValue, setReviewDayValue] = useState('1');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(investment?.name ?? '');
    setType(
      investment?.type && types.some(candidate => candidate.id === investment.type)
        ? investment.type
        : investment
          ? null
          : (types[0]?.id ?? null),
    );
    setStartDate(investment?.startDate ?? localDate());
    setReviewDayValue(String(investment?.reviewDay ?? 1));
    setReminderEnabled(investment?.reminderEnabled ?? true);
  }, [visible, investment, types]);

  const save = async () => {
    const reviewDay = Number(reviewDayValue);
    const parsed = investmentBackupSchema.safeParse({
      id: investment?.id ?? 'new',
      name,
      type,
      startDate: startDate.slice(0, 10),
      reviewDay,
      reminderEnabled,
      flows: investment?.flows ?? [],
      valuations: investment?.valuations ?? [],
    });
    if (!parsed.success) {
      Alert.alert('Check investment details', parsed.error.issues[0]?.message ?? 'Please check every field.');
      return;
    }
    setSaving(true);
    try {
      if (reminderEnabled && enabledReminderCount - (investment?.reminderEnabled ? 1 : 0) >= 100) {
        throw new Error(
          'Android supports up to 100 enabled investment reminders. Turn one off before enabling another.',
        );
      }
      if (reminderEnabled && !investment?.reminderEnabled && !(await requestInvestmentReminderPermission())) {
        throw new Error('Notifications are blocked. Allow notifications for Zero, or turn this reminder off.');
      }
      await saveInvestment(parsed.data, investment?.id);
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert('Could not save investment', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <PrimaryView colors={colors} useBottomPadding={false}>
        <ModalHeader title={investment ? 'Edit investment' : 'Add investment'} onClose={onClose} />
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={gs.pb100}>
          <CustomInput
            input={name}
            setInput={setName}
            colors={colors}
            placeholder="e.g. Index fund"
            label="Name"
            maxLength={80}
            autoCapitalize="words"
          />
          <View style={[gs.rowBetweenCenter, gs.mt10]}>
            <PrimaryText size={12} color={colors.secondaryText}>
              Type (optional)
            </PrimaryText>
            <TouchableOpacity
              onPress={onManageTypes}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Manage investment types">
              <PrimaryText size={11} weight="semibold" color={colors.accentGreen}>
                Manage
              </PrimaryText>
            </TouchableOpacity>
          </View>
          <View style={[gs.row, gs.wrap, gs.gap8, gs.mt6, gs.mb15]}>
            {[{id: null, name: 'No type'}, ...types].map(value => {
              const selected = value.id === type;
              return (
                <TouchableOpacity
                  key={value.id ?? 'none'}
                  onPress={() => setType(value.id)}
                  style={[
                    gs.px12,
                    gs.py10,
                    gs.rounded12,
                    {backgroundColor: selected ? colors.accentGreen : colors.secondaryAccent},
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{selected}}>
                  <PrimaryText size={12} color={selected ? colors.buttonText : colors.primaryText}>
                    {value.name}
                  </PrimaryText>
                </TouchableOpacity>
              );
            })}
          </View>
          <DatePicker
            label="Started on"
            createdAt={startDate}
            showDatePicker={showDate}
            setShowDatePicker={setShowDate}
            setCreatedAt={value => setStartDate(value.slice(0, 10))}
            maxDate={parseLocal(localDate())}
          />
          <CustomInput
            input={reviewDayValue}
            setInput={setReviewDayValue}
            colors={colors}
            placeholder="1–31"
            label="Monthly review day"
            keyboardType="number-pad"
            maxLength={2}
          />
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mb15}>
            Short months use their last day. The reminder arrives around 9 AM and may be delayed by Android battery
            controls.
          </PrimaryText>
          <View style={[gs.rowBetweenCenter, gs.p14, gs.rounded12, gs.mb20, {backgroundColor: colors.containerColor}]}>
            <View style={gs.flex1}>
              <PrimaryText size={14} weight="semibold">
                Monthly reminder
              </PrimaryText>
              <PrimaryText size={11} color={colors.secondaryText} style={gs.mt3}>
                Get a monthly reminder to update the monthly valuation.
              </PrimaryText>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}}
            />
          </View>
          <PrimaryButton
            colors={colors}
            buttonTitle={investment ? 'Save changes' : 'Add investment'}
            onPress={() => void save()}
            loading={saving}
          />
        </ScrollView>
      </PrimaryView>
    </Modal>
  );
}

type EntryMode = 'contribution' | 'withdrawal' | 'valuation';

export function InvestmentEntryEditor({
  visible,
  investment,
  mode,
  month,
  flow,
  valuation,
  onClose,
  onSaved,
}: {
  visible: boolean;
  investment?: Investment;
  mode: EntryMode;
  month: string;
  flow?: InvestmentFlow;
  valuation?: MonthlyValuation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useThemeColors();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stableId, setStableId] = useState(() => nanoid(24));
  const isValuation = mode === 'valuation';

  useEffect(() => {
    if (!visible || !investment) return;
    setStableId(flow?.id ?? nanoid(24));
    const existing = isValuation ? valuation : flow;
    setAmount(existing ? String('value' in existing ? existing.value : existing.amount) : '');
    let suggested = isValuation ? reviewDate(investment, month) : localDate();
    const max = monthEnd(month) < localDate() ? monthEnd(month) : localDate();
    if (suggested < investment.startDate) suggested = investment.startDate;
    setDate(existing?.date ?? (suggested > max ? max : suggested));
  }, [visible, investment, isValuation, valuation, flow, month]);

  const save = async () => {
    if (!investment) return;
    if (!amount.trim()) {
      Alert.alert('Check amount', `Enter the ${isValuation ? 'current total value' : 'amount'}.`);
      return;
    }
    const numeric = Number(amount);
    if (
      !Number.isFinite(numeric) ||
      numeric < (isValuation ? 0 : 0.01) ||
      numeric > 1e12 ||
      Math.abs(Math.round(numeric * 100) - numeric * 100) > 0.01
    ) {
      Alert.alert('Check amount', `Enter a valid ${isValuation ? 'value' : 'amount'} with at most two decimal places.`);
      return;
    }
    if (date.slice(0, 10) < investment.startDate) {
      Alert.alert('Check date', 'The entry cannot be before this investment started.');
      return;
    }
    setSaving(true);
    try {
      await saveInvestmentEntry(
        investment.id,
        isValuation
          ? {month, date: date.slice(0, 10), value: numeric}
          : {id: stableId, date: date.slice(0, 10), type: mode, amount: numeric},
      );
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert('Could not save entry', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const title = isValuation ? 'Monthly valuation' : mode === 'contribution' ? 'Add contribution' : 'Record withdrawal';
  const maxDate = isValuation && monthEnd(month) < localDate() ? monthEnd(month) : localDate();
  const minDate =
    isValuation && `${month}-01` > investment?.startDate! ? `${month}-01` : (investment?.startDate ?? localDate());

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <PrimaryView colors={colors} useBottomPadding={false}>
        <ModalHeader title={title} onClose={onClose} />
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={gs.pb100}>
          <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
            {isValuation ? 'Current total value' : mode === 'contribution' ? 'Amount added' : 'Amount taken out'}
          </PrimaryText>
          <AmountInput value={amount} onChangeText={setAmount} style={gs.mb15} />
          <DatePicker
            label={isValuation ? 'Valuation date' : 'Transaction date'}
            createdAt={date}
            showDatePicker={showDate}
            setShowDatePicker={setShowDate}
            setCreatedAt={value => setDate(value.slice(0, 10))}
            minDate={parseLocal(minDate)}
            maxDate={parseLocal(maxDate)}
          />
          {isValuation ? (
            <View style={[gs.p14, gs.rounded12, gs.mb20, {backgroundColor: colors.containerColor}]}>
              <PrimaryText size={12} weight="semibold">
                What is a monthly valuation?
              </PrimaryText>
              <PrimaryText size={11} color={colors.secondaryText} style={gs.mt5}>
                Enter what this investment is worth on that date. Zero subtracts contributions and withdrawals to
                calculate investment gain or loss without counting deposits as profit.
              </PrimaryText>
            </View>
          ) : null}
          <PrimaryButton
            colors={colors}
            buttonTitle={flow || valuation ? 'Update entry' : 'Save entry'}
            onPress={() => void save()}
            loading={saving}
          />
        </ScrollView>
      </PrimaryView>
    </Modal>
  );
}
