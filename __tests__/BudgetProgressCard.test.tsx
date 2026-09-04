import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import BudgetProgressCard from '../src/components/molecules/BudgetProgressCard';
import {ThemeProvider} from '../src/context/ThemeContext';
import type {BudgetData} from '../src/watermelondb/services/budgetService';

jest.mock('../src/watermelondb/database', () => ({database: {}}));
jest.mock('../src/hooks/useFormatAmount', () => ({
  __esModule: true,
  default: () => (amount: number) => String(amount),
}));

const budget = (id: string, amount: number, budgetType: 'monthly' | 'weekly', categoryId = ''): BudgetData => ({
  id,
  amount,
  budgetType,
  categoryId,
  userId: 'user',
  month: budgetType === 'monthly' ? '2026-09' : 'recurring-weekly:2026-08-30',
});
const expense = (id: string, amount: number) => ({
  id,
  amount,
  title: id,
  userId: 'user',
  categoryId: 'food',
  date: '2026-09-01',
});
const props = {
  visible: true,
  monthlyExpenses: [expense('monthly', 60)],
  weeklyExpenses: [expense('weekly', 20)],
  budgets: [budget('monthly', 100, 'monthly'), budget('weekly', 50, 'weekly'), budget('food', 30, 'weekly', 'food')],
  categories: [{id: 'food', userId: 'user', name: 'Food', color: '#758595', icon: 'utensils', categoryStatus: true}],
  weekRange: {startDate: '2026-08-30', endDate: '2026-09-05'},
  todayTotal: 0,
  daysInMonth: 30,
  isCurrentMonth: false,
  monthlyReady: true,
  weeklyReady: true,
  monthlyError: null,
  weeklyError: null,
};

const textContent = (tree: ReactTestRenderer.ReactTestRenderer) => {
  const visit = (
    node: ReactTestRenderer.ReactTestRendererJSON | ReactTestRenderer.ReactTestRendererJSON[] | string | null,
  ): string => {
    if (node === null) {
      return '';
    }
    if (typeof node === 'string') {
      return node;
    }
    if (Array.isArray(node)) {
      return node.map(visit).join(' ');
    }
    return node.children?.map(visit).join(' ') ?? '';
  };
  return visit(tree.toJSON()).replace(/\s+/g, ' ');
};

