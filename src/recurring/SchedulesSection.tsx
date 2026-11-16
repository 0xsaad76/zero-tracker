import React, {useState} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import PrimaryText from '../components/atoms/PrimaryText';
import PrimaryButton from '../components/atoms/PrimaryButton';
import CustomInput from '../components/atoms/CustomInput';
import Icon from '../components/atoms/Icons';
import useThemeColors from '../hooks/useThemeColors';
import useFormatAmount from '../hooks/useFormatAmount';
import {gs, hitSlop} from '../styles/globalStyles';
import {scheduledDate, type RecurringSchedule} from './model';
import {deleteRecurringSchedule, setRecurringSchedulePaused, updateRecurringSchedule} from './service';
import {useFeatureFlags} from '../features/flags';

function ScheduleRow({
  schedule,
  describe,
  onChanged,
}: {
  schedule: RecurringSchedule;
  describe: (schedule: RecurringSchedule) => string;
  onChanged: () => void | Promise<void>;
}) {
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState(String(schedule.dayOfMonth));
  const [amount, setAmount] = useState(String(schedule.amount));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateRecurringSchedule(schedule.id, {dayOfMonth: Number(day), amount: Number(amount)});
      setEditing(false);
      await onChanged();
    } catch (caught) {
      Alert.alert('Could not save automation', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete this automation?', 'Already posted entries stay. Future months stop posting.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteRecurringSchedule(schedule.id)
            .then(() => onChanged())
            .catch(caught =>
              Alert.alert(
                'Could not delete automation',
                caught instanceof Error ? caught.message : 'Please try again.',
              ),
            );
        },
      },
    ]);
  };

  const togglePaused = async () => {
    try {
      await setRecurringSchedulePaused(schedule.id, !schedule.paused);
      await onChanged();
    } catch (caught) {
      Alert.alert('Could not update automation', caught instanceof Error ? caught.message : 'Please try again.');
    }
  };

  return (
    <View style={[gs.p14, gs.rounded12, gs.mb8, {backgroundColor: colors.containerColor}]}>
      <View style={gs.rowBetweenCenter}>
        <View style={[gs.rowCenter, gs.gap10, gs.flex1]}>
          <View style={[gs.size40, gs.center, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
            <Icon name="refresh-cw" size={18} color={schedule.paused ? colors.secondaryText : colors.accentGreen} />
          </View>
          <View style={gs.flex1}>
            <PrimaryText size={13} weight="semibold" numberOfLines={1}>
              {describe(schedule)}
            </PrimaryText>
            <PrimaryText size={10} color={colors.secondaryText} style={gs.mt3} numberOfLines={1}>
              Day {schedule.dayOfMonth} · {formatAmount(schedule.amount)}
              {schedule.paused ? ' · Paused' : ''}
            </PrimaryText>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            setDay(String(schedule.dayOfMonth));
            setAmount(String(schedule.amount));
            setEditing(value => !value);
          }}
          hitSlop={hitSlop}
          style={gs.p8}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${describe(schedule)}`}
          accessibilityState={{expanded: editing}}>
          <Icon name={editing ? 'chevron-down' : 'pencil'} size={17} color={colors.secondaryText} />
        </TouchableOpacity>
      </View>

      {editing ? (
        <View style={gs.mt10}>
          <View style={[gs.row, gs.gap8]}>
            <View style={gs.flex1}>
              <CustomInput
                input={day}
                setInput={setDay}
                colors={colors}
                placeholder="5"
                label="Day of month"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={[gs.flex1, {flexGrow: 1.4}]}>
              <CustomInput
                input={amount}
                setInput={setAmount}
                colors={colors}
                placeholder="5000"
                label="Amount"
                keyboardType="decimal-pad"
                maxLength={15}
              />
            </View>
          </View>
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mb10}>
            Short months use their last day. Next posting would be{' '}
            {scheduledDate(Number(day) || schedule.dayOfMonth, new Date().toISOString().slice(0, 7))}.
          </PrimaryText>
          <View style={[gs.row, gs.gap8]}>
            <View style={gs.flex1}>
              <PrimaryButton
                colors={colors}
                buttonTitle={schedule.paused ? 'Resume' : 'Pause'}
                size="sm"
                variant="secondary"
                onPress={() => void togglePaused()}
              />
            </View>
            <View style={gs.flex1}>
              <PrimaryButton colors={colors} buttonTitle="Delete" size="sm" variant="ghost" onPress={remove} />
            </View>
            <View style={gs.flex1}>
              <PrimaryButton
                colors={colors}
                buttonTitle="Save"
                size="sm"
                loading={saving}
                onPress={() => void save()}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function SchedulesSection({
  title,
  subtitle,
  schedules,
  describe,
  onChanged,
}: {
  title: string;
  subtitle: string;
  schedules: RecurringSchedule[];
  describe: (schedule: RecurringSchedule) => string;
  onChanged: () => void | Promise<void>;
}) {
  const colors = useThemeColors();
  const {automations} = useFeatureFlags();
  // Collapsed by default: automations are set-and-forget, so they should not
  // push the day-to-day list down the screen until the user asks for them.
  const [open, setOpen] = useState(false);
  if (!automations || schedules.length === 0) return null;
  const active = schedules.filter(schedule => !schedule.paused).length;
  return (
    <View style={[gs.rounded16, gs.p14, gs.mt10, {backgroundColor: colors.containerColor}]}>
      <TouchableOpacity
        onPress={() => setOpen(value => !value)}
        activeOpacity={0.7}
        hitSlop={hitSlop}
        style={gs.rowBetweenCenter}
        accessibilityRole="button"
        accessibilityState={{expanded: open}}
        accessibilityLabel={`${title}, ${active} active of ${schedules.length}`}>
        <View style={[gs.rowCenter, gs.gap8, gs.flex1]}>
          <Icon name="repeat" size={16} color={colors.accentGreen} />
          <PrimaryText size={14} weight="semibold" numberOfLines={1} style={gs.flexShrink}>
            {title}
          </PrimaryText>
        </View>
        <View style={[gs.rowCenter, gs.gap6]}>
          <PrimaryText size={11} color={colors.secondaryText}>
            {active === schedules.length
              ? `${active} active`
              : `${active} active · ${schedules.length - active} paused`}
          </PrimaryText>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color={colors.secondaryText} />
        </View>
      </TouchableOpacity>
      {open ? (
        <>
          <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt8, gs.mb10]}>
            {subtitle}
          </PrimaryText>
          {schedules.map(schedule => (
            <ScheduleRow key={schedule.id} schedule={schedule} describe={describe} onChanged={onChanged} />
          ))}
        </>
      ) : null}
    </View>
  );
}
