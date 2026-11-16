import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import PrimaryText from '../../components/atoms/PrimaryText';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {createTradingFormatter} from '../../trading/display';
import {navigate} from '../../utils/navigationUtils';
import {gs} from '../../styles/globalStyles';
import type {Overview} from './useOverview';

interface TileProps {
  icon: string;
  label: string;
  value: string;
  hint: string;
  valueColor?: string;
  onPress: () => void;
}

const Tile: React.FC<TileProps> = ({icon, label, value, hint, valueColor, onPress}) => {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[gs.flex1, gs.p12, gs.rounded12, {minWidth: 0, backgroundColor: colors.containerColor}]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${hint}`}>
      <View style={[gs.rowCenter, gs.gap6]}>
        <Icon name={icon} size={13} color={colors.secondaryText} />
        <PrimaryText size={10} weight="semibold" color={colors.secondaryText} numberOfLines={1}>
          {label}
        </PrimaryText>
      </View>
      <PrimaryText
        size={15}
        weight="bold"
        variant="number"
        color={valueColor ?? colors.primaryText}
        numberOfLines={1}
        style={gs.mt5}>
        {value}
      </PrimaryText>
      <PrimaryText size={10} color={colors.secondaryText} numberOfLines={1} style={gs.mt3}>
        {hint}
      </PrimaryText>
    </TouchableOpacity>
  );
};

/** One row of tappable summaries for whichever optional features are switched on. */
const OverviewTiles: React.FC<{overview: Overview}> = ({overview}) => {
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const {debts, investing, trading} = overview;
  if (!debts && !investing && !trading) return null;

  return (
    <View style={[gs.row, gs.gap8, gs.mt10]}>
      {debts ? (
        <Tile
          icon="credit-card"
          label="DEBTS"
          value={debts.net === 0 ? 'Settled' : formatAmount(Math.abs(debts.net))}
          valueColor={debts.net > 0 ? colors.accentRed : debts.net < 0 ? colors.accentGreen : undefined}
          hint={debts.net > 0 ? 'You owe' : debts.net < 0 ? 'Owed to you' : 'Nothing outstanding'}
          onPress={() => navigate('TabStack', {screen: 'DebtsScreen'})}
        />
      ) : null}
      {investing ? (
        <Tile
          icon="piggy-bank"
          label="INVESTED"
          value={investing.count === 0 ? '—' : investing.value === null ? 'Update due' : formatAmount(investing.value)}
          hint={
            investing.count === 0
              ? 'Start a portfolio'
              : investing.due > 0
                ? `${investing.due} to update`
                : 'Portfolio value'
          }
          onPress={() => navigate('TabStack', {screen: 'InvestingScreen'})}
        />
      ) : null}
      {trading ? (
        <Tile
          icon="trending-up"
          label="TRADING"
          value={
            trading.count === 0
              ? '—'
              : `${trading.netPnl > 0 ? '+' : ''}${createTradingFormatter(trading.currency)(trading.netPnl)}`
          }
          valueColor={
            trading.count === 0 || trading.netPnl === 0
              ? undefined
              : trading.netPnl > 0
                ? colors.accentGreen
                : colors.accentRed
          }
          hint={
            trading.count === 0 ? 'No trades this month' : trading.count === 1 ? '1 trade' : `${trading.count} trades`
          }
          onPress={() => navigate('TabStack', {screen: 'TradingScreen'})}
        />
      ) : null}
    </View>
  );
};

export default React.memo(OverviewTiles);
