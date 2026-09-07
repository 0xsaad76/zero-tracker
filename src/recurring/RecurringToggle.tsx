import React from 'react';
import {Switch, View} from 'react-native';
import PrimaryText from '../components/atoms/PrimaryText';
import CustomInput from '../components/atoms/CustomInput';
import useThemeColors from '../hooks/useThemeColors';
import {gs} from '../styles/globalStyles';

/**
 * "Repeat monthly" switch with a day-of-month input, shared by the expense,
 * investment-contribution, and debt add forms. Controlled: each form owns the
 * state and creates the schedule after its own entry saves.
 */
export default function RecurringToggle({
  enabled,
  onToggle,
  day,
  onDay,
  what,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  day: string;
  onDay: (value: string) => void;
  what: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={[gs.p14, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}]}>
      <View style={gs.rowBetweenCenter}>
        <View style={gs.flex1}>
          <PrimaryText size={14} weight="semibold">
            Repeat monthly
          </PrimaryText>
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mt3}>
            Auto-adds this {what} on the day below, every month.
          </PrimaryText>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}}
          accessibilityLabel="Repeat monthly"
        />
      </View>
      {enabled ? (
        <View style={gs.mt10}>
          <CustomInput
            input={day}
            setInput={onDay}
            colors={colors}
            placeholder="5"
            label="Posting day (1–31)"
            keyboardType="number-pad"
            maxLength={2}
          />
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mb5}>
            Short months use their last day. Already posted months are never duplicated.
          </PrimaryText>
        </View>
      ) : null}
    </View>
  );
}
