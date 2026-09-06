import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import TradingReports from '../TradingReports';
import {ThemeProvider} from '../../../context/ThemeContext';
import {resolveTradingPairs, resolveTradingStrategies, type Trade} from '../../../trading/model';

const trade = (overrides: Partial<Trade> = {}): Trade => ({
  id: 't1',
  userId: 'owner',
  pair: 'btc',
  direction: 'long',
  leverage: 10,
  avgPrice: 67250.5,
  date: '2026-09-05',
  riskReward: 2,
  strategy: 'sfp',
  reason: 'Sweep with displacement.',
  pnl: 100,
  ...overrides,
});

const render = (trades: Trade[], currency: 'USD' | 'INR' = 'USD') => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  act(() => {
    tree = ReactTestRenderer.create(
      <ThemeProvider>
        <TradingReports
          trades={trades}
          scopeLabel="September 2026"
          pairs={resolveTradingPairs()}
          strategies={resolveTradingStrategies()}
          currency={currency}
        />
      </ThemeProvider>,
    );
  });
  return tree!;
};

const textOf = (tree: ReactTestRenderer.ReactTestRenderer): string => {
  const visit = (node: unknown): string => {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(visit).join(' ');
    const children = (node as {children?: unknown}).children;
    return visit(children as unknown);
  };
  return visit(tree.toJSON());
};

const dayLabels = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  // Composite and host nodes both carry the label; dedupe to count real bars.
  [
    ...new Set(
      tree.root
        .findAll(
          node => typeof node.props?.accessibilityLabel === 'string' && /daily P&L/.test(node.props.accessibilityLabel),
        )
        .map(node => node.props.accessibilityLabel as string),
    ),
  ];

it('renders cumulative end-of-day results and lets the user inspect each date', () => {
  const tree = render([
    trade({id: 'a', date: '2026-09-05', pnl: 100}),
    trade({id: 'b', date: '2026-09-05', pnl: 50}),
    trade({id: 'c', date: '2026-09-06', pnl: -40}),
  ]);
  expect(dayLabels(tree)).toEqual(['2026-09-06, 1 trades, daily P&L -$40, cumulative P&L +$110']);
  const previous = tree.root.findAllByProps({accessibilityLabel: 'Previous trading day'})[0];
  act(() => previous.props.onPress());
  expect(dayLabels(tree)).toEqual(['2026-09-05, 2 trades, daily P&L +$150, cumulative P&L +$150']);
  const line = tree.root.findAllByProps({testID: 'performance-line'})[0];
  expect(line.props.d).toContain('H');
  act(() => tree.root.findAllByProps({accessibilityLabel: 'Daily P&L'})[0].props.onPress());
  expect(tree.root.findAllByProps({testID: 'performance-line'})[0].props.d).toContain('L');
  expect(textOf(tree)).toContain('Days without trades are omitted');
  expect(textOf(tree)).toContain('66.7%');
});

it('converts every displayed amount at 1 USD = 105 INR', () => {
  const trades = [trade({id: 'a', pnl: 100})];
  expect(textOf(render(trades, 'USD'))).toContain('$100');
  const inr = textOf(render(trades, 'INR'));
  expect(inr).toContain('10,500');
  expect(inr).not.toContain('$100');
});

it('shows an honest empty state with no trades', () => {
  const tree = render([]);
  expect(textOf(tree)).toContain('No closed trades yet');
  expect(dayLabels(tree)).toHaveLength(0);
  expect(tree.root.findAllByProps({testID: 'performance-line'})).toHaveLength(0);
});

it('allows tapping the line to select a day and updates safely after filtering', () => {
  const trades = [trade({date: '2026-09-01'}), trade({id: 'b', date: '2026-09-03', pnl: -20})];
  const tree = render(trades);
  act(() => tree.root.findAllByProps({testID: 'performance-chart'})[0].props.onPress({nativeEvent: {locationX: 60}}));
  expect(dayLabels(tree)[0]).toContain('2026-09-01');
  act(() =>
    tree.update(
      <ThemeProvider>
        <TradingReports
          trades={[trades[1]]}
          scopeLabel="Filtered"
          pairs={resolveTradingPairs()}
          strategies={resolveTradingStrategies()}
          currency="USD"
        />
      </ThemeProvider>,
    ),
  );
  expect(dayLabels(tree)[0]).toContain('2026-09-03');
});