describe('Home limit progress', () => {
  it('switches monthly/weekly totals and shows the category limit and actual week range', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <ThemeProvider>
          <BudgetProgressCard {...props} />
        </ThemeProvider>,
      );
    });
    expect(textContent(tree)).toContain('60 spent of 100');
    const tabs = tree.root.findAllByType(TouchableOpacity).filter(node => node.props.accessibilityRole === 'tab');
    await act(async () => {
      tabs[1].props.onPress();
    });
    expect(textContent(tree)).toContain('20 spent of 50');
    expect(textContent(tree)).toContain('Food');
    expect(textContent(tree)).toContain('20 / 30');
    expect(textContent(tree)).toContain('30 Aug');
    expect(textContent(tree)).toContain('5 Sep 2026');
    await act(async () => {
      tree.unmount();
    });
  });

  it('hides the entire card and never presents loading weekly data as zero spending', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <ThemeProvider>
          <BudgetProgressCard {...props} visible={false} />
        </ThemeProvider>,
      );
    });
    expect(tree.toJSON()).toBeNull();
    await act(async () => {
      tree.update(
        <ThemeProvider>
          <BudgetProgressCard {...props} weeklyReady={false} weeklyError="offline" />
        </ThemeProvider>,
      );
    });
    const tabs = tree.root.findAllByType(TouchableOpacity).filter(node => node.props.accessibilityRole === 'tab');
    await act(async () => {
      tabs[1].props.onPress();
    });
    expect(textContent(tree)).toContain('Could not load spending');
    expect(textContent(tree)).not.toContain('spent of');
    expect(tree.root.findAllByType(View).filter(node => node.props.accessibilityRole === 'progressbar')).toHaveLength(
      0,
    );
    await act(async () => {
      tree.unmount();
    });
  });

  it('shows one category, expands choices, and remembers separate monthly/weekly selections', async () => {
    const categoryProps = {
      ...props,
      categories: [
        ...props.categories,
        {...props.categories[0], id: 'travel', name: 'Travel'},
        {...props.categories[0], id: 'unlimited', name: 'No limit'},
      ],
      budgets: [
        ...props.budgets,
        budget('food-monthly', 100, 'monthly', 'food'),
        budget('travel-monthly', 50, 'monthly', 'travel'),
        budget('travel-weekly', 10, 'weekly', 'travel'),
      ],
      monthlyExpenses: [...props.monthlyExpenses, {...expense('trip-monthly', 35), categoryId: 'travel'}],
      weeklyExpenses: [...props.weeklyExpenses, {...expense('trip-weekly', 7), categoryId: 'travel'}],
    };
    let tree!: ReactTestRenderer.ReactTestRenderer;
    const renderCard = (budgets = categoryProps.budgets) => (
      <ThemeProvider>
        <BudgetProgressCard {...categoryProps} budgets={budgets} />
      </ThemeProvider>
    );
    await act(async () => {
      tree = ReactTestRenderer.create(renderCard());
    });
    const chooser = () =>
      tree.root
        .findAllByType(TouchableOpacity)
        .find(node => node.props.accessibilityLabel?.startsWith('Choose category:'))!;
    const press = async (button: ReactTestRenderer.ReactTestInstance) => {
      await act(async () => button.props.onPress());
    };
    const option = (label: string) =>
      tree.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === label)!;
    const periodTab = (index: number) =>
      tree.root.findAllByType(TouchableOpacity).filter(node => node.props.accessibilityRole === 'tab')[index];

    expect(textContent(tree)).toContain('60 / 100');
    expect(textContent(tree)).not.toContain('Travel');
    expect(chooser().props.accessibilityState.expanded).toBe(false);
    expect(tree.root.findAllByType(View).filter(node => node.props.accessibilityRole === 'progressbar')).toHaveLength(
      1,
    );
    await press(chooser());
    expect(chooser().props.accessibilityState.expanded).toBe(true);
    expect(textContent(tree)).toContain('Travel');
    expect(textContent(tree)).not.toContain('No limit');
    expect(option('Food').props.accessibilityState.selected).toBe(true);
    await press(option('Travel'));
    expect(textContent(tree)).toContain('35 / 50');
    expect(textContent(tree)).not.toContain('Food');
    expect(chooser().props.accessibilityState.expanded).toBe(false);

    await press(chooser());
    await press(periodTab(1));
    expect(chooser().props.accessibilityState.expanded).toBe(false);
    expect(textContent(tree)).toContain('20 / 30');
    await press(chooser());
    await press(option('Travel'));
    expect(textContent(tree)).toContain('7 / 10');
    await press(periodTab(0));
    expect(textContent(tree)).toContain('35 / 50');
    await press(periodTab(1));
    expect(textContent(tree)).toContain('7 / 10');

    // Removing the selected limit must not leave a stale name/amount behind.
    await act(async () => {
      tree.update(renderCard(categoryProps.budgets.filter(item => item.categoryId !== 'travel')));
    });
    expect(textContent(tree)).toContain('20 / 30');
    expect(textContent(tree)).not.toContain('Travel');
    expect(chooser().props.disabled).toBe(true);
    await act(async () => {
      tree.update(renderCard(categoryProps.budgets.filter(item => !item.categoryId)));
    });
    expect(tree.root.findAllByType(View).filter(node => node.props.accessibilityRole === 'progressbar')).toHaveLength(
      0,
    );
    await act(async () => tree.unmount());
  });

  it('caps the selected progress bar while keeping over-budget spending visible', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <ThemeProvider>
          <BudgetProgressCard {...props} budgets={[budget('food-monthly', 30, 'monthly', 'food')]} />
        </ThemeProvider>,
      );
    });
    const progress = tree.root.findByProps({accessibilityRole: 'progressbar'});
    expect(progress.props.accessibilityValue.now).toBe(100);
    expect(progress.props.accessibilityValue.text).toBe('60 spent of 30');
    expect(textContent(tree)).toContain('60 / 30');
    await act(async () => tree.unmount());
  });
});
