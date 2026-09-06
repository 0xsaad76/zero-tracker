import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Svg, {Circle, Line, Path, Text as SvgText} from 'react-native-svg';
import PrimaryText from '../../components/atoms/PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import {gs} from '../../styles/globalStyles';
import {useTradingFormat} from '../../trading/display';
import {performanceDays, performancePlot} from '../../trading/performance';
import {convertTradingAmount, type Trade, type TradingCurrency} from '../../trading/model';

const LEFT = 60;
const TOP = 14;
const HEIGHT = 150;
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(
    new Date(`${date}T00:00:00Z`),
  );

export default function TradingPerformanceChart({trades, currency}: {trades: Trade[]; currency: TradingCurrency}) {
  const colors = useThemeColors();
  const format = useTradingFormat(currency);
  const [mode, setMode] = useState<'cumulative' | 'daily'>('cumulative');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [width, setWidth] = useState(300);
  const days = useMemo(() => performanceDays(trades), [trades]);
  const plotWidth = Math.max(100, width - LEFT - 14);
  const plot = useMemo(() => performancePlot(days, mode, plotWidth, HEIGHT), [days, mode, plotWidth]);
  const selectedIndex = Math.max(
    0,
    days.findIndex(day => day.date === selectedDate),
  );
  const index = selectedDate && days.some(day => day.date === selectedDate) ? selectedIndex : days.length - 1;
  const selected = days[index];
  const point = plot?.points[index];
  const signed = (value: number) => `${value > 0 ? '+' : ''}${format(value)}`;
  const lineColor = colors.primaryText;
  const axisLabel = (value: number) =>
    new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(convertTradingAmount(value, currency));

  return (
    <View style={gs.mt15}>
      <View style={[gs.row, gs.rounded12, {padding: 4, backgroundColor: colors.secondaryAccent}]}>
        {(['cumulative', 'daily'] as const).map(value => (
          <Pressable
            key={value}
            onPress={() => setMode(value)}
            accessibilityRole="radio"
            accessibilityLabel={value === 'cumulative' ? 'Cumulative P&L' : 'Daily P&L'}
            accessibilityState={{selected: mode === value}}
            style={[
              gs.flex1,
              gs.center,
              gs.rounded10,
              styles.control,
              {backgroundColor: mode === value ? colors.containerColor : 'transparent'},
            ]}>
            <PrimaryText size={12} weight="semibold" color={mode === value ? colors.primaryText : colors.secondaryText}>
              {value === 'cumulative' ? 'Cumulative P&L' : 'Daily P&L'}
            </PrimaryText>
          </Pressable>
        ))}
      </View>
      {!plot || !selected || !point ? (
        <View style={[gs.p20, gs.center]}>
          <PrimaryText size={12} color={colors.secondaryText}>
            No closed trades yet. Your performance line starts here.
          </PrimaryText>
        </View>
      ) : (
        <>
          <View style={[gs.rowBetweenCenter, gs.mt15]}>
            <PrimaryText size={11} color={colors.secondaryText}>
              {mode === 'cumulative' ? 'Running net result' : 'Net result by trading day'}
            </PrimaryText>
            <PrimaryText size={10} color={colors.secondaryText}>
              {currency}
            </PrimaryText>
          </View>
          <Pressable
            onLayout={event => setWidth(event.nativeEvent.layout.width)}
            accessible={false}
            testID="performance-chart"
            onPress={event => {
              const x = event.nativeEvent.locationX - LEFT;
              const nearest = plot.points.reduce((best, next) =>
                Math.abs(next.x - x) < Math.abs(best.x - x) ? next : best,
              );
              setSelectedDate(nearest.date);
            }}>
            <Svg width="100%" height={200} accessible={false}>
              {plot.ticks.map(tick => (
                <React.Fragment key={tick.value}>
                  <Line
                    x1={LEFT}
                    x2={LEFT + plotWidth}
                    y1={TOP + tick.y}
                    y2={TOP + tick.y}
                    stroke={colors.secondaryText}
                    strokeOpacity={tick.value === 0 ? 0.45 : 0.15}
                    strokeDasharray="3 5"
                  />
                  <SvgText x={LEFT - 8} y={TOP + tick.y + 4} textAnchor="end" fontSize={10} fill={colors.secondaryText}>
                    {axisLabel(tick.value)}
                  </SvgText>
                </React.Fragment>
              ))}
              <Path
                testID="performance-line"
                d={plot.path}
                transform={`translate(${LEFT}, ${TOP})`}
                fill="none"
                stroke={lineColor}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              <Line
                x1={LEFT + point.x}
                x2={LEFT + point.x}
                y1={TOP}
                y2={TOP + HEIGHT}
                stroke={colors.secondaryText}
                strokeOpacity={0.3}
                strokeDasharray="3 4"
              />
              {plot.points.map(item => (
                <Circle key={item.date} cx={LEFT + item.x} cy={TOP + item.y} r={2.5} fill={lineColor} />
              ))}
              <Circle
                cx={LEFT + point.x}
                cy={TOP + point.y}
                r={5}
                fill={colors.containerColor}
                stroke={lineColor}
                strokeWidth={2.5}
              />
              <SvgText x={LEFT} y={190} fontSize={10} fill={colors.secondaryText}>
                {mode === 'cumulative' ? 'Start · 0' : dateLabel(days[0].date)}
              </SvgText>
              {(mode === 'cumulative' || days.length > 1) && (
                <SvgText x={LEFT + plotWidth} y={190} textAnchor="end" fontSize={10} fill={colors.secondaryText}>
                  {dateLabel(days[days.length - 1].date)}
                </SvgText>
              )}
            </Svg>
          </Pressable>
          <View style={[gs.p12, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
            <View style={gs.rowBetweenCenter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous trading day"
                disabled={index === 0}
                accessibilityState={{disabled: index === 0}}
                onPress={() => setSelectedDate(days[index - 1].date)}
                style={[styles.arrow, {opacity: index === 0 ? 0.3 : 1}]}>
                <PrimaryText size={20}>‹</PrimaryText>
              </Pressable>
              <View
                accessible
                accessibilityLabel={`${selected.date}, ${selected.count} trades, daily P&L ${signed(selected.pnl)}, cumulative P&L ${signed(selected.cumulative)}`}>
                <PrimaryText size={12} weight="semibold" style={gs.textCenter}>
                  {dateLabel(selected.date)}
                </PrimaryText>
                <PrimaryText size={10} color={colors.secondaryText} style={gs.textCenter}>
                  {selected.count} {selected.count === 1 ? 'trade' : 'trades'}
                </PrimaryText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next trading day"
                disabled={index === days.length - 1}
                accessibilityState={{disabled: index === days.length - 1}}
                onPress={() => setSelectedDate(days[index + 1].date)}
                style={[styles.arrow, {opacity: index === days.length - 1 ? 0.3 : 1}]}>
                <PrimaryText size={20}>›</PrimaryText>
              </Pressable>
            </View>
            <View style={[gs.row, gs.gap12, gs.mt8]}>
              {[
                {label: 'Daily result', value: selected.pnl},
                {label: 'Cumulative', value: selected.cumulative},
              ].map(item => (
                <View key={item.label} style={gs.flex1}>
                  <PrimaryText size={10} color={colors.secondaryText}>
                    {item.label}
                  </PrimaryText>
                  <PrimaryText
                    size={14}
                    weight="semibold"
                    variant="number"
                    style={gs.mt3}
                    color={
                      item.value < 0 ? colors.accentRed : item.value > 0 ? colors.accentGreen : colors.primaryText
                    }>
                    {signed(item.value)}
                  </PrimaryText>
                </View>
              ))}
            </View>
          </View>
          <PrimaryText size={10} color={colors.secondaryText} style={gs.mt8}>
            {mode === 'cumulative'
              ? 'Starts at zero for this filter; steps show end-of-day results, not account balance.'
              : 'Each point is one active trading day. Days without trades are omitted.'}{' '}
            Tap the chart or use the arrows to inspect.
          </PrimaryText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {minHeight: 44},
  arrow: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
});
