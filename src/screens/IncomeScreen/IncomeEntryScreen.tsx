import React, {useEffect, useRef, useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import type {RouteProp} from '@react-navigation/native';
import {useRoute} from '@react-navigation/native';
import type {HomeStackParamList} from '../../navigation/types';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import AppHeader from '../../components/atoms/AppHeader';
import CustomInput from '../../components/atoms/CustomInput';
import AmountInput from '../../components/atoms/AmountInput';
import DatePicker from '../../components/atoms/DatePicker';
import useThemeColors from '../../hooks/useThemeColors';
import {goBack} from '../../utils/navigationUtils';
import {getISODateTime} from '../../utils/dateUtils';
import {gs} from '../../styles/globalStyles';
import {incomeBackupSchema} from '../../income/model';
import {deleteIncome, saveIncome} from '../../income/service';

// Common sources, one tap away. Typing anything else works just as well.
const SUGGESTIONS = ['Salary', 'Freelance', 'Business', 'Interest', 'Refund', 'Gift'];

const IncomeEntryScreen = () => {
  const colors = useThemeColors();
  const route = useRoute<RouteProp<HomeStackParamList, 'IncomeEntryScreen'>>();
  const existing = route.params.income;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [createdAt, setCreatedAt] = useState(existing ? `${existing.date}T12:00:00` : getISODateTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const candidate = {
    id: existing?.id ?? 'new',
    title,
    amount: Number(amount),
    date: createdAt.slice(0, 10),
    description,
  };
  const parsed = incomeBackupSchema.safeParse(candidate);
  const amountError =
    amountTouched && !parsed.success ? parsed.error.issues.find(issue => issue.path[0] === 'amount')?.message : null;

  const save = async () => {
    if (savingRef.current || !parsed.success) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const {title: source, amount: value, date, description: note} = parsed.data;
      await saveIncome({title: source, amount: value, date, description: note}, existing?.id);
      if (mounted.current) goBack();
    } catch (caught) {
      if (mounted.current) {
        Alert.alert('Could not save income', caught instanceof Error ? caught.message : 'Please try again.');
      }
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete this income?', 'This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteIncome(existing.id)
            .then(() => {
              if (mounted.current) goBack();
            })
            .catch(caught =>
              Alert.alert('Could not delete income', caught instanceof Error ? caught.message : 'Please try again.'),
            );
        },
      },
    ]);
  };

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader onPress={() => goBack()} colors={colors} text={existing ? 'Edit income' : 'Add income'} />
      </View>
      <ScrollView
        style={gs.flex1}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
          Amount
        </PrimaryText>
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          onBlur={() => setAmountTouched(true)}
          style={{marginBottom: amountError ? 5 : 15}}
        />
        {amountError ? (
          <PrimaryText size={12} color={colors.accentRed} style={gs.mb10}>
            {amountError}
          </PrimaryText>
        ) : null}

        <CustomInput
          colors={colors}
          input={title}
          setInput={setTitle}
          placeholder="e.g. Salary"
          label="Source"
          maxLength={80}
        />
        {title.trim() === '' ? (
          <View style={[gs.row, gs.wrap, gs.gap8, gs.mb15]}>
            {SUGGESTIONS.map(suggestion => (
              <PrimaryButton
                key={suggestion}
                colors={colors}
                buttonTitle={suggestion}
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={() => setTitle(suggestion)}
              />
            ))}
          </View>
        ) : null}

        <DatePicker
          setShowDatePicker={setShowDatePicker}
          createdAt={createdAt}
          showDatePicker={showDatePicker}
          setCreatedAt={setCreatedAt}
          label="Date received"
          maxDate={new Date()}
        />

        <CustomInput
          colors={colors}
          input={description}
          setInput={setDescription}
          placeholder="Optional"
          label="Note"
          maxLength={200}
        />
      </ScrollView>
      <View style={[gs.mt5, gs.gap8]}>
        <PrimaryButton
          colors={colors}
          buttonTitle={existing ? 'Update' : 'Add income'}
          disabled={saving || !parsed.success}
          loading={saving}
          onPress={() => void save()}
        />
        {existing ? (
          <PrimaryButton colors={colors} buttonTitle="Delete" icon="trash-2" variant="ghost" onPress={remove} />
        ) : null}
      </View>
    </PrimaryView>
  );
};

export default IncomeEntryScreen;
