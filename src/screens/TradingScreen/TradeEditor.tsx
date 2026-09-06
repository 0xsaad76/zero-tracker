import React, {useEffect, useState} from 'react';
import {Alert, Modal, ScrollView, TouchableOpacity, View} from 'react-native';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import CustomInput from '../../components/atoms/CustomInput';
import DatePicker from '../../components/atoms/DatePicker';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import {gs, hitSlop} from '../../styles/globalStyles';
import {
  localDate,
  tradeBackupSchema,
  tradeOutcome,
  type Trade,
  type TradingCurrency,
  type TradingPair,
  type TradingStrategy,
} from '../../trading/model';
import {saveTrade} from '../../trading/service';

const parseLocal = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

const LEVERAGE_PRESETS = [1, 5, 10, 25, 50, 100];

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

const SectionLabel = ({children, action}: {children: string; action?: React.ReactNode}) => {
  const colors = useThemeColors();
  return (
    <View style={[gs.rowBetweenCenter, gs.mt10]}>
      <PrimaryText size={12} color={colors.secondaryText}>
        {children}
      </PrimaryText>
      {action}
    </View>
  );
};

export default function TradeEditor({
  visible,
  trade,
  pairs,
  strategies,
  currency,
  onClose,
  onManageSetup,
  onSaved,
}: {
  visible: boolean;
  trade?: Trade;
  pairs: TradingPair[];
  strategies: TradingStrategy[];
  currency: TradingCurrency;
  onClose: () => void;
  onManageSetup: () => void;
  onSaved: () => void;
}) {
  const colors = useThemeColors();
  const [pair, setPair] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [leverage, setLeverage] = useState('10');
  const [avgPrice, setAvgPrice] = useState('');
  const [date, setDate] = useState(localDate());
  const [showDate, setShowDate] = useState(false);
  const [strategy, setStrategy] = useState('');
  const [riskReward, setRiskReward] = useState('');
  const [pnl, setPnl] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPair(trade?.pair ?? pairs[0]?.id ?? '');
    setDirection(trade?.direction ?? 'long');
    setLeverage(String(trade?.leverage ?? 10));
    setAvgPrice(trade ? String(trade.avgPrice) : '');
    setDate(trade?.date ?? localDate());
    setStrategy(trade?.strategy ?? strategies[0]?.id ?? '');
    setRiskReward(trade ? String(trade.riskReward) : '');
    setPnl(trade ? String(trade.pnl) : '');
    setReason(trade?.reason ?? '');
  }, [visible, trade, pairs, strategies]);

  const pnlNumber = pnl.trim() === '' ? null : Number(pnl);
  const outcome = pnlNumber === null || !Number.isFinite(pnlNumber) ? null : tradeOutcome(pnlNumber);
  const outcomeColor =
    outcome === 'win' ? colors.accentGreen : outcome === 'loss' ? colors.accentRed : colors.secondaryText;

  const save = async () => {
    const parsed = tradeBackupSchema.safeParse({
      id: trade?.id ?? 'new',
      pair,
      direction,
      leverage: Number(leverage),
      avgPrice: Number(avgPrice),
      date: date.slice(0, 10),
      riskReward: Number(riskReward),
      strategy,
      reason,
      pnl: Number(pnl),
    });
    if (!parsed.success) {
      Alert.alert('Check trade details', parsed.error.issues[0]?.message ?? 'Please check every field.');
      return;
    }
    if (!pairs.some(item => item.id === parsed.data.pair)) {
      Alert.alert('Check trade details', 'That trading pair no longer exists. Choose another pair.');
      return;
    }
    if (!strategies.some(item => item.id === parsed.data.strategy)) {
      Alert.alert('Check trade details', 'That strategy no longer exists. Choose another strategy.');
      return;
    }
    setSaving(true);
    try {
      await saveTrade(parsed.data, trade?.id);
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert('Could not save trade', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const manageLink = (
    <TouchableOpacity
      onPress={onManageSetup}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel="Manage strategies and pairs">
      <PrimaryText size={11} weight="semibold" color={colors.accentGreen}>
        Manage
      </PrimaryText>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <PrimaryView colors={colors} useBottomPadding={false}>
        <ModalHeader title={trade ? 'Edit trade' : 'Add trade'} onClose={onClose} />
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={gs.pb100}>
          <SectionLabel action={manageLink}>Pair</SectionLabel>
          <View style={[gs.row, gs.wrap, gs.gap8, gs.mt6, gs.mb15]}>
            {pairs.map(item => {
              const selected = item.id === pair;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setPair(item.id)}
                  style={[
                    gs.px12,
                    gs.py10,
                    gs.rounded12,
                    {backgroundColor: selected ? colors.accentGreen : colors.secondaryAccent},
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{selected}}>
                  <PrimaryText size={12} color={selected ? colors.buttonText : colors.primaryText}>
                    {item.name}
                  </PrimaryText>
                </TouchableOpacity>
              );
            })}
          </View>

          <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
            Direction and leverage
          </PrimaryText>
          <View style={[gs.row, gs.gap8, gs.mb8]}>
            {(['long', 'short'] as const).map(value => {
              const selected = value === direction;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setDirection(value)}
                  style={[
                    gs.flex1,
                    gs.py10,
                    gs.rounded12,
                    gs.center,
                    {
                      backgroundColor: selected
                        ? value === 'long'
                          ? colors.accentGreen
                          : colors.accentRed
                        : colors.secondaryAccent,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{selected}}>
                  <PrimaryText size={13} weight="semibold" color={selected ? colors.buttonText : colors.primaryText}>
                    {value === 'long' ? 'Long' : 'Short'}
                  </PrimaryText>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[gs.row, gs.wrap, gs.gap8, gs.mb15]}>
            {LEVERAGE_PRESETS.map(preset => {
              const selected = Number(leverage) === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setLeverage(String(preset))}
                  style={[
                    gs.px12,
                    gs.py8,
                    gs.roundedFull,
                    {backgroundColor: selected ? colors.primaryText : colors.secondaryAccent},
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{selected}}>
                  <PrimaryText size={11} color={selected ? colors.buttonText : colors.primaryText}>
                    {preset}x
                  </PrimaryText>
                </TouchableOpacity>
              );
            })}
          </View>
          <CustomInput
            input={leverage}
            setInput={setLeverage}
            colors={colors}
            placeholder="10"
            label="Leverage (1–125x)"
            keyboardType="number-pad"
            maxLength={3}
          />

          <View style={[gs.row, gs.gap8]}>
            <View style={gs.flex1}>
              <CustomInput
                input={avgPrice}
                setInput={setAvgPrice}
                colors={colors}
                placeholder="e.g. 67250.5"
                label={`Average price (${currency})`}
                keyboardType="decimal-pad"
                maxLength={20}
              />
            </View>
            <View style={gs.flex1}>
              <CustomInput
                input={riskReward}
                setInput={setRiskReward}
                colors={colors}
                placeholder="e.g. 2"
                label="Risk : reward"
                keyboardType="decimal-pad"
                maxLength={6}
              />
            </View>
          </View>
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mb15}>
            Risk : reward is the planned multiple, e.g. 2 means risking 1 to make 2.
          </PrimaryText>

          <DatePicker
            label="Trade date"
            createdAt={date}
            showDatePicker={showDate}
            setShowDatePicker={setShowDate}
            setCreatedAt={value => setDate(value.slice(0, 10))}
            maxDate={parseLocal(localDate())}
          />

          <SectionLabel action={manageLink}>Strategy</SectionLabel>
          <View style={[gs.row, gs.wrap, gs.gap8, gs.mt6, gs.mb15]}>
            {strategies.map(item => {
              const selected = item.id === strategy;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setStrategy(item.id)}
                  style={[
                    gs.px12,
                    gs.py10,
                    gs.rounded12,
                    {backgroundColor: selected ? colors.accentGreen : colors.secondaryAccent},
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{selected}}>
                  <PrimaryText size={12} color={selected ? colors.buttonText : colors.primaryText}>
                    {item.name}
                  </PrimaryText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[gs.rowBetweenCenter, gs.mb5]}>
            <PrimaryText size={12} color={colors.secondaryText}>
              Position PnL ({currency})
            </PrimaryText>
            {outcome ? (
              <PrimaryText size={11} weight="semibold" color={outcomeColor}>
                {outcome === 'win' ? 'Win' : outcome === 'loss' ? 'Loss' : 'Breakeven'}
              </PrimaryText>
            ) : null}
          </View>
          <CustomInput
            input={pnl}
            setInput={setPnl}
            colors={colors}
            placeholder="e.g. 250 or -120"
            keyboardType="numbers-and-punctuation"
            maxLength={15}
          />
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mb15}>
            Entered in {currency}. Use a minus sign for a loss. Win or loss is derived from this number.
          </PrimaryText>

          <CustomInput
            input={reason}
            setInput={setReason}
            colors={colors}
            placeholder="Why did you take this trade?"
            label="Reason"
            multiline
            maxLength={500}
            autoCapitalize="sentences"
          />

          <View style={gs.mt10}>
            <PrimaryButton
              colors={colors}
              buttonTitle={trade ? 'Save changes' : 'Add trade'}
              onPress={() => void save()}
              loading={saving}
            />
          </View>
        </ScrollView>
      </PrimaryView>
    </Modal>
  );
}
