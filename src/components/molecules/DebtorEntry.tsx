import {ScrollView, View} from 'react-native';
import React, {useCallback, useEffect, useRef, useState, memo} from 'react';
import type {RouteProp} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useDialog} from '../../context/DialogContext';
import type {HomeStackParamList} from '../../navigation/types';
import PrimaryView from '../atoms/PrimaryView';
import {goBack} from '../../utils/navigationUtils';
import useThemeColors from '../../hooks/useThemeColors';
import AppHeader from '../atoms/AppHeader';
import PrimaryText from '../atoms/PrimaryText';
import CategoryContainer from './CategoryContainer';
import CustomInput from '../atoms/CustomInput';
import PrimaryButton from '../atoms/PrimaryButton';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {createDebtor, updateDebtorById} from '../../cloud';
import {requireCloudUser} from '../../cloud/records';
import {fetchDebtors} from '../../redux/slice/debtorDataSlice';
import debtCategories from '../../../assets/jsons/defaultDebtAccounts.json';
import {nameSchema} from '../../utils/validationSchema';
import {fetchDebtsByDebtor} from '../../redux/slice/debtDataSlice';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {gs} from '../../styles/globalStyles';

interface DebtCategory {
  name: string;
  icon?: string;
  color?: string;
}

interface DebtorEntryProps {
  type: string;
  route?: RouteProp<HomeStackParamList, 'UpdateDebtorScreen'>;
}

const DebtorEntry: React.FC<DebtorEntryProps> = ({type, route}) => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const colors = useThemeColors();
  const debtorData = route?.params;
  const isAddButton = type === 'Add';
  const dispatch = useAppDispatch();
  const [debtorTitle, setDebtorTitle] = useState(isAddButton ? '' : (debtorData?.debtorName ?? ''));
  const [selectedCategories, setSelectedCategories] = useState<Array<DebtCategory>>(
    isAddButton ? [] : debtCategories.filter(category => category.name === debtorData?.debtorType),
  );
  const userId = useAppSelector(selectUserId);
  const isValid = nameSchema.safeParse(debtorTitle).success;
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saveDebtor = useCallback(
    async (save: () => Promise<unknown>, debtorId?: string) => {
      if (savingRef.current || !mountedRef.current || !isValid) {
        return;
      }
      const capturedUserId = userId;
      savingRef.current = true;
      setSaving(true);

      try {
        requireCloudUser(capturedUserId);
        await save();
        if (!mountedRef.current) {
          return;
        }
        requireCloudUser(capturedUserId);
        dispatch(fetchDebtors());
        if (debtorId) {
          dispatch(fetchDebtsByDebtor(debtorId));
        }
        goBack();
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        try {
          requireCloudUser(capturedUserId);
        } catch {
          return;
        }
        if (__DEV__) {
          console.error('Error saving debtor:', error);
        }
        await showAlert({
          type: 'error',
          message:
            error instanceof Error && error.message
              ? error.message
              : t('debtor.saveFailed', {defaultValue: "That person couldn't be saved. Please try again."}),
        });
      } finally {
        savingRef.current = false;
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [isValid, userId, dispatch, showAlert, t],
  );

  const toggleCategorySelection = useCallback(
    (category: DebtCategory) => {
      if (selectedCategories.some(c => c.name === category.name)) {
        setSelectedCategories([]);
      } else {
        setSelectedCategories([category]);
      }
    },
    [selectedCategories],
  );

  const handleAddDebtor = useCallback(async () => {
    await saveDebtor(() =>
      createDebtor(
        debtorTitle,
        userId,
        selectedCategories[0]?.icon ?? null,
        selectedCategories[0]?.name ?? '',
        selectedCategories[0]?.color ?? null,
      ),
    );
  }, [debtorTitle, userId, selectedCategories, saveDebtor]);

  const handleUpdateDebtor = useCallback(async () => {
    if (!debtorData?.debtorId) {
      return;
    }
    const debtorId = debtorData.debtorId;
    await saveDebtor(
      () =>
        updateDebtorById(
          debtorId,
          debtorTitle,
          selectedCategories[0]?.name ?? '',
          selectedCategories[0]?.icon,
          selectedCategories[0]?.color,
        ),
      debtorId,
    );
  }, [debtorData?.debtorId, debtorTitle, selectedCategories, saveDebtor]);

  return (
    <PrimaryView colors={colors} style={gs.justifyBetween} dismissKeyboardOnTouch>
      <View>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader
            onPress={goBack}
            colors={colors}
            text={isAddButton ? t('debtor.addTitle') : t('debtor.editTitle')}
          />
        </View>

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
          {t('debtor.typeLabel')}
        </PrimaryText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={gs.mb15}>
          <CategoryContainer
            categories={debtCategories}
            colors={colors}
            toggleCategorySelection={toggleCategorySelection}
            selectedCategories={selectedCategories}
          />
        </ScrollView>

        <CustomInput
          colors={colors}
          input={debtorTitle}
          setInput={setDebtorTitle}
          placeholder={t('debtor.namePlaceholder')}
          label={t('debtor.nameLabel')}
          schema={nameSchema}
        />
      </View>
      <PrimaryButton
        onPress={isAddButton ? handleAddDebtor : handleUpdateDebtor}
        colors={colors}
        buttonTitle={isAddButton ? t('common.add') : t('common.update')}
        loading={saving}
        disabled={saving || !isValid}
      />
    </PrimaryView>
  );
};

export default memo(DebtorEntry);
