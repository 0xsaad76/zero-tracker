import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {FlashList} from '@shopify/flash-list';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import AppHeader from '../../components/atoms/AppHeader';
import CustomInput from '../../components/atoms/CustomInput';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {goBack, navigate} from '../../utils/navigationUtils';
import {formatDate} from '../../utils/dateUtils';
import {gs} from '../../styles/globalStyles';
import {readCloudData} from '../../cloud/records';
import {searchExpenses, searchTotal, type SearchableExpense} from '../../utils/expenseSearch';

interface Row extends SearchableExpense {
  categoryIcon?: string;
  categoryColor?: string;
}

const SearchScreen = () => {
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<{id: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await readCloudData();
      const byId = new Map(data.categories.map(category => [category.id, category]));
      setRows(
        data.expenses.map(expense => {
          const category = byId.get(expense.categoryId);
          return {
            id: expense.id,
            title: expense.title,
            description: expense.description ?? '',
            amount: expense.amount,
            date: expense.date,
            categoryId: expense.categoryId,
            categoryName: category?.name ?? 'Uncategorised',
            categoryIcon: category?.icon,
            categoryColor: category?.color,
          };
        }),
      );
      // Only categories that actually have spending are worth a filter chip.
      const used = new Set(data.expenses.map(expense => expense.categoryId));
      setCategories(
        data.categories
          .filter(category => used.has(category.id))
          .map(category => ({id: category.id, name: category.name}))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your spending.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus so an edit made from a result is reflected on return.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const results = useMemo(() => searchExpenses(rows, {query, categoryId}), [rows, query, categoryId]);
  const total = useMemo(() => searchTotal(results), [results]);
  const filtering = query.trim() !== '' || categoryId !== null;

  const open = useCallback((row: Row) => {
    navigate('UpdateTransactionScreen', {
      expenseId: row.id,
      expenseTitle: row.title,
      expenseDescription: row.description ?? '',
      category: {name: row.categoryName, icon: row.categoryIcon, color: row.categoryColor},
      expenseDate: row.date,
      expenseAmount: row.amount,
    });
  }, []);

  const renderItem = useCallback(
    ({item}: {item: Row}) => (
      <TouchableOpacity
        onPress={() => open(item)}
        activeOpacity={0.7}
        style={[gs.rounded12, gs.rowBetweenCenter, gs.px14, gs.py10, gs.mb5, {backgroundColor: colors.containerColor}]}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${formatAmount(item.amount)}, ${item.categoryName}`}>
        <View style={[gs.rowCenter, gs.flex1]}>
          <View style={[gs.size36, gs.center, gs.rounded10, gs.mr10, {backgroundColor: colors.iconContainer}]}>
            <Icon name={item.categoryIcon || 'circle-dot'} size={18} color={item.categoryColor || colors.primaryText} />
          </View>
          <View style={[gs.flex1, gs.gap2]}>
            <PrimaryText weight="medium" numberOfLines={1}>
              {item.title}
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1}>
              {item.categoryName}
              {item.description ? ` · ${item.description}` : ''}
              {' · '}
              {formatDate(item.date, 'Do MMM YYYY')}
            </PrimaryText>
          </View>
        </View>
        <PrimaryText size={14} weight="semibold" variant="number" style={gs.ml10}>
          {formatAmount(item.amount)}
        </PrimaryText>
      </TouchableOpacity>
    ),
    [colors, formatAmount, open],
  );

  const chip = (id: string | null, name: string) => {
    const active = id === categoryId;
    return (
      <TouchableOpacity
        key={id ?? 'all'}
        onPress={() => setCategoryId(id)}
        style={[
          gs.px12,
          gs.py8,
          gs.roundedFull,
          {backgroundColor: active ? colors.accentGreen : colors.secondaryAccent},
        ]}
        accessibilityRole="button"
        accessibilityState={{selected: active}}>
        <PrimaryText
          size={12}
          weight="medium"
          color={active ? colors.buttonText : colors.primaryText}
          numberOfLines={1}>
          {name}
        </PrimaryText>
      </TouchableOpacity>
    );
  };

  return (
    <PrimaryView colors={colors} useBottomPadding={false}>
      <View style={[gs.mb15, gs.mt20]}>
        <AppHeader onPress={() => goBack()} colors={colors} text="Search spending" />
      </View>
      <CustomInput
        colors={colors}
        input={query}
        setInput={setQuery}
        placeholder="Title, note, category, amount or date"
        leftIcon="search"
        rightIcon={query ? 'x' : undefined}
        onRightIconPress={() => setQuery('')}
        autoCapitalize="none"
        autoFocus
        maxLength={60}
      />
      {categories.length > 1 ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[gs.gap8, gs.mb10]}>
            {chip(null, 'All')}
            {categories.map(category => chip(category.id, category.name))}
          </ScrollView>
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View style={[gs.p20, gs.itemsCenter]}>
          <PrimaryText color={colors.secondaryText}>Loading your spending…</PrimaryText>
        </View>
      ) : error && rows.length === 0 ? (
        <View style={[gs.p15, gs.rounded12, {backgroundColor: colors.containerColor}]}>
          <PrimaryText size={12} color={colors.accentRed}>
            {error}
          </PrimaryText>
          <View style={gs.mt10}>
            <PrimaryButton colors={colors} buttonTitle="Try again" size="sm" onPress={() => void load()} />
          </View>
        </View>
      ) : (
        <>
          <View style={[gs.rowBetweenCenter, gs.mb8]}>
            <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
              {results.length === 1 ? '1 RESULT' : `${results.length} RESULTS`}
            </PrimaryText>
            {results.length > 0 ? (
              <PrimaryText size={12} weight="semibold" variant="number" color={colors.secondaryText}>
                {formatAmount(total)}
              </PrimaryText>
            ) : null}
          </View>
          <View style={gs.flex1}>
            <FlashList
              data={results}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={gs.pb100}
              ListEmptyComponent={
                <View style={[gs.center, gs.p20]}>
                  <View style={[gs.size50, gs.roundedFull, gs.center, {backgroundColor: colors.secondaryAccent}]}>
                    <Icon name="search" size={22} color={colors.secondaryText} />
                  </View>
                  <PrimaryText size={13} color={colors.secondaryText} style={[gs.mt10, gs.textCenter]}>
                    {filtering ? 'Nothing matches. Try fewer words or another category.' : 'No spending recorded yet.'}
                  </PrimaryText>
                </View>
              }
            />
          </View>
        </>
      )}
    </PrimaryView>
  );
};

export default SearchScreen;
