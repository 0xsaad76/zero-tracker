import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import useThemeColors from '../../hooks/useThemeColors';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {fetchDebtsByDebtor, selectDebtData, fetchAllDebts} from '../../redux/slice/debtDataSlice';
import {goBack, navigate} from '../../utils/navigationUtils';
import {deleteAllDebtsByDebtorId, deleteDebtById, deleteDebtorById} from '../../cloud';
import {RouteProp, useFocusEffect} from '@react-navigation/native';
import {fetchDebtors} from '../../redux/slice/debtorDataSlice';
import {sortByDateDesc} from '../../utils/dateUtils';
import {DebtData as DebtDocType} from '../../cloud';
import {
  clearIndividualDebtor,
  fetchIndividualDebtor,
  selectIndividualDebtorData,
} from '../../redux/slice/IndividualDebtorSlice';
import {useDialog} from '../../context/DialogContext';
import {useTranslation} from 'react-i18next';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {requireCloudUser} from '../../cloud/records';

export type IndividualDebtsScreenRouteProp = RouteProp<
  {
    IndividualDebtsScreen: {
      debtorName: string;
      debtorId: string;
      debtorType: string;
    };
  },
  'IndividualDebtsScreen'
>;

const useIndividualDebts = (route: IndividualDebtsScreenRouteProp) => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const {showDialog, showAlert} = useDialog();
  const {t} = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const userId = useAppSelector(selectUserId);
  const destructiveActionRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const showMutationFailure = useCallback(
    async (capturedUserId: string) => {
      if (!mountedRef.current) {
        return;
      }
      try {
        requireCloudUser(capturedUserId);
      } catch {
        return;
      }
      await showAlert({
        type: 'error',
        message: 'Could not complete the change. Check your connection and try again.',
      });
    },
    [showAlert],
  );
  const individualDebts = useAppSelector(selectDebtData) as DebtDocType[];
  const {debtorId = '', debtorType = '', debtorName: routeDebtorName = ''} = route.params ?? {};
  const individualDebtor = useAppSelector(selectIndividualDebtorData);
  // The store is cleared on focus so the previous debtor never flashes; use the
  // route param until the fetch lands, otherwise the header renders empty.
  const debtorName = individualDebtor?.title ?? routeDebtorName;

  const {sortedBorrowings, sortedLendings, totalBorrowings, totalLendings, debtorTotal} = useMemo(() => {
    const sorted = sortByDateDesc(individualDebts);
    const borrowings = sorted.filter((debt: DebtDocType) => debt.type === 'Borrow');
    const lendings = sorted.filter((debt: DebtDocType) => debt.type === 'Lend');

    const borrowingsTotal = borrowings.reduce((total: number, debt: DebtDocType) => total + debt.amount, 0);
    const lendingsTotal = lendings.reduce((total: number, debt: DebtDocType) => total + debt.amount, 0);

    return {
      sortedBorrowings: borrowings,
      sortedLendings: lendings,
      totalBorrowings: borrowingsTotal,
      totalLendings: lendingsTotal,
      debtorTotal: borrowingsTotal - lendingsTotal,
    };
  }, [individualDebts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const handleEditDebt = useCallback(
    (debtId: string, debtDescription: string, amount: number, debtDate: string, debtType: string) => {
      navigate('UpdateDebtScreen', {
        debtId,
        debtDescription,
        amount,
        debtorName,
        debtDate,
        debtorId,
        debtType,
      });
    },
    [debtorId, debtorName],
  );

  const handleDeleteDebt = useCallback(
    async (debtId: string) => {
      if (destructiveActionRef.current || !mountedRef.current) {
        return;
      }
      destructiveActionRef.current = true;
      const capturedUserId = userId;
      try {
        requireCloudUser(capturedUserId);
        // Unlike transactions, a deleted debt has no undo window — confirm first.
        const confirmed = await showDialog({
          type: 'warning',
          message: t('debt.deleteConfirm'),
        });
        if (!confirmed || !mountedRef.current) {
          return;
        }
        requireCloudUser(capturedUserId);
        await deleteDebtById(debtId);
        requireCloudUser(capturedUserId);
        if (!mountedRef.current) {
          return;
        }
        dispatch(fetchDebtsByDebtor(debtorId));
        dispatch(fetchAllDebts());
      } catch {
        await showMutationFailure(capturedUserId);
      } finally {
        destructiveActionRef.current = false;
      }
    },
    [debtorId, dispatch, showDialog, showMutationFailure, t, userId],
  );

  /**
   * Deletes the debtor and, via the cascading service, every debt they hold.
   * Previously this only settled the debts when any existed, which made the
   * trash button behave identically to "mark as paid" and left the debtor
   * behind.
   */
  const handleDeleteDebtor = useCallback(async () => {
    if (destructiveActionRef.current || !mountedRef.current) {
      return;
    }
    destructiveActionRef.current = true;
    const capturedUserId = userId;
    try {
      requireCloudUser(capturedUserId);
      const hasDebts = individualDebts.length > 0;
      const confirmed = await showDialog({
        type: 'warning',
        message: hasDebts
          ? t('debtor.deleteWithDebtsConfirm', {name: debtorName})
          : t('debtor.deleteConfirm', {name: debtorName}),
      });
      if (!confirmed || !mountedRef.current) {
        return;
      }
      requireCloudUser(capturedUserId);
      await deleteDebtorById(debtorId);
      requireCloudUser(capturedUserId);
      if (!mountedRef.current) {
        return;
      }
      dispatch(fetchDebtors());
      dispatch(fetchAllDebts());
      goBack();
    } catch {
      await showMutationFailure(capturedUserId);
    } finally {
      destructiveActionRef.current = false;
    }
  }, [debtorId, debtorName, dispatch, individualDebts.length, showDialog, showMutationFailure, t, userId]);

  const handleMarkAsPaid = useCallback(async () => {
    if (destructiveActionRef.current || !mountedRef.current) {
      return;
    }
    destructiveActionRef.current = true;
    const capturedUserId = userId;
    try {
      requireCloudUser(capturedUserId);
      const confirmed = await showDialog({
        type: 'success',
        message: t('debts.settleConfirm', {name: debtorName}),
      });
      if (!confirmed || !mountedRef.current) {
        return;
      }
      requireCloudUser(capturedUserId);
      await deleteAllDebtsByDebtorId(debtorId);
      requireCloudUser(capturedUserId);
      if (!mountedRef.current) {
        return;
      }
      dispatch(fetchDebtsByDebtor(debtorId));
      dispatch(fetchAllDebts());
    } catch {
      await showMutationFailure(capturedUserId);
    } finally {
      destructiveActionRef.current = false;
    }
  }, [debtorId, debtorName, dispatch, showDialog, showMutationFailure, t, userId]);

  const handleUpdateDebtor = useCallback(() => {
    navigate('UpdateDebtorScreen', {debtorId, debtorName, debtorType});
  }, [debtorId, debtorName, debtorType]);

  useFocusEffect(
    useCallback(() => {
      dispatch(clearIndividualDebtor());
      dispatch(fetchDebtsByDebtor(debtorId));
      dispatch(fetchIndividualDebtor(debtorId));
    }, [debtorId, dispatch]),
  );

  useEffect(() => {
    if (!refreshing) return;

    let cancelled = false;
    Promise.all([dispatch(fetchDebtsByDebtor(debtorId)), dispatch(fetchIndividualDebtor(debtorId))]).finally(() => {
      if (!cancelled) setRefreshing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch, debtorId, refreshing]);

  return {
    colors,
    refreshing,
    debtorName,
    debtorId,
    debtorTotal,
    onRefresh,
    handleEditDebt,
    handleDeleteDebt,
    handleDeleteDebtor,
    handleMarkAsPaid,
    handleUpdateDebtor,
    sortedBorrowings,
    sortedLendings,
    totalBorrowings,
    totalLendings,
  };
};

export default useIndividualDebts;
